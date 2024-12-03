declare global {
  interface Window {
    __INITIAL_STATE__: any;
  }
}

const findReactProps = (element: Element): any => {
  // Try different known React internal property patterns
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
      console.log('Found React key:', key)
      return (element as any)[key]
    }
  }

  // If we can't find direct props, try to find any key that looks like a React internal
  const anyReactKey = Object.keys(element).find(key => 
    key.includes('react') || key.includes('$')
  )
  
  if (anyReactKey) {
    console.log('Found potential React key:', anyReactKey)
    return (element as any)[anyReactKey]
  }

  // Log all keys for debugging
  console.log('All element keys:', Object.keys(element))
  
  return null
}

const findTweetHandler = (element: Element): Function | null => {
  try {
    // Try to find props directly on the element
    const props = findReactProps(element)
    console.log('Found props:', props)

    if (props) {
      // Check different possible locations of the click handler
      if (typeof props.onClick === 'function') return props.onClick
      if (props.children?.props?.onClick) return props.children.props.onClick
      if (props.memoizedProps?.onClick) return props.memoizedProps.onClick
      
      // If we found props but no handler, log the structure
      console.log('Props structure:', JSON.stringify(props, null, 2))
    }

    // Try parent elements if we can't find it here
    const parent = element.parentElement
    if (parent) {
      return findTweetHandler(parent)
    }
  } catch (error) {
    console.error('Error finding tweet handler:', error)
  }
  return null
}

interface TweetPayload {
  text: string
  reply?: {
    in_reply_to_tweet_id: string
    exclude_reply_user_ids: string[]
  }
}

export const sendTweet = async (text: string): Promise<boolean> => {
  try {
    // Try to find both types of tweet buttons
    const tweetButton = document.querySelector('[data-testid="tweetButton"]') as HTMLElement
    const inlineTweetButton = document.querySelector('[data-testid="tweetButtonInline"]') as HTMLElement
    
    console.log('Found buttons:', { 
      tweetButton, 
      inlineTweetButton,
      tweetButtonExists: !!tweetButton,
      inlineButtonExists: !!inlineTweetButton,
      tweetButtonClasses: tweetButton?.className,
      inlineButtonClasses: inlineTweetButton?.className
    })

    // Create a promise that resolves when the tweet is sent
    const tweetSentPromise = new Promise<boolean>((resolve) => {
      console.log('Setting up tweet success observer')
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.target instanceof Element) {
            console.log('Mutation detected:', {
              target: mutation.target,
              textContent: mutation.target.textContent,
              type: mutation.type
            })
            if (mutation.target.textContent?.includes('Your Tweet was sent')) {
              console.log('Tweet success detected')
              observer.disconnect()
              resolve(true)
              return
            }
          }
        }
      })
      
      console.log('Starting mutation observer')
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      })

      setTimeout(() => {
        console.log('Tweet timeout reached')
        observer.disconnect()
        resolve(false)
      }, 5000)
    })

    // Click the appropriate button
    const buttonToClick = inlineTweetButton || tweetButton
    if (!buttonToClick) {
      console.error('No tweet buttons found')
      return false
    }

    console.log('Clicking button:', {
      button: buttonToClick,
      className: buttonToClick.className,
      textContent: buttonToClick.textContent,
      dataset: buttonToClick.dataset
    })

    buttonToClick.click()
    console.log('Button clicked, waiting for result')

    const success = await tweetSentPromise
    console.log('Tweet operation completed:', { success })
    return success

  } catch (error) {
    console.error('Error sending tweet:', error)
    return false
  }
} 