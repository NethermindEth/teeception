'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { LeaderboardSkeleton } from './ui/skeletons/LeaderboardSkeleton'
import { AgentDetails } from '@/hooks/useAgents'
import { formatBalance, getAgentStatus } from '@/lib/utils'
import CountdownTimer from './CountdownTimer'
import { AgentStatus } from '@/types'
import Link from 'next/link'

export enum TabType {
  AgentRanking = 'AGENT_RANKING',
  ActiveAgents = 'ACTIVE_AGENTS',
  TopAttackers = 'TOP_ATTACKERS',
}

export const AgentsList = ({
  agents,
  offset,
  isFetchingAgents,
  searchQuery,
}: {
  agents: AgentDetails[]
  isFetchingAgents: boolean
  searchQuery: string
  offset: number
}) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isFetchingAgents ? 'loading' : 'content'}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
      >
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
                    <p className="pr-1 col-span-1">#</p>
                    <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
                    <p className="col-span-10 pl-4">Agent name</p>
                  </div>
                  <div className="col-span-3 border-l border-l-[#6F6F6F] ps-4">Reward</div>
                  <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Message price</div>
                  <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Break attempts</div>
                  <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Status</div>
                </div>

                {/* Agent Cards */}
                <AnimatePresence>
                  {agents.map((agent, idx) => {
                    const promptPrice = formatBalance(
                      BigInt(agent.promptPrice),
                      agent.decimal,
                      2,
                      true
                    )
                    const prizePool = formatBalance(BigInt(agent.balance), agent.decimal)
                    const drainAmount = formatBalance(BigInt(agent.drainAmount), agent.decimal)
                    const reward = agent.isDrained || agent.isWithdrawn ? drainAmount : prizePool
                    const agentStatus = getAgentStatus({
                      isDrained: agent.isDrained,
                      isFinalized: agent.isFinalized,
                    })
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                        className="bg-[#2E40494D] backdrop-blur-xl p-3 rounded-lg hover:bg-[#2E40497D] cursor-pointer"
                        key={agent.address}
                      >
                        <Link href={`/attack/${agent.address}`} className="block">
                          {/* Mobile Layout */}
                          <div className="md:hidden space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">#{offset + idx + 1}</span>
                                <span className="font-medium overflow-hidden">{agent.name}</span>
                              </div>
                              {agentStatus === AgentStatus.ACTIVE && (
                                <CountdownTimer endTime={Number(agent.endTime)} size="sm" />
                              )}
                              {agentStatus === AgentStatus.DEFEATED && (
                                <div className="w-24 flex justify-center text-xs font-semibold bg-[#FF3F26]/20 text-[#FF3F26] py-1 rounded-full ">
                                  DEFEATED
                                </div>
                              )}
                              {agentStatus === AgentStatus.UNDEFEATED && (
                                <div className="w-24 flex justify-center text-xs font-semibold bg-[#1388D5]/20 text-[#1388D5] py-1 rounded-full">
                                  UNDEFEATED
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs">Reward</p>
                                <p>
                                  {`${reward} ${agent.symbol}`.trim()}
                                </p>
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
                              <p className="pr-1 col-span-1">{offset + idx + 1}</p>
                              <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
                              <div className="col-span-10 pl-4 overflow-hidden">{agent.name}</div>
                            </div>
                            <div className="col-span-3 ps-4">
                              {`${reward} ${agent.symbol}`.trim()}
                            </div>
                            <div className="col-span-2 ps-4">
                              {`${promptPrice} ${agent.symbol}`.trim()}
                            </div>
                            <div className="col-span-2 ps-4">{agent.breakAttempts}</div>
                            <div className="col-span-2 ps-4">
                              {agentStatus === AgentStatus.ACTIVE && (
                                <CountdownTimer endTime={Number(agent.endTime)} size="md" />
                              )}
                              {agentStatus === AgentStatus.DEFEATED && (
                                <div className="w-32 flex justify-center text-center text-sm font-bold tracking-wider bg-[#FF3F26]/20 text-[#FF3F26] py-2 rounded-full ">
                                  DEFEATED
                                </div>
                              )}
                              {agentStatus === AgentStatus.UNDEFEATED && (
                                <div className="w-32 flex justify-center text-sm text-center font-bold  bg-[#1388D5]/20 text-[#1388D5] py-2 rounded-full">
                                  UNDEFEATED
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
