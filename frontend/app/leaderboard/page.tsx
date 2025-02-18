'use client'

import { AgentListView } from '@/components/AgentListView'
import { TEXT_COPIES } from '@/constants'
import { AgentDetails } from '@/hooks/useAgents'
import { useRouter } from 'next/navigation'

export default function LeaderboardPage() {
  const router = useRouter()
  const onAgentClick = (agent: AgentDetails) => {
    router.push(`/agents/${encodeURIComponent(agent.name)}`)
  }

  return (
    <div className="mt-16 md:mt-0 min-h-screen bg-cover bg-center bg-no-repeat text-white flex-col items-end md:items-center justify-center md:px-4">
      <AgentListView
        heading={TEXT_COPIES.leaderboard.heading}
        subheading={TEXT_COPIES.leaderboard.subheading}
        onAgentClick={onAgentClick}
      />
    </div>
  )
}
