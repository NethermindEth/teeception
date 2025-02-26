import { useState, useEffect } from 'react'
import { ACTIVE_NETWORK } from '@/constants'
import { formatBalance } from '@/lib/utils'

interface RawUsageResponse {
  registered_agents: number
  attempts: {
    total: number
    successes: number
  }
  prize_pools: {
    [key: string]: string
  }
}

interface FormattedPrizePool {
  token: {
    address: string
    symbol: string
  }
  amount: string
  rawAmount: string
}

export interface FormattedUsageStats {
  registeredAgents: number
  attempts: {
    total: number
    successes: number
  }
  prizePools: FormattedPrizePool[]
  totalBounty: string
}

export const useUsageStats = () => {
  const [data, setData] = useState<FormattedUsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchUsageStats = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/usage`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const rawData: RawUsageResponse = await response.json()

        const formattedPrizePools = Object.entries(rawData.prize_pools)
          .map(([address, amount]) => {
            const token = ACTIVE_NETWORK.tokens.find(
              (t) => t.address.toLowerCase() === address.toLowerCase()
            )

            if (!token) {
              console.warn(`Token not found for address: ${address}`)
              return null
            }
            return {
              token: {
                address: token.address,
                symbol: token.symbol,
              },
              amount: formatBalance(BigInt(amount), token.decimals),
              rawAmount: amount,
            }
          })
          .filter((pool): pool is FormattedPrizePool => pool !== null)

        const baseToken = ACTIVE_NETWORK.tokens[0]
        let totalValueInBaseToken = BigInt(0)

        formattedPrizePools.forEach((pool) => {
          totalValueInBaseToken += BigInt(pool.rawAmount)
        })

        setData({
          registeredAgents: rawData.registered_agents,
          attempts: {
            total: rawData.attempts.total,
            successes: rawData.attempts.successes,
          },
          prizePools: formattedPrizePools,
          totalBounty: formatBalance(totalValueInBaseToken, baseToken.decimals),
        })
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('An error occurred while fetching usage stats')
        )
      } finally {
        setLoading(false)
      }
    }

    fetchUsageStats()
  }, [])

  return {
    data,
    loading,
    error,
    refetch: () => {
      setLoading(true)
      setError(null)
      setData(null)
    },
  }
}
