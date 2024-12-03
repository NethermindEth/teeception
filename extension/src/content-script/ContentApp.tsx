import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Configuration for the account to watch
const CONFIG = {
  accountName: '@jack_the_ether',
}

// Create a container for our modal
const createModalContainer = () => {
  let container = document.getElementById('jack-the-ether-modal-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'jack-the-ether-modal-container'
    container.style.position = 'fixed'
    container.style.top = '0'
    container.style.left = '0'
    container.style.right = '0'
    container.style.bottom = '0'
    container.style.zIndex = '9999'
    container.style.pointerEvents = 'none'
    document.body.appendChild(container)
    console.log('Created modal container:', container)
  }
  return container
}

const ConfirmationModal = ({ 
  open, 
  onClose,
  tweetButton 
}: { 
  open: boolean
  onClose: () => void
  tweetButton: HTMLElement | null
}) => {
  console.log('Rendering ConfirmationModal, open:', open)

  if (!open) return null

  return (
    <div 
      className={cn(
        "absolute inset-0 flex items-center justify-center",
        "bg-background/80 backdrop-blur-sm"
      )}
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div 
        className={cn(
          "relative",
          "w-full max-w-lg",
          "bg-card text-card-foreground",
          "rounded-lg border shadow-lg",
          "animate-in fade-in-0 zoom-in-95"
        )}
        style={{
          width: '400px',
          maxWidth: '90vw',
        }}
      >
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold leading-none tracking-tight">
              Account Mention Detected
            </h2>
            <p className="text-sm text-muted-foreground">
              You're about to tweet a message mentioning {CONFIG.accountName}.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            {/* Container for the original tweet button */}
            <div id="original-tweet-button-container" />
          </div>
        </div>
      </div>
    </div>
  )
}

const ContentApp = () => {
  const [showModal, setShowModal] = useState(false)
  const [modalContainer, setModalContainer] = useState<HTMLElement | null>(null)
  const [originalButton, setOriginalButton] = useState<HTMLElement | null>(null)

  const handleTweet = () => {
    const tweetBox = document.querySelector('[data-testid="tweetTextarea_0"], [data-testid="tweetTextarea_1"]')
    const text = tweetBox?.textContent || ''
    
    if (text.includes(CONFIG.accountName)) {
      console.log('Account mention detected, showing modal')
      setShowModal(true)
    } else {
      console.log('No account mention detected')
      // Click the original button directly
      originalButton?.click()
    }
  }

  useEffect(() => {
    // Set up modal container
    const container = createModalContainer()
    setModalContainer(container)
    console.log('Modal container set:', container)

    return () => {
      container.remove()
    }
  }, [])

  useEffect(() => {
    console.log('ContentApp mounted')

    const replaceTweetButton = (button: Element) => {
      if (button instanceof HTMLElement) {
        console.log('Found tweet button, replacing with our button')
        
        // Store the original button
        setOriginalButton(button)
        
        // Create our replacement button
        const ourButton = document.createElement('div')
        ReactDOM.render(
          <Button
            className={button.className}
            onClick={handleTweet}
          >
            Tweet
          </Button>,
          ourButton
        )
        
        // Replace the original button with our button
        button.parentNode?.replaceChild(ourButton, button)
      }
    }

    // Watch for tweet button appearance
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) {
            const button = node.querySelector('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]')
            if (button) {
              replaceTweetButton(button)
            }
          }
        })
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // Initial setup
    const existingButton = document.querySelector('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]')
    if (existingButton) {
      replaceTweetButton(existingButton)
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  // Move the original button into our modal when it's shown
  useEffect(() => {
    if (showModal && originalButton) {
      const container = document.getElementById('original-tweet-button-container')
      if (container) {
        container.appendChild(originalButton)
      }
    }
  }, [showModal, originalButton])

  return modalContainer ? ReactDOM.createPortal(
    <ConfirmationModal
      open={showModal}
      tweetButton={originalButton}
      onClose={() => {
        console.log('Modal closed')
        setShowModal(false)
      }}
    />,
    modalContainer
  ) : null
}

export default ContentApp
