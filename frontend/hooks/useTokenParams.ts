import { Contract, RpcProvider } from 'starknet'
import { TEECEPTION_AGENTREGISTRY_ABI } from '@/abis/TEECEPTION_AGENTREGISTRY_ABI'
import { useEffect, useState } from 'react'
import { ACTIVE_NETWORK } from '@/constants'
import { debug } from '@/lib/debug'

interface TokenParams {
  minPromptPrice?: bigint
  minInitialBalance?: bigint
}

export function useTokenParams(tokenAddress: string) {
  const [params, setParams] = useState<TokenParams>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTokenParams = async () => {
      if (!tokenAddress) {
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

        // Verify token is supported first
        const isSupported = await registry.is_token_supported(tokenAddress)
        if (!isSupported) {
          throw new Error('Token is not supported')
        }

        // Fetch token params
        const tokenParams = await registry.get_token_params(tokenAddress)
        setParams({
          minPromptPrice: BigInt(tokenParams.min_prompt_price.toString()),
          minInitialBalance: BigInt(tokenParams.min_initial_balance.toString())
        })
      } catch (err) {
        debug.error('useTokenParams', 'Error fetching token params:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch token params')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTokenParams()
  }, [tokenAddress])

  return {
    params,
    isLoading,
    error
  }
}
