import { useEffect, useState, useCallback } from 'react'
import { debug } from '@/lib/debug'

export interface AttackerDetails {
  address: string
  accruedBalances: { [key: string]: string }
  promptCount: number
  breakCount: number
}

export interface UseAttackersProps {
  pageSize?: number
  page?: number
}

export interface UseAttackersState {
  attackers: AttackerDetails[]
  loading: boolean
  error: string | null
  totalAttackers: number
  hasMore: boolean
  currentPage: number
}

interface IndexerAttackerResponse {
  users: Array<{
    address: string
    accrued_balances: { [key: string]: string }
    prompt_count: number
    break_count: number
  }>
  total: number
  page: number
  page_size: number
  last_block: number
}

const DEFAULT_PAGE_SIZE = 10

export const useAttackers = ({ page = 0, pageSize = DEFAULT_PAGE_SIZE }: UseAttackersProps = {}) => {
  const [state, setState] = useState<UseAttackersState>({
    attackers: [],
    loading: true,
    error: null,
    totalAttackers: 0,
    hasMore: true,
    currentPage: page,
  })

  const fetchAttackers = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    try {
      const response = await fetch(`/api/user/leaderboard?page=${page}&page_size=${pageSize}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch attackers: ${response.statusText}`)
      }

      const data: IndexerAttackerResponse = await response.json()

      const formattedAttackers: AttackerDetails[] = data.users.map((user) => ({
        address: user.address,
        accruedBalances: user.accrued_balances,
        promptCount: user.prompt_count,
        breakCount: user.break_count,
      }))

      setState((prev) => ({
        ...prev,
        attackers: formattedAttackers,
        loading: false,
        error: null,
        totalAttackers: data.total,
        hasMore: (page + 1) * pageSize < data.total,
        currentPage: data.page,
      }))
    } catch (err) {
      debug.error('useAttackers', 'Error in fetchAttackers', err)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch attackers',
      }))
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchAttackers()
  }, [fetchAttackers])

  const refetch = useCallback(() => {
    fetchAttackers()
  }, [fetchAttackers])

  return {
    ...state,
    refetch,
  }
}
