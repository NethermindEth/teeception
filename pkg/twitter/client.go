package twitter

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/dghubble/oauth1"
)

const (
	GET_TWEET_URL   = "https://api.x.com/2/tweets/%d?tweet.fields=text"
	REPLY_TWEET_URL = "https://api.twitter.com/2/tweets/%d/reply"
)

type TwitterClient struct {
	client *http.Client
}

func NewTwitterClient(consumerKey, consumerSecret, accessToken, accessTokenSecret string) *TwitterClient {
	config := oauth1.NewConfig(consumerKey, consumerSecret)
	token := oauth1.NewToken(accessToken, accessTokenSecret)
	client := config.Client(oauth1.NoContext, token)
	return &TwitterClient{client: client}
}

func (c *TwitterClient) GetTweetText(tweetID uint64) (string, error) {
	resp, err := c.client.Get(fmt.Sprintf(GET_TWEET_URL, tweetID))
	if err != nil {
		return "", fmt.Errorf("failed to get tweet by id: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to get tweet by id: %v", resp.Status)
	}

	type tweet struct {
		Data struct {
			Text string `json:"text"`
		} `json:"data"`
	}

	var data tweet
	err = json.NewDecoder(resp.Body).Decode(&data)
	if err != nil {
		return "", fmt.Errorf("failed to decode tweet: %v", err)
	}

	return data.Data.Text, nil
}

func (c *TwitterClient) ReplyToTweet(tweetID uint64, reply string) error {
	slog.Info("replying to tweet", "tweet_id", tweetID, "reply", reply)

	if len(reply) > 280 {
		reply = reply[:280]
	}

	resp, err := c.client.Post(fmt.Sprintf(REPLY_TWEET_URL, tweetID), "application/json", strings.NewReader(reply))
	if err != nil {
		return fmt.Errorf("failed to reply to tweet: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to reply to tweet: %v", resp.Status)
	}

	return nil
}
