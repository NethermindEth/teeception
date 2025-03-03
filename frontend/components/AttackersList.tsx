'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { LeaderboardSkeleton } from './ui/skeletons/LeaderboardSkeleton'
import { AttackerDetails } from '@/hooks/useAttackers'
import { formatBalance } from '@/lib/utils'
import { ACTIVE_NETWORK } from '@/constants'
import Link from 'next/link'
import { AttackerIdentifier } from './AttackerIdentifier'

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
  // Function to generate Voyager URL for an address
  const getVoyagerAddressUrl = (address: string) => {
    return `${ACTIVE_NETWORK.explorer}/contract/${address}`
  }

  // Calculate win ratio (breaks / prompts)
  const calculateWinRatio = (breakCount: number, promptCount: number): string => {
    if (promptCount === 0) return '0%'
    const ratio = (breakCount / promptCount) * 100
    return `${ratio.toFixed(1)}%`
  }

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
                  <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Accrued rewards</div>
                  <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Prompt count</div>
                  <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Break count</div>
                  <div className="col-span-3 border-l border-l-[#6F6F6F] ps-4">Win ratio</div>
                </div>

                {/* Attacker Cards */}
                <AnimatePresence>
                  {attackers.map((attacker, idx) => {
                    // const accruedBalances = ACTIVE_NETWORK.tokens
                    //   .map((token) => {
                    //     const balance =
                    //       attacker.accruedBalances[token.address] || "0";
                    //     const formattedBalance = formatBalance(
                    //       BigInt(balance),
                    //       token.decimals
                    //     );
                    //     return `${formattedBalance} ${token.symbol}`;
                    //   })
                    //   .join(", ");

                    const strkToken = ACTIVE_NETWORK.tokens[0]
                    const balance = attacker.accruedBalances[strkToken.address] || '0'
                    const formattedBalance = formatBalance(BigInt(balance), strkToken.decimals)
                    const accruedBalance = `${formattedBalance} ${strkToken.symbol}`
                    const winRatio = calculateWinRatio(attacker.breakCount, attacker.promptCount)

                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                        className="bg-[#2E40494D] backdrop-blur-xl p-3 rounded-lg hover:bg-[#2E40497D] cursor-pointer"
                        key={attacker.address}
                      >
                        <Link
                          href={getVoyagerAddressUrl(attacker.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {/* Mobile Layout */}
                          <div className="md:hidden space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">#{offset + idx + 1}</span>
                              <AttackerIdentifier address={attacker.address} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs">Rewards</p>
                                <p>{accruedBalance}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs">Prompts</p>
                                <p>{attacker.promptCount}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs">Breaks</p>
                                <p>{attacker.breakCount}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs">Win ratio</p>
                                <p>{winRatio}</p>
                              </div>
                            </div>
                          </div>

                          {/* Desktop Layout */}
                          <div className="hidden md:grid md:grid-cols-12 items-center">
                            <div className="col-span-3 grid grid-cols-12 items-center">
                              <p className="pr-1 col-span-1">{offset + idx + 1}</p>
                              <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
                              <div className="col-span-10 pl-4">
                                <AttackerIdentifier address={attacker.address} />
                              </div>
                            </div>
                            <div className="col-span-2 ps-4">{accruedBalance}</div>
                            <div className="col-span-2 ps-4">{attacker.promptCount}</div>
                            <div className="col-span-2 ps-4">{attacker.breakCount}</div>
                            <div className="col-span-3 ps-4">{winRatio}</div>
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
