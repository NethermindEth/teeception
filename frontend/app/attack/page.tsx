'use client'

import { AgentDetails } from '@/hooks/useAgents'
import { useAccount } from '@starknet-react/core'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { useRouter } from 'next/navigation'
import { AgentListView } from '@/components/AgentListView'
import { TEXT_COPIES } from '@/constants'
import { AttackerDetails } from '@/hooks/useAttackers'

export default function AttackPage() {
  const { address } = useAccount()
  const router = useRouter()

  const onAgentClick = (agent: AgentDetails) => {
    router.push(`/attack/${agent.address}`)
  }

  const onAttackerClick = (attacker: AttackerDetails) => {
    console.log(attacker)
  }

  if (!address) {
    return (
      <ConnectPrompt
        title="Welcome Challenger"
        subtitle="One step away from breaking the unbreakable"
        theme="attacker"
      />
    )
  }

  return (
    <div className="mt-16 md:mt-0 min-h-screen bg-cover bg-center bg-no-repeat text-white flex-col items-end md:items-center justify-center md:px-4">
      <AgentListView
        heading={TEXT_COPIES.attack.heading}
        subheading={TEXT_COPIES.attack.subheading}
        onAgentClick={onAgentClick}
        onAttackerClick={onAttackerClick}
      />
    </div>
  )
}
