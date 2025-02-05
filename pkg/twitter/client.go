package twitter

type TwitterClientConfig struct {
	Username          string
	Password          string
	Email             string
	ConsumerKey       string
	ConsumerSecret    string
	AccessToken       string
	AccessTokenSecret string
}

type TwitterClient interface {
	Initialize(config *TwitterClientConfig) error
	GetTweetText(tweetID uint64) (string, error)
	ReplyToTweet(tweetID uint64, reply string) error
	SendTweet(tweet string) error
}
