package graphql

import (
	"context"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"time"
)

// ExponentialBackoff defines the configuration for exponential backoff retry mechanism
type ExponentialBackoff struct {
	// InitialDelay is the delay for the first retry attempt
	InitialDelay time.Duration
	// MaxDelay is the maximum delay between retry attempts
	MaxDelay time.Duration
	// Factor is the multiplier for each subsequent retry delay
	Factor float64
	// Jitter is the randomization factor (0-1) to add to the delay
	Jitter float64
}

// DefaultBackoff returns the default exponential backoff configuration
func DefaultBackoff() ExponentialBackoff {
	return ExponentialBackoff{
		InitialDelay: 1 * time.Second,
		MaxDelay:     60 * time.Second,
		Factor:       2.0,
		Jitter:       0.1,
	}
}

// calculateDelay calculates the delay for a given attempt number
func (b ExponentialBackoff) calculateDelay(attempt int) time.Duration {
	// Calculate base delay with exponential increase
	delay := float64(b.InitialDelay) * math.Pow(b.Factor, float64(attempt))

	// Apply jitter
	if b.Jitter > 0 {
		jitter := (rand.Float64() * 2 - 1) * b.Jitter
		delay = delay * (1 + jitter)
	}

	// Ensure delay doesn't exceed max delay
	if delay > float64(b.MaxDelay) {
		delay = float64(b.MaxDelay)
	}

	return time.Duration(delay)
}

// doRequestWithBackoff executes a request with exponential backoff retry mechanism
func (c *Client) doRequestWithBackoff(ctx context.Context, req *http.Request) (*http.Response, error) {
	backoff := DefaultBackoff()
	attempt := 0

	for {
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, err
		}

		// Check if we need to retry based on rate limit headers
		if resp.StatusCode != http.StatusTooManyRequests {
			return resp, nil
		}

		// Get rate limit reset time from headers
		resetStr := resp.Header.Get("x-rate-limit-reset")
		if resetStr != "" {
			resetTime, err := strconv.ParseInt(resetStr, 10, 64)
			if err == nil {
				// Calculate wait time based on rate limit reset
				waitTime := time.Until(time.Unix(resetTime, 0))
				if waitTime > 0 {
					select {
					case <-ctx.Done():
						return nil, ctx.Err()
					case <-time.After(waitTime):
						continue
					}
				}
			}
		}

		// Use exponential backoff if rate limit headers are not available
		delay := backoff.calculateDelay(attempt)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
			attempt++
			continue
		}
	}
}
