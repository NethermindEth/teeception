/**
 * DOM selectors for Twitter elements
 */
export const SELECTORS = {
  TWEET_BUTTON: '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]',
  TWEET_TEXTAREA: '[data-testid="tweetTextarea_0"], [data-testid="tweetTextarea_1"]',
  TWEET_TEXTBOX: 'div[role="textbox"]',
  POST_BUTTON: '[data-testid="SideNav_NewTweet_Button"]',
  TWEET: 'article[data-testid="tweet"]',
  TWEET_TEXT: '[data-testid="tweetText"]',
  TWEET_TIME: 'time',
  TWEET_ACTIONS: '[role="group"]'
} as const 