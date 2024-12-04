package twitter

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sync"

	"github.com/dghubble/oauth1"
	twauth "github.com/dghubble/oauth1/twitter"
	"github.com/gin-gonic/gin"
)

const (
	twitterApiUrl = "https://api.twitter.com"
	loginRoute    = "/login"
	callbackRoute = "/callback"
)

type OAuthTokenPair struct {
	Token  string
	Secret string
}

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

	tokenPairMutex sync.Mutex
	tokenPair      *OAuthTokenPair
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

func (s *TwitterLoginServer) WaitForTokenPair(ctx context.Context) (*OAuthTokenPair, error) {
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

	tokenPair, err := s.requestOAuthToken(s.twitterAppKey, s.twitterAppSecret)
	if err != nil {
		slog.Error("failed to request OAuth token", "error", err)
		c.String(http.StatusInternalServerError, fmt.Sprintf("Failed to request OAuth token: %v", err))
		return
	}

	s.tokenPairMutex.Lock()
	s.tokenPair = tokenPair
	s.tokenPairMutex.Unlock()

	config := oauth1.Config{
		ConsumerKey:    s.twitterAppKey,
		ConsumerSecret: s.twitterAppSecret,
		CallbackURL:    s.GetCallbackRoute(),
		Endpoint:       twauth.AuthorizeEndpoint,
	}

	authorizationURL, err := config.AuthorizationURL(tokenPair.Token)
	if err != nil {
		slog.Error("failed to get authorization URL", "error", err)
		c.String(http.StatusInternalServerError, fmt.Sprintf("Failed to get authorization URL: %v", err))
		return
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
		s.tokenPairMutex.Lock()
		defer s.tokenPairMutex.Unlock()

		if s.tokenPair == nil {
			return fmt.Errorf("no token pair found")
		}

		if query.OAuthToken != s.tokenPair.Token {
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

	s.validateAccessToken(tokenPair)

	go func() {
		s.shutdown()
	}()

	c.String(http.StatusOK, "Successfully logged in")
}

type RequestTokenResponse struct {
	OAuthToken       string `json:"oauth_token"`
	OAuthTokenSecret string `json:"oauth_token_secret"`
}

type AccessTokenResponse struct {
	OAuthToken       string `json:"oauth_token"`
	OAuthTokenSecret string `json:"oauth_token_secret"`
	// UserID           uint64 `json:"user_id,string"`
	// ScreenName       string `json:"screen_name"`
}

func (s *TwitterLoginServer) requestOAuthToken(appKey, appSecret string) (*OAuthTokenPair, error) {
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

	response := &RequestTokenResponse{
		OAuthToken:       requestToken,
		OAuthTokenSecret: requestSecret,
	}

	return &OAuthTokenPair{
		Token:  response.OAuthToken,
		Secret: response.OAuthTokenSecret,
	}, nil
}

func (s *TwitterLoginServer) authorizeToken(appKey, appSecret, oauthVerifier string) (*OAuthTokenPair, error) {
	s.tokenPairMutex.Lock()
	tokenPair := s.tokenPair
	s.tokenPairMutex.Unlock()

	config := oauth1.Config{
		ConsumerKey:    appKey,
		ConsumerSecret: appSecret,
		CallbackURL:    s.GetCallbackRoute(),
		Endpoint:       twauth.AuthorizeEndpoint,
	}

	accessToken, accessSecret, err := config.AccessToken(tokenPair.Token, tokenPair.Secret, oauthVerifier)
	if err != nil {
		slog.Error("failed to get access token", "error", err)
		return nil, err
	}

	response := &AccessTokenResponse{
		OAuthToken:       accessToken,
		OAuthTokenSecret: accessSecret,
	}

	return &OAuthTokenPair{
		Token:  response.OAuthToken,
		Secret: response.OAuthTokenSecret,
	}, nil
}

func (s *TwitterLoginServer) validateAccessToken(tokenPair *OAuthTokenPair) error {
	client := oauth1.NewConfig(s.twitterAppKey, s.twitterAppSecret).
		Client(oauth1.NoContext, oauth1.NewToken(tokenPair.Token, tokenPair.Secret))

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
