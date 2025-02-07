import { useState, useEffect } from 'react'

export interface AgentDetails {
  address: string
  name: string
  balance: string
  endTime: string
  feePerMessage: string
  systemPrompt: string
  status: 'undefeated' | 'defeated'
  ownerAddress: string
  winnerAddress?: string
  claimedReward?: string
}

interface UseAgentsOptions {
  page: number
  pageSize: number
}

export function useAgents({ page, pageSize }: UseAgentsOptions) {
  const [agents, setAgents] = useState<AgentDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true)
        // TODO: Replace with actual API call
        const mockAgents: AgentDetails[] = [
          {
            address: '0x123',
            name: 'Agent Smith',
            balance: '1000',
            endTime: (Date.now() + 86400000 * 30).toString(), // 30 days from now
            feePerMessage: '10',
            systemPrompt: 'I am a secure agent that cannot be hacked.',
            status: 'undefeated',
            ownerAddress: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
          },
          {
            address: '0x456',
            name: 'Agent Jones',
            balance: '2000',
            endTime: (Date.now() + 86400000 * 15).toString(), // 15 days from now
            feePerMessage: '20',
            systemPrompt: 'Try to hack me if you can!',
            status: 'defeated',
            ownerAddress: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
            winnerAddress: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
          }
        ]
        setAgents(mockAgents)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch agents'))
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
  }, [page, pageSize])

  return { agents, loading, error }
}
