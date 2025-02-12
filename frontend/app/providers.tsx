'use client'

import { StarknetConfig, publicProvider } from '@starknet-react/core'
import { ControllerConnector } from '@cartridge/connector'
import { sepolia } from '@starknet-react/chains'
import { ACTIVE_NETWORK, STARKNET_CONFIG } from '@/constants'
import { AddFundsProvider } from '@/contexts/AddFundsContext'

const policies = {
  contracts: {
    [ACTIVE_NETWORK.agentRegistryAddress]: {
      name: 'Agent Registry',
      description: 'Allows interaction with the Agent Registry contract',
      methods: [
        {
          name: 'Register Agent',
          description: 'Register a new AI agent',
          entrypoint: 'register_agent',
        },
        {
          name: 'Transfer Agent',
          description: 'Transfer ownership of an agent',
          entrypoint: 'transfer',
        },
      ],
    },
  },
}

const cartridgeConnector = new ControllerConnector({
  policies,
  defaultChainId: ACTIVE_NETWORK.chainId,
  chains: [{ rpcUrl: ACTIVE_NETWORK.rpc }, { rpcUrl: STARKNET_CONFIG.mainnet.rpc }],
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={publicProvider()}
      connectors={[cartridgeConnector]}
    >
      <AddFundsProvider>{children}</AddFundsProvider>
    </StarknetConfig>
  )
}
