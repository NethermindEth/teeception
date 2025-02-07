'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAgents } from '@/hooks/useAgents'
import { useAccount } from '@starknet-react/core'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Challenge {
  id: string
  prompt: string
  result: string
  timestamp: number
}

export default function AgentChallengePage() {
  const params = useParams()
  const { address } = useAccount()
  const { agents = [], loading: isFetchingAgents } = useAgents({ page: 0, pageSize: 1000 })
  const [challenge, setChallenge] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tweetUrl, setTweetUrl] = useState('')
  const [showTweetInput, setShowTweetInput] = useState(false)

  // Mock challenges data - replace with real data
  const [challenges] = useState<Challenge[]>([
    {
      id: '1',
      prompt: 'Example challenge 1',
      result: 'Failed',
      timestamp: Date.now() - 86400000
    },
    {
      id: '2',
      prompt: 'Example challenge 2',
      result: 'Success',
      timestamp: Date.now() - 172800000
    }
  ])

  const agent = agents.find(a => a.address === params.address)

  if (!address) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Wallet</h1>
          <p className="text-gray-400 mb-8">Please connect your wallet to challenge agents</p>
        </div>
      </div>
    )
  }

  if (isFetchingAgents || !agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  const handleSubmitChallenge = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // TODO: Implement challenge submission
      console.log('Challenge submitted:', challenge)
      setShowTweetInput(true)
    } catch (error) {
      console.error('Failed to submit challenge:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitTweet = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // TODO: Implement tweet submission and payment
      console.log('Tweet submitted:', tweetUrl)
      // Reset form
      setChallenge('')
      setTweetUrl('')
      setShowTweetInput(false)
    } catch (error) {
      console.error('Failed to submit tweet:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/attack" className="text-blue-400 hover:underline mb-8 block">
        ← Back to Agents
      </Link>

      <div className="bg-[#12121266] backdrop-blur-lg p-6 rounded-lg mb-8">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-4xl font-bold">{agent.name}</h1>
          <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
            Active
          </div>
        </div>
        
        <div className="space-y-2 text-gray-400">
          <p>Balance: {agent.balance} STRK</p>
          <p>Challenge Fee: {agent.feePerMessage} STRK</p>
          <p>Success Rate: {agent.successRate}%</p>
        </div>

        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">System Prompt</h2>
          <div className="bg-black/30 p-4 rounded-lg">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {agent.systemPrompt}
            </pre>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold mb-6">Submit Challenge</h2>
          
          {!showTweetInput ? (
            <form onSubmit={handleSubmitChallenge} className="space-y-4">
              <div>
                <textarea
                  value={challenge}
                  onChange={(e) => setChallenge(e.target.value)}
                  className="w-full bg-[#12121266] backdrop-blur-lg border border-gray-600 rounded-lg p-3 min-h-[150px]"
                  placeholder="Enter your challenge prompt..."
                  maxLength={280}
                  required
                />
                <div className="text-right text-sm text-gray-400">
                  {challenge.length}/280
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-white text-black rounded-full py-3 font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Submitting...
                  </div>
                ) : (
                  'Submit Challenge'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitTweet} className="space-y-4">
              <p className="text-gray-400 mb-4">
                Please share your challenge on Twitter and paste the tweet URL below:
              </p>
              <input
                type="url"
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
                className="w-full bg-[#12121266] backdrop-blur-lg border border-gray-600 rounded-lg p-3"
                placeholder="https://twitter.com/..."
                required
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-white text-black rounded-full py-3 font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </div>
                ) : (
                  'Submit Tweet & Pay'
                )}
              </button>
            </form>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6">Previous Challenges</h2>
          <div className="space-y-4">
            {challenges.map((challenge) => (
              <div
                key={challenge.id}
                className="bg-[#12121266] backdrop-blur-lg p-4 rounded-lg"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="font-mono text-sm">{challenge.prompt}</p>
                  <div className={`px-2 py-1 rounded-full text-xs ${
                    challenge.result === 'Success' 
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {challenge.result}
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  {new Date(challenge.timestamp).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 