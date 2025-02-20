'use client'

import { FormattedUsageStats } from '@/hooks/useUsageStats'
import { AnimatePresence, motion } from 'framer-motion'

export const Stats = ({
  data,
  isLoading,
}: {
  data: FormattedUsageStats | null
  isLoading: boolean
}) => {
  const mockData = {
    registeredAgents: 0,
    attempts: {
      total: 0,
      successes: 0
    },
    totalBounty: '0'
  }

  const displayData = isLoading ? mockData : data

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-center gap-2 lg:gap-6 mt-4 lg:mt-6"
      >
        <motion.div layout>
          <motion.p layout className="text-[#7E7E7E] text-sm lg:text-base mb-1">Launched agents</motion.p>
          <motion.h3
            layout
            className="text-lg lg:text-[38px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 20 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isLoading ? "" : (
              displayData?.registeredAgents
            )}
          </motion.h3>
        </motion.div>

        <div>
          <div className="w-[1px] h-full white-gradient-border-vertical-top min-h-[40px]"></div>
          <div className="w-[1px] h-full white-gradient-border-vertical-bottom min-h-[40px]"></div>
        </div>

        <motion.div layout>
          <motion.p layout className="text-[#7E7E7E] text-sm lg:text-base mb-1">Total break attempts</motion.p>
          <motion.h3
            layout
            className="text-lg lg:text-[38px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 20 : 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {isLoading ? "" : (
              displayData?.attempts.total
            )}
          </motion.h3>
        </motion.div>

        <div>
          <div className="w-[1px] h-full white-gradient-border-vertical-top min-h-[40px]"></div>
          <div className="w-[1px] h-full white-gradient-border-vertical-bottom min-h-[40px]"></div>
        </div>

        <motion.div layout>
          <motion.p layout className="text-[#7E7E7E] text-sm lg:text-base mb-1">Successful Breaks</motion.p>
          <motion.h3
            layout
            className="text-lg lg:text-[38px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 20 : 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {isLoading ? "" : (
              displayData?.attempts.successes
            )}
          </motion.h3>
        </motion.div>

        <div>
          <div className="w-[1px] h-full white-gradient-border-vertical-top min-h-[40px]"></div>
          <div className="w-[1px] h-full white-gradient-border-vertical-bottom min-h-[40px]"></div>
        </div>

        <motion.div layout>
          <motion.p layout className="text-[#7E7E7E] text-sm lg:text-base mb-1">Total bounty</motion.p>
          <motion.h3
            layout
            className="text-lg lg:text-[38px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 20 : 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            {isLoading ? "" : (
              `${displayData?.totalBounty} STRK`
            )}
          </motion.h3>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
