import { divideFloatStrings } from '@/lib/utils'
import clsx from 'clsx'

export type AgentInfoProps = {
  balance: string
  decimal: number
  promptPrice: string
  symbol: string
  breakAttempts: number
  className?: string
}
export const AgentInfo = ({
  balance,
  decimal,
  promptPrice,
  symbol,
  breakAttempts,
  className,
}: AgentInfoProps) => {
  const prizePool = divideFloatStrings(balance, decimal)
  const messagePrice = divideFloatStrings(promptPrice, decimal)
  return (
    <div
      className={clsx(
        className,
        'bg-gradient-to-l from-[#35546266] via-[#2E404966] to-[#6e9aaf66] p-[1px] rounded-lg max-w-[624px] mx-auto'
      )}
    >
      <div className="bg-black w-full h-full rounded-lg">
        <div className="bg-[#12121266] w-full h-full rounded-lg p-3 md:p-[18px] flex justify-between">
          <div>
            <p className="text-[10px] md:text-xs text-[#E1EDF2]">Prize pool</p>
            <h4 className="text-xl md:text-2xl font-bold">
              {prizePool} {symbol}
            </h4>
          </div>

          <div className="h-full w-[1px] bg-[#35546266] min-h-12"></div>

          <div>
            <p className="text-[10px] md:text-xs text-[#E1EDF2]">Message price</p>
            <h4 className="text-xl md:text-2xl font-bold">
              {messagePrice} {symbol}
            </h4>
          </div>

          <div className="h-full w-[1px] bg-[#35546266] min-h-12"></div>

          <div>
            <p className="text-[10px] md:text-xs text-[#E1EDF2]">Break attempts</p>
            <h4 className="text-xl md:text-2xl font-bold">{breakAttempts}</h4>
          </div>
        </div>
      </div>
    </div>
  )
}
