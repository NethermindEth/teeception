import { useEffect, useState, useCallback, useRef } from 'react'
import { Contract, RpcProvider } from 'starknet'
import { AGENT_REGISTRY_COPY_ABI } from '@/abis/AGENT_REGISTRY'
import { AGENT_ABI } from '@/abis/AGENT_ABI'
import { ERC20_ABI } from '@/abis/ERC20_ABI'
import { debug } from '@/lib/debug'
import { AGENT_REGISTRY_ADDRESS, RPC_NODE_URL } from '@/constants'

export interface AgentDetails {
  address: string
  name: string
  systemPrompt: string
  promptPrice: string
  prizePool: string
  isFinalized: boolean
  promptCount: number
}

export interface UseAgentsProps {
  start?: number
  end?: number
  pageSize?: number
}

export interface UseAgentsState {
  agents: AgentDetails[]
  loading: boolean
  error: string | null
  totalAgents: number
  hasMore: boolean
}

const createProvider = () => new RpcProvider({ nodeUrl: RPC_NODE_URL })

const formatAddress = (address: string) => `0x${BigInt(address).toString(16)}`

const DEFAULT_PAGE_SIZE = 10

export const useAgents = ({
  start = 0,
  end,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseAgentsProps = {}) => {
  const [state, setState] = useState<UseAgentsState>({
    agents: [],
    loading: true,
    error: null,
    totalAgents: 0,
    hasMore: true,
  })

  const providerRef = useRef<RpcProvider>(null)
  const registryRef = useRef<Contract>(null)

  // Initialize provider and registry contract
  useEffect(() => {
    providerRef.current = createProvider()
    registryRef.current = new Contract(
      AGENT_REGISTRY_COPY_ABI,
      AGENT_REGISTRY_ADDRESS,
      providerRef.current
    )
  }, [])

  const fetchAgentDetails = useCallback(
    async (address: string, provider: RpcProvider): Promise<AgentDetails> => {
      try {
        const agent = new Contract(AGENT_ABI, address, provider)

        const [nameResult, systemPromptResult, promptPrice, prizePool, isFinalized, promptCount] =
          await Promise.all(
            [
              agent.get_name(),
              agent.get_system_prompt(),
              agent.get_prompt_price(),
              agent.get_prize_pool(),
              agent.is_finalized(),
              agent.get_prompt_count(),
            ].map((promise) =>
              promise.catch((e: unknown) => {
                debug.error('useAgents', 'Error fetching agent data', { address, error: e })
                return null
              })
            )
          )

        return {
          address,
          name: nameResult?.toString() || '',
          systemPrompt: systemPromptResult?.toString() || 'NA',
          promptPrice: promptPrice?.toString() || '0',
          promptCount: promptCount?.toString() || '0',
          prizePool: prizePool?.toString() || '0',
          isFinalized: Boolean(isFinalized),
        }
      } catch (err) {
        debug.error('useAgents', 'Error processing agent', { address, error: err })
        throw err
      }
    },
    []
  )

  const fetchAgents = useCallback(async () => {
    if (!providerRef.current || !registryRef.current) return

    setState((prev) => ({ ...prev, loading: true }))

    try {
      const effectiveEnd = end || start + pageSize

      // Fetch total agents count
      const totalAgents = await registryRef.current.get_agents_count()

      console.log('Total agents', totalAgents)

      // Fetch agent addresses for the current page
      const rawAgentAddresses = await registryRef.current.get_agents(start, effectiveEnd)
      const agentAddresses = rawAgentAddresses.map(formatAddress)

      // Fetch details for each agent
      const agentDetails = await Promise.allSettled(
        agentAddresses.map((address: string) => fetchAgentDetails(address, providerRef.current!))
      )

      const validAgents = agentDetails
        .filter(
          (result): result is PromiseFulfilledResult<AgentDetails> => result.status === 'fulfilled'
        )
        .map((result) => result.value)

      setState((prev) => ({
        ...prev,
        agents: validAgents,
        loading: false,
        error: null,
        totalAgents: Number(totalAgents),
        hasMore: effectiveEnd < Number(totalAgents),
      }))
    } catch (err) {
      debug.error('useAgents', 'Error in fetchAgents', err)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch agents',
      }))
    }
  }, [start, end, pageSize, fetchAgentDetails])

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
