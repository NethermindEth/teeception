import { useEffect, useState, useCallback, useRef } from 'react'
import { SELECTORS } from '../constants/selectors'
import { debug } from '../utils/debug'

interface TweetButtonState {
  originalButton: HTMLElement | null
  overlayButton: HTMLElement | null
}

/**
 * Creates and manages an overlay button on top of the Twitter tweet button
 * @param onClick Callback function to be called when the overlay button is clicked
 * @returns Object containing the original and overlay button elements
 */
export const useTweetButton = (onClick?: () => void) => {
  const [state, setState] = useState<TweetButtonState>({
    originalButton: null,
    overlayButton: null
  })

  // Use refs to track current elements and avoid unnecessary re-renders
  const currentOverlayRef = useRef<HTMLElement | null>(null)
  const currentButtonRef = useRef<HTMLElement | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)

  const createOverlayButton = useCallback((originalButton: HTMLElement) => {
    const rect = originalButton.getBoundingClientRect()
    const overlay = document.createElement('div')
    overlay.id = 'jack-the-ether-button-overlay'
    overlay.style.position = 'fixed'
    overlay.style.top = `${rect.top}px`
    overlay.style.left = `${rect.left}px`
    overlay.style.width = `${rect.width}px`
    overlay.style.height = `${rect.height}px`
    overlay.style.zIndex = '99999'
    overlay.style.cursor = 'pointer'
    overlay.style.backgroundColor = 'transparent'
    overlay.style.pointerEvents = 'auto'
    
    if (onClick) {
      overlay.addEventListener('click', onClick)
    }
    
    return overlay
  }, [onClick])

  // Update overlay position with throttling
  const updateOverlayPosition = useCallback((tweetButton: HTMLElement, overlay: HTMLElement) => {
    const now = Date.now()
    if (now - lastUpdateTimeRef.current < 100) return // Throttle to max once per 100ms
    
    lastUpdateTimeRef.current = now
    const newRect = tweetButton.getBoundingClientRect()
    
    if (newRect.width > 0 && newRect.height > 0) {
      const currentTop = parseInt(overlay.style.top)
      const currentLeft = parseInt(overlay.style.left)
      const currentWidth = parseInt(overlay.style.width)
      const currentHeight = parseInt(overlay.style.height)
      
      // Only update if position or size has changed significantly (more than 1px)
      if (Math.abs(currentTop - newRect.top) > 1 ||
          Math.abs(currentLeft - newRect.left) > 1 ||
          Math.abs(currentWidth - newRect.width) > 1 ||
          Math.abs(currentHeight - newRect.height) > 1) {
        
        overlay.style.top = `${newRect.top}px`
        overlay.style.left = `${newRect.left}px`
        overlay.style.width = `${newRect.width}px`
        overlay.style.height = `${newRect.height}px`
      }
      
      overlay.style.display = 'block'
    } else {
      overlay.style.display = 'none'
    }
  }, [])

  // Find and update tweet button
  const findTweetButton = useCallback(() => {
    const tweetButtons = Array.from(document.querySelectorAll(SELECTORS.TWEET_BUTTON))
    return tweetButtons
      .filter(b => {
        const rect = b.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      .pop() as HTMLElement | undefined
  }, [])

  // Main update function
  const updateOverlays = useCallback(() => {
    const tweetButton = findTweetButton()
    
    // If we found the same button, just update position
    if (tweetButton && currentButtonRef.current === tweetButton && currentOverlayRef.current) {
      updateOverlayPosition(tweetButton, currentOverlayRef.current)
      return
    }

    // Clean up old overlay and observer
    if (currentOverlayRef.current) {
      currentOverlayRef.current.remove()
      resizeObserverRef.current?.disconnect()
    }

    if (tweetButton) {
      const overlay = createOverlayButton(tweetButton)
      
      // Set up resize observer for the tweet box
      const tweetBox = document.querySelector(SELECTORS.TWEET_TEXTAREA)
        ?.closest(SELECTORS.TWEET_TEXTBOX)
      
      if (tweetBox) {
        let resizeTimeout: NodeJS.Timeout | null = null
        resizeObserverRef.current = new ResizeObserver(() => {
          if (resizeTimeout) return
          resizeTimeout = setTimeout(() => {
            if (currentButtonRef.current && currentOverlayRef.current) {
              updateOverlayPosition(currentButtonRef.current, currentOverlayRef.current)
            }
            resizeTimeout = null
          }, 150) // Increased debounce time
        })
        resizeObserverRef.current.observe(tweetBox)
      }

      document.body.appendChild(overlay)
      currentOverlayRef.current = overlay
      currentButtonRef.current = tweetButton

      setState({
        originalButton: tweetButton,
        overlayButton: overlay
      })
    }
  }, [createOverlayButton, updateOverlayPosition, findTweetButton])

  // Set up scroll and resize handlers with throttling
  useEffect(() => {
    let lastScrollTime = 0
    
    const handleViewportChange = () => {
      const now = Date.now()
      if (now - lastScrollTime < 100) return // Throttle to max once per 100ms
      lastScrollTime = now
      
      if (currentButtonRef.current && currentOverlayRef.current) {
        updateOverlayPosition(currentButtonRef.current, currentOverlayRef.current)
      }
    }

    window.addEventListener('scroll', handleViewportChange, { passive: true })
    window.addEventListener('resize', handleViewportChange, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [updateOverlayPosition])

  // Set up mutation observer for DOM changes
  useEffect(() => {
    let mutationTimeout: NodeJS.Timeout | null = null
    let lastMutationTime = 0
    
    // Initial update with retry
    const initialUpdate = () => {
      updateOverlays()
      const button = findTweetButton()
      if (!button) {
        setTimeout(initialUpdate, 500) // Retry every 500ms if button not found
      }
    }
    setTimeout(initialUpdate, 100)

    const observer = new MutationObserver((mutations) => {
      // Skip mutations that don't affect our elements
      const relevantMutation = mutations.some(mutation => {
        // Check if mutation target or its parent is relevant
        const isRelevantTarget = 
          mutation.target instanceof Element &&
          (mutation.target.matches(SELECTORS.TWEET_BUTTON) ||
           mutation.target.querySelector(SELECTORS.TWEET_BUTTON) ||
           mutation.target.closest(SELECTORS.TWEET_BUTTON))
        
        return isRelevantTarget
      })

      if (!relevantMutation) return

      const now = Date.now()
      if (now - lastMutationTime < 200) return // Throttle mutations
      lastMutationTime = now

      if (mutationTimeout) clearTimeout(mutationTimeout)
      mutationTimeout = setTimeout(updateOverlays, 200)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    })

    return () => {
      observer.disconnect()
      resizeObserverRef.current?.disconnect()
      currentOverlayRef.current?.remove()
      if (mutationTimeout) clearTimeout(mutationTimeout)
    }
  }, [updateOverlays, findTweetButton])

  return state
} 