'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAgents } from '@/hooks/useAgents'
import { useAccount } from '@starknet-react/core'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

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
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [pendingTweet, setPendingTweet] = useState<{
    text: string;
    submitted: boolean;
  } | null>(null)
  const [tweetUrl, setTweetUrl] = useState('')
  const [showTweetInput, setShowTweetInput] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [testStatus, setTestStatus] = useState<'active' | 'undefeated' | 'defeated'>('active')
  const [loadingProgress, setLoadingProgress] = useState(0)

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
    const [timeLeft, setTimeLeft] = useState(() => {
      if (testAgent.status !== 'active') return ''
      
      const endTime = parseInt(testAgent.endTime)
      const now = Date.now()
      const difference = endTime - now

      if (difference <= 0) return 'EXPIRED'

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      return `${days}D ${hours}H ${minutes}M ${seconds}S`
    })

    useEffect(() => {
      const calculateTimeLeft = () => {
        const endTime = parseInt(testAgent.endTime)
        const now = Date.now()
        const difference = endTime - now

        if (difference <= 0) {
          return 'EXPIRED'
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24))
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((difference % (1000 * 60)) / 1000)

        return `${days}D ${hours}H ${minutes}M ${seconds}S`
      }

      if (testAgent.status === 'active') {
        const timer = setInterval(() => {
          setTimeLeft(calculateTimeLeft())
        }, 1000)

        return () => clearInterval(timer)
      }
    }, [testAgent.endTime, testAgent.status])

    switch (testAgent.status) {
      case 'active':
        return (
          <div className="text-3xl font-bold text-[#FFD700] min-w-[240px] text-center">
            {timeLeft || '00D 00H 00M 00S'}
          </div>
        )
      
      case 'undefeated':
        return (
          <div className="text-3xl font-bold tracking-wider bg-[#1388D5]/20 text-[#1388D5] px-8 py-4 rounded-lg mb-12">
            UNDEFEATED
          </div>
        )
      
      default:
        return (
          <div className="text-3xl font-bold tracking-wider bg-[#FF3F26]/20 text-[#FF3F26] px-8 py-4 rounded-lg mb-12">
            DEFEATED
          </div>
        )
    }
  }

  const SystemPromptDisplay = () => {
    return (
      <div className="bg-[#12121266] backdrop-blur-lg p-6 rounded-lg border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.1)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="font-mono text-sm text-[#FFD700]">
            {testAgent.ownerAddress}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-black/30 p-4 rounded-lg">
            <pre className="whitespace-pre-wrap font-mono text-lg text-[#FFD700]">
              {testAgent.systemPrompt}
            </pre>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-400">
            {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    )
  }

  const handleSubmitChallenge = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setIsRedirecting(true)
    setLoadingProgress(0)
    
    try {
      const tweetText = `@teeception :${testAgent.name}: ${challenge}`
      const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
      
      // Animate loading bar
      const startTime = performance.now()
      const duration = 2000 // 2 seconds total
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        // Ease out cubic function for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3)
        setLoadingProgress(eased * 100)
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          const twitterWindow = window.open(tweetIntent, '_blank')
          if (!twitterWindow) {
            throw new Error('Please allow popups to share on Twitter')
          }
          
          // Wait a moment before showing the URL submission form
          setTimeout(() => {
            setPendingTweet({ text: challenge, submitted: false })
            setChallenge('')
            setIsSubmitting(false)
            setIsRedirecting(false)
            setLoadingProgress(0)
          }, 1000)
        }
      }
      
      requestAnimationFrame(animate)
    } catch (error) {
      console.error('Failed to submit challenge:', error)
      setIsSubmitting(false)
      setIsRedirecting(false)
      setLoadingProgress(0)
    }
  }

  const handleSubmitTweetUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // TODO: Verify tweet URL and process payment
      console.log('Processing tweet:', tweetUrl)
      
      // Mark tweet as submitted
      setPendingTweet(prev => prev ? { ...prev, submitted: true } : null)
      setTweetUrl('')
    } catch (error) {
      console.error('Failed to process tweet:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditPendingTweet = () => {
    if (pendingTweet) {
      setChallenge(pendingTweet.text)
      setPendingTweet(null)
    }
  }

  const handleReshare = () => {
    if (pendingTweet) {
      const tweetText = `@teeception :${testAgent.name}: ${pendingTweet.text}`
      const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
      window.open(tweetIntent, '_blank')
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

      <div className="absolute top-[76px] left-0 right-0 z-10 h-[180px] flex items-center">
        <div className="w-full">
          <div className="max-w-[1632px] mx-auto px-4">
            <div className="bg-[#12121266] backdrop-blur-lg p-6 rounded-lg">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-5xl font-bold mb-6">{testAgent.name}</h1>
                
                <div className="flex items-center gap-8 justify-center">
                  <div className="flex items-baseline gap-4">
                    <div className="text-6xl font-bold bg-gradient-to-r from-[#FFD700] via-[#FFF8DC] to-[#FFD700] text-transparent bg-clip-text bg-[length:200%_100%] animate-shimmer">
                      {testAgent.balance}
                    </div>
                    <div className="text-3xl font-medium text-[#FFD700]">STRK</div>
                  </div>
                  {testAgent.status === 'active' && <StatusDisplay />}
                </div>

                {testAgent.status !== 'active' && <StatusDisplay />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-[180px]">
        {testAgent.status === 'undefeated' && (
          <div className="max-w-3xl mx-auto">
            <SystemPromptDisplay />
          </div>
        )}

        {testAgent.status === 'active' && (
          <div className="max-w-3xl mx-auto">
            {isRedirecting ? (
              <div className="bg-[#12121266] backdrop-blur-lg rounded-lg overflow-hidden">
                <div className="p-12 text-center">
                  <div className="flex flex-col items-center gap-8">
                    <div className="flex items-center gap-3">
                      <Image src="/icons/x.svg" width={24} height={24} alt="X" className="opacity-80" />
                      <h2 className="text-2xl font-medium">Opening Twitter</h2>
                    </div>
                    <div className="flex items-center gap-6 text-lg text-gray-300">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FF3F26]/20 text-[#FF3F26] flex items-center justify-center font-medium">1</div>
                        <span>Post</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FF3F26]/20 text-[#FF3F26] flex items-center justify-center font-medium">2</div>
                        <span>Copy link</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FF3F26]/20 text-[#FF3F26] flex items-center justify-center font-medium">3</div>
                        <span>Return</span>
                      </div>
                    </div>
                    <div className="w-full max-w-[300px] h-1 bg-[#FF3F26]/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#FF3F26] rounded-full transform-gpu"
                        style={{ 
                          width: `${loadingProgress}%`,
                          boxShadow: '0 0 8px rgba(255, 63, 38, 0.3), 0 0 4px rgba(255, 63, 38, 0.2)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : pendingTweet ? (
              <div className="space-y-6">
                <div className="bg-[#12121266] backdrop-blur-lg p-6 rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Pending Challenge</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={handleEditPendingTweet}
                        className="px-4 py-2 text-sm border border-gray-600 rounded-lg hover:border-[#FF3F26] hover:text-[#FF3F26] transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleReshare}
                        className="px-4 py-2 text-sm border border-gray-600 rounded-lg hover:border-[#FF3F26] hover:text-[#FF3F26] transition-colors"
                      >
                        Reshare
                      </button>
                    </div>
                  </div>
                  <div className="bg-black/30 p-4 rounded-lg">
                    <p className="font-mono text-lg text-gray-400">
                      @teeception :{testAgent.name}: {pendingTweet.text}
                    </p>
                  </div>
                </div>

                {!pendingTweet.submitted && (
                  <form onSubmit={handleSubmitTweetUrl} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Tweet URL
                      </label>
                      <input
                        type="url"
                        value={tweetUrl}
                        onChange={(e) => setTweetUrl(e.target.value)}
                        className="w-full bg-[#12121266] backdrop-blur-lg border-2 border-gray-600 focus:border-[#FF3F26] rounded-lg p-4 text-lg transition-all duration-300
                          focus:shadow-[0_0_30px_rgba(255,63,38,0.1)] outline-none"
                        placeholder="https://twitter.com/..."
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-black border-2 border-white text-white rounded-lg py-4 font-medium 
                        transition-all duration-300
                        hover:text-[#FF3F26] hover:border-[#FF3F26] hover:shadow-[0_0_30px_rgba(255,63,38,0.2)]
                        disabled:opacity-50 disabled:cursor-not-allowed
                        flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Submit Tweet URL'
                      )}
                    </button>
                  </form>
                )}
              </div>
            ) : (
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
                    disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Opening Twitter...
                    </>
                  ) : (
                    <>
                      <Image src="/icons/x.svg" width={16} height={16} alt="X" className="opacity-80" />
                      <span>Share Challenge</span>
                      <span className="text-sm opacity-80">({testAgent.feePerMessage} STRK)</span>
                    </>
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
            )}
          </div>
        )}

        {/* Winning Challenge Display with System Prompt */}
        {testAgent.status === 'defeated' && (
          <div className="max-w-3xl mx-auto space-y-8">
            <ChallengeDisplay challenge={challenges.find(c => c.isWinningPrompt)!} />
            
            <div className="bg-[#1388D5]/10 backdrop-blur-lg p-6 rounded-lg border border-[#1388D5]/20">
              <h2 className="text-xl font-semibold text-[#1388D5] mb-4">System Prompt</h2>
              <pre className="whitespace-pre-wrap font-mono text-lg text-gray-300">
                {testAgent.systemPrompt}
              </pre>
            </div>
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
    </div>
  )
} 