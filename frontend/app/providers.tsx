'use client'

'use client'
import React from 'react'
import { StarknetConfig, publicProvider, voyager } from '@starknet-react/core'
import { ControllerConnector } from '@cartridge/connector'
import { ACTIVE_NETWORK, STARKNET_CONFIG } from '@/constants'
import { AddFundsProvider } from '@/contexts/AddFundsContext'
import { InjectedConnector } from 'starknetkit/injected'
import { WebWalletConnector } from 'starknetkit/webwallet'
import { ConnectWalletProvider } from '@/contexts/ConnectWalletContext'

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

const connectors = [
  new InjectedConnector({ options: { id: 'argentX', name: 'Argent X' } }),
  new InjectedConnector({ options: { id: 'braavos', name: 'Braavos' } }),
  new WebWalletConnector({ url: 'https://web.argent.xyz' }),
  cartridgeConnector,
]

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StarknetConfig
      chains={[ACTIVE_NETWORK.chain]}
      provider={publicProvider()}
      connectors={connectors}
      explorer={voyager}
    >
      <AddFundsProvider>
        <ConnectWalletProvider>{children}</ConnectWalletProvider>
      </AddFundsProvider>
    </StarknetConfig>
  )
}
