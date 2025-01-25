import { Contract, RpcProvider } from 'starknet'
import { AGENT_REGISTRY_COPY_ABI } from '../../abis/AGENT_REGISTRY'
import { useAgentRegistry } from './useAgentRegistry'
import { useEffect, useState } from 'react'
import { ACTIVE_NETWORK } from '../config/starknet'
import { debug } from '../utils/debug'

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
      if (!registryAddress) {
        debug.log('useTokenSupport', 'No registry address available')
        setIsLoading(false)
        return
      }

      debug.log('useTokenSupport', 'Starting token support check', { 
        registryAddress,
        rpc: ACTIVE_NETWORK.rpc
      })
      
      setIsLoading(true)
      setError(null)

      try {
        const provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc })
        debug.log('useTokenSupport', 'Created RPC provider')

        const registry = new Contract(AGENT_REGISTRY_COPY_ABI, registryAddress, provider)
        debug.log('useTokenSupport', 'Created registry contract instance')

        // Verify contract connection
        try {
          const testCall = await registry.is_token_supported(ACTIVE_NETWORK.tokens.STRK.address)
          debug.log('useTokenSupport', 'Test contract call successful', { testCall })
        } catch (err) {
          debug.error('useTokenSupport', 'Test contract call failed', err)
          throw new Error('Failed to connect to registry contract')
        }
        
        const results: Record<string, TokenSupportInfo> = {}
        
        debug.log('useTokenSupport', 'Checking tokens', { 
          tokens: Object.keys(ACTIVE_NETWORK.tokens)
        })

        // Check each token in parallel
        const checks = Object.entries(ACTIVE_NETWORK.tokens).map(async ([symbol, token]) => {
          debug.log('useTokenSupport', 'Checking token', { 
            symbol, 
            address: token.address,
            decimals: token.decimals
          })
          
          try {
            const isSupported = await registry.is_token_supported(token.address)
            let minPromptPrice: bigint | undefined

            debug.log('useTokenSupport', 'Token support result', { 
              symbol, 
              isSupported,
              address: token.address
            })

            if (isSupported) {
              try {
                const price = await registry.get_min_prompt_price(token.address)
                minPromptPrice = BigInt(price.toString())
                debug.log('useTokenSupport', 'Got min prompt price', { 
                  symbol, 
                  minPromptPrice: minPromptPrice.toString() 
                })
              } catch (priceErr) {
                debug.error('useTokenSupport', 'Error getting min price', { 
                  symbol, 
                  error: priceErr 
                })
              }
            }

            results[symbol] = {
              isSupported,
              minPromptPrice
            }
          } catch (err) {
            debug.error('useTokenSupport', 'Error checking token', { 
              symbol, 
              address: token.address,
              error: err 
            })
            results[symbol] = {
              isSupported: false
            }
          }
        })

        await Promise.all(checks)
        debug.log('useTokenSupport', 'Final results', results)
        setSupportedTokens(results)
      } catch (err) {
        debug.error('useTokenSupport', 'Error checking token support:', err)
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