'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentsList, TabType } from './AgentsList'
import { useMemo, useState } from 'react'
import { AgentDetails, useAgents } from '@/hooks/useAgents'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { DOTS, usePagination } from '@/hooks/usePagination'

const PAGE_SIZE = 10
const SIBLING_COUNT = 1

export const Leaderboard = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  //TODO: show toast for failed to load agents
  const {
    agents = [],
    loading: isFetchingAgents,
    totalAgents,
  } = useAgents({ page: currentPage, pageSize: PAGE_SIZE })

  const totalPages = Math.ceil(totalAgents / PAGE_SIZE)
  const paginationRange = usePagination({
    currentPage,
    totalCount: totalAgents,
    pageSize: PAGE_SIZE,
    siblingCount: SIBLING_COUNT,
  })
  const activeAgents = useMemo(() => agents.filter((agent) => !agent.isFinalized), [agents])
  const topAttackers = useMemo(
    () => agents.sort((agent1, agent2) => +agent2.balance - +agent1.balance),
    [agents]
  )

  const filterAgents = (agents: AgentDetails[], query: string) => {
    if (!query.trim()) return agents

    const lowercaseQuery = query.toLowerCase().trim()
    return agents.filter(
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
  const filteredTopAttackers = useMemo(
    () => filterAgents(topAttackers, searchQuery),
    [topAttackers, searchQuery]
  )

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  return (
    <div className="px-2 md:px-8 py-12 md:py-20 max-w-[1560px] mx-auto md:mt-20">
      <div className="mb-20">
        <p className="text-4xl md:text-[48px] font-bold text-center uppercase" id="leaderboard">
          Leaderboard
        </p>

        <div className="flex max-w-[800px] mx-auto my-3 md:my-6">
          <div className="white-gradient-border"></div>
          <div className="white-gradient-border rotate-180"></div>
        </div>

        <p className="text-[#B4B4B4] text-center max-w-[594px] mx-auto">
          Discover agents created over time, active agents and check how both hackers who cracked
          systems and agent&apos;s creators have earned STRK rewards
        </p>
      </div>
      <div>
        <Tabs defaultValue={TabType.ActiveAgents} className="w-full">
          <div className="flex flex-col md:flex-row items-center justify-between mb-6">
            <TabsList className="flex w-full">
              <TabsTrigger value={TabType.AgentRanking}>
                Agents ranking ({agents.length})
              </TabsTrigger>
              <TabsTrigger value={TabType.ActiveAgents}>
                Active agents ({activeAgents.length})
              </TabsTrigger>
              <TabsTrigger value={TabType.TopAttackers}>
                Top attackers ({topAttackers.length})
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

          <TabsContent value={TabType.AgentRanking}>
            <AgentsList
              agents={filteredAgents}
              isFetchingAgents={isFetchingAgents}
              searchQuery={searchQuery}
            />
          </TabsContent>
          <TabsContent value={TabType.ActiveAgents}>
            <AgentsList
              agents={filteredActiveAgents}
              isFetchingAgents={isFetchingAgents}
              searchQuery={searchQuery}
            />
          </TabsContent>
          <TabsContent value={TabType.TopAttackers}>
            <AgentsList
              agents={filteredTopAttackers}
              isFetchingAgents={isFetchingAgents}
              searchQuery={searchQuery}
            />
          </TabsContent>
        </Tabs>
        <div className="flex gap-1 mx-auto text-[#B8B8B8] text-xs w-fit mt-6 items-center">
          <button
            onClick={handlePreviousPage}
            className={`hover:text-white ${
              currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
            disabled={currentPage === 0}
          >
            <ChevronLeft />
          </button>

          {paginationRange.map((pageNumber, index) => {
            if (pageNumber === DOTS) {
              return (
                <span key={index} className="text-[#B8B8B8]">
                  ...
                </span>
              )
            }
            return (
              <button
                onClick={() => setCurrentPage(+pageNumber)}
                key={index}
                className={`${pageNumber === currentPage ? 'text-white' : 'text-[#B8B8B8]'} p-2`}
              >
                {pageNumber}
              </button>
            )
          })}
          <button
            onClick={handleNextPage}
            className={`hover:text-white ${
              currentPage === totalPages ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
            disabled={currentPage === totalPages}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  )
}
