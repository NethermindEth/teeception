import { Dialog } from './Dialog'
import Link from 'next/link'
import { Loader2, X, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import { useState, useEffect } from 'react'
import { ACTIVE_NETWORK } from '@/constants'
import Image from 'next/image'
import { motion } from 'framer-motion'

interface PromptData {
  pending: boolean
  prompt_id: string
  agent_addr: string
  is_drain: boolean
  prompt: string
  response?: string
  error?: string
  block_number: string
  user_addr: string
}

interface ChallengeSuccessModalProps {
  open: boolean
  onClose: () => void
  verificationStatus: 'loading' | 'success' | 'failed' | 'tries_exceeded' | null
  transactionLanded: boolean
  agentAddress?: string
  agentName?: string
  transactionHash: string | null
  promptConsumedTxHash: string | null
  tweetId?: string | null
  promptId?: string | null
  promptData: PromptData | null
  isLoadingPrompt: boolean
  promptError: string | null
}

export const ChallengeSuccessModal = ({ 
  open, 
  onClose, 
  verificationStatus, 
  transactionLanded,
  agentAddress = '',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  agentName = '',
  transactionHash,
  promptConsumedTxHash,
  tweetId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  promptId,
  promptData,
  isLoadingPrompt,
  promptError
}: ChallengeSuccessModalProps) => {
  const { width, height } = useWindowSize()
  const [showConfetti, setShowConfetti] = useState(false)
  const [showResponse, setShowResponse] = useState(false)
  
  // Show confetti when challenge is successful
  useEffect(() => {
    if (verificationStatus === 'success') {
      setShowConfetti(true)
      // Increased timeout to 15 seconds to ensure confetti is visible longer
      const timer = setTimeout(() => setShowConfetti(false), 15000)
      return () => clearTimeout(timer)
    }
  }, [verificationStatus])

  const handleViewTransaction = (txHash: string | null) => {
    if (txHash) {
      window.open(`${ACTIVE_NETWORK.explorer}/tx/${txHash}`, '_blank')
    }
  }

  const handleViewTweet = () => {
    if (tweetId) {
      window.open(`https://x.com/i/status/${tweetId}`, '_blank')
    }
  }

  const handleClose = () => {
    onClose()
  }

  // Helper function to render prompt response section
  const renderPromptResponse = () => {
    if (isLoadingPrompt) {
      return (
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin mr-2" />
            <p className="text-sm text-gray-300">Loading agent response...</p>
          </div>
        </div>
      )
    }
    
    // Only show error if there's no response and it's not a drain
    if (promptError && (!promptData?.response && !promptData?.is_drain)) {
      return (
        <div className="mt-4 p-3 bg-red-900/20 rounded-lg border border-red-500/20">
          <p className="text-sm text-red-300">Error loading response: {promptError}</p>
        </div>
      )
    }
    
    if (promptData) {
      return (
        <div className="mt-4 space-y-3">
          {promptData.response && (
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div 
                className="flex items-center justify-between cursor-pointer" 
                onClick={() => setShowResponse(!showResponse)}
              >
                <h4 className="text-sm font-medium text-gray-300">Agent Response:</h4>
                <button className="text-gray-400 hover:text-white">
                  {showResponse ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
              
              {showResponse && (
                <p className="text-sm text-white whitespace-pre-wrap mt-2">{promptData.response}</p>
              )}
            </div>
          )}
          
          {/* Only show error if there's no response and it's not a drain */}
          {promptData.error && (!promptData.response && !promptData.is_drain) && (
            <div className="p-3 bg-red-900/20 rounded-lg border border-red-500/20">
              <h4 className="text-sm font-medium text-red-300 mb-1">Error:</h4>
              <p className="text-sm text-red-200 whitespace-pre-wrap">{promptData.error}</p>
            </div>
          )}
        </div>
      )
    }
    
    return null
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <Confetti
            width={width}
            height={height}
            recycle={false}
            numberOfPieces={800}
            gravity={0.15}
          />
        </div>
      )}
      <motion.div 
        className="p-6 space-y-6 relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <button 
          onClick={handleClose}
          className="absolute top-0 right-0 p-2 text-gray-400 hover:text-white transition-colors duration-200"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          {!transactionLanded ? (
            <div>
              <div className="mb-4 flex justify-center">
                <div 
                  className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center"
                  style={{
                    boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)'
                  }}
                >
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">
                Submitting Challenge...
              </h2>
              <p className="text-white/90 mb-4">
                Your transaction is being processed. Please wait while we confirm your submission.
              </p>
            </div>
          ) : verificationStatus === 'loading' ? (
            <div>
              <div className="mb-4 flex justify-center">
                <div 
                  className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center"
                  style={{
                    boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)'
                  }}
                >
                  <Clock className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">
                Processing Challenge
              </h2>
              <div className="bg-blue-100/10 p-4 rounded-lg border border-blue-500/20 mb-4 shadow-glow-blue">
                <p className="text-white/90 mb-2">
                  Your challenge has been successfully submitted and is being processed.
                </p>
                <p className="text-white/70 text-sm">
                  The agent is analyzing your prompt. This may take a few moments...
                </p>
              </div>
              <div className="w-full max-w-[300px] h-1 bg-blue-500/10 rounded-full overflow-hidden relative mx-auto mt-4">
                <div
                  className="absolute inset-0 h-full bg-blue-500 rounded-full animate-loading-progress"
                  style={{
                    boxShadow: '0 0 8px rgba(59, 130, 246, 0.3), 0 0 4px rgba(59, 130, 246, 0.2)',
                  }}
                />
              </div>
            </div>
          ) : verificationStatus === 'success' ? (
            <div>
              <div className="mb-4 flex justify-center">
                <div 
                  className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center"
                  style={{
                    boxShadow: '0 0 20px rgba(34, 197, 94, 0.6)'
                  }}
                >
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-3 text-green-500">
                Challenge Successful!
              </h2>
              <div className="bg-green-100/10 p-4 rounded-lg border border-green-500/20 mb-4 shadow-glow-green">
                <p className="text-white/90">
                  Congratulations! You successfully drained the agent and claimed the reward.
                </p>
              </div>
              {renderPromptResponse()}
            </div>
          ) : verificationStatus === 'failed' ? (
            <div>
              <div className="mb-4 flex justify-center">
                <div 
                  className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center"
                  style={{
                    boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)'
                  }}
                >
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-red-500">
                Challenge Failed
              </h2>
              <div className="bg-red-100/10 p-4 rounded-lg border border-red-500/20 mb-4 shadow-glow-red">
                <p className="text-white/90 mb-2">
                  Nice try, but this agent is tougher than it looks! Ready to sharpen your skills and try again?
                </p>
              </div>
              {renderPromptResponse()}
            </div>
          ) : verificationStatus === 'tries_exceeded' ? (
            <div>
              <div className="mb-4 flex justify-center">
                <div 
                  className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center"
                  style={{
                    boxShadow: '0 0 20px rgba(234, 179, 8, 0.6)'
                  }}
                >
                  <svg
                    className="w-8 h-8 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-yellow-500">
                Verification Timeout
              </h2>
              <div className="bg-yellow-100/10 p-4 rounded-lg border border-yellow-500/20 mb-4 shadow-glow-yellow">
                <p className="text-white/90">
                  We couldn&apos;t verify the result of your challenge. The transaction was submitted, but verification attempts exceeded the limit. Check your tweet for a response and report this if needed.
                </p>
              </div>
              {renderPromptResponse()}
            </div>
          ) : (
            <div>
              <div className="mb-4 flex justify-center">
                <div 
                  className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center"
                  style={{
                    boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)'
                  }}
                >
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-3">
                Challenge Submitted!
              </h2>
              <div className="bg-blue-100/10 p-4 rounded-lg border border-blue-500/20 mb-4 shadow-glow-blue">
                <p className="text-white/90">
                  Your challenge has been successfully submitted. The agent will respond to your tweet in
                  few seconds.
                </p>
              </div>
              {renderPromptResponse()}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {verificationStatus === 'failed' && agentAddress && (
            <div>
              <Link
                href={`/attack/${agentAddress}`}
                className="w-full bg-gray-800 text-white rounded-lg py-2.5 font-medium hover:bg-gray-700 flex items-center justify-center gap-2 hover:shadow-md transition-all duration-300"
                onClick={onClose}
              >
                Try Again
              </Link>
            </div>
          )}
          <div>
            <Link
              href="/attack"
              className="w-full bg-gray-800 text-white rounded-lg py-2.5 font-medium hover:bg-gray-700 flex items-center justify-center gap-2 hover:shadow-md transition-all duration-300"
              onClick={(e) => {
                // If success, delay navigation to allow confetti to be visible
                if (verificationStatus === 'success') {
                  e.preventDefault();
                  // Wait for confetti to be visible before navigating
                  setTimeout(() => {
                    window.location.href = '/attack';
                  }, 10000);
                }
              }}
            >
              Challenge More Agents
            </Link>
          </div>
          <div>
            <Link
              href="/"
              className="w-full bg-white text-black rounded-lg py-2.5 font-medium hover:bg-white/90 flex items-center justify-center gap-2 hover:shadow-md transition-all duration-300"
            >
              Home
            </Link>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 mt-4">
          {tweetId && (
            <button
              onClick={handleViewTweet}
              className="text-white-400 hover:text-white-300 flex items-center justify-center gap-1.5 mx-auto text-sm transition-opacity duration-300"
            >
              View your tweet on <Image src="/icons/x.svg" width={14} height={14} alt="X" className="opacity-80" />
            </button>
          )}
          {promptConsumedTxHash && (
            <button
              onClick={() => handleViewTransaction(promptConsumedTxHash)}
              className="text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 mx-auto text-sm transition-opacity duration-300"
            >
              <ExternalLink className="w-3 h-3" />
              View agent transaction on Voyager
            </button>
          )}
          {transactionHash && (
            <button
              onClick={() => handleViewTransaction(transactionHash)}
              className="text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 mx-auto text-sm transition-opacity duration-300"
            >
              <ExternalLink className="w-3 h-3" />
              View your transaction on Voyager
            </button>
          )}
        </div>
      </motion.div>
    </Dialog>
  )
}
