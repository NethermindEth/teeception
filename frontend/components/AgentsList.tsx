'use client'
import { useRouter } from 'next/navigation'
import { LeaderboardSkeleton } from './ui/skeletons/LeaderboardSkeleton'
import { AgentDetails } from '@/hooks/useAgents'
import { divideFloatStrings } from '@/lib/utils'
import CountdownTimer from './CountdownTimer'

export enum TabType {
  AgentRanking = 'AGENT_RANKING',
  ActiveAgents = 'ACTIVE_AGENTS',
  TopAttackers = 'TOP_ATTACKERS',
}

export const AgentsList = ({
  agents,
  isFetchingAgents,
  searchQuery,
  onAgentClick,
}: {
  agents: AgentDetails[]
  isFetchingAgents: boolean
  searchQuery: string
  onAgentClick?: (agent: AgentDetails) => void
}) => {
  const router = useRouter()
  const handleAgentClick = (agent: AgentDetails) => {
    if (onAgentClick) {
      onAgentClick(agent)
    } else {
      router.push(`/agents/${encodeURIComponent(agent.name)}`)
    }
  }

  return (
    <>
      {isFetchingAgents ? (
        <LeaderboardSkeleton />
      ) : (
        <>
          {agents.length === 0 && searchQuery ? (
            <div className="text-center py-8 text-[#B8B8B8]">
              No agents found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            <div className="text-xs flex flex-col gap-1">
              {/* Table Header - Hidden on mobile */}
              <div className="hidden md:grid md:grid-cols-12 bg-[#2E40494D] backdrop-blur-xl p-3 rounded-lg mb-2">
                <div className="col-span-3 grid grid-cols-12 items-center">
                  <p className="pr-1 col-span-1">Rank</p>
                  <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
                  <p className="col-span-10 pl-4">Agent name</p>
                </div>
                <div className="col-span-3 border-l border-l-[#6F6F6F] ps-4">Reward</div>
                <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Message price</div>
                <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Break attempts</div>
                <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Status</div>
              </div>

              {/* Agent Cards */}
              {agents.map((agent, idx) => {
                const promptPrice = divideFloatStrings(agent.promptPrice, agent.decimal)
                const prizePool = divideFloatStrings(agent.balance, agent.decimal)
                return (
                  <div
                    className="bg-[#2E40494D] backdrop-blur-xl p-3 rounded-lg hover:bg-[#2E40497D] cursor-pointer"
                    key={agent.address}
                    onClick={() => handleAgentClick(agent)}
                  >
                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">#{idx + 1}</span>
                          <span className="font-medium">{agent.name}</span>
                        </div>
                        <CountdownTimer
                          endTime={Number(agent.endTime)}
                          isFinalized={agent.isFinalized}
                          size="sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs">Reward</p>
                          <p>{`${prizePool} ${agent.symbol}`.trim()}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Message price</p>
                          <p>{`${promptPrice} ${agent.symbol}`.trim()}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Break attempts</p>
                          <p>{agent.breakAttempts}</p>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden md:grid md:grid-cols-12 items-center">
                      <div className="col-span-3 grid grid-cols-12 items-center">
                        <p className="pr-1 col-span-1">{idx + 1}</p>
                        <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
                        <div className="col-span-10 pl-4">{agent.name}</div>
                      </div>
                      <div className="col-span-3 ps-4">{`${prizePool} ${agent.symbol}`.trim()}</div>
                      <div className="col-span-2 ps-4">
                        {`${promptPrice} ${agent.symbol}`.trim()}
                      </div>
                      <div className="col-span-2 ps-4">{agent.breakAttempts}</div>
                      <div className="col-span-2 ps-4">
                        <CountdownTimer
                          endTime={Number(agent.endTime)}
                          isFinalized={agent.isFinalized}
                          size="md"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )
}
