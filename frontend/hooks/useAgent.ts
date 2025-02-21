import { useEffect, useState, useCallback } from 'react'
import { debug } from '@/lib/debug'
import { ACTIVE_NETWORK, DEFAULT_TOKEN_DECIMALS } from '@/constants'

export type Prompt = {
  prompt: string
  user: string
  is_success: boolean
  drained_to: string
  prompt_id: string
  tweet_id: string
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
  latestPrompts: Prompt[]
  systemPrompt: string
  creator: string
  drainAmount: string
  isDrained: boolean
  isWithdrawn: boolean
  isFinalized: boolean
  drainPrompt: Prompt | null
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
  is_withdrawn: boolean
  is_finalized: boolean
  prompt_price: string
  break_attempts: string
  latest_prompts: Array<Prompt>
  drain_amount: string
  drain_prompt: Prompt | null
}
// interface AgentSearchResponse {
//   agents: Array<AgentFromIndexer>
//   total: number
//   page: number
//   page_size: number
//   last_block: number
// }

export interface UseAgentState {
  agent: SingleAgentDetails | null
  loading: boolean
  error: string | null
}

export const useAgent = ({ fetchBy, value }: { fetchBy: 'name' | 'address'; value: string }) => {
  const [state, setState] = useState<UseAgentState>({
    agent: null,
    loading: true,
    error: null,
  })

  const fetchAgent = useCallback(async () => {
    if (!value) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Agent name or address is required',
      }))
      return
    }

    setState((prev) => ({ ...prev, loading: true }))
    let response: Response | null = null

    const retryInterval = 3000 // 2 second interval between retries
    const maxRetries = 5
    let retryCount = 0
    
    while (retryCount < maxRetries) {
      try {
        if (fetchBy === 'name') {
          const encodedName = encodeURIComponent(value)
          response = await fetch(`/api/agent?name=${encodedName}`)
        } else {
          response = await fetch(`/api/agent?address=${value}`)
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch agent: ${response.statusText}`)
        }

        const data = await response.json()

        const matchingAgent: AgentFromIndexer | undefined =
          fetchBy === 'name'
            ? data.agents.find((agent: AgentFromIndexer) => agent.name === value)
            : data

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
          latestPrompts: matchingAgent.latest_prompts,
          systemPrompt: matchingAgent.system_prompt,
          creator: matchingAgent.creator,
          isDrained: matchingAgent.is_drained,
          isWithdrawn: matchingAgent.is_withdrawn,
          drainAmount: matchingAgent.drain_amount,
          isFinalized: matchingAgent.is_finalized,
          drainPrompt: matchingAgent.drain_prompt,
        }

        setState({
          agent: formattedAgent,
          loading: false,
          error: null,
        })
        return // Success - exit retry loop
      } catch (err) {
        retryCount++
        if (retryCount >= maxRetries) {
          debug.error('useAgent', `Error in fetchAgent after ${retryCount} retries`, err)
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to fetch agent details',
          }))
          return
        }
        await new Promise(resolve => setTimeout(resolve, retryInterval))
      }
    }
  }, [fetchBy, value])

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
