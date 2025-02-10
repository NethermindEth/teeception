import { useEffect, useState, useCallback } from 'react'
import { debug } from '@/lib/debug'
import { ACTIVE_NETWORK, DEFAULT_TOKEN_DECIMALS } from '@/constants'

export interface AgentPrompt {
  prompt: string
  is_success: boolean
  drained_to: string
}

export interface SingleAgentDetails {
  address: string
  name: string
  balance: string
  promptPrice: string
  breakAttempts: number
  endTime: string
  tokenAddress: string
  symbol: string
  decimal: number
  pending: boolean
  latestPrompts: AgentPrompt[]
  systemPrompt: string
}

export type AgentFromIndexer = {
  pending: boolean
  address: string
  creator: string
  token: string
  name: string
  system_prompt: string
  balance: string
  end_time: string
  is_drained: boolean
  is_finalized: boolean
  prompt_price: string
  break_attempts: string
  latest_prompts: Array<{
    prompt: string
    is_success: boolean
    drained_to: string
  }>
}
interface AgentSearchResponse {
  agents: Array<AgentFromIndexer>
  total: number
  page: number
  page_size: number
  last_block: number
}

export interface UseAgentState {
  agent: SingleAgentDetails | null
  loading: boolean
  error: string | null
}

export const useAgent = (agentName: string) => {
  const [state, setState] = useState<UseAgentState>({
    agent: null,
    loading: true,
    error: null,
  })

  const fetchAgent = useCallback(async () => {
    if (!agentName) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Agent name is required',
      }))
      return
    }

    setState((prev) => ({ ...prev, loading: true }))

    try {
      const encodedName = encodeURIComponent(agentName)
      const response = await fetch(`/api/agent?name=${encodedName}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch agent: ${response.statusText}`)
      }

      const data: AgentSearchResponse = await response.json()

      // Find the agent with matching name
      const matchingAgent = data.agents.find((agent) => agent.name === agentName)

      if (!matchingAgent) {
        throw new Error('Agent not found')
      }

      const token = ACTIVE_NETWORK.tokens.find(({ address }) => address === matchingAgent.token)

      const formattedAgent: SingleAgentDetails = {
        address: matchingAgent.address,
        name: matchingAgent.name,
        balance: matchingAgent.balance,
        promptPrice: matchingAgent.prompt_price,
        breakAttempts: parseInt(matchingAgent.break_attempts),
        endTime: matchingAgent.end_time,
        tokenAddress: matchingAgent.token,
        symbol: token?.symbol || '',
        decimal: token?.decimals || DEFAULT_TOKEN_DECIMALS,
        pending: matchingAgent.pending,
        latestPrompts: matchingAgent.latest_prompts.map((prompt) => ({
          prompt: prompt.prompt,
          is_success: prompt.is_success,
          drained_to: prompt.drained_to,
        })),
        systemPrompt: matchingAgent.system_prompt,
      }

      setState({
        agent: formattedAgent,
        loading: false,
        error: null,
      })
    } catch (err) {
      debug.error('useAgent', 'Error in fetchAgent', err)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch agent details',
      }))
    }
  }, [agentName])

  useEffect(() => {
    fetchAgent()
  }, [fetchAgent])

  const refetch = useCallback(() => {
    fetchAgent()
  }, [fetchAgent])

  return {
    ...state,
    refetch,
  }
}
