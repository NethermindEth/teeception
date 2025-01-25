import { useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { SELECTORS } from '../constants/selectors'
import { TweetOverlay } from '../components/TweetOverlay'
import { extractAgentName } from '../utils/twitter'
import { checkTweetPaid, getAgentAddressByName } from '../utils/contracts'
import { debug } from '../utils/debug'
import { CONFIG } from '../config'

interface TweetData {
  id: string
  isPaid: boolean
  agentName: string
}

const TWEET_CACHE = new Map<string, TweetData>()

export const useTweetObserver = (
  onPayClick: (tweetId: string, agentName: string) => void,
  currentUser: string
) => {
  const processTweet = useCallback(async (tweet: HTMLElement) => {
    try {
      // Get tweet text and check if it's a challenge tweet
      const textElement = tweet.querySelector(SELECTORS.TWEET_TEXT)
      const text = textElement?.textContent || ''
      
      if (!text.includes(CONFIG.accountName)) return
      
      const agentName = extractAgentName(text)
      if (!agentName) return
      
      // Get tweet ID from time element href
      const timeElement = tweet.querySelector(SELECTORS.TWEET_TIME)
      const tweetUrl = timeElement?.closest('a')?.href
      const tweetId = tweetUrl?.split('/').pop()
      if (!tweetId) return

      // Check if we've already processed this tweet
      if (TWEET_CACHE.has(tweetId)) return
      
      // Get tweet author
      const authorElement = tweet.querySelector('div[data-testid="User-Name"]')
      const isOwnTweet = authorElement?.textContent?.includes(currentUser) || false

      // Create container for overlay
      const overlayContainer = document.createElement('div')
      tweet.style.position = 'relative'
      tweet.appendChild(overlayContainer)

      // Get agent address and check if tweet is paid
      const agentAddress = await getAgentAddressByName(agentName)
      let isPaid = false
      
      if (agentAddress) {
        isPaid = await checkTweetPaid(agentAddress, tweetId)
      } else {
        debug.error('TweetObserver', 'Agent address not found', { agentName })
      }
      
      TWEET_CACHE.set(tweetId, { id: tweetId, isPaid, agentName })

      // Render overlay
      ReactDOM.render(
        <TweetOverlay
          tweetId={tweetId}
          isPaid={isPaid}
          isOwnTweet={isOwnTweet}
          onPayClick={() => onPayClick(tweetId, agentName)}
        />,
        overlayContainer
      )

      debug.log('TweetObserver', 'Processed tweet', { tweetId, agentName, isOwnTweet, isPaid })
    } catch (error) {
      debug.error('TweetObserver', 'Error processing tweet', error)
    }
  }, [currentUser, onPayClick])

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const addedNodes = Array.from(mutation.addedNodes)
        for (const node of addedNodes) {
          if (node instanceof HTMLElement) {
            // Check if the node itself is a tweet
            if (node.matches(SELECTORS.TWEET)) {
              processTweet(node)
            }
            // Check child nodes for tweets
            const tweets = node.querySelectorAll(SELECTORS.TWEET)
            tweets.forEach(tweet => processTweet(tweet as HTMLElement))
          }
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // Process any existing tweets
    const existingTweets = document.querySelectorAll(SELECTORS.TWEET)
    existingTweets.forEach(tweet => processTweet(tweet as HTMLElement))

    return () => {
      observer.disconnect()
      // Clean up overlays
      TWEET_CACHE.clear()
    }
  }, [processTweet])

  return null
} 