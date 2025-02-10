'use client'
import { useRouter } from 'next/navigation'
import { LeaderboardSkeleton } from './ui/skeletons/LeaderboardSkeleton'
import { AgentDetails } from '@/hooks/useAgents'
import { calculateTimeLeft, divideFloatStrings } from '@/lib/utils'

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
            <div className="text-xs flex flex-col gap-1 whitespace-nowrap overflow-x-auto">
              <div className="grid grid-cols-12 bg-[#2E40494D] backdrop-blur-xl min-w-[680px] min-h-10 p-3 rounded-lg mb-2">
                <div className="col-span-5 md:col-span-3 grid grid-cols-12 items-center">
                  <p className="pr-1 col-span-2 lg:col-span-1">Rank</p>
                  <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
                  <p className="col-span-2">Agent name</p>
                </div>
                <div className="col-span-3 border-l border-l-[#6F6F6F] ps-4">Reward</div>
                <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Message price</div>
                <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Break attempts</div>
              </div>

              {agents.map((agent, idx) => {
                const timeLeft = calculateTimeLeft(Number(agent.endTime))
                const promptPrice = divideFloatStrings(agent.promptPrice, agent.decimal)
                const prizePool = divideFloatStrings(agent.balance, agent.decimal)
                return (
                  <div
                    className="grid grid-cols-12 bg-[#2E40494D] backdrop-blur-xl min-w-[680px] min-h-11 p-3 rounded-lg hover:bg-[#2E40497D] cursor-pointer"
                    key={agent.address}
                    onClick={() => handleAgentClick(agent)}
                  >
                    <div className="col-span-5 md:col-span-3 grid grid-cols-12 items-center">
                      <p className="pr-1 col-span-2 lg:col-span-1">{idx + 1}</p>
                      <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
                      <div className="col-span-2 flex gap-1 items-center">
                        <div className="mr-4">{agent.name}</div>
                      </div>
                    </div>
                    <div className="col-span-3 ps-4">{`${prizePool} ${agent.symbol}`.trim()}</div>
                    <div className="col-span-2 ps-4">{`${promptPrice} ${agent.symbol}`.trim()}</div>
                    <div className="col-span-2 ps-4">{agent.breakAttempts}</div>
                    {!agent.isFinalized && timeLeft !== 'Inactive' && (
                      <div className="rounded-full bg-black px-4 py-2 flex items-center justify-end">
                        <div className="w-2 h-2 bg-[#00D369] rounded-full flex-shrink-0"></div>
                        <div className="pl-1">{timeLeft}</div>
                      </div>
                    )}
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
