import { useEffect, useState, useCallback } from 'react'
import { debug } from '@/lib/debug'
import { ACTIVE_NETWORK, DEFAULT_TOKEN_DECIMALS } from '@/constants'
import { AgentFromIndexer } from './useAgent'

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
  drainAmount: string
  isDrained: boolean
  isWithdrawn: boolean
}

export interface UseAgentsProps {
  pageSize: number
  page: number
  active: boolean | null
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
  agents: Array<AgentFromIndexer>
  total: number
  page: number
  page_size: number
  last_block: number
}

const DEFAULT_PAGE_SIZE = 10

export const useAgents = ({page, pageSize, active}: UseAgentsProps = { page: 0, pageSize: DEFAULT_PAGE_SIZE, active: null }) => {
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
    try {
      const response = await fetch(`/api/leaderboard?page=${page}&page_size=${pageSize}${active !== null ? `&active=${active}` : ''}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`)
      }

      const data: IndexerAgentResponse = await response.json()

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
          isDrained: agent.is_drained,
          isWithdrawn: agent.is_withdrawn,
          drainAmount: agent.drain_amount,
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
