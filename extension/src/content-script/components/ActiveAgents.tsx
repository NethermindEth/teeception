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
import { AGENT_REGISTRY_COPY_ABI } from '../../abis/AGENT_REGISTRY'
import { AGENT_ABI } from '../../abis/AGENT_ABI'
import { debug } from '../utils/debug'

interface AgentWithBalances {
  address: string
  name: string
  systemPrompt: string
  balances: Record<string, string>
}

interface Agent {
  name: string
  address: string
  systemPrompt: string
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
  const { address: registryAddress } = useAgentRegistry()
  const { agents, loading: agentsLoading, error: agentsError } = useAgents(registryAddress)
  const { supportedTokens, isLoading: isLoadingSupport } = useTokenSupport()
  const [agentsWithBalances, setAgentsWithBalances] = useState<AgentWithBalances[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agentList, setAgentList] = useState<Agent[]>([])
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set())

  // Get supported tokens only
  const supportedTokenList = useMemo(
    () =>
      Object.entries(ACTIVE_NETWORK.tokens)
        .filter(([symbol]) => supportedTokens[symbol]?.isSupported)
        .map(([symbol, token]) => [symbol, token] as [string, typeof token]),
    [supportedTokens]
  )

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc })
        const registry = new Contract(
          AGENT_REGISTRY_COPY_ABI,
          ACTIVE_NETWORK.agentRegistryAddress,
          provider
        )

        const agentAddresses = await registry.get_agents()
        const loadedAgents: Agent[] = []

        for (const address of agentAddresses) {
          try {
            // Convert BigInt address to hex string
            const hexAddress = '0x' + BigInt(address).toString(16)
            const agentContract = new Contract(AGENT_ABI, hexAddress, provider)

            const [name, systemPrompt] = await Promise.all([
              agentContract.get_name(),
              agentContract.get_system_prompt(),
            ])

            loadedAgents.push({
              name: name.toString(),
              address: hexAddress,
              systemPrompt: systemPrompt.toString(),
            })
          } catch (error) {
            debug.error('ActiveAgents', 'Error loading individual agent', { address, error })
          }
        }

        setAgentList(loadedAgents)
      } catch (error) {
        debug.error('ActiveAgents', 'Error loading agents', error)
      } finally {
        setLoading(false)
      }
    }

    loadAgents()
  }, [])

  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (!agentList.length) {
        setLoading(false)
        return
      }

      try {
        const provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc })

        const balancePromises = agentList.map(async (agent) => {
          const tokenBalances: Record<string, string> = {}

          await Promise.all(
            supportedTokenList.map(async ([symbol, token]) => {
              const tokenContract = new Contract(ERC20_ABI, token.address, provider)
              const balance = await tokenContract.balance_of(agent.address)
              tokenBalances[symbol] = balance.toString()
            })
          )

          return {
            ...agent,
            balances: tokenBalances,
          }
        })

        const agentsWithTokenBalances = await Promise.all(balancePromises)
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
  }, [agentList, supportedTokenList])

  // Sort agents by total value in STRK
  const sortedAgents = [...agentsWithBalances].sort((a, b) => {
    const balanceA = BigInt(a.balances['STRK'] || '0')
    const balanceB = BigInt(b.balances['STRK'] || '0')
    return balanceB > balanceA ? 1 : balanceB < balanceA ? -1 : 0
  })

  const formatBalance = (balance: string, decimals: number) => {
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

  if (loading || agentsLoading || isLoadingSupport) {
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
        <div
          className="grid border-b border-b-[#2F3336]"
          style={{ gridTemplateColumns: `auto repeat(${supportedTokenList.length}, 200px)` }}
        >
          <div className="text-[#A4A4A4] text-sm py-4">Active agents ({agentList.length})</div>
          {supportedTokenList.map(([symbol, token]) => (
            <div
              key={symbol}
              className="text-[#A4A4A4] text-sm py-4 text-right flex items-center justify-end gap-1"
            >
              <token.image />
              <span>{symbol}</span>
            </div>
          ))}
        </div>

        <div className="pt-3 max-h-[400px] overflow-scroll pb-12">
          {sortedAgents.map((agent) => (
            <div key={agent.address}>
              <div
                className={`grid items-center py-4 border-b border-b-[#2F3336] hover:bg-[#16181C] pr-2`}
                style={{
                  gridTemplateColumns: `32px auto repeat(${supportedTokenList.length}, 200px) 100px`,
                }}
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
                </div>

                {supportedTokenList.map(([symbol, token]) => (
                  <div key={symbol} className="text-right">
                    <p className="text-white">
                      {formatBalance(agent.balances[symbol] || '0', token.decimals)}
                    </p>
                  </div>
                ))}

                <div className="flex justify-end">
                  <button
                    onClick={() => composeTweet(agent.name)}
                    className="bg-white rounded-full px-4 py-1.5 text-black text-sm hover:bg-white/70 disabled:bg-white/70"
                    disabled
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
