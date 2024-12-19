package twitter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const (
	twitterAPIBaseURL      = "https://api.twitter.com/2"
	onboardingTaskEndpoint = "https://api.twitter.com/1.1/onboarding/task.json"
)

// TweetField represents available fields for tweet objects
type TweetField string

const (
	TweetFieldText              TweetField = "text"
	TweetFieldCreatedAt         TweetField = "created_at"
	TweetFieldAuthorID         TweetField = "author_id"
	TweetFieldConversationID   TweetField = "conversation_id"
	TweetFieldInReplyToUserID  TweetField = "in_reply_to_user_id"
	TweetFieldPublicMetrics    TweetField = "public_metrics"
)

var defaultTweetFields = []TweetField{
	TweetFieldText,
	TweetFieldCreatedAt,
	TweetFieldAuthorID,
	TweetFieldConversationID,
	TweetFieldInReplyToUserID,
	TweetFieldPublicMetrics,
}

// tweetRequest represents the request body for creating a tweet using v1.1 API
type tweetRequest struct {
	Text     string   `json:"text"`
	ReplyID  string   `json:"in_reply_to_status_id,omitempty"`
	MediaIDs []string `json:"media_ids,omitempty"`
}

func (c *TwitterClient) GetTweet(ctx context.Context, id string) (*Tweet, error) {
	url := fmt.Sprintf("%s/tweets/%s", twitterAPIBaseURL, id)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	// Add query parameters for tweet fields
	q := req.URL.Query()
	var fields []string
	for _, field := range defaultTweetFields {
		fields = append(fields, string(field))
	}
	q.Add("tweet.fields", strings.Join(fields, ","))
	req.URL.RawQuery = q.Encode()

	resp, err := c.doRequest(ctx, req)
	if err != nil {
		if err == context.DeadlineExceeded || err == context.Canceled {
			return nil, err
		}
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp ErrorResponse
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
			return nil, fmt.Errorf("decode error response: %w", err)
		}
		if len(errResp.Errors) > 0 {
			return nil, fmt.Errorf("twitter API error: %s", errResp.Errors[0].Message)
		}
		return nil, fmt.Errorf("twitter API error: status code %d", resp.StatusCode)
	}

	var result struct {
		Data *Tweet `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return result.Data, nil
}

// createTweet sends a tweet creation request to the v1.1 API
func (c *TwitterClient) createTweet(ctx context.Context, req *tweetRequest) (*Tweet, error) {
	headers := make(http.Header)
	headers.Set("Authorization", "Bearer "+c.auth.GetBearerToken())
	headers.Set("Content-Type", "application/json")

	// Add CSRF token from cookies
	cookies := c.auth.GetCookies(onboardingTaskEndpoint)
	for _, cookie := range cookies {
		if cookie.Name == "ct0" {
			headers.Set("x-csrf-token", cookie.Value)
			break
		}
	}

	// Prepare request body
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	// Create request
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, onboardingTaskEndpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	// Set headers
	httpReq.Header = headers

	// Send request with rate limiting
	resp, err := c.doRequest(ctx, httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	// Parse response
	var result struct {
		Data *Tweet `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return result.Data, nil
}

func (c *TwitterClient) ReplyToTweet(ctx context.Context, id string, text string) error {
	req := &tweetRequest{
		Text:    text,
		ReplyID: id,
	}

	_, err := c.createTweet(ctx, req)
	if err != nil {
		return fmt.Errorf("create reply tweet: %w", err)
	}

	return nil
}
