'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useAccount, useContract, useSendTransaction } from '@starknet-react/core'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { formatBalance, getAgentStatus } from '@/lib/utils'
import { X_BOT_NAME } from '@/constants'
import { TEECEPTION_ERC20_ABI } from '@/abis/TEECEPTION_ERC20_ABI'
import { TEECEPTION_AGENT_ABI } from '@/abis/TEECEPTION_AGENT_ABI'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { TweetPreview } from '@/components/TweetPreview'
import { Prompt, useAgent } from '@/hooks/useAgent'
import { StatusDisplay } from '@/components/StatusDisplay'
import { AgentStatus } from '@/types'
import { AgentInfo } from '@/components/AgentInfo'
import { ChallengeSuccessModal } from '@/components/ChallengeSuccessModal'

const tweetUrlRegex = /^(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/\w+\/status\/([1-9]\d*)$/

const extractTweetId = (url: string): string | null => {
  try {
    // Handle direct tweet ID input (numeric string) first
    if (url.match(/^\d+$/)) {
      return url
    }

    // Basic URL validation
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return null
    }

    // Clean the URL
    const cleanUrl = url.trim()

    // Match tweet URL pattern and extract ID
    const match = cleanUrl.match(tweetUrlRegex)

    if (match) {
      return match[2] // Return the tweet ID (second capture group)
    }
  } catch (error) {
    console.error('Failed to parse tweet URL:', error)
  }
  return null
}

export default function AgentChallengePage() {
  const params = useParams()

  const {
    agent,
    loading: isFetchingAgent,
    // error: isErrorAgent,
  } = useAgent({
    fetchBy: 'address',
    value: params.address as string,
  })

  const { address, account } = useAccount()
  const [challenge, setChallenge] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [pendingTweet, setPendingTweet] = useState<{
    text: string
    submitted: boolean
  } | null>(null)
  const [tweetUrl, setTweetUrl] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [agentStatus, setAgentStatus] = useState<AgentStatus>(() =>
    getAgentStatus({ isDrained: agent?.isDrained, isFinalized: agent?.isFinalized })
  )
  const [currentTweetId, setCurrentTweetId] = useState<string | null>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [isPaid, setIsPaid] = useState(false)
  const [showChallengeSuccess, setShowChallengeSuccess] = useState(false)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const status = getAgentStatus({ isDrained: agent?.isDrained, isFinalized: agent?.isFinalized })
    setAgentStatus(status)
  }, [agent])

  useEffect(() => {
    if (currentTweetId && isPaid && !showChallengeSuccess) {
      setShowChallengeSuccess(true)
    }
  }, [currentTweetId, isPaid, showChallengeSuccess])

  // Contract instances
  const { contract: tokenContract } = useContract({
    abi: TEECEPTION_ERC20_ABI,
    address: agent ? `0x${BigInt(agent.tokenAddress).toString(16).padStart(64, '0')}` : undefined,
  })

  const { contract: agentContract } = useContract({
    abi: TEECEPTION_AGENT_ABI,
    address: agent ? `0x${BigInt(agent.address).toString(16).padStart(64, '0')}` : undefined,
  })

  // Transaction hook
  const { sendAsync } = useSendTransaction({
    calls: useMemo(() => {
      if (!tokenContract || !agentContract || !pendingTweet?.text || !agent) return undefined

      try {
        const tweetIdBigInt = BigInt(extractTweetId(tweetUrl) || '0')

        return [
          tokenContract.populate('approve', [agentContract.address, BigInt(agent.promptPrice)]),
          agentContract.populate('pay_for_prompt', [tweetIdBigInt, pendingTweet.text]),
        ]
      } catch (error) {
        console.error('Error preparing transaction calls:', error)
        return undefined
      }
    }, [tokenContract, agentContract, pendingTweet?.text, tweetUrl, agent]),
    onSuccess: () => {
      setIsPaid(true)
    },
  })

  if (!address) {
    return (
      <ConnectPrompt
        title="Welcome Challenger"
        subtitle="One step away from breaking the unbreakable"
        theme="attacker"
      />
    )
  }

  if (isFetchingAgent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="container mx-auto px-4 py-8 pt-24">
        <Link href="/attack" className="text-blue-400 hover:underline mb-8 block">
          ← Back to Agents
        </Link>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-lg text-gray-400">Agent not found</p>
        </div>
      </div>
    )
  }

  const SystemPromptDisplay = () => {
    return (
      <div className="bg-[#12121266] backdrop-blur-lg p-6 rounded-lg border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.1)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="font-mono text-sm text-[#FFD700]">{agent.address}</div>
        </div>

        <div className="space-y-4">
          <div className="bg-black/30 p-4 rounded-lg">
            <pre className="whitespace-pre-wrap font-mono text-lg text-[#FFD700]">
              {agent.systemPrompt}
            </pre>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-400">{new Date().toLocaleDateString()}</p>
        </div>
      </div>
    )
  }

  const handleSubmitChallenge = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setIsRedirecting(true)

    try {
      const tweetText = `${X_BOT_NAME} :${agent.name}: ${challenge}`
      const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`

      // Wait for 2 seconds to show the animation
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Then proceed with opening Twitter
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
      }, 1000)
    } catch (error) {
      console.error('Failed to submit challenge:', error)
      setIsSubmitting(false)
      setIsRedirecting(false)
    }
  }

  const handleSubmitTweetUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    const tweetId = extractTweetId(tweetUrl)
    if (!tweetId) {
      setPaymentError('Invalid tweet URL')
      return
    }

    if (!account) {
      setPaymentError('Please connect your wallet first.')
      return
    }

    setCurrentTweetId(tweetId)
    setIsProcessingPayment(true)
    setPaymentError(null)

    try {
      const response = await sendAsync()

      if (response?.transaction_hash) {
        await account.waitForTransaction(response.transaction_hash)
        setPendingTweet((prev) => (prev ? { ...prev, submitted: true } : null))
        setTweetUrl('')
        setIsPaid(true)
      }
    } catch (error) {
      console.error('Failed to process payment:', error)
      setPaymentError(
        error instanceof Error ? error.message : 'Failed to process payment. Please try again.'
      )
    } finally {
      setIsProcessingPayment(false)
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
      const tweetText = `${X_BOT_NAME} :${agent.name}: ${pendingTweet.text}`
      const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
      window.open(tweetIntent, '_blank')
    }
  }

  const ChallengeDisplay = ({ challenge }: { challenge: Prompt }) => {
    const isWinner = challenge.is_success

    return (
      <div
        className={`bg-[#12121266] backdrop-blur-lg p-6 rounded-lg ${
          isWinner ? 'border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.1)]' : ''
        }`}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className={`font-mono text-sm ${isWinner ? 'text-[#FFD700]' : 'text-gray-400'}`}>
            {challenge.drained_to}
          </div>
          {/* <div className={`text-sm ${isWinner ? 'text-[#FFD700]' : 'text-blue-400'}`}>
            {challenge.twitterHandle }
          </div> */}
        </div>

        <div className="space-y-4">
          <div className="bg-black/30 p-4 rounded-lg">
            <p className={`font-mono text-lg ${isWinner ? 'text-[#FFD700]' : 'text-white'}`}>
              {challenge.prompt}
            </p>
          </div>
          <div className="bg-black/30 p-4 rounded-lg">
            {/* <p className="font-mono text-lg text-gray-400">{challenge.agentResponse}</p> */}
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-400">
            {/* {new Date(challenge.timestamp).toLocaleDateString()} */}
          </p>
          {isWinner && <div className="text-[#FFD700] text-sm font-medium">Winning Attempt</div>}
        </div>
      </div>
    )
  }

  const getMaxPromptLength = () => {
    const prefix = `${X_BOT_NAME} :${agent.name}: `
    return 280 - prefix.length
  }

  return (
    <div className="min-h-screen bg-[url('/img/abstract_bg.png')] bg-cover bg-repeat-y">
      <div className="container mx-auto px-2 md:px-8 py-8 md:py-20 max-w-[1560px] relative">
        <Link
          href="/attack"
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors mb-8 relative z-20"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Agents</span>
        </Link>

        <div className="absolute top-[140px] inset-x-0 z-10 h-[180px] flex items-center">
          <div className="w-full">
            <div className="max-w-[1560px] mx-auto px-4">
              <div className="flex flex-col items-center justify-center">
                <h1 className="text-4xl md:text-[48px] font-bold mb-3 uppercase">{agent.name}</h1>
                <div className="flex max-w-[400px] w-full mx-auto mb-8">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-50"></div>
                </div>
                <AgentInfo
                  balance={agent.balance}
                  decimal={agent.decimal}
                  promptPrice={agent.promptPrice}
                  symbol={agent.symbol}
                  breakAttempts={agent.breakAttempts}
                  className="w-full"
                />
                <div className="mt-4">
                  <StatusDisplay agent={agent} status={agentStatus} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-[280px]">
          {agentStatus === AgentStatus.UNDEFEATED && (
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="text-4xl md:text-[48px] font-bold text-center uppercase mb-6">
                System Prompt
              </div>

              <div className="flex max-w-[800px] mx-auto mb-12">
                <div className="white-gradient-border"></div>
                <div className="white-gradient-border rotate-180"></div>
              </div>

              <SystemPromptDisplay />
            </div>
          )}

          {agentStatus === AgentStatus.ACTIVE && (
            <div className="max-w-3xl mx-auto space-y-8">
              {isRedirecting ? (
                <div className="bg-[#12121266] backdrop-blur-lg rounded-lg overflow-hidden">
                  <div className="p-8 md:p-12 text-center">
                    <div className="flex flex-col items-center gap-8">
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl md:text-2xl font-medium">Opening</h2>
                        <Image
                          src="/icons/x.svg"
                          width={24}
                          height={24}
                          alt="X"
                          className="opacity-80"
                        />
                      </div>
                      <div className="flex flex-col md:flex-row items-center gap-6 text-lg text-gray-300">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FF3F26]/20 text-[#FF3F26] flex items-center justify-center font-medium">
                            1
                          </div>
                          <span>Post</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FF3F26]/20 text-[#FF3F26] flex items-center justify-center font-medium">
                            2
                          </div>
                          <span>Copy link</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FF3F26]/20 text-[#FF3F26] flex items-center justify-center font-medium">
                            3
                          </div>
                          <span>Return</span>
                        </div>
                      </div>
                      <div className="w-full max-w-[300px] h-1 bg-[#FF3F26]/10 rounded-full overflow-hidden relative">
                        <div
                          className="absolute inset-0 h-full bg-[#FF3F26] rounded-full animate-loading-progress"
                          style={{
                            boxShadow:
                              '0 0 8px rgba(255, 63, 38, 0.3), 0 0 4px rgba(255, 63, 38, 0.2)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : pendingTweet ? (
                <div className="space-y-6">
                  {currentTweetId && isPaid ? (
                    <div className="bg-[#12121266] backdrop-blur-lg border-2 border-[#FF3F26]/30 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(255,63,38,0.1)]">
                      <div className="w-full bg-black/50 border-b-2 border-[#FF3F26]/30 py-4 font-medium flex items-center justify-center gap-2">
                        <span>Challenge Submitted</span>
                      </div>
                      <div className="p-8 flex justify-center">
                        <TweetPreview tweetId={currentTweetId} isPaid={isPaid} />
                      </div>
                    </div>
                  ) : (
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
                          {X_BOT_NAME} :{agent.name}: {pendingTweet.text}
                        </p>
                      </div>
                    </div>
                  )}

                  {!pendingTweet.submitted && !isPaid && (
                    <form onSubmit={handleSubmitTweetUrl} className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium mb-2">Tweet URL</label>
                        <input
                          type="url"
                          value={tweetUrl}
                          onChange={(e) => {
                            setTweetUrl(e.target.value)
                            setPaymentError(null)
                            // Extract and set tweet ID when URL changes
                            const newTweetId = extractTweetId(e.target.value)
                            setCurrentTweetId(newTweetId)
                          }}
                          className="w-full bg-[#12121266] backdrop-blur-lg border-2 border-gray-600 focus:border-[#FF3F26] rounded-lg p-4 text-lg transition-all duration-300
                              focus:shadow-[0_0_30px_rgba(255,63,38,0.1)] outline-none"
                          placeholder={`https://x.com/your_amazing_profile/status/your_winning_bet`}
                          required
                        />
                        {paymentError && (
                          <p className="mt-2 text-sm text-[#FF3F26]">{paymentError}</p>
                        )}
                      </div>

                      {currentTweetId && (
                        <div className="bg-[#12121266] backdrop-blur-lg border-2 border-[#FF3F26]/30 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(255,63,38,0.1)]">
                          <button
                            type="submit"
                            disabled={isProcessingPayment || !currentTweetId}
                            className="w-full bg-black/50 border-b-2 border-[#FF3F26]/30 py-4 font-medium 
                                transition-all duration-300
                                hover:text-[#FF3F26] hover:bg-black/70
                                disabled:opacity-50 disabled:cursor-not-allowed
                                flex items-center justify-center gap-2"
                          >
                            {isProcessingPayment ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing Payment...
                              </>
                            ) : (
                              <>
                                Pay to Challenge
                                <span className="text-sm opacity-80">
                                  (
                                  {formatBalance(BigInt(agent.promptPrice), agent.decimal, 2, true)}{' '}
                                  STRK)
                                </span>
                              </>
                            )}
                          </button>
                          <div className="p-8 flex justify-center">
                            <TweetPreview tweetId={currentTweetId} isPaid={false} />
                          </div>
                        </div>
                      )}

                      <ul className="text-sm leading-6 text-gray-400 space-y-2 list-disc pl-4">
                        <li>This payment will activate the challenge for this tweet</li>
                        <li>
                          If you are successful you&apos;ll get{' '}
                          {formatBalance(BigInt(agent.balance), agent.decimal)} STRK
                        </li>
                        <li>If you fail, your STRK is added to the reward</li>
                      </ul>
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
                      maxLength={getMaxPromptLength()}
                      required
                    />
                    <div className="absolute bottom-4 right-4 text-sm text-gray-400">
                      {challenge.length}/{getMaxPromptLength()}
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
                        Opening{' '}
                        <Image
                          src="/icons/x.svg"
                          width={16}
                          height={16}
                          alt="X"
                          className="opacity-80"
                        />
                        ...
                      </>
                    ) : (
                      <>
                        <span>Challenge on </span>
                        <Image
                          src="/icons/x.svg"
                          width={16}
                          height={16}
                          alt="X"
                          className="opacity-80"
                        />
                      </>
                    )}
                  </button>

                  <div className="mt-8 space-y-4">
                    <h2 className="text-xl font-semibold">System Prompt</h2>
                    <div className="bg-black/30 p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap font-mono text-sm">
                        {agent.systemPrompt}
                      </pre>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Winning Challenge Display with System Prompt */}
          {agentStatus === AgentStatus.DEFEATED && agent.drainPrompt && (
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="text-4xl md:text-[48px] font-bold text-center uppercase mb-6">
                Winning Challenge
              </div>

              <div className="flex max-w-[800px] mx-auto mb-12">
                <div className="white-gradient-border"></div>
                <div className="white-gradient-border rotate-180"></div>
              </div>

              <ChallengeDisplay challenge={agent.drainPrompt} />

              <div className="text-4xl md:text-[48px] font-bold text-center uppercase mb-6">
                System Prompt
              </div>

              <div className="flex max-w-[800px] mx-auto mb-12">
                <div className="white-gradient-border"></div>
                <div className="white-gradient-border rotate-180"></div>
              </div>

              <div className="bg-[#12121266] backdrop-blur-lg p-6 rounded-lg border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.1)]">
                <pre className="whitespace-pre-wrap font-mono text-lg text-[#FFD700]">
                  {agent.systemPrompt}
                </pre>
              </div>
            </div>
          )}

          {/* Other Attempts */}
          {agent?.latestPrompts?.length > 0 && (
            <div className="max-w-3xl mx-auto mt-20">
              <h2 className="text-4xl md:text-[48px] font-bold text-center uppercase mb-6">
                Previous Attempts
              </h2>

              <div className="flex max-w-[800px] mx-auto mb-12">
                <div className="white-gradient-border"></div>
                <div className="white-gradient-border rotate-180"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {agent?.latestPrompts
                  .filter(
                    (challenge) =>
                      // !(testAgent.status === 'undefeated' && challenge.isWinningPrompt) &&
                      // !(testAgent.status === 'defeated' && challenge.isWinningPrompt)
                      !challenge.is_success
                  )
                  // .sort((a, b) => b.timestamp - a.timestamp)
                  .map((challenge) => {
                    // console.log('Challenge ID:', challenge.id);
                    // Extract tweet ID if it's a full URL
                    // const tweetId = challenge.id.includes('status/')
                    //   ? extractTweetId(challenge.id)
                    //   : challenge.id
                    // console.log('Extracted Tweet ID:', tweetId)

                    return (
                      <div
                        key={challenge.tweet_id}
                        className="bg-[#12121266] backdrop-blur-lg rounded-lg overflow-hidden border border-gray-800/50"
                      >
                        <div className="w-full bg-black/50 border-b border-gray-800/50 py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              {/* <span>{new Date(challenge.timestamp).toLocaleDateString()}</span> */}
                            </div>
                            {/* <div className="text-sm text-gray-400">{challenge.twitterHandle}</div> */}
                          </div>
                        </div>
                        <div className="p-4">
                          {challenge.tweet_id ? (
                            <TweetPreview tweetId={challenge.tweet_id} isPaid={true} />
                          ) : (
                            <div className="text-red-400 text-sm">Invalid tweet ID format</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Test Controls */}
          {/* <div className="fixed bottom-4 right-4 flex gap-4 bg-black/50 backdrop-blur-lg p-4 rounded-lg">
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
          </div> */}
        </div>
      </div>
      <ChallengeSuccessModal
        open={showChallengeSuccess}
        onClose={() => {
          setShowChallengeSuccess(false)
        }}
      />
    </div>
  )
}
