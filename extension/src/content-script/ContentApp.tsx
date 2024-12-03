import React, { useEffect, useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { ConfirmationModal } from './components/modals/ConfirmationModal'
import { CONFIG } from './config'
import { getTweetText } from './utils/dom'
import { useTweetButton } from './hooks/useTweetButton'
import { useModalContainer } from './hooks/useModalContainer'
import { debug } from './utils/debug'
import { SELECTORS } from './constants/selectors'

/**
 * Main content script application component
 * Manages the tweet button overlay and confirmation modal
 */
const ContentApp = () => {
  const [showModal, setShowModal] = useState(false)
  const { originalButton, overlayButton } = useTweetButton()
  const modalContainer = useModalContainer(showModal)

  const handleTweetAttempt = useCallback(() => {
    const text = getTweetText()
    debug.log('ContentApp', 'Tweet attempt', { text, hasAccountMention: text.includes(CONFIG.accountName) })
    if (text && text.includes(CONFIG.accountName)) {
      setShowModal(true)
    } else if (originalButton) {
      originalButton.click()
    }
  }, [originalButton])

  // Set up click handler for overlay button
  useEffect(() => {
    if (!overlayButton) return

    const handleClick = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      handleTweetAttempt()
    }

    overlayButton.onclick = handleClick

    return () => {
      overlayButton.onclick = null
    }
  }, [overlayButton, handleTweetAttempt])

  // Set up keyboard shortcut handler with capture phase
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we're in a tweet input
      const target = event.target as HTMLElement
      const isTweetInput = target.matches(SELECTORS.TWEET_TEXTAREA) || 
                          target.closest(SELECTORS.TWEET_TEXTBOX) !== null

      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if (isTweetInput && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        debug.log('ContentApp', 'Keyboard shortcut detected', {
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          target: target.tagName,
          isTweetInput
        })

        // Always prevent default for Cmd+Enter
        event.preventDefault()
        event.stopPropagation()
        
        // Use the same tweet attempt handler as the button click
        handleTweetAttempt()
      }
    }

    // Use capture phase to intercept the event before Twitter's handlers
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [handleTweetAttempt])

  const handleConfirm = () => {
    debug.log('ContentApp', 'Confirming tweet')
    setShowModal(false)
    if (originalButton) {
      originalButton.click()
    }
  }

  return modalContainer && showModal ? ReactDOM.createPortal(
    <ConfirmationModal
      open={true}
      onConfirm={handleConfirm}
      onCancel={() => {
        debug.log('ContentApp', 'Canceling tweet')
        setShowModal(false)
      }}
    />,
    modalContainer
  ) : null
}

export default ContentApp
