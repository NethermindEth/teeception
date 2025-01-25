import { useEffect, useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { ConfirmationModal } from './components/modals/ConfirmationModal'
import { PaymentModal } from './components/modals/PaymentModal'
import { ConnectButton } from './components/ConnectButton'
import { CONFIG } from './config'
import { getTweetText } from './utils/dom'
import { useTweetButton } from './hooks/useTweetButton'
import { useTweetObserver } from './hooks/useTweetObserver'
import { SELECTORS } from './constants/selectors'
import { debug } from './utils/debug'
import { extractAgentName } from './utils/twitter'
import { payForTweet, getAgentAddressByName } from './utils/contracts'
import { useAccount } from '@starknet-react/core'

const ContentApp = () => {
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [currentAgentName, setCurrentAgentName] = useState<string | null>(null)
  const [currentTweetId, setCurrentTweetId] = useState<string | null>(null)
  const { originalButton } = useTweetButton()
  const { account } = useAccount()

  const handleTweetAttempt = useCallback(() => {
    const text = getTweetText()
    
    if (text && text.includes(CONFIG.accountName)) {
      const agentName = extractAgentName(text)
      if (agentName) {
        setCurrentAgentName(agentName)
        setShowConfirmModal(true)
      } else {
        // If no agent name found, just send the tweet
        originalButton?.click()
      }
    } else if (originalButton) {
      originalButton.click()
    }
  }, [originalButton])

  const handlePayment = useCallback(async (tweetId: string, agentName: string) => {
    setCurrentTweetId(tweetId)
    setCurrentAgentName(agentName)
    setShowPaymentModal(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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

  const handleConfirmTweet = () => {
    if (originalButton) {
      originalButton.click()
    }
    setShowConfirmModal(false)
    setCurrentAgentName(null)
  }

  const handleConfirmPayment = async () => {
    try {
      if (!account) {
        throw new Error('Please connect your wallet first')
      }

      if (currentTweetId && currentAgentName) {
        // Get agent address first
        const agentAddress = await getAgentAddressByName(currentAgentName)
        if (!agentAddress) {
          throw new Error(`Agent ${currentAgentName} not found`)
        }
        
        debug.log('ContentApp', 'Sending payment transaction', {
          agentAddress,
          tweetId: currentTweetId,
          account
        })

        // Send the payment transaction
        const txHash = await payForTweet(agentAddress, currentTweetId, account)
        debug.log('ContentApp', 'Payment transaction sent', { txHash })
        
        // Only close modal after successful transaction
        setShowPaymentModal(false)
        setCurrentAgentName(null)
        setCurrentTweetId(null)
        
        // TODO: Show transaction pending notification
      }
    } catch (error) {
      debug.error('ContentApp', 'Error handling payment', error)
      throw error // Re-throw to let PaymentModal handle the error state
    }
  }

  // Get current user from Twitter
  const [currentUser, setCurrentUser] = useState('')
  useEffect(() => {
    const userElement = document.querySelector('div[data-testid="User-Name"]')
    if (userElement) {
      setCurrentUser(userElement.textContent || '')
    }
  }, [])

  // Use tweet observer
  useTweetObserver(handlePayment, currentUser)

  return (
    <>
      <ConnectButton />
      {showConfirmModal && (
        <ConfirmationModal
          open={true}
          onConfirm={handleConfirmTweet}
          onCancel={() => {
            setShowConfirmModal(false)
            setCurrentAgentName(null)
          }}
          agentName={currentAgentName || undefined}
        />
      )}
      {showPaymentModal && currentAgentName && currentTweetId && (
        <PaymentModal
          open={true}
          onConfirm={handleConfirmPayment}
          onCancel={() => {
            setShowPaymentModal(false)
            setCurrentAgentName(null)
            setCurrentTweetId(null)
          }}
          agentName={currentAgentName}
          tweetId={currentTweetId}
        />
      )}
    </>
  )
}

export default ContentApp
