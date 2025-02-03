import { AGENT_VIEWS } from './AgentView'
import { ACTIVE_NETWORK, TWITTER_CONFIG } from '../config/starknet'
import { useAgents } from '../hooks/useAgents'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Contract } from 'starknet'
import { TEECEPTION_ERC20_ABI } from '@/abis/TEECEPTION_ERC20_ABI'
import { useEffect, useState } from 'react'
import { SELECTORS } from '../constants/selectors'
import { debug } from '../utils/debug'
import { getProvider, normalizeAddress } from '../utils/contracts'

interface AgentWithBalances {
  address: string
  name: string
  systemPrompt: string
  token: {
    address: string
    minPromptPrice: string
    minInitialBalance: string
  }
  promptPrice: string
  prizePool: string
  pendingPool: string
  endTime: string
  isFinalized: boolean
}

// Since we're not adding any additional fields in AgentWithBalances, we can just use the same type
type Agent = AgentWithBalances;

// Function to focus tweet compose box and set text
const composeTweet = (agentName: string, setIsShowAgentView: (show: boolean) => void) => {
  const tweetButton = document.querySelector(SELECTORS.TWEET_BUTTON) as HTMLElement
  const tweetTextarea = document.querySelector(SELECTORS.TWEET_TEXTAREA) as HTMLElement
  const postButton = document.querySelector(SELECTORS.POST_BUTTON) as HTMLElement

  const insertText = (textarea: HTMLElement) => {
    textarea.focus()
    const existingText = textarea.textContent || ''
    const hasExistingText = existingText.trim().length > 0
    const text = `${TWITTER_CONFIG.accountName} :${agentName}:${hasExistingText ? ' ' : ''}`
    document.execCommand('insertText', false, text)
    setIsShowAgentView(false)
  }

  const tryInsertWithRetry = (retryCount = 0, maxRetries = 5) => {
    const textarea = document.querySelector(SELECTORS.TWEET_TEXTAREA) as HTMLElement
    if (textarea) {
      insertText(textarea)
    } else if (retryCount < maxRetries) {
      setTimeout(() => tryInsertWithRetry(retryCount + 1), 200)
    } else {
      debug.error('AgentList', 'Failed to find textarea after max retries', { agentName })
    }
  }

  if (tweetTextarea) {
    insertText(tweetTextarea)
  } else {
    if (postButton) {
      postButton.click()
      // Give the popup time to render
      setTimeout(() => tryInsertWithRetry(), 300)
    } else if (tweetButton) {
      tweetButton.click()
      // Give the popup time to render
      setTimeout(() => tryInsertWithRetry(), 300)
    }
  }
}

export default function AgentList({
  setCurrentView,
  setIsShowAgentView,
}: {
  setCurrentView: React.Dispatch<React.SetStateAction<AGENT_VIEWS>>
  setIsShowAgentView: (show: boolean) => void
}) {
  const { agents, loading: agentsLoading, error: agentsError } = useAgents()
  const [agentsWithBalances, setAgentsWithBalances] = useState<AgentWithBalances[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agentList, setAgentList] = useState<Agent[]>([])
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set())
  const [tokenImages, setTokenImages] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!agentsLoading) {
      setAgentList(agents.map(agent => ({
        name: agent.name,
        address: agent.address,
        systemPrompt: agent.systemPrompt,
        token: agent.token,
        promptPrice: agent.promptPrice,
        prizePool: agent.prizePool,
        pendingPool: agent.pendingPool,
        endTime: agent.endTime,
        isFinalized: agent.isFinalized,
      })))
    }
  }, [agents, agentsLoading])

  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (agentsLoading) return;
      
      setLoading(true);
      
      try {
        if (!agentList.length) {
          setAgentsWithBalances([]);
          return;
        }

        const provider = getProvider()

        // Create a map of token addresses to fetch images only once
        const uniqueTokens = new Set(agentList.map(agent => agent.token.address))
        const tokenImagePromises = Array.from(uniqueTokens).map(async (tokenAddress) => {
          try {
            // Skip invalid token addresses
            if (!tokenAddress || tokenAddress === '0x0') {
              return [tokenAddress, ''] as [string, string];
            }

            const cleanAddress = normalizeAddress(tokenAddress)
            debug.log('AgentList', 'Normalized token address', { 
              original: tokenAddress, 
              normalized: cleanAddress 
            })

            const tokenContract = new Contract(TEECEPTION_ERC20_ABI, cleanAddress, provider)
            const symbol = await tokenContract.symbol()
            const token = ACTIVE_NETWORK.tokens[symbol.toString()]
            return [tokenAddress, token?.image || ''] as [string, string]
          } catch (err) {
            debug.error('AgentList', 'Error fetching token image:', err)
            return [tokenAddress, ''] as [string, string]
          }
        })

        const tokenImageResults = await Promise.all(tokenImagePromises)
        setTokenImages(Object.fromEntries(tokenImageResults))

        const agentsWithTokenBalances = await Promise.all(
          agentList.map(async (agent) => {
            try {
              // Skip balance fetch for invalid token addresses
              if (!agent.token.address || agent.token.address === '0x0') {
                return agent;
              }

              const cleanAddress = normalizeAddress(agent.token.address)
              debug.log('AgentList', 'Normalized token address for balance', { 
                original: agent.token.address, 
                normalized: cleanAddress 
              })

              const tokenContract = new Contract(TEECEPTION_ERC20_ABI, cleanAddress, provider)
              const balance = await tokenContract.balance_of(agent.address)
              return {
                ...agent,
                balance: balance.toString()
              }
            } catch (err) {
              debug.error('AgentList', 'Error fetching token balance:', {
                address: agent.address,
                tokenAddress: agent.token.address,
                error: err
              })
              return agent
            }
          })
        )

        setAgentsWithBalances(agentsWithTokenBalances)
      } catch (err) {
        debug.error('AgentList', 'Error fetching token balances:', err)
        setError('Failed to fetch token balances')
      } finally {
        setLoading(false);
      }
    }

    fetchTokenBalances()
  }, [agentList, agentsLoading])

  // Sort agents by total value in their respective tokens
  const sortedAgents = [...agentsWithBalances].sort((a, b) => {
    // Put error state agents at the bottom
    if (a.token.address === '0x0' && b.token.address !== '0x0') return 1;
    if (a.token.address !== '0x0' && b.token.address === '0x0') return -1;
    
    const balanceA = BigInt(a.prizePool || '0')
    const balanceB = BigInt(b.prizePool || '0')
    return balanceB > balanceA ? 1 : balanceB < balanceA ? -1 : 0
  })

  const formatBalance = (balance: string, decimals: number = 18) => {
    const value = BigInt(balance)
    if (value === BigInt(0)) return '0'

    const divisor = BigInt(10 ** decimals)
    const integerPart = value / divisor
    const fractionalPart = value % divisor

    let fractionalStr = fractionalPart.toString().padStart(decimals, '0')
    fractionalStr = fractionalStr.replace(/0+$/, '')

    if (fractionalStr) {
      return `${integerPart}.${fractionalStr.slice(0, 4)}`
    }
    return integerPart.toString()
  }

  const toggleAgentPrompt = (address: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setExpandedAgents((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(address)) {
        newSet.delete(address)
      } else {
        newSet.add(address)
      }
      return newSet
    })
  }

  if (agentsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading agents...</span>
        </div>
      </div>
    )
  }

  if (error || agentsError) {
    return (
      <div className="flex items-center justify-center h-[600px] text-red-500">
        {error || agentsError}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[600px] p-4">
      <section className="pt-5">
        {/* Header */}
        <div className="grid border-b border-b-[#2F3336]" style={{ gridTemplateColumns: 'auto 200px' }}>
          <div className="text-[#A4A4A4] text-sm py-4">Active agents ({agentList.length})</div>
          <div className="text-[#A4A4A4] text-sm py-4 text-right">Balance</div>
        </div>

        <div className="pt-3 max-h-[400px] overflow-scroll pr-4 pb-12">
          {sortedAgents.map((agent) => (
            <div key={agent.address}>
              <div
               className={`grid items-center py-4 border-b border-b-[#2F3336] hover:bg-[#16181C] ${
                expandedAgents.has(agent.address) ? 'bg-[#16181C]' : ''
              } pr-2`}
                style={{ gridTemplateColumns: '32px auto 200px 100px' }}
              >
                <button
                  onClick={(e) => toggleAgentPrompt(agent.address, e)}
                  className="text-[#A4A4A4] hover:text-white flex items-center justify-center"
                >
                  {expandedAgents.has(agent.address) ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>

                <div className="text-white text-base">
                  <h3 className="text-white flex items-center gap-2">
                    {agent.name}
                    {agent.isFinalized && (
                      <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-500 rounded">Finalized</span>
                    )}
                  </h3>
                  <p className="text-[#A4A4A4] text-sm">
                    Price: {formatBalance(agent.promptPrice)}
                  </p>
                </div>

                <div className="text-right flex items-center justify-end gap-2">
                  {tokenImages[agent.token.address] && (
                    <img 
                      src={tokenImages[agent.token.address]} 
                      alt="Token" 
                      className="w-4 h-4 rounded-full"
                    />
                  )}
                  <div>
                    <p className="text-white">
                      {(() => {
                        try {
                          if (!agent.token?.address || agent.token.address === '0x0') {
                            return 'Error'
                          }

                          const matchingToken = Object.values(ACTIVE_NETWORK.tokens).find(token => {
                            try {
                              return token && token.address && 
                                     normalizeAddress(token.address) === normalizeAddress(agent.token.address)
                            } catch (err) {
                              debug.error('AgentList', 'Error comparing token addresses:', {
                                token,
                                agentToken: agent.token,
                                error: err
                              })
                              return false
                            }
                          })

                          debug.log('AgentList', 'Token lookup:', {
                            agentToken: agent.token.address,
                            normalizedAgentToken: normalizeAddress(agent.token.address),
                            availableTokens: Object.values(ACTIVE_NETWORK.tokens).map(t => ({
                              symbol: t.symbol,
                              address: t.address,
                              normalized: normalizeAddress(t.address)
                            }))
                          })

                          return `${formatBalance(agent.prizePool)} ${matchingToken?.symbol || 'Unknown'}`
                        } catch (err) {
                          debug.error('AgentList', 'Error formatting token display:', err)
                          return 'Error'
                        }
                      })()}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={(e) => composeTweet(agent.name, setIsShowAgentView)}
                    className="bg-white rounded-full px-4 py-1.5 text-black text-sm hover:bg-white/70 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={agent.isFinalized}
                  >
                    Reply
                  </button>
                </div>
              </div>

              {expandedAgents.has(agent.address) && (
                <div className="px-8 py-4 text-[#A4A4A4] text-sm bg-[#16181C] border-b border-b-[#2F3336]">
                  <div className="mb-2">
                    <span className="text-white">System Prompt:</span>
                    <p className="mt-1">{agent.systemPrompt}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <span className="text-white">Pending Pool:</span>
                      <p>{formatBalance(agent.pendingPool)}</p>
                    </div>
                    <div>
                      <span className="text-white">End Time:</span>
                      <p>{new Date(parseInt(agent.endTime) * 1000).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {sortedAgents.length === 0 && (
            <div className="text-center text-[#A4A4A4] py-4">No agents found</div>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-3 px-4 py-8 absolute bottom-0 left-0 right-0">
        <button
          onClick={() => setCurrentView(AGENT_VIEWS.LAUNCH_AGENT)}
          className="bg-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-black text-base hover:bg-white/70 border border-transparent"
        >
          Launch Agent
        </button>
        <button
          className="bg-transparent border border-white text-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-base hover:bg-white hover:text-black"
          onClick={() => setCurrentView(AGENT_VIEWS.LEADERBOARD)}
        >
          Visit leaderboard
        </button>
      </div>
    </div>
  )
}
