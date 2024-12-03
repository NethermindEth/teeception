/**
 * DOM selectors for Twitter elements
 */
export const SELECTORS = {
  TWEET_BUTTON: '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]',
  TWEET_TEXTAREA: '[data-testid="tweetTextarea_0"], [data-testid="tweetTextarea_1"]',
  TWEET_TEXTBOX: 'div[role="textbox"]'
} as const 