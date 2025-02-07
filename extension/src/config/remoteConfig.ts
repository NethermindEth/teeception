import { deepMerge } from '@/lib/utils'
import { DEFAULT_CONFIG } from './defaultConfig'
import { RemoteConfig } from './types'

const GITHUB_RAW_URL =
  'https://raw.githubusercontent.com/NethermindEth/teeception/blob/main/extension/config.json'
const CACHE_KEY = 'blockchain_remote_config'
const CACHE_EXPIRY_KEY = 'blockchain_remote_config_expiry'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export class RemoteConfigService {
  private static instance: RemoteConfigService
  private config: RemoteConfig = DEFAULT_CONFIG

  private constructor() {}

  static getInstance(): RemoteConfigService {
    if (!RemoteConfigService.instance) {
      RemoteConfigService.instance = new RemoteConfigService()
    }
    return RemoteConfigService.instance
  }

  async fetchConfig(): Promise<RemoteConfig> {
    try {
      const cachedConfig = await this.getFromCache()
      if (cachedConfig) {
        this.config = cachedConfig
        return cachedConfig
      }

      const response = await fetch(GITHUB_RAW_URL)
      if (!response.ok) {
        throw new Error('Failed to fetch blockchain config')
      }

      const newConfig = await response.json()

      console.log('new config', newConfig)

      if (!this.isValidConfig(newConfig)) {
        throw new Error('Invalid config format')
      }

      this.config = deepMerge(DEFAULT_CONFIG, newConfig)

      // Cache the config
      await this.saveToCache(this.config)

      return this.config
    } catch (error) {
      console.error('Error fetching blockchain config:', error)
      return DEFAULT_CONFIG
    }
  }

  private isValidConfig(config: any): config is RemoteConfig {
    return (
      typeof config === 'object' &&
      typeof config.RPC_URL === 'string' &&
      typeof config.STARKNET_CONFIG.sepolia.AGENT_REGISTRY_ADDRESS === 'string' &&
      config.STARKNET_CONFIG.sepolia.AGENT_REGISTRY_ADDRESS.startsWith('0x')
    )
  }

  private async saveToCache(config: RemoteConfig): Promise<void> {
    try {
      await chrome.storage.local.set({
        [CACHE_KEY]: config,
        [CACHE_EXPIRY_KEY]: Date.now() + CACHE_DURATION,
      })
    } catch (error) {
      console.error('Error saving config to cache:', error)
    }
  }

  private async getFromCache(): Promise<RemoteConfig | null> {
    try {
      const result = await chrome.storage.local.get([CACHE_KEY, CACHE_EXPIRY_KEY])
      const expiry = result[CACHE_EXPIRY_KEY]

      if (!expiry || Date.now() > expiry) {
        return null
      }

      return result[CACHE_KEY] as RemoteConfig
    } catch (error) {
      console.error('Error reading from cache:', error)
      return null
    }
  }

  getConfig(): RemoteConfig {
    return this.config
  }
}
