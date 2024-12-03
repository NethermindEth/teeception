import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { ConfirmationModal } from './components/ConfirmationModal'
import { CONFIG } from './config'
import { getTweetText } from './utils/dom'

const TWEET_BUTTON_SELECTOR = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'

const debug = {
  log: (component: string, action: string, data?: any) => {
    console.log(`[JackTheEther][${component}] ${action}`, data || '')
  },
  error: (component: string, action: string, error: any) => {
    console.error(`[JackTheEther][${component}] ${action} failed:`, error)
  }
}

const createOverlayButton = (originalButton: HTMLElement) => {
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
  return overlay
}

const createModalContainer = () => {
  const container = document.createElement('div')
  container.id = 'jack-the-ether-modal-container'
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '0'
  container.style.right = '0'
  container.style.bottom = '0'
  container.style.zIndex = '9999'
  document.body.appendChild(container)
  return container
}

const ContentApp = () => {
  const [showModal, setShowModal] = useState(false)
  const [modalContainer, setModalContainer] = useState<HTMLElement | null>(null)
  const [originalButton, setOriginalButton] = useState<HTMLElement | null>(null)
  const [overlayButton, setOverlayButton] = useState<HTMLElement | null>(null)

  // Create/remove modal container when modal visibility changes
  useEffect(() => {
    if (showModal) {
      const container = createModalContainer()
      setModalContainer(container)
      return () => {
        container.remove()
        setModalContainer(null)
      }
    }
  }, [showModal])

  // Watch for tweet buttons and create overlays
  useEffect(() => {
    let currentOverlay: HTMLElement | null = null
    let currentResizeObserver: ResizeObserver | null = null
    let isUpdating = false
    let updatePositionFn: ((time: number) => void) | null = null
    let lastUpdateTime = 0

    const updateOverlays = () => {
      const now = Date.now()
      if (now - lastUpdateTime < 100 || isUpdating) return
      lastUpdateTime = now
      isUpdating = true
      
      try {
        if (currentOverlay) {
          currentOverlay.remove()
          currentResizeObserver?.disconnect()
        }
        
        const tweetButtons = Array.from(document.querySelectorAll(TWEET_BUTTON_SELECTOR))
        const tweetButton = tweetButtons
          .filter(b => {
            const rect = b.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
          })
          .pop() as HTMLElement | undefined

        if (tweetButton) {
          const overlay = createOverlayButton(tweetButton)
          
          updatePositionFn = (time: number) => {
            const newRect = tweetButton.getBoundingClientRect()
            if (newRect.width > 0 && newRect.height > 0) {
              overlay.style.top = `${newRect.top}px`
              overlay.style.left = `${newRect.left}px`
              overlay.style.width = `${newRect.width}px`
              overlay.style.height = `${newRect.height}px`
              overlay.style.display = 'block'
            } else {
              overlay.style.display = 'none'
            }
          }

          let resizeTimeout: number | null = null
          const tweetBox = document.querySelector('[data-testid="tweetTextarea_0"], [data-testid="tweetTextarea_1"]')
            ?.closest('div[role="textbox"]')
          
          if (tweetBox) {
            currentResizeObserver = new ResizeObserver(() => {
              if (resizeTimeout) window.cancelAnimationFrame(resizeTimeout)
              if (updatePositionFn) resizeTimeout = window.requestAnimationFrame(updatePositionFn)
            })
            currentResizeObserver.observe(tweetBox)
          }

          const handleScroll = () => {
            if (updatePositionFn) window.requestAnimationFrame(updatePositionFn)
          }

          window.addEventListener('scroll', handleScroll, { passive: true })
          window.addEventListener('resize', handleScroll, { passive: true })

          document.body.appendChild(overlay)
          currentOverlay = overlay

          overlay.onclick = (event) => {
            event.preventDefault()
            event.stopPropagation()

            const text = getTweetText()
            if (text && text.includes(CONFIG.accountName)) {
              setShowModal(true)
            } else {
              tweetButton.click()
            }
          }

          setOverlayButton(overlay)
          setOriginalButton(tweetButton)
        }
      } finally {
        isUpdating = false
      }
    }

    setTimeout(updateOverlays, 500)

    let mutationTimeout: NodeJS.Timeout | null = null
    const observer = new MutationObserver(() => {
      if (mutationTimeout) clearTimeout(mutationTimeout)
      mutationTimeout = setTimeout(updateOverlays, 100)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    })

    return () => {
      observer.disconnect()
      currentResizeObserver?.disconnect()
      currentOverlay?.remove()
      if (mutationTimeout) clearTimeout(mutationTimeout)
    }
  }, [])

  const handleConfirm = () => {
    setShowModal(false)
    if (originalButton) originalButton.click()
  }

  return modalContainer && showModal ? ReactDOM.createPortal(
    <ConfirmationModal
      open={true}
      onConfirm={handleConfirm}
      onCancel={() => setShowModal(false)}
    />,
    modalContainer
  ) : null
}

export default ContentApp
