import { useEffect, useState, useCallback } from 'react'
import { debug } from '@/lib/debug'
import { ACTIVE_NETWORK, DEFAULT_TOKEN_DECIMALS, INDEXER_BASE_URL } from '@/constants'

export interface AgentDetails {
  address: string
  name: string
  balance: string
  promptPrice: string
  systemPrompt: string
  breakAttempts: number
  endTime: string
  tokenAddress: string
  symbol: string
  decimal: number
  pending: boolean
  latestPrompts: Array<{
    prompt: string
    isSuccess: boolean
    drainedTo: string
  }>
  isFinalized: boolean
}

export interface UseAgentsProps {
  pageSize?: number
  page?: number
}

export interface UseAgentsState {
  agents: AgentDetails[]
  loading: boolean
  error: string | null
  totalAgents: number
  hasMore: boolean
  currentPage: number
}

interface IndexerAgentResponse {
  agents: Array<{
    pending: boolean
    address: string
    token: string
    name: string
    balance: string
    end_time: string
    prompt_price: string
    break_attempts: string
    system_prompt: string
    latest_prompts: Array<{
      prompt: string
      is_success: boolean
      drained_to: string
    }>
    is_finalized: boolean
  }>
  total: number
  page: number
  page_size: number
  last_block: number
}

const DEFAULT_PAGE_SIZE = 10

export const useAgents = ({ page = 0, pageSize = DEFAULT_PAGE_SIZE }: UseAgentsProps = {}) => {
  const [state, setState] = useState<UseAgentsState>({
    agents: [],
    loading: true,
    error: null,
    totalAgents: 0,
    hasMore: true,
    currentPage: page,
  })

  const fetchAgents = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    console.log('url', `${INDEXER_BASE_URL}/leaderboard?page=${page}&pageSize=${pageSize}`)
    try {
      const response = await fetch(`/api/leaderboard?page=${page}&pageSize=${pageSize}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`)
      }

      const data: IndexerAgentResponse = await response.json()
      console.log('Indexer data', data)

      const formattedAgents: AgentDetails[] = data.agents.map((agent) => {
        const token = ACTIVE_NETWORK.tokens.find(({ address }) => address === agent.token)

        return {
          address: agent.address,
          name: agent.name,
          balance: agent.balance,
          systemPrompt: agent.system_prompt,
          promptPrice: agent.prompt_price,
          breakAttempts: parseInt(agent.break_attempts),
          endTime: agent.end_time,
          tokenAddress: agent.token,
          symbol: token?.symbol || '',
          decimal: token?.decimals || DEFAULT_TOKEN_DECIMALS,
          pending: agent.pending,
          latestPrompts: agent.latest_prompts.map((prompt) => ({
            prompt: prompt.prompt,
            isSuccess: prompt.is_success,
            drainedTo: prompt.drained_to,
          })),
          isFinalized: agent.is_finalized,
        }
      })

      setState((prev) => ({
        ...prev,
        agents: formattedAgents,
        loading: false,
        error: null,
        totalAgents: data.total,
        hasMore: (page + 1) * pageSize < data.total,
        currentPage: data.page,
      }))
    } catch (err) {
      debug.error('useAgents', 'Error in fetchAgents', err)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch agents',
      }))
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const refetch = useCallback(() => {
    fetchAgents()
  }, [fetchAgents])

  return {
    ...state,
    refetch,
  }
}
