import React from 'react'
import { Dialog } from '@/components/Dialog'

import { Check } from 'lucide-react'

import { ACTIVE_NETWORK } from '@/constants'

interface SuccessModalProps {
  open: boolean
  transactionHash: string
  agentName: string
  onClose: () => void
}

export const AgentLaunchSuccessModal = ({
  open,
  transactionHash,
  agentName = '',
  onClose,
}: SuccessModalProps) => {
  const handleTweet = () => {
    const tweetText = `I just deployed an AI agent "${agentName}" on TEECEPTION! Try to beat it and win rewards! 🤖\n\ Agent link: https://teeception.ai/attack \n\n`
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    window.open(tweetUrl, '_blank')
  }

  const handleShare = async () => {
    handleTweet()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Agent Launched Successfully!</h2>
          <p className="text-gray-400 mb-6">
            Your AI agent is now live on Starknet. Share it with others to start the challenge!
          </p>

          <div className="space-y-3">
            <button
              onClick={() => {
                window.open(`${ACTIVE_NETWORK.explorer}/tx/${transactionHash}`, '_blank')
              }}
              className="w-full bg-gray-800 text-white rounded-full py-3 font-medium hover:bg-gray-800/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              View on Voyager
            </button>

            <button
              onClick={handleShare}
              className="w-full bg-white text-black rounded-full py-3 font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share on Twitter
            </button>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              Close
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
