import { SELECTORS } from '../constants/selectors'
import { debug } from './debug'

declare global {
  interface Window {
    __INITIAL_STATE__: any
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
      debug.log('Twitter', 'Found React key', { key })
      return (element as any)[key]
    }
  }

  // If we can't find direct props, try to find any key that looks like a React internal
  const anyReactKey = Object.keys(element).find(key => 
    key.includes('react') || key.includes('$')
  )
  
  if (anyReactKey) {
    debug.log('Twitter', 'Found potential React key', { key: anyReactKey })
    return (element as any)[anyReactKey]
  }

  debug.log('Twitter', 'Available element keys', { keys: Object.keys(element) })
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
    debug.log('Twitter', 'Found props', { props })

    if (props) {
      // Check different possible locations of the click handler
      if (typeof props.onClick === 'function') return props.onClick
      if (props.children?.props?.onClick) return props.children.props.onClick
      if (props.memoizedProps?.onClick) return props.memoizedProps.onClick
      
      debug.log('Twitter', 'Props structure', { props })
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
 * Sends a tweet by simulating a click on the tweet button
 * @param text - The text content of the tweet
 * @returns Promise that resolves to true if the tweet was sent successfully
 */
export const sendTweet = async (): Promise<boolean> => {
  try {
    // Try to find both types of tweet buttons
    const tweetButton = document.querySelector(SELECTORS.TWEET_BUTTON) as HTMLElement
    const inlineTweetButton = document.querySelector('[data-testid="tweetButtonInline"]') as HTMLElement
    
    debug.log('Twitter', 'Found tweet buttons', { 
      tweetButtonExists: !!tweetButton,
      inlineButtonExists: !!inlineTweetButton,
      tweetButtonClasses: tweetButton?.className,
      inlineButtonClasses: inlineTweetButton?.className
    })

    // Create a promise that resolves when the tweet is sent
    const tweetSentPromise = new Promise<boolean>((resolve) => {
      debug.log('Twitter', 'Setting up tweet success observer')
      
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.target instanceof Element) {
            debug.log('Twitter', 'Mutation detected', {
              target: mutation.target,
              textContent: mutation.target.textContent,
              type: mutation.type
            })
            
            if (mutation.target.textContent?.includes('Your Tweet was sent')) {
              debug.log('Twitter', 'Tweet success detected')
              observer.disconnect()
              resolve(true)
              return
            }
          }
        }
      })
      
      debug.log('Twitter', 'Starting mutation observer')
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      })

      // Set a timeout to prevent hanging
      setTimeout(() => {
        debug.log('Twitter', 'Tweet timeout reached')
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

    debug.log('Twitter', 'Clicking button', {
      className: buttonToClick.className,
      textContent: buttonToClick.textContent,
      dataset: buttonToClick.dataset
    })

    buttonToClick.click()
    debug.log('Twitter', 'Button clicked, waiting for result')

    const success = await tweetSentPromise
    debug.log('Twitter', 'Tweet operation completed', { success })
    return success

  } catch (error) {
    debug.error('Twitter', 'Error sending tweet', error)
    return false
  }
} 