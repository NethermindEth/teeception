import { TEECEPTION_ERC20_ABI } from '@/abis/TEECEPTION_ERC20_ABI'
import { useAccount, useContract, useBalance } from '@starknet-react/core'
import { ACTIVE_NETWORK } from '../config/starknet'

interface TokenBalance {
  balance: bigint
  formatted: string
}

export function useTokenBalance(tokenSymbol: string) {
  const { address } = useAccount()
  const token = ACTIVE_NETWORK.tokens[tokenSymbol]

  const { data: balance, isLoading, error } = useBalance({
    address: address as `0x${string}`,
    token: token?.address as `0x${string}`,
    watch: true,
  })

  if (!token) {
    return {
      balance: null,
      isLoading: false,
      error: 'Token not found'
    }
  }

  if (isLoading || !balance) {
    return {
      balance: null,
      isLoading: true,
      error: null
    }
  }

  if (error) {
    return {
      balance: null,
      isLoading: false,
      error: 'Failed to fetch balance'
    }
  }

  return {
    balance: {
      balance: balance.value,
      formatted: balance.formatted
    },
    isLoading: false,
    error: null
  }
} 