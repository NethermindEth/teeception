'use client'

import { useState } from 'react'
import { useAgents, AgentDetails } from '@/hooks/useAgents'
import { useAccount } from '@starknet-react/core'
import { Loader2, Search } from 'lucide-react'
import { Header } from '@/components/Header'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { calculateTimeLeft } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMemo } from 'react'
import { AgentsList } from '@/components/AgentsList'
import { useRouter } from 'next/navigation'

enum TabType {
  AllAgents = 'all-agents',
  ActiveAgents = 'active-agents',
  HighestRewards = 'highest-rewards',
}

export default function AttackPage() {
  const { address } = useAccount()
  const [searchQuery, setSearchQuery] = useState('')
  const { agents = [], loading: isFetchingAgents } = useAgents({ page: 0, pageSize: 1000 })
  const router = useRouter()

  const activeAgents = useMemo(
    () => agents.filter((agent) => calculateTimeLeft(Number(agent.endTime)) !== 'Inactive'),
    [agents]
  )
  const highestRewards = useMemo(
    () => agents.sort((agent1, agent2) => +agent2.balance - +agent1.balance),
    [agents]
  )

  const filterAgents = (agentsList: AgentDetails[], query: string) => {
    if (!query.trim()) return agentsList

    const lowercaseQuery = query.toLowerCase().trim()
    return agentsList.filter(
      (agent) =>
        agent.name.toLowerCase().includes(lowercaseQuery) ||
        agent.address.toLowerCase().includes(lowercaseQuery)
    )
  }

  const filteredAgents = useMemo(() => filterAgents(agents, searchQuery), [agents, searchQuery])
  const filteredActiveAgents = useMemo(
    () => filterAgents(activeAgents, searchQuery),
    [activeAgents, searchQuery]
  )
  const filteredHighestRewards = useMemo(
    () => filterAgents(highestRewards, searchQuery),
    [highestRewards, searchQuery]
  )

  const handleAgentClick = (agent: AgentDetails) => {
    router.push(`/attack/${agent.address}`)
  }

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
      <div className="px-2 md:px-8 py-12 md:py-20 max-w-[1560px] mx-auto md:mt-20">
        <div className="mb-20">
          <p className="text-4xl md:text-[48px] font-bold text-center uppercase">
            Chose your oponent
          </p>

          <div className="flex max-w-[800px] mx-auto my-3 md:my-6">
            <div className="white-gradient-border"></div>
            <div className="white-gradient-border rotate-180"></div>
          </div>

          <p className="text-[#B4B4B4] text-center max-w-[594px] mx-auto">
            Trick one of these agents into sending you all their STRK
          </p>
        </div>

        <div>
          <Tabs defaultValue={TabType.ActiveAgents} className="w-full">
            <div className="flex flex-col md:flex-row items-center justify-between mb-6">
              <TabsList className="flex w-full">
                <TabsTrigger value={TabType.AllAgents}>All agents ({agents.length})</TabsTrigger>
                <TabsTrigger value={TabType.ActiveAgents}>
                  Active agents ({activeAgents.length})
                </TabsTrigger>
                <TabsTrigger value={TabType.HighestRewards}>
                  Highest rewards ({highestRewards.length})
                </TabsTrigger>
              </TabsList>

              <div className="relative w-full md:w-auto mt-4 md:mt-0">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by agent"
                  className="placeholder:text-[#6F6F6F] border border-[#6F6F6F] rounded-[28px] bg-transparent px-5 py-1 min-h-[2rem] text-sm outline-none focus:border-white w-full md:w-auto"
                />
                <Search
                  className="text-[#6F6F6F] absolute top-1/2 -translate-y-1/2 right-5"
                  width={14}
                />
              </div>
            </div>

            <TabsContent value={TabType.AllAgents}>
              <AgentsList
                agents={filteredAgents}
                isFetchingAgents={isFetchingAgents}
                searchQuery={searchQuery}
                onAgentClick={handleAgentClick}
              />
            </TabsContent>
            <TabsContent value={TabType.ActiveAgents}>
              <AgentsList
                agents={filteredActiveAgents}
                isFetchingAgents={isFetchingAgents}
                searchQuery={searchQuery}
                onAgentClick={handleAgentClick}
              />
            </TabsContent>
            <TabsContent value={TabType.HighestRewards}>
              <AgentsList
                agents={filteredHighestRewards}
                isFetchingAgents={isFetchingAgents}
                searchQuery={searchQuery}
                onAgentClick={handleAgentClick}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}
