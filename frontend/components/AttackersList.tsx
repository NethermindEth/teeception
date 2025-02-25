'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { LeaderboardSkeleton } from './ui/skeletons/LeaderboardSkeleton'
import { AttackerDetails } from '@/hooks/useAttackers'
import { formatBalance } from '@/lib/utils'
import { ACTIVE_NETWORK } from '@/constants'
import Link from 'next/link'

export const AttackersList = ({
  attackers,
  isFetchingAttackers,
  searchQuery,
  offset,
}: {
  attackers: AttackerDetails[]
  isFetchingAttackers: boolean
  searchQuery: string
  offset: number
}) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isFetchingAttackers ? 'loading' : 'content'}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
      >
        {isFetchingAttackers ? (
          <LeaderboardSkeleton />
        ) : (
          <>
            {attackers.length === 0 && searchQuery ? (
              <div className="text-center py-8 text-[#B8B8B8]">
                No attackers found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="text-xs flex flex-col gap-1">
                {/* Table Header - Hidden on mobile */}
                <div className="hidden md:grid md:grid-cols-12 bg-[#2E40494D] backdrop-blur-xl p-3 rounded-lg mb-2">
                  <div className="col-span-3 grid grid-cols-12 items-center">
                    <p className="pr-1 col-span-1">#</p>
                    <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
                    <p className="col-span-10 pl-4">Attacker address</p>
                  </div>
                  <div className="col-span-3 border-l border-l-[#6F6F6F] ps-4">Accrued rewards</div>
                  <div className="col-span-3 border-l border-l-[#6F6F6F] ps-4">Prompt count</div>
                  <div className="col-span-3 border-l border-l-[#6F6F6F] ps-4">Break count</div>
                </div>

                {/* Attacker Cards */}
                <AnimatePresence>
                  {attackers.map((attacker, idx) => {
                    const accruedBalances = ACTIVE_NETWORK.tokens
                      .map((token) => {
                        const balance = attacker.accruedBalances[token.address] || '0'
                        const formattedBalance = formatBalance(BigInt(balance), token.decimals)
                        return `${formattedBalance} ${token.symbol}`
                      })
                      .join(', ')

                    const formattedAddress = `${attacker.address.slice(
                      0,
                      6
                    )}...${attacker.address.slice(-4)}`

                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                        className="bg-[#2E40494D] backdrop-blur-xl p-3 rounded-lg hover:bg-[#2E40497D] cursor-pointer"
                        key={attacker.address}
                      >
                        {/* Remove pointer-events-none to enable this link in future*/}
                        <Link
                          href={`/attackers/${attacker.address}`}
                          className="block pointer-events-none"
                        >
                          {/* Mobile Layout */}
                          <div className="md:hidden space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">#{offset + idx + 1}</span>
                              <span className="font-medium">{formattedAddress}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs">Rewards</p>
                                <p>{accruedBalances}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs">Prompts</p>
                                <p>{attacker.promptCount}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs">Breaks</p>
                                <p>{attacker.breakCount}</p>
                              </div>
                            </div>
                          </div>

                          {/* Desktop Layout */}
                          <div className="hidden md:grid md:grid-cols-12 items-center">
                            <div className="col-span-3 grid grid-cols-12 items-center">
                              <p className="pr-1 col-span-1">{offset + idx + 1}</p>
                              <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
                              <div className="col-span-10 pl-4">{formattedAddress}</div>
                            </div>
                            <div className="col-span-3 ps-4">{accruedBalances}</div>
                            <div className="col-span-3 ps-4">{attacker.promptCount}</div>
                            <div className="col-span-3 ps-4">{attacker.breakCount}</div>
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
