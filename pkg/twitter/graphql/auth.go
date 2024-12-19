package graphql

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
)

// AuthClient handles Twitter authentication
type AuthClient struct {
	client      *http.Client
	bearerToken string
	guestToken  string
	csrfToken   string
	cookies     []*http.Cookie
	mu          sync.RWMutex
}

// NewAuthClient creates a new authentication client
func NewAuthClient(client *http.Client, bearerToken string) *AuthClient {
	if client == nil {
		client = http.DefaultClient
	}
	return &AuthClient{
		client:      client,
		bearerToken: bearerToken,
	}
}

// refreshGuestToken refreshes the guest token
func (a *AuthClient) refreshGuestToken(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.twitter.com/1.1/guest/activate.json", nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", a.bearerToken))

	resp, err := a.client.Do(req)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		GuestToken string `json:"guest_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	a.mu.Lock()
	a.guestToken = result.GuestToken
	a.mu.Unlock()

	return nil
}

// updateCSRFToken updates the CSRF token from cookies
func (a *AuthClient) updateCSRFToken() {
	a.mu.RLock()
	defer a.mu.RUnlock()

	for _, cookie := range a.cookies {
		if cookie.Name == "ct0" {
			a.csrfToken = cookie.Value
			break
		}
	}
}

// SetCookies updates the stored cookies
func (a *AuthClient) SetCookies(cookies []*http.Cookie) {
	a.mu.Lock()
	a.cookies = cookies
	a.mu.Unlock()
	a.updateCSRFToken()
}

// GetAuthHeaders returns the required authentication headers
func (a *AuthClient) GetAuthHeaders() http.Header {
	a.mu.RLock()
	defer a.mu.RUnlock()

	headers := make(http.Header)
	headers.Set("Authorization", fmt.Sprintf("Bearer %s", a.bearerToken))

	if a.guestToken != "" {
		headers.Set("X-Guest-Token", a.guestToken)
	}

	if a.csrfToken != "" {
		headers.Set("X-Csrf-Token", a.csrfToken)
	}

	// Add cookie header if we have cookies
	if len(a.cookies) > 0 {
		var cookieStrs []string
		for _, cookie := range a.cookies {
			cookieStrs = append(cookieStrs, cookie.String())
		}
		headers.Set("Cookie", strings.Join(cookieStrs, "; "))
	}

	return headers
}

// EnsureGuestToken ensures a valid guest token exists
func (a *AuthClient) EnsureGuestToken(ctx context.Context) error {
	a.mu.RLock()
	hasToken := a.guestToken != ""
	a.mu.RUnlock()

	if !hasToken {
		return a.refreshGuestToken(ctx)
	}
	return nil
}

// UpdateClient updates the GraphQL client with current auth headers
func (a *AuthClient) UpdateClient(c *Client) {
	headers := a.GetAuthHeaders()
	for key, values := range headers {
		for _, value := range values {
			c.SetHeader(key, value)
		}
	}
}
