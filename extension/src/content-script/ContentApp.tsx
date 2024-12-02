import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

// Configuration for the account to watch
const CONFIG = {
  accountName: '@jack_the_ether',
}

// Modal Component
const ConfirmationModal = ({ onConfirm, onClose }: { onConfirm: () => void, onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Account Mention Detected</h2>
        <p className="mb-6">You're about to tweet a message mentioning {CONFIG.accountName}.</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

const ContentApp = () => {
  const [showModal, setShowModal] = useState(false)
  const [pendingTweetButton, setPendingTweetButton] = useState<Element | null>(null)

  const handleTweetButtonClick = (event: Event) => {
    const tweetBox = document.querySelector('[data-testid="tweetTextarea_0"]')
    const text = tweetBox?.textContent || ''

    if (text.includes(CONFIG.accountName)) {
      event.preventDefault()
      event.stopPropagation()
      
      // Store the tweet button element for later use
      if (event.target instanceof Element) {
        setPendingTweetButton(event.target)
      }
      setShowModal(true)
    }
  }

  const handleConfirmTweet = () => {
    if (pendingTweetButton) {
      // Create and dispatch a new click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      })
      pendingTweetButton.dispatchEvent(clickEvent)
    }
    setShowModal(false)
    setPendingTweetButton(null)
  }

  useEffect(() => {
    console.log('ContentApp mounted')

    const setupTweetButton = () => {
      const tweetButton = document.querySelector('[data-testid="tweetButton"]')
      if (tweetButton) {
        console.log('Found tweet button, adding click listener')
        tweetButton.addEventListener('click', handleTweetButtonClick, true)
      }
    }

    // Watch for tweet button appearance
    const observer = new MutationObserver((mutations) => {
      setupTweetButton()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // Initial setup
    setupTweetButton()

    // Cleanup
    return () => {
      observer.disconnect()
      const tweetButton = document.querySelector('[data-testid="tweetButton"]')
      if (tweetButton) {
        tweetButton.removeEventListener('click', handleTweetButtonClick, true)
      }
    }
  }, [])

  // Create a portal for the modal
  if (showModal) {
    return ReactDOM.createPortal(
      <ConfirmationModal
        onConfirm={handleConfirmTweet}
        onClose={() => {
          setShowModal(false)
          setPendingTweetButton(null)
        }}
      />,
      document.body
    )
  }

  return null
}

export default ContentApp
