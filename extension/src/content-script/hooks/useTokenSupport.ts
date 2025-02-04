import { Contract, RpcProvider } from 'starknet'
import { TEECEPTION_AGENTREGISTRY_ABI } from '@/abis/TEECEPTION_AGENTREGISTRY_ABI'
import { useAgentRegistry } from './useAgentRegistry'
import { useEffect, useState } from 'react'
import { ACTIVE_NETWORK } from '../config/starknet'
import { debug } from '../utils/debug'

interface TokenSupportInfo {
  isSupported: boolean
  minPromptPrice?: bigint
  minInitialBalance?: bigint
}

export function useTokenSupport() {
  const { address: registryAddress } = useAgentRegistry()
  const [supportedTokens, setSupportedTokens] = useState<Record<string, TokenSupportInfo>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkTokenSupport = async () => {
      if (!registryAddress) {
        setIsLoading(false)
        return
      }
      
      setIsLoading(true)
      setError(null)

      try {
        const provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc })

        const registry = new Contract(TEECEPTION_AGENTREGISTRY_ABI, registryAddress, provider)

        // Verify contract connection
        try {
          await registry.is_token_supported(ACTIVE_NETWORK.tokens.STRK.address)
          // Test token params call
          const testParams = await registry.get_token_params(ACTIVE_NETWORK.tokens.STRK.address)
          debug.log('useTokenSupport', 'Test token params call result:', {
            token: 'STRK',
            params: testParams,
            raw_min_prompt_price: testParams.min_prompt_price.toString(),
            raw_min_initial_balance: testParams.min_initial_balance.toString()
          })
        } catch (err) {
          debug.error('useTokenSupport', 'Test contract call failed', err)
          throw new Error('Failed to connect to registry contract')
        }
        
        const results: Record<string, TokenSupportInfo> = {}
        
        // Check each token in parallel
        const checks = Object.entries(ACTIVE_NETWORK.tokens).map(async ([symbol, token]) => {
          try {
            const isSupported = await registry.is_token_supported(token.address)
            let minPromptPrice: bigint | undefined
            let minInitialBalance: bigint | undefined

            if (isSupported) {
              try {
                const params = await registry.get_token_params(token.address)
                debug.log('useTokenSupport', 'Token params raw', { 
                  symbol,
                  params,
                  min_prompt_price_raw: params.min_prompt_price.toString(),
                  min_initial_balance_raw: params.min_initial_balance.toString()
                })
                
                minPromptPrice = BigInt(params.min_prompt_price.toString())
                minInitialBalance = BigInt(params.min_initial_balance.toString())
                
                debug.log('useTokenSupport', 'Token params processed', { 
                  symbol,
                  minPromptPrice: minPromptPrice.toString(),
                  minInitialBalance: minInitialBalance.toString(),
                  displayValue: Number(minInitialBalance) / Math.pow(10, ACTIVE_NETWORK.tokens[symbol].decimals)
                })
              } catch (priceErr) {
                debug.error('useTokenSupport', 'Error getting token params', { 
                  symbol, 
                  error: priceErr 
                })
              }
            }

            results[symbol] = {
              isSupported,
              minPromptPrice,
              minInitialBalance
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