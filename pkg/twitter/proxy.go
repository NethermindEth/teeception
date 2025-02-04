package twitter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
)

type TwitterProxy struct {
	httpClient *http.Client
	url        string
}

var _ TwitterClient = (*TwitterProxy)(nil)

func NewTwitterProxy(url string, client *http.Client) *TwitterProxy {
	return &TwitterProxy{
		httpClient: client,
		url:        url,
	}
}

func (p *TwitterProxy) Initialize(config *TwitterClientConfig) error {
	body := map[string]string{
		"username":          config.Username,
		"password":          config.Password,
		"consumerKey":       config.ConsumerKey,
		"consumerSecret":    config.ConsumerSecret,
		"accessToken":       config.AccessToken,
		"accessTokenSecret": config.AccessTokenSecret,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal body: %w", err)
	}

	resp, err := p.httpClient.Post(fmt.Sprintf("%s/initialize", p.url), "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to initialize (status %d), and failed to read response body: %w", resp.StatusCode, err)
		}
		return fmt.Errorf("failed to initialize (status %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

func (p *TwitterProxy) GetTweetText(tweetID uint64) (string, error) {
	resp, err := p.httpClient.Get(fmt.Sprintf("%s/tweet/%d", p.url, tweetID))
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to get tweet: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	return string(body), nil
}

func (p *TwitterProxy) ReplyToTweet(tweetID uint64, reply string) error {
	slog.Info("replying to tweet", "tweet_id", tweetID, "reply", reply)

	body := map[string]string{
		"reply": reply,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal body: %w", err)
	}

	resp, err := p.httpClient.Post(fmt.Sprintf("%s/reply/%d", p.url, tweetID), "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to reply to tweet: %d", resp.StatusCode)
	}

	return nil
}
