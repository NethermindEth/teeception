import { Contract, RpcProvider } from 'starknet'
import { TEECEPTION_AGENTREGISTRY_ABI } from '@/abis/TEECEPTION_AGENTREGISTRY_ABI'
import { useEffect, useState } from 'react'
import { ACTIVE_NETWORK } from '@/constants'
import { debug } from '@/lib/debug'
import { useDebounce } from './useDebounce'

export function useAgentNameExists(agentName: string, debounceMs = 500) {
  const [exists, setExists] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isDebouncing, setIsDebouncing] = useState<boolean>(false)
  
  // Debounce the agent name to avoid too many requests
  const debouncedAgentName = useDebounce(agentName, debounceMs)
  
  // Set debouncing state
  useEffect(() => {
    if (agentName !== debouncedAgentName) {
      setIsDebouncing(true)
    } else {
      setIsDebouncing(false)
    }
  }, [agentName, debouncedAgentName])

  // Check if agent name exists
  useEffect(() => {
    const checkAgentName = async () => {
      if (!debouncedAgentName.trim()) {
        setExists(false)
        setIsLoading(false)
        return
      }
      
      setIsLoading(true)
      setError(null)

      try {
        const provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc })
        const registry = new Contract(
          TEECEPTION_AGENTREGISTRY_ABI, 
          ACTIVE_NETWORK.agentRegistryAddress, 
          provider
        )

        // Call get_agent_by_name to check if the agent exists
        const agentAddress = await registry.get_agent_by_name(debouncedAgentName)
        
        // If the address is not zero, the agent name is already taken
        const nameExists = agentAddress !== BigInt(0)
        
        setExists(nameExists)
      } catch (err) {
        debug.error('useAgentNameExists', 'Error checking agent name:', err)
        // Don't set error if it's just a "not found" error
        if (err instanceof Error && !err.message.includes('not found')) {
          setError(err instanceof Error ? err.message : 'Failed to check agent name')
        } else {
          setExists(false)
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkAgentName()
  }, [debouncedAgentName])

  return {
    exists,
    isLoading,
    isDebouncing,
    error
  }
} 