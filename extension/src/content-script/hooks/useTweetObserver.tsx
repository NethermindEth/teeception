import { useEffect, useCallback, useRef } from 'react'
import { SELECTORS } from '../constants/selectors'
import { extractAgentName } from '../utils/twitter'
import { checkTweetPaid, getAgentAddressByName } from '../utils/contracts'
import { debug } from '../utils/debug'
import { TWITTER_CONFIG } from '../config/starknet'

interface TweetData {
  id: string
  isPaid: boolean
  agentName: string
  overlayContainer?: HTMLDivElement
}

// Use sessionStorage to persist cache across page navigations
const getTweetCache = () => {
  try {
    const cached = sessionStorage.getItem('tweetCache')
    return cached ? new Map<string, TweetData>(JSON.parse(cached)) : new Map<string, TweetData>()
  } catch (error) {
    debug.error('TweetObserver', 'Error reading tweet cache', error)
    return new Map<string, TweetData>()
  }
}

const setTweetCache = (cache: Map<string, TweetData>) => {
  try {
    const serializable = Array.from(cache.entries()).map(([key, value]) => {
      // Don't serialize DOM elements
      const { overlayContainer, ...rest } = value
      return [key, rest]
    })
    sessionStorage.setItem('tweetCache', JSON.stringify(serializable))
  } catch (error) {
    debug.error('TweetObserver', 'Error saving tweet cache', error)
  }
}

export const useTweetObserver = (
  onPayClick: (tweetId: string, agentName: string) => void,
  currentUser: string
) => {
  const tweetCache = useRef<Map<string, TweetData>>(getTweetCache())
  const observer = useRef<MutationObserver | null>(null)
  const processingTweets = useRef<Set<string>>(new Set())
  const processTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const processTweet = useCallback(
    async (tweet: HTMLElement) => {
      try {
        // Skip if not a full tweet (e.g. retweet preview)
        if (!tweet.querySelector(SELECTORS.TWEET_TIME)) return

        // Get tweet text and check if it's a challenge tweet
        const textElement = tweet.querySelector(SELECTORS.TWEET_TEXT)
        const text = textElement?.textContent || ''

        if (!text.includes(TWITTER_CONFIG.accountName)) return

        const agentName = extractAgentName(text)
        if (!agentName) return

        // Get tweet ID from time element href
        const timeElement = tweet.querySelector(SELECTORS.TWEET_TIME)
        const tweetUrl = timeElement?.closest('a')?.href
        const tweetId = tweetUrl?.split('/').pop()
        if (!tweetId) return

        // Prevent concurrent processing of the same tweet
        if (processingTweets.current.has(tweetId)) return
        processingTweets.current.add(tweetId)

        // Check if we've already processed this tweet and nothing has changed
        const cachedTweet = tweetCache.current.get(tweetId)
        const existingBanner = tweet.nextElementSibling
        if (cachedTweet && existingBanner?.classList.contains('tweet-challenge-banner')) {
          processingTweets.current.delete(tweetId)
          return
        }

        // Get agent address and check if tweet is paid
        const agentAddress = await getAgentAddressByName(agentName)
        let isPaid = false

        // Remove any existing banner only if we're going to add a new one
        if (existingBanner?.classList.contains('tweet-challenge-banner')) {
          existingBanner.remove()
        }

        if (!agentAddress) {
          // Agent doesn't exist - show grey banner
          tweet.style.border = '2px solid rgba(128, 128, 128, 0.1)'
          tweet.style.borderRadius = '0'

          const banner = document.createElement('div')
          banner.className = 'tweet-challenge-banner'
          banner.style.cssText = `
          padding: 12px 16px;
          background-color: rgba(128, 128, 128, 0.1);
          border-bottom: 1px solid rgb(128, 128, 128, 0.2);
          margin-top: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: rgb(128, 128, 128);
        `

          const bannerText = document.createElement('span')
          bannerText.textContent = 'This tweet references a Teeception agent that does not exist'
          banner.appendChild(bannerText)

          // Insert banner after the tweet
          tweet.parentNode?.insertBefore(banner, tweet.nextSibling)

          processingTweets.current.delete(tweetId)
          return
        }

        isPaid = await checkTweetPaid(agentAddress, tweetId)

        if (isPaid) {
          // Paid tweet - show green banner
          tweet.style.border = '2px solid rgba(0, 200, 83, 0.1)'
          tweet.style.borderRadius = '0'

          const banner = document.createElement('div')
          banner.className = 'tweet-challenge-banner'
          banner.style.cssText = `
          padding: 12px 16px;
          background-color: rgba(0, 200, 83, 0.1);
          border-bottom: 1px solid rgb(0, 200, 83, 0.2);
          margin-top: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: rgb(0, 200, 83);
        `

          const bannerText = document.createElement('span')
          bannerText.textContent = 'This challenge has been paid for and is being executed'
          banner.appendChild(bannerText)

          const viewButton = document.createElement('button')
          viewButton.textContent = 'View Progress'
          viewButton.style.cssText = `
          background-color: rgb(0, 200, 83);
          color: white;
          padding: 6px 16px;
          border-radius: 9999px;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          border: none;
        `
          viewButton.addEventListener('click', () =>
            window.open(`https://teeception.ai/tweet/${tweetId}`, '_blank')
          )
          banner.appendChild(viewButton)

          // Insert banner after the tweet
          tweet.parentNode?.insertBefore(banner, tweet.nextSibling)
        } else {
          // Unpaid tweet - show red banner (existing code)
          tweet.style.border = '2px solid rgba(244, 33, 46, 0.1)'
          tweet.style.borderRadius = '0'

          const banner = document.createElement('div')
          banner.className = 'tweet-challenge-banner'
          banner.style.cssText = `
          padding: 12px 16px;
          background-color: rgba(244, 33, 46, 0.1);
          border-bottom: 1px solid rgb(244, 33, 46, 0.2);
          margin-top: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: rgb(244, 33, 46);
        `

          const bannerText = document.createElement('span')
          bannerText.textContent = 'This tweet initiates a challenge'
          banner.appendChild(bannerText)

          const payButton = document.createElement('button')
          payButton.textContent = 'Pay to Challenge'
          payButton.style.cssText = `
          background-color: rgb(244, 33, 46);
          color: white;
          padding: 6px 16px;
          border-radius: 9999px;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          border: none;
        `
          payButton.addEventListener('click', () => onPayClick(tweetId, agentName))
          banner.appendChild(payButton)

          // Insert banner after the tweet
          tweet.parentNode?.insertBefore(banner, tweet.nextSibling)
        }

        // Update cache
        tweetCache.current.set(tweetId, {
          id: tweetId,
          isPaid,
          agentName,
        })
        setTweetCache(tweetCache.current)

        // Double check the tweet is still in the DOM
        if (!document.contains(tweet)) {
          return
        }
      } catch (error) {
        debug.error('TweetObserver', 'Error processing tweet', error)
      } finally {
        const timeElement = tweet.querySelector(SELECTORS.TWEET_TIME)
        const tweetUrl = timeElement?.closest('a')?.href
        const currentTweetId = tweetUrl?.split('/').pop()
        if (currentTweetId) {
          processingTweets.current.delete(currentTweetId)
        }
      }
    },
    [currentUser, onPayClick]
  )

  const processExistingTweets = useCallback(() => {
    // Clear any pending process timeout
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current)
    }

    // Delay processing to let Twitter's UI settle
    processTimeoutRef.current = setTimeout(() => {
      const tweets = document.querySelectorAll(SELECTORS.TWEET)
      tweets.forEach((tweet) => {
        if (tweet instanceof HTMLElement) {
          processTweet(tweet)
        }
      })
    }, 100)
  }, [processTweet])

  useEffect(() => {
    // Process existing tweets immediately on mount
    const tweets = document.querySelectorAll(SELECTORS.TWEET)
    tweets.forEach((tweet) => {
      if (tweet instanceof HTMLElement) {
        processTweet(tweet)
      }
    })

    // Set up navigation listener
    const handleNavigation = () => {
      processExistingTweets()
    }

    // Handle both Twitter's client-side routing and browser navigation
    window.addEventListener('popstate', handleNavigation)
    window.addEventListener('pushstate', handleNavigation)
    window.addEventListener('replacestate', handleNavigation)

    // Also watch for scroll events as Twitter uses virtual scrolling
    let scrollTimeout: NodeJS.Timeout | null = null
    const handleScroll = () => {
      if (scrollTimeout) return
      scrollTimeout = setTimeout(() => {
        processExistingTweets()
        scrollTimeout = null
      }, 250)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // Set up mutation observer with more specific targeting
    let mutationTimeout: NodeJS.Timeout | null = null
    observer.current = new MutationObserver((mutations) => {
      // Skip if we already have a pending update
      if (mutationTimeout) return

      let shouldProcessTweets = false

      for (const mutation of mutations) {
        // Only process certain types of mutations
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes)
          const hasRelevantAddition = addedNodes.some((node) => {
            if (node instanceof HTMLElement) {
              // Only check for actual tweet containers or their direct content
              return (
                node.matches(SELECTORS.TWEET) ||
                node.matches('[data-testid="tweet"]') ||
                node.matches('[data-testid="tweetText"]')
              )
            }
            return false
          })

          if (hasRelevantAddition) {
            shouldProcessTweets = true
            break
          }
        }

        // Only check specific attribute changes on tweet elements
        if (
          mutation.type === 'attributes' &&
          mutation.target instanceof HTMLElement &&
          mutation.attributeName === 'data-testid' &&
          (mutation.target.matches(SELECTORS.TWEET) || mutation.target.closest(SELECTORS.TWEET))
        ) {
          shouldProcessTweets = true
          break
        }
      }

      if (shouldProcessTweets) {
        mutationTimeout = setTimeout(() => {
          processExistingTweets()
          mutationTimeout = null
        }, 100) // Reduced timeout for faster response
      }
    })

    observer.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid'],
    })

    // Also set up an interval to periodically check for tweets that might have been missed
    const checkInterval = setInterval(processExistingTweets, 2000)

    return () => {
      if (processTimeoutRef.current) {
        clearTimeout(processTimeoutRef.current)
      }
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      if (mutationTimeout) {
        clearTimeout(mutationTimeout)
      }
      if (checkInterval) {
        clearInterval(checkInterval)
      }
      window.removeEventListener('popstate', handleNavigation)
      window.removeEventListener('pushstate', handleNavigation)
      window.removeEventListener('replacestate', handleNavigation)
      window.removeEventListener('scroll', handleScroll)
      observer.current?.disconnect()
    }
  }, [processExistingTweets, processTweet]) // Added processTweet to dependencies

  return null
}
