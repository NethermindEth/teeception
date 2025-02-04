import { Contract, RpcProvider } from 'starknet'
import { TEECEPTION_ERC20_ABI } from '@/abis/TEECEPTION_ERC20_ABI'
import { useAccount } from '@starknet-react/core'
import { useEffect, useState } from 'react'
import { ACTIVE_NETWORK } from '../config/starknet'

interface TokenBalance {
  balance: bigint
  formatted: string
}

export function useTokenBalance(tokenSymbol: string) {
  const { account } = useAccount()
  const [balance, setBalance] = useState<TokenBalance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBalance = async () => {
      if (!account || !tokenSymbol) return

      setIsLoading(true)
      setError(null)

      try {
        const token = ACTIVE_NETWORK.tokens[tokenSymbol]
        if (!token) {
          throw new Error('Token not found')
        }

        const provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc })
        const contract = new Contract(TEECEPTION_ERC20_ABI, token.address, provider)
        
        const rawBalance = await contract.balanceOf(account.address)
        const balanceValue = BigInt(rawBalance.toString())
        
        setBalance({
          balance: balanceValue,
          formatted: (Number(balanceValue) / Math.pow(10, token.decimals)).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6
          })
        })
      } catch (err) {
        console.error('Error fetching token balance:', err)
        setError('Failed to fetch balance')
      } finally {
        setIsLoading(false)
      }
    }

    fetchBalance()
  }, [account, tokenSymbol])

  return {
    balance,
    isLoading,
    error
  }
} 