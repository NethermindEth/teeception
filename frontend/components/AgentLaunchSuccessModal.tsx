import React from 'react'
import { Dialog } from '@/components/Dialog'
import { Check, ExternalLink, X } from 'lucide-react'

import { ACTIVE_NETWORK } from '@/constants'
import Link from 'next/link'

interface SuccessModalProps {
  open: boolean
  transactionHash: string
  agentName: string
  agentAddress: string
  onClose: () => void
}

export const AgentLaunchSuccessModal = ({
  open,
  transactionHash,
  agentName = '',
  agentAddress = '',
  onClose,
}: SuccessModalProps) => {
  const handleTweet = () => {
    const tweetText = `I just deployed an AI agent "${agentName}" on TEECEPTION! Try to beat it and win rewards! 🤖\n\ Agent link: https://teeception.ai/attack/${agentAddress} \n\n`
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    window.open(tweetUrl, '_blank')
  }

  const handleShare = async () => {
    handleTweet()
  }

  const handleClose = () => {
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="p-6 space-y-5 relative">
        <button 
          onClick={handleClose}
          className="absolute top-0 right-0 p-2 text-gray-400 hover:text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Agent Launched Successfully!</h2>
          <p className="text-gray-400 mb-4">
            Your AI agent is now live on Starknet. Share it with others to start the challenge!
          </p>

          <div className="space-y-3 mb-4">
            <Link 
              href={`/attack/${agentAddress}`} 
              className="w-full bg-gray-800 text-white rounded-lg py-2.5 font-medium hover:bg-gray-700 flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Your Agent
            </Link>

            <button
              onClick={handleShare}
              className="w-full bg-white text-black rounded-lg py-2.5 font-medium hover:bg-white/90 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share on Twitter
            </button>
            
            <button
              onClick={() => {
                window.open(`${ACTIVE_NETWORK.explorer}/tx/${transactionHash}`, '_blank')
              }}
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center justify-center gap-1 mx-auto"
            >
              View transaction details on Voyager
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
