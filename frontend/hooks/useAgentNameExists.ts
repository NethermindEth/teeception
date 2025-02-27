import { Contract, RpcProvider } from 'starknet'
import { TEECEPTION_AGENTREGISTRY_ABI } from '@/abis/TEECEPTION_AGENTREGISTRY_ABI'
import { useEffect, useState, useCallback } from 'react'
import { ACTIVE_NETWORK } from '@/constants'
import { debug } from '@/lib/debug'
import { useDebouncedCallback } from 'use-debounce'

export function useAgentNameExists(agentName: string, debounceMs = 500) {
  const [exists, setExists] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isDebouncing, setIsDebouncing] = useState<boolean>(false)
  const [lastAgentName, setLastAgentName] = useState<string>('')
  
  // Debounced function to check if agent name exists
  const debouncedCheckAgentName = useDebouncedCallback(
    async (name: string) => {
      if (!name.trim()) {
        setExists(false)
        setIsLoading(false)
        setIsDebouncing(false)
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
        const agentAddress = await registry.get_agent_by_name(name)
        
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
        setIsDebouncing(false)
      }
    },
    debounceMs
  )

  // Wrapper function to handle immediate state updates
  const checkAgentName = useCallback((name: string) => {
    setLastAgentName(name)
    setIsDebouncing(name !== lastAgentName)
    debouncedCheckAgentName(name)
  }, [debouncedCheckAgentName, lastAgentName])

  // Trigger the check when the agent name changes
  useEffect(() => {
    checkAgentName(agentName)
  }, [agentName, checkAgentName])

  return {
    exists,
    isLoading,
    isDebouncing,
    error
  }
} 