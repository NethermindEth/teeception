package graphql

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCreateTweetGraphQL(t *testing.T) {
	// Mock server for GraphQL endpoint
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request path
		if r.URL.Path != "/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		// Verify request method
		if r.Method != "POST" {
			t.Errorf("unexpected method: %s", r.Method)
		}

		// Verify content type
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("unexpected content type: %s", ct)
		}

		// Parse request body
		var req GraphQLRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("failed to decode request body: %v", err)
			return
		}

		// Verify request variables
		text, ok := req.Variables["tweet_text"].(string)
		if !ok || text != "test tweet" {
			t.Errorf("unexpected tweet text: %v", req.Variables["tweet_text"])
			return
		}

		// Return mock response
		resp := GraphQLResponse{
			Data: json.RawMessage(`{
				"create_tweet": {
					"tweet_results": {
						"result": {
							"rest_id": "123456",
							"legacy": {
								"created_at": "` + time.Now().Format(time.RFC3339) + `",
								"full_text": "test tweet"
							}
						}
					}
				}
			}`),
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	// Create test client
	auth := NewAuthClient(http.DefaultClient, "test-bearer-token")
	client := NewClient(http.DefaultClient, auth)

	// Override endpoint URL for testing
	CreateTweetEndpoint = mockServer.URL + "/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet"

	// Create tweet operation
	op := NewCreateTweetOperation(client)
	resp, err := op.Execute(context.Background(), "test tweet", nil)
	if err != nil {
		t.Fatalf("failed to create tweet: %v", err)
	}

	if resp.Data.CreateTweet.TweetResults.Result.RestID != "123456" {
		t.Errorf("unexpected tweet ID: %s", resp.Data.CreateTweet.TweetResults.Result.RestID)
	}

	if resp.Data.CreateTweet.TweetResults.Result.Legacy.FullText != "test tweet" {
		t.Errorf("unexpected tweet text: %s", resp.Data.CreateTweet.TweetResults.Result.Legacy.FullText)
	}
}

func TestRateLimitingAndBackoff(t *testing.T) {
	attempts := 0
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts <= 2 {
			w.Header().Set("x-rate-limit-remaining", "0")
			w.Header().Set("x-rate-limit-reset", fmt.Sprintf("%d", time.Now().Add(time.Second).Unix()))
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}

		// Return success on third attempt
		resp := GraphQLResponse{
			Data: json.RawMessage(`{
				"create_tweet": {
					"tweet_results": {
						"result": {
							"rest_id": "123456",
							"legacy": {
								"created_at": "` + time.Now().Format(time.RFC3339) + `",
								"full_text": "test tweet"
							}
						}
					}
				}
			}`),
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	auth := NewAuthClient(http.DefaultClient, "test-bearer-token")
	client := NewClient(http.DefaultClient, auth)
	CreateTweetEndpoint = mockServer.URL + "/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet"


	op := NewCreateTweetOperation(client)
	_, err := op.Execute(context.Background(), "test tweet", nil)
	if err != nil {
		t.Fatalf("failed after retries: %v", err)
	}

	if attempts != 3 {
		t.Errorf("expected 3 attempts, got %d", attempts)
	}
}

func TestAuthErrorHandling(t *testing.T) {
	attempts := 0
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts == 1 {
			// First attempt: return auth error
			resp := GraphQLResponse{
				Errors: []struct {
					Message string `json:"message"`
					Code    string `json:"code"`
					Path    []string `json:"path"`
				}{
					{
						Message: "Invalid guest token",
						Code:    "INVALID_GUEST_TOKEN",
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
			return
		}

		// Second attempt: return success
		resp := GraphQLResponse{
			Data: json.RawMessage(`{
				"create_tweet": {
					"tweet_results": {
						"result": {
							"rest_id": "123456",
							"legacy": {
								"created_at": "` + time.Now().Format(time.RFC3339) + `",
								"full_text": "test tweet"
							}
						}
					}
				}
			}`),
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	auth := NewAuthClient(http.DefaultClient, "test-bearer-token")
	client := NewClient(http.DefaultClient, auth)
	CreateTweetEndpoint = mockServer.URL + "/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet"

	op := NewCreateTweetOperation(client)
	_, err := op.Execute(context.Background(), "test tweet", nil)
	if err != nil {
		t.Fatalf("failed after auth retry: %v", err)
	}

	if attempts != 2 {
		t.Errorf("expected 2 attempts, got %d", attempts)
	}
}

func TestTweetDetailGraphQL(t *testing.T) {
	// Mock server for GraphQL endpoint
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request path
		if r.URL.Path != "/i/api/graphql/OqNw12_F_UvxnkIwB0fLAQ/TweetDetail" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		// Verify request method
		if r.Method != "POST" {
			t.Errorf("unexpected method: %s", r.Method)
		}

		// Parse request body
		var req GraphQLRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("failed to decode request body: %v", err)
			return
		}

		// Verify request variables
		focalTweetID, ok := req.Variables["focalTweetId"].(string)
		if !ok || focalTweetID != "123456" {
			t.Errorf("unexpected focal tweet ID: %v", req.Variables["focalTweetId"])
		}

		// Return mock response
		resp := GraphQLResponse{
			Data: json.RawMessage(`{
				"tweet_result": {
					"result": {
						"rest_id": "123456",
						"legacy": {
							"created_at": "` + time.Now().Format(time.RFC3339) + `",
							"full_text": "test tweet content",
							"reply_count": 5,
							"retweet_count": 10,
							"favorite_count": 20
						}
					}
				}
			}`),
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	// Create test client
	auth := NewAuthClient(http.DefaultClient, "test-bearer-token")
	client := NewClient(http.DefaultClient, auth)

	// Override endpoint URL for testing
	TweetDetailEndpoint = mockServer.URL + "/i/api/graphql/OqNw12_F_UvxnkIwB0fLAQ/TweetDetail"

	// Get tweet details operation
	op := NewTweetDetailOperation(client)
	resp, err := op.Execute(context.Background(), "123456")
	if err != nil {
		t.Fatalf("failed to get tweet details: %v", err)
	}

	if resp.Data.TweetResult.Result.RestID != "123456" {
		t.Errorf("unexpected tweet ID: %s", resp.Data.TweetResult.Result.RestID)
	}

	if resp.Data.TweetResult.Result.Legacy.FullText != "test tweet content" {
		t.Errorf("unexpected tweet text: %s", resp.Data.TweetResult.Result.Legacy.FullText)
	}

	if resp.Data.TweetResult.Result.Legacy.ReplyCount != 5 {
		t.Errorf("unexpected reply count: %d", resp.Data.TweetResult.Result.Legacy.ReplyCount)
	}
}

func TestTweetDetailNotFound(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := GraphQLResponse{
			Errors: []struct {
				Message string `json:"message"`
				Code    string `json:"code"`
				Path    []string `json:"path"`
			}{
				{
					Message: "Tweet not found",
					Code:    "NOT_FOUND",
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	auth := NewAuthClient(http.DefaultClient, "test-bearer-token")
	client := NewClient(http.DefaultClient, auth)
	TweetDetailEndpoint = mockServer.URL

	op := NewTweetDetailOperation(client)
	_, err := op.Execute(context.Background(), "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent tweet")
	}

	if err.Error() != "graphql error: Tweet not found" {
		t.Errorf("unexpected error message: %s", err.Error())
	}
}
