'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentsList, TabType } from './AgentsList'
import { useMemo, useState } from 'react'
import { AgentDetails, useAgents } from '@/hooks/useAgents'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import {  usePagination } from '@/hooks/usePagination'
import { useAttackers } from '@/hooks/useAttackers'
import { AttackersList } from './AttackersList'

const PAGE_SIZE = 10
const SIBLING_COUNT = 1

type AgentListViewProps = {
  heading: string
  subheading: string
}

export const AgentListView = ({ heading, subheading }: AgentListViewProps) => {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Get tab from URL, default to ActiveAgents
  const selectedTab = (searchParams.get('tab') as TabType) || TabType.ActiveAgents
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(0)

  const {
    agents: allAgents,
    loading: isFetchingAllAgents,
    totalAgents: totalAllAgents,
  } = useAgents({ page: currentPage, pageSize: PAGE_SIZE, active: null })

  const {
    agents: activeAgents,
    loading: isFetchingActiveAgents,
    totalAgents: totalActiveAgents,
  } = useAgents({ page: currentPage, pageSize: PAGE_SIZE, active: true })

  const {
    attackers = [],
    loading: isFetchingAttackers,
    totalAttackers,
  } = useAttackers({ page: currentPage, pageSize: PAGE_SIZE })

  let totalTabEntries = 0
  if (selectedTab === TabType.TopAttackers) {
    totalTabEntries = totalAttackers
  } else if (selectedTab === TabType.ActiveAgents) {
    totalTabEntries = totalActiveAgents
  } else {
    totalTabEntries = totalAllAgents
  }

  const totalPages = Math.ceil(totalTabEntries / PAGE_SIZE)

  const paginationRange = usePagination({
    currentPage,
    totalCount: totalTabEntries,
    pageSize: PAGE_SIZE,
    siblingCount: SIBLING_COUNT,
  })

  const filterAgents = (agents: AgentDetails[], query: string) => {
    if (!query.trim()) return agents
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query.toLowerCase()) ||
        agent.address.toLowerCase().includes(query.toLowerCase())
    )
  }

  const filteredAgents = useMemo(
    () => filterAgents(allAgents, searchQuery),
    [allAgents, searchQuery]
  )
  const filteredActiveAgents = useMemo(
    () => filterAgents(activeAgents, searchQuery),
    [activeAgents, searchQuery]
  )

  const handleTabChange = (tab: string) => {
    router.push(`?tab=${tab}`, { scroll: false })
    setCurrentPage(0)
    if (tab === TabType.TopAttackers) {
      setSearchQuery('')
    }
  }

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
    <div className="px-2 md:px-8 py-12 md:py-20 max-w-[1560px] mx-auto md:pt-36">
      <div className="mb-20">
        <p className="text-4xl md:text-[48px] font-bold text-center uppercase" id="leaderboard">
          {heading}
        </p>
        <div className="flex max-w-[800px] mx-auto my-3 md:my-6">
          <div className="white-gradient-border"></div>
          <div className="white-gradient-border rotate-180"></div>
        </div>
        <p className="text-[#B4B4B4] text-center max-w-[594px] mx-auto">{subheading}</p>
      </div>

      <div>
        <Tabs value={selectedTab} className="w-full" onValueChange={handleTabChange}>
          <div className="flex flex-col md:flex-row items-center justify-between mb-6">
            <TabsList className="flex w-full">
              <TabsTrigger value={TabType.AgentRanking}>Agents ranking</TabsTrigger>
              <TabsTrigger value={TabType.ActiveAgents}>Active agents</TabsTrigger>
              <TabsTrigger value={TabType.TopAttackers}>Top attackers</TabsTrigger>
            </TabsList>

            {selectedTab !== TabType.TopAttackers && (
              <div className="relative w-full md:w-auto mt-4 md:mt-0">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by agent"
                  className="placeholder:text-[#6F6F6F] border border-[#6F6F6F] rounded-[28px] bg-transparent px-5 py-1 min-h-[2rem] text-sm outline-none focus:border-white w-full md:w-auto"
                />
                <Search className="text-[#6F6F6F] absolute top-1/2 -translate-y-1/2 right-5" width={14} />
              </div>
            )}
          </div>

          <TabsContent value={TabType.AgentRanking}>
            <AgentsList agents={filteredAgents} isFetchingAgents={isFetchingAllAgents} searchQuery={searchQuery} offset={currentPage * PAGE_SIZE} />
          </TabsContent>
          <TabsContent value={TabType.ActiveAgents}>
            <AgentsList agents={filteredActiveAgents} isFetchingAgents={isFetchingActiveAgents} searchQuery={searchQuery} offset={currentPage * PAGE_SIZE} />
          </TabsContent>
          <TabsContent value={TabType.TopAttackers}>
            <AttackersList attackers={attackers} isFetchingAttackers={isFetchingAttackers} searchQuery="" offset={currentPage * PAGE_SIZE} />
          </TabsContent>
        </Tabs>

        {/* Pagination */}
        <div className="flex gap-1 mx-auto text-[#B8B8B8] text-xs w-fit mt-6 items-center">
          <button onClick={handlePreviousPage} className={`hover:text-white ${currentPage === 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} disabled={currentPage === 0}>
            <ChevronLeft />
          </button>

          {paginationRange.map((pageNumber, index) => (
            <button key={index} onClick={() => setCurrentPage(+pageNumber)} className={`${pageNumber === currentPage ? 'text-white' : 'text-[#B8B8B8]'} p-2`}>
              {pageNumber}
            </button>
          ))}

          <button onClick={handleNextPage} className={`hover:text-white ${currentPage === totalPages - 1 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} disabled={currentPage === totalPages - 1}>
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  )
}
