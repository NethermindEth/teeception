'use client'

import { FormattedUsageStats } from '@/hooks/useUsageStats'
import StatSkeleton from './StatSkeleton'

export const Stats = ({
  data,
  isLoading,
}: {
  data: FormattedUsageStats | null
  isLoading: boolean
}) => {
  if (isLoading || !data) return <StatSkeleton />
  return (
    <div className="flex items-center justify-center gap-2 lg:gap-6 mt-4 lg:mt-6">
      <div>
        <p className="text-[#7E7E7E] text-sm lg:text-base mb-1">Launched agents</p>
        <h3 className="text-lg lg:text-[38px]">{data.registeredAgents}</h3>
      </div>

      <div>
        <div className="w-[1px] h-full white-gradient-border-vertical-top min-h-[40px]"></div>
        <div className="w-[1px] h-full white-gradient-border-vertical-bottom min-h-[40px]"></div>
      </div>

      <div>
        <p className="text-[#7E7E7E] text-sm lg:text-base mb-1">Total break attempts</p>
        <h3 className="text-lg lg:text-[38px]">{data.attempts.total}</h3>
      </div>

      <div>
        <div className="w-[1px] h-full white-gradient-border-vertical-top min-h-[40px]"></div>
        <div className="w-[1px] h-full white-gradient-border-vertical-bottom min-h-[40px]"></div>
      </div>

      <div>
        <p className="text-[#7E7E7E] text-sm lg:text-base mb-1">Successful Breaks</p>
        <h3 className="text-lg lg:text-[38px]">{data.attempts.successes}</h3>
      </div>

      <div>
        <div className="w-[1px] h-full white-gradient-border-vertical-top min-h-[40px]"></div>
        <div className="w-[1px] h-full white-gradient-border-vertical-bottom min-h-[40px]"></div>
      </div>

      <div>
        <p className="text-[#7E7E7E] text-sm lg:text-base mb-1">Average bounty</p>
        <h3 className="text-lg lg:text-[38px]">{data.averageBounty.amount} STRK</h3>
      </div>
    </div>
  )
}
