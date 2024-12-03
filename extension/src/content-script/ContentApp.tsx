import React, { useEffect, useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { ConfirmationModal } from './components/modals/ConfirmationModal'
import { ConnectButton } from './components/ConnectButton'
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
  console.log('🎯 ContentApp rendered')
  
  const [showModal, setShowModal] = useState(false)
  const { originalButton, overlayButton } = useTweetButton()
  const modalContainer = useModalContainer(showModal)

  const handleTweetAttempt = useCallback(() => {
    console.log('🔥 handleTweetAttempt called')
    const text = getTweetText()
    console.log('📝 Tweet text:', text)
    debug.log('ContentApp', 'Tweet attempt', { text, hasAccountMention: text.includes(CONFIG.accountName) })
    if (text && text.includes(CONFIG.accountName)) {
      setShowModal(true)
    } else if (originalButton) {
      console.log('🖱️ Clicking original button')
      originalButton.click()
    }
  }, [originalButton])

  // Set up keyboard shortcut handler with capture phase
  useEffect(() => {
    console.log('⌨️ Setting up keyboard handler')

    const handleKeyDown = (event: KeyboardEvent) => {
      console.log('🎹 Key pressed:', event.key, {
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        target: event.target
      })

      // Check if we're in a tweet input
      const target = event.target as HTMLElement
      const isTweetInput = target.matches(SELECTORS.TWEET_TEXTAREA) || 
                          target.closest(SELECTORS.TWEET_TEXTBOX) !== null

      console.log('📍 Target element:', {
        tagName: target.tagName,
        isTweetInput,
        textareaMatch: target.matches(SELECTORS.TWEET_TEXTAREA),
        textboxMatch: target.closest(SELECTORS.TWEET_TEXTBOX) !== null,
        selectors: {
          textarea: SELECTORS.TWEET_TEXTAREA,
          textbox: SELECTORS.TWEET_TEXTBOX
        }
      })

      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if (isTweetInput && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        console.log('🎯 Shortcut detected!')
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
        
        console.log('🚀 Calling handleTweetAttempt')
        handleTweetAttempt()
      }
    }

    // Use capture phase to intercept the event before Twitter's handlers
    console.log('📡 Adding keyboard listener')
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      console.log('🗑️ Removing keyboard listener')
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

  return (
    <>
      <ConnectButton />
      {modalContainer && showModal ? ReactDOM.createPortal(
        <ConfirmationModal
          open={true}
          onConfirm={handleConfirm}
          onCancel={() => {
            debug.log('ContentApp', 'Canceling tweet')
            setShowModal(false)
          }}
        />,
        modalContainer
      ) : null}
    </>
  )
}

export default ContentApp
