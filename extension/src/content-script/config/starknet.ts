import { constants } from 'starknet';
import { sepolia, mainnet } from "@starknet-react/chains";

export const STARKNET_CONFIG = {
  sepolia: {
    chain: sepolia,
    chainId: constants.StarknetChainId.SN_SEPOLIA,
    name: 'Sepolia',
    usdc: '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080',
    strk: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
    explorer: 'https://sepolia.starkscan.co',
    rpc: 'https://starknet-sepolia.public.blastapi.io',
    starkgate: 'https://sepolia.starkgate.starknet.io',
    agentRegistryAddress: undefined, // Default address for Sepolia
  },
  mainnet: {
    chain: mainnet,
    chainId: constants.StarknetChainId.SN_MAIN,
    name: 'Mainnet',
    usdc: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
    strk: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
    explorer: 'https://starkscan.co',
    rpc: 'https://starknet-mainnet.public.blastapi.io',
    starkgate: 'https://starkgate.starknet.io',
    agentRegistryAddress: undefined, // Default address for Mainnet
  }
} as const;

export const ACTIVE_NETWORK = STARKNET_CONFIG.sepolia;
