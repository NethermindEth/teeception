package twitter

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"golang.org/x/time/rate"
)

func TestNewTwitterClient(t *testing.T) {
	tests := []struct {
		name    string
		config  *TwitterConfig
		wantErr error
	}{
		{
			name:    "nil config",
			config:  nil,
			wantErr: ErrInvalidConfig,
		},
		{
			name: "missing app credentials",
			config: &TwitterConfig{
				Username:     "test",
				AccessToken:  "token",
				AccessSecret: "secret",
			},
			wantErr: ErrMissingAppCredentials,
		},
		{
			name: "missing access credentials",
			config: &TwitterConfig{
				Username:   "test",
				AppKey:    "key",
				AppSecret: "secret",
			},
			wantErr: ErrMissingAccessCredentials,
		},
		{
			name: "missing username",
			config: &TwitterConfig{
				AppKey:       "key",
				AppSecret:    "secret",
				AccessToken:  "token",
				AccessSecret: "secret",
			},
			wantErr: ErrMissingUsername,
		},
		{
			name: "valid config",
			config: &TwitterConfig{
				Username:     "test",
				AppKey:       "key",
				AppSecret:    "secret",
				AccessToken:  "token",
				AccessSecret: "secret",
			},
			wantErr: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewTwitterClient(tt.config)
			if err != tt.wantErr {
				t.Errorf("NewTwitterClient() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestTwitterClient_GetTweet(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/2/tweets/123" {
			t.Errorf("Expected path /2/tweets/123, got %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}

		q := r.URL.Query()
		fields := q.Get("tweet.fields")
		if fields == "" {
			t.Errorf("Expected tweet.fields parameter, got none")
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		expectedFields := map[string]bool{
			"text":                true,
			"created_at":         true,
			"author_id":          true,
			"conversation_id":    true,
			"in_reply_to_user_id": true,
			"public_metrics":     true,
		}

		fieldList := strings.Split(fields, ",")
		for _, field := range fieldList {
			if !expectedFields[field] {
				t.Errorf("Unexpected field %s", field)
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			delete(expectedFields, field)
		}

		if len(expectedFields) > 0 {
			t.Errorf("Missing fields: %v", expectedFields)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		resp := TweetResponse{
			Data: Tweet{
				ID:             "123",
				Text:           "Test tweet",
				CreatedAt:      "2024-01-01T00:00:00Z",
				AuthorID:       "456",
				ConversationID: "789",
				PublicMetrics: struct {
					RetweetCount    int `json:"retweet_count"`
					ReplyCount      int `json:"reply_count"`
					LikeCount       int `json:"like_count"`
					QuoteCount      int `json:"quote_count"`
					BookmarkCount   int `json:"bookmark_count"`
					ImpressionCount int `json:"impression_count"`
				}{
					RetweetCount:    10,
					ReplyCount:      5,
					LikeCount:       20,
					QuoteCount:      2,
					BookmarkCount:   3,
					ImpressionCount: 100,
				},
			},
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	twitterAPIBaseURL = server.URL + "/2"

	client := &TwitterClient{
		config: &TwitterConfig{
			AppKey:       "test-key",
			AppSecret:    "test-secret",
			AccessToken:  "test-token",
			AccessSecret: "test-secret",
			Username:     "test",
		},
		client:      server.Client(),
		rateLimiter: rate.NewLimiter(rate.Every(time.Millisecond), 1),
	}

	tweet, err := client.GetTweet(context.Background(), "123")
	if err != nil {
		t.Fatalf("GetTweet() error = %v", err)
	}

	if tweet.ID != "123" {
		t.Errorf("Expected tweet ID 123, got %s", tweet.ID)
	}
	if tweet.Text != "Test tweet" {
		t.Errorf("Expected tweet text 'Test tweet', got %s", tweet.Text)
	}
	if tweet.CreatedAt != "2024-01-01T00:00:00Z" {
		t.Errorf("Expected created_at '2024-01-01T00:00:00Z', got %s", tweet.CreatedAt)
	}
	if tweet.AuthorID != "456" {
		t.Errorf("Expected author_id '456', got %s", tweet.AuthorID)
	}
	if tweet.ConversationID != "789" {
		t.Errorf("Expected conversation_id '789', got %s", tweet.ConversationID)
	}
	if tweet.PublicMetrics.RetweetCount != 10 {
		t.Errorf("Expected retweet_count 10, got %d", tweet.PublicMetrics.RetweetCount)
	}
}

func TestTwitterClient_ReplyToTweet(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST request, got %s", r.Method)
		}
		if r.URL.Path != "/2/tweets/123/reply" {
			t.Errorf("Expected path /2/tweets/123/reply, got %s", r.URL.Path)
		}

		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Errorf("Failed to decode request body: %v", err)
		}
		if text, ok := payload["text"].(string); !ok || text != "Test reply" {
			t.Errorf("Expected text='Test reply', got %v", payload["text"])
		}

		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	twitterAPIBaseURL = server.URL + "/2"

	client := &TwitterClient{
		config: &TwitterConfig{
			Username:     "test",
			AppKey:       "key",
			AppSecret:    "secret",
			AccessToken:  "token",
			AccessSecret: "secret",
		},
		client:      server.Client(),
		rateLimiter: rate.NewLimiter(rate.Every(time.Millisecond), 1),
	}

	err := client.ReplyToTweet(context.Background(), "123", "Test reply")
	if err != nil {
		t.Errorf("ReplyToTweet() error = %v", err)
	}
}

func TestTwitterClient_Retries(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(TweetResponse{
			Data: Tweet{ID: "123", Text: "Test tweet"},
		})
	}))
	defer server.Close()
	twitterAPIBaseURL = server.URL + "/2"

	client := &TwitterClient{
		config: &TwitterConfig{
			Username:     "test",
			AppKey:       "key",
			AppSecret:    "secret",
			AccessToken:  "token",
			AccessSecret: "secret",
		},
		client:      server.Client(),
		rateLimiter: rate.NewLimiter(rate.Every(time.Millisecond), 1),
	}

	tweet, err := client.GetTweet(context.Background(), "123")
	if err != nil {
		t.Errorf("GetTweet() with retries error = %v", err)
	}
	if attempts != 3 {
		t.Errorf("Expected 3 attempts, got %d", attempts)
	}
	if tweet.ID != "123" || tweet.Text != "Test tweet" {
		t.Errorf("GetTweet() = %v, want ID=123, Text='Test tweet'", tweet)
	}
}

func TestTwitterClient_ContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
		json.NewEncoder(w).Encode(TweetResponse{
			Data: Tweet{ID: "123", Text: "Test tweet"},
		})
	}))
	defer server.Close()

	twitterAPIBaseURL = server.URL + "/2"

	client := &TwitterClient{
		config: &TwitterConfig{
			Username:     "test",
			AppKey:       "key",
			AppSecret:    "secret",
			AccessToken:  "token",
			AccessSecret: "secret",
		},
		client:      server.Client(),
		rateLimiter: rate.NewLimiter(rate.Every(time.Millisecond), 1),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	_, err := client.GetTweet(ctx, "123")
	if err == nil {
		t.Error("Expected context deadline exceeded error, got nil")
	}
	if err != context.DeadlineExceeded {
		t.Errorf("Expected context.DeadlineExceeded, got %v", err)
	}
}

func TestTwitterClient_ErrorResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{
			Errors: []struct {
				Message string `json:"message"`
			}{
				{Message: "Invalid request"},
			},
		})
	}))
	defer server.Close()

	twitterAPIBaseURL = server.URL + "/2"

	client := &TwitterClient{
		config: &TwitterConfig{
			Username:     "test",
			AppKey:       "key",
			AppSecret:    "secret",
			AccessToken:  "token",
			AccessSecret: "secret",
		},
		client:      server.Client(),
		rateLimiter: rate.NewLimiter(rate.Every(time.Millisecond), 1),
	}

	_, err := client.GetTweet(context.Background(), "123")
	if err == nil {
		t.Error("Expected error response, got nil")
	}
	if err.Error() != "twitter API error: Invalid request" {
		t.Errorf("Expected 'twitter API error: Invalid request', got %v", err)
	}
}

func TestTwitterClient_RateLimiting(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(TweetResponse{
			Data: Tweet{ID: "123", Text: "Test tweet"},
		})
	}))
	defer server.Close()

	twitterAPIBaseURL = server.URL + "/2"

	client := &TwitterClient{
		config: &TwitterConfig{
			Username:     "test",
			AppKey:       "key",
			AppSecret:    "secret",
			AccessToken:  "token",
			AccessSecret: "secret",
		},
		client:      server.Client(),
		rateLimiter: rate.NewLimiter(rate.Every(100*time.Millisecond), 1),
	}

	start := time.Now()
	for i := 0; i < 3; i++ {
		_, err := client.GetTweet(context.Background(), "123")
		if err != nil {
			t.Errorf("GetTweet() error = %v", err)
		}
	}
	duration := time.Since(start)

	if duration < 200*time.Millisecond {
		t.Errorf("Expected rate limiting to enforce minimum 200ms duration, got %v", duration)
	}
}
