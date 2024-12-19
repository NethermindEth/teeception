package graphql

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// Client handles GraphQL requests to Twitter's API
type Client struct {
	httpClient *http.Client
	headers    http.Header
	auth       *AuthClient
}

// NewClient creates a new GraphQL client
func NewClient(httpClient *http.Client, auth *AuthClient) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		httpClient: httpClient,
		headers:    make(http.Header),
		auth:       auth,
	}
}

// SetHeader sets a header for all requests
func (c *Client) SetHeader(key, value string) {
	c.headers.Set(key, value)
}

// Do executes a GraphQL request
func (c *Client) Do(ctx context.Context, endpoint string, req *GraphQLRequest, resp interface{}) error {
	// Ensure we have a valid guest token before making the request
	if err := c.auth.EnsureGuestToken(ctx); err != nil {
		return fmt.Errorf("ensure guest token: %w", err)
	}

	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	// Set headers
	httpReq.Header = c.headers.Clone()
	httpReq.Header.Set("Content-Type", "application/json")

	// Update headers with current auth headers
	c.auth.UpdateClient(c)

	// Execute request with exponential backoff
	httpResp, err := c.doRequestWithBackoff(ctx, httpReq)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer httpResp.Body.Close()

	// Parse response
	var graphqlResp GraphQLResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&graphqlResp); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	// Check for GraphQL errors
	if len(graphqlResp.Errors) > 0 {
		// Check if error is auth-related and try to refresh
		if isAuthError(graphqlResp.Errors[0].Code) {
			if err := c.auth.refreshGuestToken(ctx); err != nil {
				return fmt.Errorf("refresh auth token: %w", err)
			}
			// Retry the request once with new token
			return c.Do(ctx, endpoint, req, resp)
		}
		return fmt.Errorf("graphql error: %s", graphqlResp.Errors[0].Message)
	}

	// Parse data into response type
	if resp != nil {
		// Create a wrapper with "data" field
		wrapper := map[string]json.RawMessage{
			"data": graphqlResp.Data,
		}
		// Marshal and unmarshal through the wrapper to handle nested data structure
		wrapperBytes, err := json.Marshal(wrapper)
		if err != nil {
			return fmt.Errorf("marshal response wrapper: %w", err)
		}
		if err := json.Unmarshal(wrapperBytes, resp); err != nil {
			return fmt.Errorf("unmarshal response data: %w", err)
		}
	}

	return nil
}

// isAuthError checks if the error code indicates an authentication issue
func isAuthError(code string) bool {
	authErrors := map[string]bool{
		"UNAUTHORIZED":        true,
		"INVALID_GUEST_TOKEN": true,
		"FORBIDDEN":          true,
	}
	return authErrors[code]
}
