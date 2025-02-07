import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { RemoteConfigService } from './remoteConfig'
import type { Config } from './types'
import { DEFAULT_CONFIG } from './defaultConfig'

// Create a base atom with the default config
export const configAtom = atom<Config>(DEFAULT_CONFIG)

// Create an atom for loading state
export const configLoadingAtom = atom<boolean>(false)

// Create an atom for error state
export const configErrorAtom = atom<string | null>(null)

// Create an atom for last update timestamp with storage
export const configLastUpdateAtom = atomWithStorage<number>('config_last_update', 0)

// Create a writeable atom that handles config updates
export const configWriteAtom = atom(
  (get) => get(configAtom),
  (get, set, newConfig: Config) => {
    set(configAtom, newConfig)
    set(configLastUpdateAtom, Date.now())
  }
)

// Create an atom for handling errors
export const setConfigErrorAtom = atom(null, (get, set, error: Error | string) => {
  set(configErrorAtom, error instanceof Error ? error.message : error)
})

// Initialize config function
export async function initializeConfig(
  setConfig: (config: Config) => void,
  setError: (error: string) => void
) {
  const remoteConfig = RemoteConfigService.getInstance()

  try {
    const previousUpdate = await chrome.storage.local.get('config_last_update')
    const lastUpdate = previousUpdate.config_last_update || 0
    const now = Date.now()

    // Only fetch new config if more than 5 minutes have passed
    if (now - lastUpdate > 5 * 60 * 1000) {
      const newConfig = await remoteConfig.fetchConfig()
      setConfig(newConfig)
    }
  } catch (error) {
    console.error('Failed to initialize config:', error)
    setError(error instanceof Error ? error.message : 'Unknown error')
  }
}

// Selector atoms for specific parts of the config
export const activeNetworkAtom = atom((get) => get(configAtom).ACTIVE_NETWORK)
export const starknetConfigAtom = atom((get) => get(configAtom).STARKNET_CONFIG)
export const nethermindApiKeyAtom = atom((get) => get(configAtom).NETHERMIND_API_KEY)

// Selector for specific network
export const networkConfigAtom = atom((get) => {
  const config = get(configAtom)
  const networkName = get(activeNetworkAtom).name.toLowerCase()
  return config.STARKNET_CONFIG[networkName as keyof typeof config.STARKNET_CONFIG]
})

// Selector for tokens of current network
export const currentNetworkTokensAtom = atom((get) => get(networkConfigAtom).tokens)

// Helper atom to get a specific token
export const tokenBySymbolAtom = atom(
  (get) => (symbol: string) => get(currentNetworkTokensAtom)[symbol]
)
