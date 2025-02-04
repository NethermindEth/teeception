import { constants } from 'starknet'
import { sepolia, mainnet } from '@starknet-react/chains'

interface Token {
  address: string
  name: string
  symbol: string
  decimals: number
  image: string
}

export const STARKNET_CONFIG = {
  sepolia: {
    chain: sepolia,
    chainId: constants.StarknetChainId.SN_SEPOLIA,
    name: 'Sepolia',
    explorer: 'https://sepolia.starkscan.co',
    rpc: 'https://api.cartridge.gg/x/starknet/sepolia',
    starkgate: 'https://sepolia.starkgate.starknet.io',
    agentRegistryAddress: '0x03e485dd9b325e3e3020a5724a5d167659e52089124ff461f1cfeac387d2ae59',
    tokens: {
      STRK: {
        address: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
        name: 'Starknet Token',
        symbol: 'STRK',
        decimals: 18,
        image: 'https://assets.starknet.io/strk.svg',
      },
      ETH: {
        address: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
        image: 'https://assets.starknet.io/eth.svg',
      },
    } as Record<string, Token>,
  },
  mainnet: {
    chain: mainnet,
    chainId: constants.StarknetChainId.SN_MAIN,
    name: 'Mainnet',
    explorer: 'https://starkscan.co',
    rpc: 'https://api.cartridge.gg/x/starknet/mainnet',
    starkgate: 'https://starkgate.starknet.io',
    agentRegistryAddress: undefined,
    tokens: {
      STRK: {
        address: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
        name: 'Starknet Token',
        symbol: 'STRK',
        decimals: 18,
        image: 'https://assets.starknet.io/strk.svg',
      },
      USDC: {
        address: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        image: 'https://assets.starknet.io/usdc.svg',
      },
    } as Record<string, Token>,
  },
} as const

export const ACTIVE_NETWORK = STARKNET_CONFIG.sepolia

export const TWITTER_CONFIG = {
  accountName: '@jack_the_ether',
}
