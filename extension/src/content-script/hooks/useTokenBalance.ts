import { useBalance } from "@starknet-react/core";
import { constants } from 'starknet';

const USDC_ADDRESSES = {
  [constants.StarknetChainId.SN_MAIN]: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
  [constants.StarknetChainId.SN_SEPOLIA]: '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080',
} as const;

export function useTokenBalance(address: `0x${string}` | undefined, chainId: string | undefined) {
  const { data: mainnetBalance } = useBalance({
    address,
    token: USDC_ADDRESSES[constants.StarknetChainId.SN_MAIN],
    watch: true,
  });

  const { data: sepoliaBalance } = useBalance({
    address,
    token: USDC_ADDRESSES[constants.StarknetChainId.SN_SEPOLIA],
    watch: true,
  });

  const currentBalance = chainId === constants.StarknetChainId.SN_MAIN 
    ? mainnetBalance?.formatted 
    : sepoliaBalance?.formatted;

  return {
    balance: currentBalance || '0',
    symbol: mainnetBalance?.symbol || 'USDC',
    loading: !mainnetBalance && !sepoliaBalance
  };
} 