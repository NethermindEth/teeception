package twitter

import "errors"

// Error definitions
var (
	ErrInvalidConfig         = errors.New("invalid configuration")
	ErrMissingAppCredentials = errors.New("missing app key or secret")
	ErrMissingAccessCredentials   = errors.New("missing access token or secret")
	ErrMissingUsername           = errors.New("missing username")
	ErrMaxRetriesExceeded        = errors.New("maximum retries exceeded")
)

type Tweet struct {
	ID                string `json:"id"`
	Text              string `json:"text"`
	CreatedAt         string `json:"created_at,omitempty"`
	AuthorID          string `json:"author_id,omitempty"`
	ConversationID    string `json:"conversation_id,omitempty"`
	InReplyToUserID   string `json:"in_reply_to_user_id,omitempty"`
	PublicMetrics     struct {
		RetweetCount    int `json:"retweet_count"`
		ReplyCount      int `json:"reply_count"`
		LikeCount       int `json:"like_count"`
		QuoteCount      int `json:"quote_count"`
		BookmarkCount   int `json:"bookmark_count"`
		ImpressionCount int `json:"impression_count"`
	} `json:"public_metrics,omitempty"`
}

type TweetResponse struct {
	Data Tweet `json:"data"`
}

type ErrorResponse struct {
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

type Meta struct {
	ResultCount int `json:"result_count"`
}

type TweetListResponse struct {
	Data []Tweet `json:"data"`
	Meta Meta    `json:"meta"`
}
