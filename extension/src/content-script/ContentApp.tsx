import { useEffect, useState, useCallback, useRef } from 'react'
import { ConfirmationModal } from './components/modals/ConfirmationModal'
import { PaymentModal } from './components/modals/PaymentModal'
import { ConnectButton } from './components/ConnectButton'
import { getTweetText } from './utils/dom'
import { useTweetButton } from './hooks/useTweetButton'
import { useTweetObserver } from './hooks/useTweetObserver'
import { SELECTORS } from './constants/selectors'
import { debug } from './utils/debug'
import { extractAgentName } from './utils/twitter'
import { payForTweet, getAgentAddressByName } from './utils/contracts'
import { useAccount } from '@starknet-react/core'
import { TWITTER_CONFIG } from './config/starknet'

const ContentApp = () => {
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [currentAgentName, setCurrentAgentName] = useState<string | null>(null)
  const [currentTweetId, setCurrentTweetId] = useState<string | null>(null)
  const { account } = useAccount()
  const originalButtonRef = useRef<HTMLElement | null>(null)

  const handleTweetAttempt = useCallback(() => {
    const text = getTweetText()

    if (text && text.includes(TWITTER_CONFIG.accountName)) {
      const agentName = extractAgentName(text)
      if (agentName) {
        setCurrentAgentName(agentName)
        setShowConfirmModal(true)
      } else {
        // If no agent name found, just send the tweet
        originalButtonRef.current?.click()
      }
    } else if (originalButtonRef.current) {
      originalButtonRef.current.click()
    }
  }, [])

  const { originalButton } = useTweetButton(handleTweetAttempt)

  // Keep originalButtonRef in sync
  useEffect(() => {
    originalButtonRef.current = originalButton
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

  // Get current user from Twitter
  const [currentUser, setCurrentUser] = useState('')
  useEffect(() => {
    const userElement = document.querySelector('div[data-testid="User-Name"]')
    if (userElement) {
      setCurrentUser(userElement.textContent || '')
    }
  }, [])

  // Use tweet observer
  const { updateBanner, checkUnpaidTweets, markTweetAsPaid } = useTweetObserver(handlePayment, currentUser)

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
          checkForNewTweets={checkUnpaidTweets}
        />
      )}
      {showPaymentModal && currentAgentName && currentTweetId && (
        <PaymentModal
          open={true}
          onConfirm={() => {
            setShowPaymentModal(false)
            setCurrentAgentName(null)
            setCurrentTweetId(null)
          }}
          onCancel={() => {
            setShowPaymentModal(false)
            setCurrentAgentName(null)
            setCurrentTweetId(null)
          }}
          agentName={currentAgentName}
          tweetId={currentTweetId}
          updateBanner={updateBanner}
          checkUnpaidTweets={checkUnpaidTweets}
          markTweetAsPaid={markTweetAsPaid}
        />
      )}
    </>
  )
}

export default ContentApp
