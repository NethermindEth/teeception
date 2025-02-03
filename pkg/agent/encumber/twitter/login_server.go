package twitter

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sync"

	"github.com/NethermindEth/teeception/pkg/agent/debug"
	"github.com/dghubble/oauth1"
	twauth "github.com/dghubble/oauth1/twitter"
	"github.com/gin-gonic/gin"
)

const (
	twitterApiUrl = "https://api.twitter.com"
	loginRoute    = "/login"
	callbackRoute = "/callback"
)

type CallbackQuery struct {
	OAuthToken    string `form:"oauth_token"`
	OAuthVerifier string `form:"oauth_verifier"`
}

type TwitterLoginServer struct {
	server *http.Server

	ip   string
	port string

	twitterAppKey    string
	twitterAppSecret string

	shutdownCh chan struct{}

	requestTokenPairMutex sync.Mutex
	requestTokenPair      *oauth1.Token

	tokenPairMutex sync.Mutex
	tokenPair      *oauth1.Token
}

func NewTwitterLoginServer(ip, port string, twitterAppKey, twitterAppSecret string) *TwitterLoginServer {
	return &TwitterLoginServer{
		ip:               ip,
		port:             port,
		shutdownCh:       make(chan struct{}),
		twitterAppKey:    twitterAppKey,
		twitterAppSecret: twitterAppSecret,
	}
}

func (s *TwitterLoginServer) GetLoginRoute() string {
	return "http://" + s.ip + ":" + s.port + loginRoute
}

func (s *TwitterLoginServer) GetCallbackRoute() string {
	return "http://" + s.ip + ":" + s.port + callbackRoute
}

func (s *TwitterLoginServer) WaitForTokenPair(ctx context.Context) (*oauth1.Token, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-s.shutdownCh:
	}

	s.tokenPairMutex.Lock()
	tokenPair := s.tokenPair
	s.tokenPairMutex.Unlock()

	return tokenPair, nil
}

func (s *TwitterLoginServer) Start() {
	router := gin.Default()

	router.GET(loginRoute, s.handleLogin)
	router.GET(callbackRoute, s.handleCallback)

	s.server = &http.Server{
		Addr:    "0.0.0.0:" + s.port,
		Handler: router,
	}

	go func() {
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
		}
	}()
}

func (s *TwitterLoginServer) shutdown() error {
	if s.server != nil {
		if err := s.server.Shutdown(context.Background()); err != nil {
			return fmt.Errorf("server shutdown error: %v", err)
		}
	}
	close(s.shutdownCh)
	return nil
}

func (s *TwitterLoginServer) handleLogin(c *gin.Context) {
	slog.Info("login request received")

	requestTokenPair, err := s.requestOAuthToken(s.twitterAppKey, s.twitterAppSecret)
	if err != nil {
		slog.Error("failed to request OAuth token", "error", err)
		c.String(http.StatusInternalServerError, fmt.Sprintf("Failed to request OAuth token: %v", err))
		return
	}

	if debug.IsDebugShowPassword() {
		slog.Info("requested OAuth token", "token", requestTokenPair.Token, "secret", requestTokenPair.TokenSecret)
	}

	s.requestTokenPairMutex.Lock()
	s.requestTokenPair = requestTokenPair
	s.requestTokenPairMutex.Unlock()

	config := oauth1.Config{
		ConsumerKey:    s.twitterAppKey,
		ConsumerSecret: s.twitterAppSecret,
		CallbackURL:    s.GetCallbackRoute(),
		Endpoint:       twauth.AuthorizeEndpoint,
	}

	authorizationURL, err := config.AuthorizationURL(requestTokenPair.Token)
	if err != nil {
		slog.Error("failed to get authorization URL", "error", err)
		c.String(http.StatusInternalServerError, fmt.Sprintf("Failed to get authorization URL: %v", err))
		return
	}

	if debug.IsDebugShowPassword() {
		slog.Info("got authorization URL", "url", authorizationURL.String())
	}

	slog.Info("redirecting to Twitter", "url", authorizationURL.String())
	c.Redirect(http.StatusTemporaryRedirect, authorizationURL.String())
}

func (s *TwitterLoginServer) handleCallback(c *gin.Context) {
	var query CallbackQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.String(http.StatusBadRequest, fmt.Sprintf("Invalid callback query: %v", err))
		return
	}

	slog.Info("callback received")

	err := func() error {
		s.requestTokenPairMutex.Lock()
		defer s.requestTokenPairMutex.Unlock()

		if s.requestTokenPair == nil {
			return fmt.Errorf("no token pair found")
		}

		if query.OAuthToken != s.requestTokenPair.Token {
			return fmt.Errorf("oauth token mismatch")
		}

		return nil
	}()
	if err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	tokenPair, err := s.authorizeToken(s.twitterAppKey, s.twitterAppSecret, query.OAuthVerifier)
	if err != nil {
		slog.Error("failed to authorize token", "error", err)
		c.String(http.StatusInternalServerError, fmt.Sprintf("Failed to authorize token: %v", err))
		return
	}

	if debug.IsDebugShowPassword() {
		slog.Info("authorized token", "token", tokenPair.Token, "secret", tokenPair.TokenSecret)
	}

	err = s.validateAccessToken(tokenPair)
	if err != nil {
		slog.Error("failed to validate access token", "error", err)
	} else {
		c.String(http.StatusOK, "Successfully logged in")
	}

	s.tokenPairMutex.Lock()
	s.tokenPair = tokenPair
	s.tokenPairMutex.Unlock()

	go func() {
		if err := s.shutdown(); err != nil {
			slog.Error("failed to shutdown twitter login server", "error", err)
		}
	}()
}

func (s *TwitterLoginServer) requestOAuthToken(appKey, appSecret string) (*oauth1.Token, error) {
	config := oauth1.Config{
		ConsumerKey:    appKey,
		ConsumerSecret: appSecret,
		CallbackURL:    s.GetCallbackRoute(),
		Endpoint:       twauth.AuthorizeEndpoint,
	}

	requestToken, requestSecret, err := config.RequestToken()
	if err != nil {
		slog.Error("failed to get request token", "error", err)
		return nil, err
	}

	return oauth1.NewToken(requestToken, requestSecret), nil
}

func (s *TwitterLoginServer) authorizeToken(appKey, appSecret, oauthVerifier string) (*oauth1.Token, error) {
	s.requestTokenPairMutex.Lock()
	requestTokenPair := s.requestTokenPair
	s.requestTokenPairMutex.Unlock()

	config := oauth1.Config{
		ConsumerKey:    appKey,
		ConsumerSecret: appSecret,
		CallbackURL:    s.GetCallbackRoute(),
		Endpoint:       twauth.AuthorizeEndpoint,
	}

	accessToken, accessSecret, err := config.AccessToken(requestTokenPair.Token, requestTokenPair.TokenSecret, oauthVerifier)
	if err != nil {
		slog.Error("failed to get access token", "error", err)
		return nil, err
	}

	if debug.IsDebugShowPassword() {
		slog.Info("got access token", "token", accessToken, "secret", accessSecret)
	}

	return oauth1.NewToken(accessToken, accessSecret), nil
}

func (s *TwitterLoginServer) validateAccessToken(token *oauth1.Token) error {
	client := oauth1.NewConfig(s.twitterAppKey, s.twitterAppSecret).
		Client(oauth1.NoContext, token)

	resp, err := client.Get("https://api.twitter.com/2/users/me?user.fields=profile_image_url,most_recent_tweet_id")
	if err != nil {
		slog.Error("failed to send request", "error", err)
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		slog.Error("request failed", "status", resp.StatusCode)
		return fmt.Errorf("request failed with status %d", resp.StatusCode)
	}

	return nil
}
