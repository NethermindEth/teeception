package graphql

import (
	"context"
	"fmt"
)

// CreateTweetOperation handles tweet creation via GraphQL
type CreateTweetOperation struct {
	client *Client
}

// NewCreateTweetOperation creates a new tweet creation operation
func NewCreateTweetOperation(client *Client) *CreateTweetOperation {
	return &CreateTweetOperation{client: client}
}

// Execute creates a new tweet
func (op *CreateTweetOperation) Execute(ctx context.Context, text string, replyToID *string) (*CreateTweetResponse, error) {
	variables := CreateTweetVariables{
		TweetText:      text,
		ReplyToTweetId: replyToID,
		DarkRequest:    false,
		Media: struct {
			MediaEntities     []interface{} `json:"media_entities"`
			PossiblySensitive bool          `json:"possibly_sensitive"`
		}{
			MediaEntities:     []interface{}{},
			PossiblySensitive: false,
		},
	}

	// Convert variables to map[string]interface{}
	varsMap := map[string]interface{}{
		"tweet_text":       variables.TweetText,
		"reply_to_tweet_id": variables.ReplyToTweetId,
		"dark_request":      variables.DarkRequest,
		"media":            variables.Media,
	}

	// GraphQL mutation for creating a tweet
	query := `
		mutation CreateTweet($tweet_text: String!, $dark_request: Boolean!, $media: MediaInput!, $reply_to_tweet_id: ID) {
			create_tweet(input: {
				tweet_text: $tweet_text
				dark_request: $dark_request
				media: $media
				reply_to_tweet_id: $reply_to_tweet_id
			}) {
				tweet_results {
					result {
						rest_id
						legacy {
							created_at
							full_text
						}
					}
				}
			}
		}
	`

	req := &GraphQLRequest{
		Query:        query,
		Variables:    varsMap,
		Features:     DefaultFeatures(),
		FieldToggles: map[string]bool{
			"withArticlePlainText": false,
		},
	}

	var resp CreateTweetResponse
	if err := op.client.Do(ctx, CreateTweetEndpoint, req, &resp); err != nil {
		return nil, fmt.Errorf("execute create tweet: %w", err)
	}

	return &resp, nil
}

// TweetDetailOperation handles fetching tweet details via GraphQL
type TweetDetailOperation struct {
	client *Client
}

// NewTweetDetailOperation creates a new tweet detail operation
func NewTweetDetailOperation(client *Client) *TweetDetailOperation {
	return &TweetDetailOperation{client: client}
}

func (op *TweetDetailOperation) Execute(ctx context.Context, tweetID string) (*TweetDetailResponse, error) {
	variables := TweetDetailVariables{
		FocalTweetID: tweetID,
		WithReplies:  true,
	}

	// Convert variables to map[string]interface{}
	varsMap := map[string]interface{}{
		"focalTweetId": variables.FocalTweetID,
		"with_replies": variables.WithReplies,
	}

	// GraphQL query for fetching tweet details
	query := `
		query TweetDetail($focalTweetId: ID!, $with_replies: Boolean!) {
			tweet_result(rest_id: $focalTweetId) {
				result {
					rest_id
					legacy {
						created_at
						full_text
						reply_count
						retweet_count
						favorite_count
					}
				}
			}
		}
	`

	req := &GraphQLRequest{
		Query:        query,
		Variables:    varsMap,
		Features:     DefaultFeatures(),
		FieldToggles: map[string]bool{
			"withArticlePlainText": false,
		},
	}

	var resp TweetDetailResponse
	if err := op.client.Do(ctx, TweetDetailEndpoint, req, &resp); err != nil {
		return nil, err
	}

	return &resp, nil
}
