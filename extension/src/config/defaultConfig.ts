import {
  ACTIVE_NETWORK,
  NETHERMIND_API_KEY,
  STARKNET_CONFIG,
} from '@/content-script/config/starknet'
import { Config } from './types'

// Type assertion for DEFAULT_CONFIG
export const DEFAULT_CONFIG: Config = {
  STARKNET_CONFIG,
  ACTIVE_NETWORK,
  NETHERMIND_API_KEY,
} as const
