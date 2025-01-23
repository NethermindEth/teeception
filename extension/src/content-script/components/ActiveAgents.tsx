import { AGENT_VIEWS } from './AgentView'
import { useAgents } from '../hooks/useAgents'
import { useAgentRegistry } from '../hooks/useAgentRegistry'
import { Loader2 } from 'lucide-react'

export default function ActiveAgents({
  setCurrentView,
}: {
  setCurrentView: React.Dispatch<React.SetStateAction<AGENT_VIEWS>>
}) {
  const { address: registryAddress } = useAgentRegistry()
  const { agents, loading, error } = useAgents(registryAddress)

  // Sort agents by balance
  const sortedAgents = [...agents].sort((a, b) => {
    const balanceA = BigInt(a.balance)
    const balanceB = BigInt(b.balance)
    return balanceB > balanceA ? 1 : balanceB < balanceA ? -1 : 0
  })

  const formatBalance = (balance: string) => {
    const value = BigInt(balance)
    if (value === BigInt(0)) return '0'
    
    // Format with 18 decimals
    const decimals = 18
    const divisor = BigInt(10 ** decimals)
    const integerPart = value / divisor
    const fractionalPart = value % divisor
    
    // Format fractional part and remove trailing zeros
    let fractionalStr = fractionalPart.toString().padStart(decimals, '0')
    fractionalStr = fractionalStr.replace(/0+$/, '')
    
    if (fractionalStr) {
      return `${integerPart}.${fractionalStr.slice(0, 4)}` // Show only 4 decimal places
    }
    return integerPart.toString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading agents...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] text-red-500">
        Failed to load agents
      </div>
    )
  }

  return (
    <div>
      <section className="pt-5">
        <div className="text-[#A4A4A4] text-sm grid grid-cols-2 py-4 border-b border-b-[#2F3336]">
          <p className="">Active agents ({agents.length})</p>
          <p className="text-right">Pool size</p>
        </div>

        <div className="pt-3 max-h-[calc(100vh-240px)] overflow-scroll pr-4 pb-12 h-[600px]">
          {sortedAgents.map((agent, index) => {
            return (
              <div className="text-base grid grid-cols-2 py-2" key={agent.address}>
                <div>
                  <p>{agent.name}</p>
                </div>
                <div className="text-right">
                  <p>{formatBalance(agent.balance)} STRK</p>
                </div>
              </div>
            )
          })}
          {agents.length === 0 && (
            <div className="text-center text-[#A4A4A4] py-4">
              No agents found
            </div>
          )}
        </div>
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
