import { SELECTORS } from '../constants/selectors'
import { debug } from './debug'
import { TWITTER_CONFIG } from '../config/starknet'

declare global {
  interface Window {
    __INITIAL_STATE__: any
    showChallengeModal?: (agentName: string) => Promise<boolean>;
  }
}

/**
 * Finds React internal props on a DOM element
 * @param element - The DOM element to search
 * @returns The React props object or null if not found
 */
const findReactProps = (element: Element): any => {
  const reactInternalKeys = [
    '__reactFiber$',
    '__reactInternalInstance$',
    '__reactProps$',
    '_reactProps',
    '_reactInternalInstance'
  ]

  for (const prefix of reactInternalKeys) {
    const key = Object.keys(element).find(key => key.startsWith(prefix))
    if (key) {
       
      return (element as any)[key]
    }
  }

  // If we can't find direct props, try to find any key that looks like a React internal
  const anyReactKey = Object.keys(element).find(key => 
    key.includes('react') || key.includes('$')
  )
  
  if (anyReactKey) {
     
    return (element as any)[anyReactKey]
  }

   
  return null
}

/**
 * Recursively searches for the tweet handler function on an element and its parents
 * @param element - The DOM element to search
 * @returns The tweet handler function or null if not found
 */
const findTweetHandler = (element: Element): Function | null => {
  try {
    const props = findReactProps(element)
     

    if (props) {
      // Check different possible locations of the click handler
      if (typeof props.onClick === 'function') return props.onClick
      if (props.children?.props?.onClick) return props.children.props.onClick
      if (props.memoizedProps?.onClick) return props.memoizedProps.onClick
      
       
    }

    // Try parent elements if we can't find it here
    const parent = element.parentElement
    if (parent) {
      return findTweetHandler(parent)
    }
  } catch (error) {
    debug.error('Twitter', 'Error finding tweet handler', error)
  }
  return null
}

/**
 * Extracts agent name from tweet text
 * @param text - The tweet text
 * @returns The agent name or null if not found
 */
export const extractAgentName = (text: string): string | null => {
   
  
  // Remove any text from our overlay to prevent infinite loops
  const cleanText = text.replace(/Paid|Pay to Challenge/g, '').trim()
  
  const match = cleanText.match(/:([^:]+):/)
   
  if (!match || !match[1]) return null
  const agentName = match[1].trim()
   
  return agentName
}

/**
 * Removes the bot mention and agent name from the tweet text
 * @param text The full tweet text
 * @returns The cleaned prompt text
 */
export const cleanPromptText = (text: string): string => {
  // Create regex using the exact bot name from config, escaping any special characters
  const botName = TWITTER_CONFIG.accountName.replace('@', '')
  // Match any whitespace before the mention, the mention itself, and ensure single space after
  const regex = new RegExp(`\\s*@${botName}\\s+:([^:]+):\\s*`, 'g')
  return text.replace(regex, ' ').trim()
}

/**
 * Sends a tweet by simulating a click on the tweet button
 * @param text - The text content of the tweet
 * @returns Promise that resolves to true if the tweet was sent successfully
 */
export const sendTweet = async (): Promise<boolean> => {
  try {
    // Try to find both types of tweet buttons
    const tweetButton = document.querySelector(SELECTORS.TWEET_BUTTON) as HTMLElement
    const inlineTweetButton = document.querySelector('[data-testid="tweetButtonInline"]') as HTMLElement
    const tweetTextarea = document.querySelector(SELECTORS.TWEET_TEXTAREA) as HTMLElement
    
     
    
    // Extract agent name from textarea if it exists
    const agentName = tweetTextarea ? extractAgentName(tweetTextarea.textContent || '') : null
    
     
    
    // If we found an agent name and have the modal function, show it first
    if (agentName && window.showChallengeModal) {
      const shouldProceed = await window.showChallengeModal(agentName)
      if (!shouldProceed) {
        return false
      }
    }
    
    // Create a promise that resolves when the tweet is sent
    const tweetSentPromise = new Promise<boolean>((resolve) => {
       
      
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.target instanceof Element) {
            if (mutation.target.textContent?.includes('Your Tweet was sent')) {
               
              observer.disconnect()
              resolve(true)
              return
            }
          }
        }
      })
      
       
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      })

      // Set a timeout to prevent hanging
      setTimeout(() => {
         
        observer.disconnect()
        resolve(false)
      }, 5000)
    })

    // Click the appropriate button
    const buttonToClick = inlineTweetButton || tweetButton
    if (!buttonToClick) {
      debug.error('Twitter', 'No tweet buttons found', null)
      return false
    }

    buttonToClick.click()

    const success = await tweetSentPromise
     
    return success

  } catch (error) {
    debug.error('Twitter', 'Error sending tweet', error)
    return false
  }
} 