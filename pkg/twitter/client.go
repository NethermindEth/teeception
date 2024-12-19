package twitter

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/dghubble/oauth1"
	"golang.org/x/time/rate"
)

type TwitterConfig struct {
	AppKey           string
	AppSecret        string
	AccessToken      string
	AccessSecret     string
	BearerToken      string
	RateLimitWindow  time.Duration
	RateLimitTokens  int
	Username         string
}

// TwitterClient is the main client for interacting with Twitter
type TwitterClient struct {
	config      *TwitterConfig
	client      *http.Client
	rateLimiter *rate.Limiter
}

// NewTwitterClient creates a new TwitterClient with the provided configuration
func NewTwitterClient(config *TwitterConfig) (*TwitterClient, error) {
	if config == nil {
		return nil, ErrInvalidConfig
	}

	// Check required credentials
	if config.AppKey == "" || config.AppSecret == "" {
		return nil, ErrMissingAppCredentials
	}

	if config.AccessToken == "" || config.AccessSecret == "" {
		return nil, ErrMissingAccessCredentials
	}

	if config.Username == "" {
		return nil, ErrMissingUsername
	}

	// Set default rate limiting if not configured
	if config.RateLimitWindow == 0 {
		config.RateLimitWindow = 15 * time.Minute
	}
	if config.RateLimitTokens == 0 {
		config.RateLimitTokens = 50
	}

	// Create oauth1 config and client
	oauthConfig := oauth1.NewConfig(config.AppKey, config.AppSecret)
	client := oauthConfig.Client(oauth1.NoContext, oauth1.NewToken(config.AccessToken, config.AccessSecret))

	return &TwitterClient{
		config: config,
		client: client,
		rateLimiter: rate.NewLimiter(
			rate.Every(config.RateLimitWindow/time.Duration(config.RateLimitTokens)),
			config.RateLimitTokens,
		),
	}, nil
}

// doRequest executes an HTTP request with rate limiting and retries
func (c *TwitterClient) doRequest(ctx context.Context, req *http.Request) (*http.Response, error) {
	// Wait for rate limiter
	if err := c.rateLimiter.Wait(ctx); err != nil {
		if err == context.DeadlineExceeded || err == context.Canceled {
			return nil, err
		}
		return nil, fmt.Errorf("rate limit wait: %w", err)
	}

	var lastErr error
	maxRetries := 3
	backoff := 1 * time.Second

	for attempt := 0; attempt < maxRetries; attempt++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			// Execute request
			resp, err := c.client.Do(req)
			if err != nil {
				if err == context.DeadlineExceeded || err == context.Canceled {
					return nil, err
				}
				lastErr = fmt.Errorf("attempt %d failed: %w", attempt+1, err)
				// Only retry on network errors
				if attempt < maxRetries-1 {
					time.Sleep(backoff)
					backoff *= 2 // Exponential backoff
					continue
				}
				return nil, fmt.Errorf("%w: %v", ErrMaxRetriesExceeded, lastErr)
			}

			// Handle rate limiting (HTTP 429)
			if resp.StatusCode == http.StatusTooManyRequests {
				resetStr := resp.Header.Get("x-rate-limit-reset")
				if resetStr != "" {
					resetTime, err := strconv.ParseInt(resetStr, 10, 64)
					if err == nil {
						waitDuration := time.Until(time.Unix(resetTime, 0))
						if waitDuration > 0 {
							resp.Body.Close()
							select {
							case <-ctx.Done():
								return nil, ctx.Err()
							case <-time.After(waitDuration):
								continue // Retry after waiting
							}
						}
					}
				}
				// If we couldn't parse the reset time, fall back to exponential backoff
				resp.Body.Close()
				if attempt < maxRetries-1 {
					time.Sleep(backoff)
					backoff *= 2
					continue
				}
			}

			// Check if we should retry based on status code
			if resp.StatusCode >= 500 && attempt < maxRetries-1 {
				resp.Body.Close()
				lastErr = fmt.Errorf("attempt %d failed: server error %d", attempt+1, resp.StatusCode)
				time.Sleep(backoff)
				backoff *= 2 // Exponential backoff
				continue
			}

			return resp, nil
		}
	}

	return nil, fmt.Errorf("%w: %v", ErrMaxRetriesExceeded, lastErr)
}
