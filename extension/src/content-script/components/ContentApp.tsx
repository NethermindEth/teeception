import { useEffect, useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { ConfirmationModal } from '../components/modals/ConfirmationModal'
import { PaymentModal } from '../components/modals/PaymentModal'
import { ConnectButton } from '../components/ConnectButton'
import { CONFIG } from '../config'
import { getTweetText } from '../utils/dom'
import { useTweetButton } from '../hooks/useTweetButton'
import { useTweetObserver } from '../hooks/useTweetObserver'
import { SELECTORS } from '../constants/selectors'
import { debug } from '../utils/debug'
import { extractAgentName } from '../utils/twitter'
import { getAgentAddressByName } from '../utils/contracts'
import { useAccount } from '@starknet-react/core'

const ContentApp = () => {
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [currentAgentName, setCurrentAgentName] = useState<string | null>(null)
  const [currentTweetId, setCurrentTweetId] = useState<string | null>(null)
  const account = useAccount()

  const handleTweetAttempt = async (agentName: string, tweetId: string) => {
    try {
      debug.log('ContentApp', 'Attempting to pay for tweet', { agentName, tweetId })
      
      // Get agent address to verify it exists
      const agentAddress = await getAgentAddressByName(agentName)
      if (!agentAddress) {
        throw new Error(`Agent ${agentName} not found`)
      }

      // Show payment modal
      setCurrentAgentName(agentName)
      setCurrentTweetId(tweetId)
      setShowPaymentModal(true)
    } catch (error) {
      debug.error('ContentApp', 'Error handling tweet attempt', error)
      throw error
    }
  }

  const handleConfirmPayment = async () => {
    try {
      if (!account) {
        throw new Error('Please connect your wallet first')
      }

      if (currentTweetId && currentAgentName) {
        debug.log('ContentApp', 'Payment confirmed via modal')
        
        // Just cleanup state since transaction is handled by PaymentModal
        setShowPaymentModal(false)
        setCurrentAgentName(null)
        setCurrentTweetId(null)
      }
    } catch (error) {
      debug.error('ContentApp', 'Error in payment confirmation', error)
      throw error
    }
  }

  // ... rest of the component ...
} 