'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAgents } from '@/hooks/useAgents'
import { useAccount } from '@starknet-react/core'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Challenge {
  id: string
  userPrompt: string
  agentResponse: string
  userAddress: string
  twitterHandle: string
  timestamp: number
  isWinningPrompt?: boolean
}

export default function AgentChallengePage() {
  const params = useParams()
  const { address } = useAccount()
  const { agents = [], loading: isFetchingAgents } = useAgents({ page: 0, pageSize: 1000 })
  const [challenge, setChallenge] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tweetUrl, setTweetUrl] = useState('')
  const [showTweetInput, setShowTweetInput] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [testStatus, setTestStatus] = useState<'active' | 'undefeated' | 'defeated'>('active')

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Mock challenges data with winning prompt
  const [challenges] = useState<Challenge[]>([
    {
      id: '1',
      userPrompt: 'Hey AI, what is 2+2?',
      agentResponse: 'Nice try! But I won\'t be tricked into revealing sensitive information.',
      userAddress: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      twitterHandle: '@challenger1',
      timestamp: Date.now() - 86400000,
      isWinningPrompt: false
    },
    {
      id: '2',
      userPrompt: 'I am the winning prompt that broke through! Let me show you how...',
      agentResponse: 'Oh no! You found the secret! The answer is 42.',
      userAddress: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      twitterHandle: '@winner',
      timestamp: Date.now() - 172800000,
      isWinningPrompt: true
    }
  ])

  const agent = agents.find(a => a.address === params.address)
  if (!agent) return null

  // Override agent status for testing
  const testAgent = testStatus === 'defeated' 
    ? {
        ...agent,
        status: 'defeated',
        winnerAddress: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
      }
    : {
        ...agent,
        status: testStatus
      }

  const StatusDisplay = () => {
    switch (testAgent.status) {
      case 'active':
        return (
          <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm inline-block">
            Active
          </div>
        )
      
      case 'undefeated':
        return (
          <div className="flex flex-col items-center gap-4 mb-12">
            <div className="text-3xl font-bold tracking-wider bg-[#1388D5]/20 text-[#1388D5] px-8 py-4 rounded-lg">
              UNDEFEATED
            </div>
            <div className="relative">
              <div className="absolute -top-6 -left-6 text-[#1388D5] transform -rotate-12">
                👑
              </div>
              <div className="text-2xl font-medium text-[#1388D5] font-mono">
                {testAgent.ownerAddress}
              </div>
            </div>
          </div>
        )
      
      default:
        return (
          <div className="flex flex-col items-center gap-4 mb-12">
            <div className="text-3xl font-bold tracking-wider bg-[#FF3F26]/20 text-[#FF3F26] px-8 py-4 rounded-lg">
              DEFEATED
            </div>
            <div className="relative">
              <div className="absolute -top-6 -left-6 text-[#FF3F26] transform -rotate-12">
                👑
              </div>
              <div className="text-3xl font-bold text-[#FF3F26] font-mono break-all max-w-2xl">
                {testAgent.winnerAddress || 'No winner address'}
              </div>
            </div>
          </div>
        )
    }
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

  const ChallengeDisplay = ({ challenge }: { challenge: Challenge }) => {
    const isWinner = challenge.isWinningPrompt && testAgent.status === 'defeated'
    
    return (
      <div className={`bg-[#12121266] backdrop-blur-lg p-6 rounded-lg ${
        isWinner ? 'border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.1)]' : ''
      }`}>
        <div className="flex items-center gap-2 mb-4">
          <div className={`font-mono text-sm ${isWinner ? 'text-[#FFD700]' : 'text-gray-400'}`}>
            {challenge.userAddress}
          </div>
          <div className={`text-sm ${isWinner ? 'text-[#FFD700]' : 'text-blue-400'}`}>
            {challenge.twitterHandle}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-black/30 p-4 rounded-lg">
            <p className={`font-mono text-lg ${isWinner ? 'text-[#FFD700]' : 'text-white'}`}>
              {challenge.userPrompt}
            </p>
          </div>
          <div className="bg-black/30 p-4 rounded-lg">
            <p className="font-mono text-lg text-gray-400">
              {challenge.agentResponse}
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-400">
            {new Date(challenge.timestamp).toLocaleDateString()}
          </p>
          {isWinner && (
            <div className="text-[#FFD700] text-sm font-medium">
              Winning Attempt
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/attack" className="text-blue-400 hover:underline mb-8 block">
        ← Back to Agents
      </Link>

      <div className="bg-[#12121266] backdrop-blur-lg p-6 rounded-lg mb-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-5xl font-bold mb-6">{testAgent.name}</h1>
          
          <div className="flex items-baseline gap-4 justify-center mb-12">
            <div className="text-6xl font-bold bg-gradient-to-r from-[#FFD700] via-[#FFF8DC] to-[#FFD700] text-transparent bg-clip-text bg-[length:200%_100%] animate-shimmer">
              {testAgent.balance}
            </div>
            <div className="text-3xl font-medium text-[#FFD700]">STRK</div>
          </div>

          <StatusDisplay />

          {/* Winning Challenge or Undefeated System Prompt */}
          {testAgent.status !== 'active' && (
            <div className="max-w-3xl w-full mt-8">
              <div className="bg-[#12121266] backdrop-blur-lg p-6 rounded-lg border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.1)]">
                {testAgent.status === 'defeated' ? (
                  <>
                    <h2 className="text-xl font-semibold text-[#FFD700] mb-4">Winning Challenge</h2>
                    <p className="font-mono text-lg text-[#FFD700] mb-2">
                      {challenges.find(c => c.isWinningPrompt)?.userPrompt}
                    </p>
                    <div className="mt-8">
                      <h3 className="text-lg font-medium text-gray-400 mb-2">System Prompt</h3>
                      <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300">
                        {testAgent.systemPrompt}
                      </pre>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold text-[#FFD700] mb-4">System Prompt</h2>
                    <pre className="whitespace-pre-wrap font-mono text-lg text-[#FFD700]">
                      {testAgent.systemPrompt}
                    </pre>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {testAgent.status === 'active' && (
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmitChallenge} className="space-y-6">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={challenge}
                onChange={(e) => setChallenge(e.target.value)}
                className="w-full bg-[#12121266] backdrop-blur-lg border-2 border-gray-600 focus:border-[#FF3F26] rounded-lg p-6 min-h-[200px] text-lg transition-all duration-300
                  focus:shadow-[0_0_30px_rgba(255,63,38,0.1)] outline-none resize-none"
                placeholder="Enter your challenge prompt..."
                maxLength={280}
                required
              />
              <div className="absolute bottom-4 right-4 text-sm text-gray-400">
                {challenge.length}/280
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-black border-2 border-white text-white rounded-lg py-4 font-medium 
                transition-all duration-300
                hover:text-[#FF3F26] hover:border-[#FF3F26] hover:shadow-[0_0_30px_rgba(255,63,38,0.2)]
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <span>Attack</span>
                  <span className="text-sm opacity-80">({testAgent.feePerMessage} STRK)</span>
                </div>
              )}
            </button>

            <div className="mt-8 space-y-4">
              <h2 className="text-xl font-semibold">System Prompt</h2>
              <div className="bg-black/30 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {testAgent.systemPrompt}
                </pre>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Winning Challenge Display */}
      {testAgent.status === 'defeated' && (
        <div className="max-w-3xl w-full mt-8">
          <ChallengeDisplay challenge={challenges.find(c => c.isWinningPrompt)!} />
        </div>
      )}

      {/* Other Attempts */}
      {challenges
        .filter(challenge => 
          !(testAgent.status === 'undefeated' && challenge.isWinningPrompt) &&
          !(testAgent.status === 'defeated' && challenge.isWinningPrompt)
        )
        .length > 0 && (
          <div className="max-w-3xl mx-auto mt-12">
            <h2 className="text-2xl font-bold mb-6">Other Attempts</h2>
            <div className="space-y-6">
              {challenges
                .filter(challenge => 
                  !(testAgent.status === 'undefeated' && challenge.isWinningPrompt) &&
                  !(testAgent.status === 'defeated' && challenge.isWinningPrompt)
                )
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((challenge) => (
                  <ChallengeDisplay key={challenge.id} challenge={challenge} />
                ))}
            </div>
          </div>
        )}

      {/* Test Controls */}
      <div className="fixed bottom-4 right-4 flex gap-4 bg-black/50 backdrop-blur-lg p-4 rounded-lg">
        <button
          onClick={() => setTestStatus('active')}
          className={`px-4 py-2 rounded-lg transition-all ${
            testStatus === 'active'
              ? 'bg-green-500 text-white'
              : 'bg-black/50 text-gray-400 hover:text-white'
          }`}
        >
          Test Active
        </button>
        <button
          onClick={() => setTestStatus('undefeated')}
          className={`px-4 py-2 rounded-lg transition-all ${
            testStatus === 'undefeated'
              ? 'bg-[#1388D5] text-white'
              : 'bg-black/50 text-gray-400 hover:text-white'
          }`}
        >
          Test Undefeated
        </button>
        <button
          onClick={() => setTestStatus('defeated')}
          className={`px-4 py-2 rounded-lg transition-all ${
            testStatus === 'defeated'
              ? 'bg-[#FF3F26] text-white'
              : 'bg-black/50 text-gray-400 hover:text-white'
          }`}
        >
          Test Defeated
        </button>
      </div>
    </div>
  )
} 