import { useAtom, useAtomValue } from 'jotai'
import {
  configAtom,
  configLoadingAtom,
  configErrorAtom,
  activeNetworkAtom,
  currentNetworkTokensAtom,
} from './atoms'
import type { Token } from './types'

export function useConfig() {
  const [config] = useAtom(configAtom)
  const [loading] = useAtom(configLoadingAtom)
  const [error] = useAtom(configErrorAtom)

  return {
    config,
    loading,
    error,
  }
}

export function useActiveNetwork() {
  return useAtomValue(activeNetworkAtom)
}

export function useNetworkTokens() {
  return useAtomValue(currentNetworkTokensAtom)
}

export function useToken(symbol: string): Token | undefined {
  const tokens = useAtomValue(currentNetworkTokensAtom)
  return tokens[symbol]
}
