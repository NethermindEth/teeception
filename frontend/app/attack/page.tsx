'use client'

import { useEffect, useState } from 'react'
import { useAgents } from '@/hooks/useAgents'
import { useAccount } from '@starknet-react/core'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { ConnectPrompt } from '@/components/ConnectPrompt'

export default function AttackPage() {
  const { address } = useAccount()
  const { agents = [], loading: isFetchingAgents } = useAgents({ page: 0, pageSize: 1000 })

  if (!address) {
    return (
      <>
        <Header />
        <ConnectPrompt
          title="Welcome Challenger"
          subtitle="One step away from breaking the unbreakable"
          theme="attacker"
        />
      </>
    )
  }

  if (isFetchingAgents) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <h1 className="text-4xl font-bold mb-8">Challenge Agents</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Link 
              href={`/attack/${agent.address}`} 
              key={agent.address}
              className="bg-[#12121266] backdrop-blur-lg p-6 rounded-lg hover:bg-[#12121299] transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">{agent.name}</h2>
                <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                  Active
                </div>
              </div>
              
              <div className="space-y-2 text-gray-400">
                <p>Balance: {agent.balance} STRK</p>
                <p>Challenge Fee: {agent.feePerMessage} STRK</p>
                <p>Success Rate: {agent.successRate}%</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
} 