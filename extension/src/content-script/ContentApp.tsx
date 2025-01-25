import { useEffect, useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { ConfirmationModal } from './components/modals/ConfirmationModal'
import { ConnectButton } from './components/ConnectButton'
import { CONFIG } from './config'
import { getTweetText } from './utils/dom'
import { useTweetButton } from './hooks/useTweetButton'
import { useModalContainer } from './hooks/useModalContainer'
import { useTweetObserver } from './hooks/useTweetObserver'
import { SELECTORS } from './constants/selectors'
import { debug } from './utils/debug'
import { extractAgentName } from './utils/twitter'
import { payForTweet, getPromptPrice, getAgentAddressByName } from './utils/contracts'

const ContentApp = () => {
  const [showModal, setShowModal] = useState(false)
  const [currentAgentName, setCurrentAgentName] = useState<string | null>(null)
  const [currentTweetId, setCurrentTweetId] = useState<string | null>(null)
  const { originalButton } = useTweetButton()
  const modalContainer = useModalContainer(showModal)

  const handleTweetAttempt = useCallback(() => {
    debug.log('ContentApp', 'Handle Tweet attempt called')
    const text = getTweetText()
    debug.log('ContentApp', 'Tweet text:', { text })
    
    if (text && text.includes(CONFIG.accountName)) {
      const agentName = extractAgentName(text)
      debug.log('ContentApp', 'Found agent name:', { agentName })
      if (agentName) {
        setCurrentAgentName(agentName)
        setShowModal(true)
      } else {
        // If no agent name found, just send the tweet
        originalButton?.click()
      }
    } else if (originalButton) {
      originalButton.click()
    }
  }, [originalButton])

  const handlePayment = useCallback(async (tweetId: string, agentName: string) => {
    debug.log('ContentApp', 'Handling payment', { tweetId, agentName })
    setCurrentTweetId(tweetId)
    setCurrentAgentName(agentName)
    setShowModal(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      debug.log('ContentApp', 'Key pressed:', {
        key: event.key,
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

  const handleConfirm = async () => {
    try {
      if (currentTweetId && currentAgentName) {
        // Get agent address
        const agentAddress = await getAgentAddressByName(currentAgentName)
        if (!agentAddress) {
          throw new Error(`Agent ${currentAgentName} not found`)
        }
        
        // Get the price for the challenge
        const price = await getPromptPrice(agentAddress)
        debug.log('ContentApp', 'Got prompt price', { price })
        
        // Send the payment transaction
        const txHash = await payForTweet(agentAddress, currentTweetId)
        debug.log('ContentApp', 'Payment sent', { txHash })
        
        // TODO: Show transaction pending notification
      } else if (originalButton) {
        // If no tweet ID, this is a new tweet confirmation
        originalButton.click()
      }
    } catch (error) {
      debug.error('ContentApp', 'Error handling confirmation', error)
      // TODO: Show error notification
    } finally {
      setShowModal(false)
      setCurrentAgentName(null)
      setCurrentTweetId(null)
    }
  }

  // Get current user from Twitter
  const [currentUser, setCurrentUser] = useState('')
  useEffect(() => {
    const userElement = document.querySelector('div[data-testid="UserName"]')
    if (userElement) {
      setCurrentUser(userElement.textContent || '')
    }
  }, [])

  // Use tweet observer
  useTweetObserver(handlePayment, currentUser)

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
                setCurrentAgentName(null)
                setCurrentTweetId(null)
              }}
              agentName={currentAgentName || undefined}
            />,
            modalContainer
          )
        : null}
    </>
  )
}

export default ContentApp
