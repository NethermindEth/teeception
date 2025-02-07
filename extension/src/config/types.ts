import { Chain } from '@starknet-react/chains'
import { constants } from 'starknet'

export interface Token {
  address: string
  name: string
  symbol: string
  decimals: number
  image: string
}

interface NetworkConfig {
  chain: Chain
  chainId: constants.StarknetChainId
  name: string
  explorer: string
  rpc: string
  starkgate: string
  agentRegistryAddress: string | undefined
  tokens: Record<string, Token>
}

type StarknetConfig = {
  readonly sepolia: NetworkConfig
  readonly mainnet: NetworkConfig
}

export type Config = {
  readonly STARKNET_CONFIG: StarknetConfig
  readonly ACTIVE_NETWORK: NetworkConfig
  readonly NETHERMIND_API_KEY: string
}

export type RemoteConfig = Config

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
