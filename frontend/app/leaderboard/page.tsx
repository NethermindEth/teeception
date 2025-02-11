'use client'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Leaderboard } from '@/components/Leaderboard'

export default function LeaderboardPage() {
  return (
    <div className="bg-[url('/img/abstract_bg.png')] bg-cover h-screen bg-repeat-y overflow-y-hidden">
      <div className="min-h-screen bg-cover bg-center bg-no-repeat text-white flex-col items-end md:items-center justify-center md:px-4">
        <Header />
        <Leaderboard />
        <Footer />
      </div>
    </div>
  )
}
