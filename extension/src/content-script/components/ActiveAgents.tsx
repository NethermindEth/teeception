import { AGENT_VIEWS } from './AgentView'
import { ACTIVE_NETWORK, TWITTER_CONFIG } from '../config/starknet'
import { useAgents } from '../hooks/useAgents'
import { useAgentRegistry } from '../hooks/useAgentRegistry'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Contract, RpcProvider } from 'starknet'
import { ERC20_ABI } from '../../abis/ERC20_ABI'
import { useEffect, useState, useMemo } from 'react'
import { useTokenSupport } from '../hooks/useTokenSupport'
import { SELECTORS } from '../constants/selectors'
import { AGENT_REGISTRY_ABI } from '../../abis/AGENT_REGISTRY'
import { AGENT_ABI } from '../../abis/AGENT_ABI'
import { debug } from '../utils/debug'
import { getProvider } from '../utils/contracts'

interface AgentWithBalances {
  address: string
  name: string
  systemPrompt: string
  token: {
    address: string
    minPromptPrice: string
    minInitialBalance: string
  }
  balance: string
}

interface Agent {
  name: string
  address: string
  systemPrompt: string
  token: {
    address: string
    minPromptPrice: string
    minInitialBalance: string
  }
}

// Function to focus tweet compose box and set text
const composeTweet = (agentName: string) => {
  const tweetButton = document.querySelector(SELECTORS.TWEET_BUTTON) as HTMLElement
  const tweetTextarea = document.querySelector(SELECTORS.TWEET_TEXTAREA) as HTMLElement
  const postButton = document.querySelector(SELECTORS.POST_BUTTON) as HTMLElement

  const insertText = (textarea: HTMLElement) => {
    textarea.focus()
    const existingText = textarea.textContent || ''
    const hasExistingText = existingText.trim().length > 0
    const text = `${TWITTER_CONFIG.accountName} :${agentName}:${hasExistingText ? ' ' : ''}`
    document.execCommand('insertText', false, text)
  }

  if (tweetTextarea) {
    insertText(tweetTextarea)
  } else {
    if (postButton) {
      postButton.click()
      setTimeout(() => {
        const newTextarea = document.querySelector(SELECTORS.TWEET_TEXTAREA) as HTMLElement
        if (newTextarea) {
          insertText(newTextarea)
        } else if (tweetButton) {
          tweetButton.click()
          setTimeout(() => {
            const fallbackTextarea = document.querySelector(SELECTORS.TWEET_TEXTAREA) as HTMLElement
            if (fallbackTextarea) {
              insertText(fallbackTextarea)
            } else {
              debug.error('ActiveAgents', 'Failed to find textarea after all attempts', {
                agentName,
              })
            }
          }, 100)
        }
      }, 100)
    } else if (tweetButton) {
      tweetButton.click()
      setTimeout(() => {
        const newTextarea = document.querySelector(SELECTORS.TWEET_TEXTAREA) as HTMLElement
        if (newTextarea) {
          insertText(newTextarea)
        } else {
          debug.error('ActiveAgents', 'Failed to find textarea after tweet button', { agentName })
        }
      }, 100)
    }
  }
}

export default function ActiveAgents({
  setCurrentView,
}: {
  setCurrentView: React.Dispatch<React.SetStateAction<AGENT_VIEWS>>
}) {
  const { agents, loading: agentsLoading, error: agentsError } = useAgents()
  const { contract: registry } = useAgentRegistry()
  const [agentsWithBalances, setAgentsWithBalances] = useState<AgentWithBalances[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agentList, setAgentList] = useState<Agent[]>([])
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set())
  const [tokenImages, setTokenImages] = useState<Record<string, string>>({})

  useEffect(() => {
    if (agents.length > 0) {
      setAgentList(agents.map(agent => ({
        name: agent.name,
        address: agent.address,
        systemPrompt: agent.systemPrompt,
        token: agent.token
      })))
    }
  }, [agents])

  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (!agentList.length) {
        setLoading(false)
        return
      }

      try {
        const provider = getProvider()

        // Create a map of token addresses to fetch images only once
        const uniqueTokens = new Set(agentList.map(agent => agent.token.address))
        const tokenImagePromises = Array.from(uniqueTokens).map(async (tokenAddress) => {
          try {
            const tokenContract = new Contract(ERC20_ABI, tokenAddress, provider)
            const symbol = await tokenContract.symbol()
            const token = ACTIVE_NETWORK.tokens[symbol.toString()]
            return [tokenAddress, token?.image || ''] as [string, string]
          } catch (err) {
            debug.error('ActiveAgents', 'Error fetching token image:', err)
            return [tokenAddress, ''] as [string, string]
          }
        })

        const tokenImageResults = await Promise.all(tokenImagePromises)
        setTokenImages(Object.fromEntries(tokenImageResults))

        const agentsWithTokenBalances = await Promise.all(
          agentList.map(async (agent) => {
            try {
              const tokenContract = new Contract(ERC20_ABI, agent.token.address, provider)
              const balance = await tokenContract.balance_of(agent.address)
              return {
                ...agent,
                balance: balance.toString()
              }
            } catch (err) {
              debug.error('ActiveAgents', 'Error fetching token balance:', err)
              return {
                ...agent,
                balance: '0'
              }
            }
          })
        )

        setAgentsWithBalances(agentsWithTokenBalances)
      } catch (err) {
        debug.error('ActiveAgents', 'Error fetching token balances:', err)
        setError('Failed to fetch token balances')
      } finally {
        setLoading(false)
      }
    }

    if (agentList.length) {
      fetchTokenBalances()
    }
  }, [agentList])

  // Sort agents by total value in their respective tokens
  const sortedAgents = [...agentsWithBalances].sort((a, b) => {
    const balanceA = BigInt(a.balance || '0')
    const balanceB = BigInt(b.balance || '0')
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

  if (loading || agentsLoading) {
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

        <div className="pt-3 max-h-[calc(100vh-240px)] overflow-scroll pr-4 pb-12">
          {sortedAgents.map((agent) => (
            <div key={agent.address}>
              <div
                className="grid items-center py-4 border-b border-b-[#2F3336] hover:bg-[#16181C]"
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
                  <h3 className="text-white">{agent.name}</h3>
                  <p className="text-[#A4A4A4] text-sm">
                    Min price: {formatBalance(agent.token.minPromptPrice)}
                  </p>
                </div>

                <div className="text-right flex items-center justify-end gap-2">
                  <img 
                    src={tokenImages[agent.token.address]} 
                    alt="Token" 
                    className="w-4 h-4 rounded-full"
                  />
                  <p className="text-white">
                    {formatBalance(agent.balance)}
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => composeTweet(agent.name)}
                    className="bg-white rounded-full px-4 py-1.5 text-black text-sm hover:bg-white/70"
                  >
                    Reply
                  </button>
                </div>
              </div>

              {expandedAgents.has(agent.address) && (
                <div className="px-8 py-4 text-[#A4A4A4] text-sm bg-[#16181C] border-b border-b-[#2F3336]">
                  {agent.systemPrompt}
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
