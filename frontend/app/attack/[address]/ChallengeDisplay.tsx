import { ACTIVE_NETWORK } from '@/constants'
import { truncateAddress } from '@/lib/utils'
import { Prompt } from '@/types'
import Link from 'next/link'

export const ChallengeDisplay = ({ challenge }: { challenge: Prompt }) => {
  const isWinner = challenge.is_success

  return (
    <div
      className={`bg-[#12121266] backdrop-blur-lg p-6 rounded-lg ${
        isWinner ? 'border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.1)]' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Link
          className={`underline block font-mono text-sm ${
            isWinner ? 'text-[#FFD700]' : 'text-gray-400'
          }`}
          href={`${ACTIVE_NETWORK.explorer}/contract/${challenge.drained_to}`}
          target="_blank"
        >
          {truncateAddress(challenge.drained_to)}
        </Link>
      </div>
      <div className="space-y-4">
        <div className="bg-black/30 p-4 rounded-lg overflow-scroll">
          <p className={`font-mono text-lg ${isWinner ? 'text-[#FFD700]' : 'text-white'}`}>
            {challenge.prompt}
          </p>
        </div>
      </div>
      <div className="flex justify-between items-center mt-4">
        <p className="text-sm text-gray-400"></p>
        {isWinner && <div className="text-[#FFD700] text-sm font-medium">Winning Attempt</div>}
      </div>
    </div>
  )
}
