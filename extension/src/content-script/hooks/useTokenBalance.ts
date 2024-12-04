import { useBalance } from "@starknet-react/core";
import { ACTIVE_NETWORK } from '../config/starknet';

export function useTokenBalance(address: `0x${string}` | undefined) {
  const { data: balance } = useBalance({
    address,
    token: ACTIVE_NETWORK.strk,
    watch: true,
  });

  return {
    balance: balance?.formatted || '0',
    symbol: balance?.symbol || 'STRK',
    loading: !balance
  };
} 