import { constants } from 'starknet'
import { mainnet, sepolia } from '@starknet-react/chains'
export const DEFAULT_RPC_URL = 'https://api.cartridge.gg/x/starknet/sepolia'
export const RPC_NODE_URL = process.env.NEXT_PUBLIC_RPC_NODE_URL || DEFAULT_RPC_URL
export const AGENT_REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS ||
  '0x0136e0484d5e9733ff105019318c0e10431ac21bccb582d8584cd285caf080f5'
export const X_BOT_NAME = '@teetestt84759'

export const INDEXER_BASE_URL =
  process.env.NEXT_PUBLIC_INDEXER_BASE_URL || 'http://34.141.53.65:4001'
interface Token {
  address: string
  name: string
  symbol: string
  decimals: number
  image: string
  originalAddress: string
}

export const STARKNET_CONFIG = {
  sepolia: {
    chain: sepolia,
    chainId: constants.StarknetChainId.SN_SEPOLIA,
    name: 'Sepolia',
    explorer: 'https://sepolia.voyager.online',
    rpc: 'https://api.cartridge.gg/x/starknet/sepolia',
    starkgate: 'https://sepolia.starkgate.starknet.io',
    agentRegistryAddress: '0x00f415ab3f224935ed532dfa06485881c526fef8cb31e6e7e95cafc95fdc5e8d',
    tokens: [
      {
        address: '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
        originalAddress: '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
        name: 'Starknet Token',
        symbol: 'STRK',
        decimals: 18,
        image: 'https://assets.starknet.io/strk.svg',
      },
      {
        address: '0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        originalAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
        image: 'https://assets.starknet.io/eth.svg',
      },
    ] as Token[],
  },
  mainnet: {
    chain: mainnet,
    chainId: constants.StarknetChainId.SN_MAIN,
    name: 'Mainnet',
    explorer: 'https://voyager.online',
    rpc: 'https://api.cartridge.gg/x/starknet/mainnet',
    starkgate: 'https://starkgate.starknet.io',
    agentRegistryAddress: undefined,
    tokens: [
      {
        address: '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
        originalAddress: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
        name: 'Starknet Token',
        symbol: 'STRK',
        decimals: 18,
        image: 'https://assets.starknet.io/strk.svg',
      },
      {
        address: '0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
        originalAddress: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        image: 'https://assets.starknet.io/usdc.svg',
      },
    ] as Token[],
  },
} as const

export const ACTIVE_NETWORK = STARKNET_CONFIG.sepolia
export const DEFAULT_TOKEN_DECIMALS = 18
export const STARKGATE_FAUCET_URL = 'https://starkgate.starknet.io/bridge/deposit'
export const SEPOLIA_FAUCET_URL = 'https://starknet-faucet.vercel.app'

export const TEXT_COPIES = {
  leaderboard: {
    heading: 'Leaderboard',
    subheading:
      'Discover agents created over time, active agents and check how both hackers who cracked systems and agent&apos;s creators have earned STRK rewards',
  },
  attack: {
    heading: 'Chose your oponent',
    subheading: 'Trick one of these agents into sending you all their STRK',
  },
}
