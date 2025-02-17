import { useState, useEffect } from 'react'
import { ACTIVE_NETWORK } from '@/constants'
import { formatBigInt } from '@/lib/utils'

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
    successRate: number
  }
  prizePools: FormattedPrizePool[]
  averageBounty: {
    amount: string
    rawAmount: string
  }
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
        console.log('raw data', rawData)

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
              amount: formatBigInt(amount, token.decimals),
              rawAmount: amount,
            }
          })
          .filter((pool): pool is FormattedPrizePool => pool !== null)

        const baseToken = ACTIVE_NETWORK.tokens[0]
        let totalValueInBaseToken = BigInt(0)

        formattedPrizePools.forEach((pool) => {
          if (pool.token.address.toLowerCase() === baseToken.address.toLowerCase()) {
            totalValueInBaseToken += BigInt(pool.rawAmount)
          } else {
            // Here you would implement price conversion logic if needed
            // For now, we'll just add the raw amounts
            totalValueInBaseToken += BigInt(pool.rawAmount)
          }
        })

        // Calculate average bounty
        const averageBountyRaw =
          rawData.registered_agents > 0
            ? totalValueInBaseToken / BigInt(rawData.registered_agents)
            : BigInt(0)

        const successRate =
          rawData.attempts.total > 0
            ? (rawData.attempts.successes / rawData.attempts.total) * 100
            : 0

        setData({
          registeredAgents: rawData.registered_agents,
          attempts: {
            total: rawData.attempts.total,
            successes: rawData.attempts.successes,
            successRate,
          },
          prizePools: formattedPrizePools,
          averageBounty: {
            amount: formatBigInt(averageBountyRaw.toString(), baseToken.decimals),
            rawAmount: averageBountyRaw.toString(),
          },
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
