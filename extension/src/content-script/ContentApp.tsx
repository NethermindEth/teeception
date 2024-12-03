import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { ConfirmationModal } from './components/modals/ConfirmationModal'
import { CONFIG } from './config'
import { getTweetText } from './utils/dom'
import { useTweetButton } from './hooks/useTweetButton'
import { useModalContainer } from './hooks/useModalContainer'

/**
 * Main content script application component
 * Manages the tweet button overlay and confirmation modal
 */
const ContentApp = () => {
  const [showModal, setShowModal] = useState(false)
  const { originalButton, overlayButton } = useTweetButton()
  const modalContainer = useModalContainer(showModal)

  // Set up click handler for overlay button
  useEffect(() => {
    if (!overlayButton) return

    const handleClick = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      const text = getTweetText()
      if (text && text.includes(CONFIG.accountName)) {
        setShowModal(true)
      } else if (originalButton) {
        originalButton.click()
      }
    }

    overlayButton.onclick = handleClick

    return () => {
      overlayButton.onclick = null
    }
  }, [overlayButton, originalButton])

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
