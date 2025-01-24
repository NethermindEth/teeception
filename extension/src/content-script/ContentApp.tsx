import { useEffect, useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { ConfirmationModal } from './components/modals/ConfirmationModal'
import { ConnectButton } from './components/ConnectButton'
import { CONFIG } from './config'
import { getTweetText } from './utils/dom'
import { useTweetButton } from './hooks/useTweetButton'
import { useModalContainer } from './hooks/useModalContainer'
import { SELECTORS } from './constants/selectors'

const ContentApp = () => {
  const [showModal, setShowModal] = useState(false)
  const { originalButton } = useTweetButton()
  const modalContainer = useModalContainer(showModal)

  const handleTweetAttempt = useCallback(() => {
    console.log('Handle Tweet attempt called')
    const text = getTweetText()
    console.log('tweet text', text)
    if (text && text.includes(CONFIG.accountName)) {
      setShowModal(true)
    } else if (originalButton) {
      originalButton.click()
    }
  }, [originalButton])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      console.log('🎹 Key pressed:', event.key, {
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        target: event.target,
      })

      // Check if we're in a tweet input
      const target = event.target as HTMLElement
      const isTweetInput =
        target.matches(SELECTORS.TWEET_TEXTAREA) || target.closest(SELECTORS.TWEET_TEXTBOX) !== null

      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if (isTweetInput && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        // Always prevent default for Cmd+Enter
        event.preventDefault()
        event.stopPropagation()

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
    setShowModal(false)
    //TODO: Here we need to make the payment
    if (originalButton) {
      originalButton.click()
    }
  }

  return (
    <>
      <ConnectButton />
      {modalContainer
        ? ReactDOM.createPortal(
            <ConfirmationModal
              open={true}
              onConfirm={handleConfirm}
              onCancel={() => {
                setShowModal(false)
              }}
            />,
            modalContainer
          )
        : null}
    </>
  )
}

export default ContentApp
