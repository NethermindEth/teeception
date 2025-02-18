'use client'

import { Leaderboard } from '@/components/Leaderboard'

export default function LeaderboardPage() {
  return (
    <div className="mt-16 md:mt-0 min-h-screen bg-cover bg-center bg-no-repeat text-white flex-col items-end md:items-center justify-center md:px-4">
      <Leaderboard />
    </div>
  )
}
