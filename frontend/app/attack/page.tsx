'use client'

import { useAccount } from '@starknet-react/core'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { AgentListView } from '@/components/AgentListView'
import { TEXT_COPIES } from '@/constants'

export default function AttackPage() {
  const { address } = useAccount()

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
    <div className="mt-16 md:mt-0 min-h-[calc(100vh-60px)] bg-cover bg-center bg-no-repeat text-white flex-col items-end md:items-center justify-center md:px-4">
      <AgentListView
        heading={TEXT_COPIES.attack.heading}
        subheading={TEXT_COPIES.attack.subheading}
      />
    </div>
  )
}
