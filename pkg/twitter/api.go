package twitter

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/dghubble/oauth1"
)

const (
	getTweetURL   = "https://api.x.com/2/tweets/%d?tweet.fields=text"
	replyTweetURL = "https://api.twitter.com/2/tweets/%d/reply"

	backoffMaxElapsedTime  = 15 * time.Minute
	backoffInitialInterval = 1 * time.Second
	backoffMaxInterval     = 5 * time.Minute

	replyMaxSize = 280
)

type TwitterApiClient struct {
	client *http.Client
	mu     sync.RWMutex
	reset  time.Time
}

var _ TwitterClient = (*TwitterApiClient)(nil)

func NewTwitterApiClient() *TwitterApiClient {
	return &TwitterApiClient{
		reset: time.Now(),
	}
}

func (c *TwitterApiClient) Initialize(config *TwitterClientConfig) error {
	oauthConfig := oauth1.NewConfig(config.ConsumerKey, config.ConsumerSecret)
	oauthToken := oauth1.NewToken(config.AccessToken, config.AccessTokenSecret)
	client := oauthConfig.Client(oauth1.NoContext, oauthToken)

	c.client = client

	return nil
}

func (c *TwitterApiClient) waitForRateLimit() {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if time.Now().Before(c.reset) {
		time.Sleep(time.Until(c.reset))
	}
}

func (c *TwitterApiClient) updateRateLimits(resp *http.Response) {
	c.mu.Lock()
	defer c.mu.Unlock()

	slog.Info(
		"x api rate limits",
		"limit", resp.Header.Get("x-rate-limit-limit"),
		"remaining", resp.Header.Get("x-rate-limit-remaining"),
		"reset", resp.Header.Get("x-rate-limit-reset"),
	)

	if resetStr := resp.Header.Get("x-rate-limit-reset"); resetStr != "" {
		if resetTime, err := strconv.ParseInt(resetStr, 10, 64); err == nil {
			c.reset = time.Unix(resetTime, 0)
		}
	}
}

func (c *TwitterApiClient) doWithRetry(req *http.Request) (*http.Response, error) {
	b := backoff.NewExponentialBackOff()
	b.MaxElapsedTime = backoffMaxElapsedTime
	b.InitialInterval = backoffInitialInterval
	b.MaxInterval = backoffMaxInterval

	var resp *http.Response
	var err error

	operation := func() error {
		c.waitForRateLimit()

		resp, err = c.client.Do(req)
		if err != nil {
			resp.Body.Close()
			return err
		}

		c.updateRateLimits(resp)

		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			return fmt.Errorf("rate limit exceeded")
		}

		return nil
	}

	err = backoff.Retry(operation, b)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (c *TwitterApiClient) GetTweetText(tweetID uint64) (string, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf(getTweetURL, tweetID), nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}

	resp, err := c.doWithRetry(req)
	if err != nil {
		return "", fmt.Errorf("failed to get tweet by id: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to get tweet by id: %v", resp.Status)
	}

	type tweet struct {
		Data struct {
			Text string `json:"text"`
		} `json:"data"`
	}

	var data tweet
	err = json.NewDecoder(resp.Body).Decode(&data)
	if err != nil {
		return "", fmt.Errorf("failed to decode tweet: %v", err)
	}

	return data.Data.Text, nil
}

func (c *TwitterApiClient) ReplyToTweet(tweetID uint64, reply string) error {
	slog.Info("replying to tweet", "tweet_id", tweetID, "reply", reply)

	if len(reply) > replyMaxSize {
		reply = reply[:replyMaxSize]
	}

	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf(replyTweetURL, tweetID), strings.NewReader(reply))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.doWithRetry(req)
	if err != nil {
		return fmt.Errorf("failed to r to tweet: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to reply to tweet: %v", resp.Status)
	}

	return nil
}
