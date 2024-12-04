package twitter

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"sync"

	"github.com/dghubble/oauth1"
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

	url string

	twitterAppKey    string
	twitterAppSecret string

	shutdownCh chan struct{}

	tokenPairMutex sync.Mutex
	tokenPair      *OAuthTokenPair
}

func NewTwitterLoginServer(url string, twitterAppKey, twitterAppSecret string) *TwitterLoginServer {
	return &TwitterLoginServer{
		url:              url,
		shutdownCh:       make(chan struct{}),
		twitterAppKey:    twitterAppKey,
		twitterAppSecret: twitterAppSecret,
	}
}

func (s *TwitterLoginServer) GetLoginRoute() string {
	return "http://" + s.url + loginRoute
}

func (s *TwitterLoginServer) GetCallbackRoute() string {
	return "http://" + s.url + callbackRoute
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
		Addr:    s.url,
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
		c.String(http.StatusInternalServerError, fmt.Sprintf("Failed to request OAuth token: %v", err))
		return
	}

	s.tokenPairMutex.Lock()
	s.tokenPair = tokenPair
	s.tokenPairMutex.Unlock()

	authURL := fmt.Sprintf("https://api.twitter.com/oauth/authenticate?oauth_token=%s", s.tokenPair.Token)
	slog.Info("redirecting to Twitter", "url", authURL)
	c.Redirect(http.StatusTemporaryRedirect, authURL)
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
	OAuthToken             string `json:"oauth_token"`
	OAuthTokenSecret       string `json:"oauth_token_secret"`
	OAuthCallbackConfirmed bool   `json:"oauth_callback_confirmed"`
}

type AccessTokenResponse struct {
	OAuthToken       string `json:"oauth_token"`
	OAuthTokenSecret string `json:"oauth_token_secret"`
	// UserID           uint64 `json:"user_id,string"`
	// ScreenName       string `json:"screen_name"`
}

func (s *TwitterLoginServer) requestOAuthToken(appKey, appSecret string) (*OAuthTokenPair, error) {
	config := oauth1.NewConfig(appKey, appSecret)

	client := config.Client(oauth1.NoContext, nil)

	params := url.Values{}
	params.Set("oauth_callback", s.GetCallbackRoute())

	req, err := http.NewRequest("POST", "https://api.twitter.com/oauth/request_token", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	req.URL.RawQuery = params.Encode()

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	values, err := url.ParseQuery(string(body))
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %v", err)
	}

	response := &RequestTokenResponse{
		OAuthToken:             values.Get("oauth_token"),
		OAuthTokenSecret:       values.Get("oauth_token_secret"),
		OAuthCallbackConfirmed: values.Get("oauth_callback_confirmed") == "true",
	}

	if !response.OAuthCallbackConfirmed {
		return nil, fmt.Errorf("oauth callback not confirmed")
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

	config := oauth1.NewConfig(appKey, appSecret)
	token := oauth1.NewToken(tokenPair.Token, tokenPair.Secret)

	client := config.Client(oauth1.NoContext, token)

	params := url.Values{}
	params.Set("oauth_verifier", oauthVerifier)

	req, err := http.NewRequest("POST", "https://api.twitter.com/oauth/access_token", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	req.URL.RawQuery = params.Encode()

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	values, err := url.ParseQuery(string(body))
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %v", err)
	}

	response := &AccessTokenResponse{
		OAuthToken:       values.Get("oauth_token"),
		OAuthTokenSecret: values.Get("oauth_token_secret"),
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
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("request failed with status %d", resp.StatusCode)
	}

	return nil
}
