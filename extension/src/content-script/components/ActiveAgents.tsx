import { AGENT_VIEWS } from './AgentView'
import { ACTIVE_NETWORK } from '../config/starknet'
import { useAgents } from '../hooks/useAgents'
import { useAgentRegistry } from '../hooks/useAgentRegistry'
import { Loader2 } from 'lucide-react'
import { Contract, RpcProvider } from 'starknet'
import { ERC20_ABI } from '../../abis/ERC20_ABI'
import { useEffect, useState, useMemo } from 'react'
import { useTokenSupport } from '../hooks/useTokenSupport'

interface AgentWithBalances {
  address: string;
  name: string;
  systemPrompt: string;
  balances: Record<string, string>;
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

  // Get supported tokens only
  const supportedTokenList = useMemo(() => 
    Object.entries(ACTIVE_NETWORK.tokens)
      .filter(([symbol]) => supportedTokens[symbol]?.isSupported)
      .map(([symbol, token]) => [symbol, token] as [string, typeof token])
  , [supportedTokens])

  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (!agents.length) {
        setLoading(false)
        return
      }

      try {
        const provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc })
        
        const balancePromises = agents.map(async (agent) => {
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
        console.error('Error fetching token balances:', err)
        setError('Failed to fetch token balances')
      } finally {
        setLoading(false)
      }
    }

    if (agents.length) {
      fetchTokenBalances()
    }
  }, [agents, supportedTokenList])

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
        {error || 'Failed to load agents'}
      </div>
    )
  }

  return (
    <div>
      <section className="pt-5">
        {/* Header */}
        <div className="grid border-b border-b-[#2F3336]" style={{ gridTemplateColumns: `auto repeat(${supportedTokenList.length}, 200px)` }}>
          <div className="text-[#A4A4A4] text-sm py-4">
            Active agents ({agents.length})
          </div>
          {supportedTokenList.map(([symbol, token]) => (
            <div key={symbol} className="flex items-center gap-2 justify-center text-[#A4A4A4] text-sm py-4">
              <img src={token.image} alt={token.name} className="w-4 h-4 rounded-full" />
              <span>{symbol}</span>
            </div>
          ))}
        </div>

        {/* Agent List */}
        <div className="pt-3 max-h-[calc(100vh-240px)] overflow-scroll pr-4 pb-12 h-[600px]">
          {sortedAgents.map((agent) => (
            <div 
              key={agent.address} 
              className="grid border-b border-[#2F3336] last:border-0 py-4" 
              style={{ gridTemplateColumns: `auto repeat(${supportedTokenList.length}, 200px)` }}
            >
              <div className="text-white text-base">{agent.name}</div>
              {supportedTokenList.map(([symbol, token]) => (
                <div key={symbol} className="text-center text-base">
                  {formatBalance(agent.balances[symbol] || '0', token.decimals)} {symbol}
                </div>
              ))}
            </div>
          ))}
          {agents.length === 0 && (
            <div className="text-center text-[#A4A4A4] py-4">
              No agents found
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 px-4 py-8 bg-[#12121266] backdrop-blur-sm absolute bottom-0 left-0 right-0">
          <button
            onClick={() => {
              setCurrentView(AGENT_VIEWS.LAUNCH_AGENT)
            }}
            className="bg-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-black text-base hover:bg-white/70 border border-transparent"
          >
            Launch Agent
          </button>
          <button
            className="bg-transparent border border-white text-white rounded-[58px] min-h-[44px] md:min-w-[152px] flex items-center justify-center px-4 text-base hover:bg-white hover:text-black"
            onClick={() => {
              setCurrentView(AGENT_VIEWS.LEADERBOARD)
            }}
          >
            Visit leaderboard
          </button>
        </div>
      </section>
    </div>
  )
}
