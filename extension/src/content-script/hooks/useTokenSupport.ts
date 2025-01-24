import { Contract, RpcProvider } from 'starknet'
import { AGENT_REGISTRY_COPY_ABI } from '../../abis/AGENT_REGISTRY'
import { useAgentRegistry } from './useAgentRegistry'
import { useEffect, useState } from 'react'
import { ACTIVE_NETWORK } from '../config/starknet'

interface TokenSupportInfo {
  isSupported: boolean
  minPromptPrice?: bigint
}

export function useTokenSupport() {
  const { address: registryAddress } = useAgentRegistry()
  const [supportedTokens, setSupportedTokens] = useState<Record<string, TokenSupportInfo>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkTokenSupport = async () => {
      if (!registryAddress) return

      setIsLoading(true)
      setError(null)

      try {
        const provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc })
        const registry = new Contract(AGENT_REGISTRY_COPY_ABI, registryAddress, provider)
        
        const results: Record<string, TokenSupportInfo> = {}
        
        // Check each token in parallel
        const checks = Object.entries(ACTIVE_NETWORK.tokens).map(async ([symbol, token]) => {
          const isSupported = await registry.is_token_supported(token.address)
          let minPromptPrice: bigint | undefined

          if (isSupported) {
            const price = await registry.get_min_prompt_price(token.address)
            minPromptPrice = BigInt(price.toString())
          }

          results[symbol] = {
            isSupported,
            minPromptPrice
          }
        })

        await Promise.all(checks)
        setSupportedTokens(results)
      } catch (err) {
        console.error('Error checking token support:', err)
        setError('Failed to fetch supported tokens')
      } finally {
        setIsLoading(false)
      }
    }

    checkTokenSupport()
  }, [registryAddress])

  return {
    supportedTokens,
    isLoading,
    error
  }
} 