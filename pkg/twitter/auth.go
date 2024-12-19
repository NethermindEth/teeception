package twitter

import (
	"context"
	"net/http"
	"net/http/cookiejar"
	"net/url"

	"github.com/dghubble/oauth1"
	"github.com/g8rswimmer/go-twitter/v2"
)

type TwitterAuth struct {
	bearerToken string
	cookieJar   *cookiejar.Jar
	v2Client    *twitter.Client
	httpClient  *http.Client
}

func NewTwitterAuth(bearerToken string) (*TwitterAuth, error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{
		Jar: jar,
	}

	return &TwitterAuth{
		bearerToken: bearerToken,
		cookieJar:   jar,
		httpClient:  client,
	}, nil
}

func (a *TwitterAuth) LoginWithV2(appKey, appSecret, accessToken, accessSecret string) error {
	config := oauth1.NewConfig(appKey, appSecret)
	token := oauth1.NewToken(accessToken, accessSecret)
	httpClient := config.Client(context.Background(), token)

	a.v2Client = &twitter.Client{
		Authorizer: &twitter.BearerTokenAuthorizer{
			Token: a.bearerToken,
		},
		Client: httpClient,
		Host:   "https://api.twitter.com",
	}

	return nil
}

func (a *TwitterAuth) GetBearerToken() string {
	return a.bearerToken
}

func (a *TwitterAuth) GetV2Client() *twitter.Client {
	return a.v2Client
}

func (a *TwitterAuth) GetHTTPClient() *http.Client {
	return a.httpClient
}

func (a *TwitterAuth) GetCookies(urlStr string) []*http.Cookie {
	if u, err := url.Parse(urlStr); err == nil {
		return a.cookieJar.Cookies(u)
	}
	return nil
}

func (a *TwitterAuth) SetCookies(urlStr string, cookies []*http.Cookie) error {
	u, err := url.Parse(urlStr)
	if err != nil {
		return err
	}
	a.cookieJar.SetCookies(u, cookies)
	return nil
}
