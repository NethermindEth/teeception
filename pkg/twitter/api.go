package twitter

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

var (
	twitterAPIBaseURL = "https://api.twitter.com/2"
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

func (c *TwitterClient) ReplyToTweet(ctx context.Context, id string, text string) error {
	url := fmt.Sprintf("%s/tweets/%s/reply", twitterAPIBaseURL, id)

	payload := map[string]interface{}{
		"text": text,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal request payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(jsonPayload)))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.doRequest(ctx, req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		var errResp ErrorResponse
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
			return fmt.Errorf("decode error response: %w", err)
		}
		if len(errResp.Errors) > 0 {
			return fmt.Errorf("twitter API error: %s", errResp.Errors[0].Message)
		}
		return fmt.Errorf("twitter API error: status code %d", resp.StatusCode)
	}

	return nil
}
