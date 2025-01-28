'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DOTS, usePagination } from '@/hooks/usePagination'
import { ACTIVE_AGENTS_DATA, AGENTS_RANKING_DATA, TOP_ATTACKERS_DATA } from '@/mock-data'
import { LeaderboardSkeleton } from './ui/skeletons/LeaderboardSkeleton'

export enum TabType {
  AgentRanking = 'AGENT_RANKING',
  ActiveAgents = 'ACTIVE_AGENTS',
  TopAttackers = 'TOP_ATTACKERS',
}

interface AgentTabContentProps {
  tabType: TabType
}

const PAGE_SIZE = 10
const SIBLING_COUNT = 1

const getDataForTab = (type: TabType) => {
  switch (type) {
    case TabType.ActiveAgents:
      return ACTIVE_AGENTS_DATA
    case TabType.TopAttackers:
      return TOP_ATTACKERS_DATA
    case TabType.AgentRanking:
      return AGENTS_RANKING_DATA
    default:
      return []
  }
}

export const AgentTabs = ({ tabType }: AgentTabContentProps) => {
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const data = getDataForTab(tabType)
  const totalCount = data.length
  const paginationRange = usePagination({
    currentPage,
    totalCount,
    pageSize: PAGE_SIZE,
    siblingCount: SIBLING_COUNT,
  })

  const handleAgentClick = (agentName: string) => {
    router.push(`/agents/${encodeURIComponent(agentName)}`)
  }

  const onPageChange = (page: number) => {
    setCurrentPage(page)
  }

  const onNext = () => {
    onPageChange(currentPage + 1)
  }

  const onPrevious = () => {
    onPageChange(currentPage - 1)
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const currentAgents = data.slice(startIndex, endIndex)
  const lastPage = Math.ceil(totalCount / PAGE_SIZE)

  if (!paginationRange || paginationRange.length < 2) {
    return null
  }

  return (
    <>
      {true ? (
        <LeaderboardSkeleton />
      ) : (
      <div className="text-xs flex flex-col gap-1 whitespace-nowrap overflow-x-auto">
        <div className="grid grid-cols-12 bg-[#2E40494D] backdrop-blur-xl min-w-[680px] min-h-10 p-3 rounded-lg mb-2">
          <div className="col-span-5 md:col-span-3 grid grid-cols-12 items-center">
            <p className="pr-1 col-span-2 lg:col-span-1">Rank</p>
            <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
            <p className="col-span-2">Agent name</p>
          </div>
          <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Break attempts</div>
          <div className="col-span-3 border-l border-l-[#6F6F6F] ps-4">Message price</div>
          <div className="col-span-2 border-l border-l-[#6F6F6F] ps-4">Prize pool</div>
        </div>

        {currentAgents.map((agent) => (
          <div
            className="grid grid-cols-12 bg-[#2E40494D] backdrop-blur-xl min-w-[680px] min-h-11 p-3 rounded-lg hover:bg-[#2E40497D] cursor-pointer"
            key={agent.id}
            onClick={() => handleAgentClick(agent.name)}
          >
            <div className="col-span-5 md:col-span-3 grid grid-cols-12 items-center">
              <p className="pr-1 col-span-2 lg:col-span-1">{agent.rank}</p>
              <div className="h-full w-[1px] bg-[#6F6F6F]"></div>
              <div className="col-span-2 flex gap-1 items-center">
                <div className="mr-4">{agent.name}</div>
                {agent.isActive && (
                  <>
                    <div className="w-2 h-2 bg-[#00D369] rounded-full flex-shrink-0"></div>
                    <div>Active</div>
                  </>
                )}
              </div>
            </div>
            <div className="col-span-2 ps-4">{agent.breakAttempts}</div>
            <div className="col-span-3 ps-4">${agent.MessagePrice}</div>
            <div className="col-span-2 ps-4">${agent.prizePool}</div>
          </div>
        ))}
      </div>
    )}

      <div className="flex gap-1 mx-auto text-[#B8B8B8] text-xs w-fit mt-6 items-center">
        <button
          onClick={onPrevious}
          className={`hover:text-white ${
            currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
          disabled={currentPage === 1}
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
              onClick={() => onPageChange(+pageNumber)}
              key={index}
              className={`${pageNumber === currentPage ? 'text-white' : 'text-[#B8B8B8]'} p-2`}
            >
              {pageNumber}
            </button>
          )
        })}
        <button
          onClick={onNext}
          className={`hover:text-white ${
            currentPage === lastPage ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
          disabled={currentPage === lastPage}
        >
          <ChevronRight />
        </button>
      </div>
    </>
  )
}
