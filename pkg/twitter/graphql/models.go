package graphql

import "encoding/json"

// GraphQLRequest represents a GraphQL request
type GraphQLRequest struct {
	Query        string                 `json:"query"`
	Variables    map[string]interface{} `json:"variables"`
	Features     map[string]bool        `json:"features"`
	FieldToggles map[string]bool        `json:"fieldToggles,omitempty"`
}

// GraphQLResponse represents a GraphQL response
type GraphQLResponse struct {
	Data   json.RawMessage `json:"data"`
	Errors []struct {
		Message string `json:"message"`
		Code    string `json:"code"`
		Path    []string `json:"path"`
	} `json:"errors,omitempty"`
}

// CreateTweetVariables represents variables for creating a tweet
type CreateTweetVariables struct {
	TweetText string `json:"tweet_text"`
	ReplyToTweetId *string `json:"reply_to_tweet_id,omitempty"`
	DarkRequest bool `json:"dark_request"`
	Media struct {
		MediaEntities []interface{} `json:"media_entities"`
		PossiblySensitive bool `json:"possibly_sensitive"`
	} `json:"media"`
}

// CreateTweetResponse represents the response from creating a tweet
type CreateTweetResponse struct {
	Data struct {
		CreateTweet struct {
			TweetResults struct {
				Result struct {
					RestID string `json:"rest_id"`
					Legacy struct {
						CreatedAt string `json:"created_at"`
						FullText  string `json:"full_text"`
					} `json:"legacy"`
				} `json:"result"`
			} `json:"tweet_results"`
		} `json:"create_tweet"`
	} `json:"data"`
}

// TweetDetailVariables represents variables for fetching tweet details
type TweetDetailVariables struct {
	FocalTweetID string `json:"focalTweetId"`
	WithReplies  bool   `json:"with_replies"`
}

// TweetDetailResponse represents the response from fetching tweet details
type TweetDetailResponse struct {
	Data struct {
		TweetResult struct {
			Result struct {
				RestID string `json:"rest_id"`
				Legacy struct {
					CreatedAt     string `json:"created_at"`
					FullText      string `json:"full_text"`
					ReplyCount    int    `json:"reply_count"`
					RetweetCount  int    `json:"retweet_count"`
					FavoriteCount int    `json:"favorite_count"`
				} `json:"legacy"`
			} `json:"result"`
		} `json:"tweet_result"`
	} `json:"data"`
}
