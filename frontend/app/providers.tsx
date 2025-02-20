'use client'

'use client'
import React from 'react'
import { StarknetConfig, publicProvider, voyager } from '@starknet-react/core'
import { ControllerConnector } from '@cartridge/connector'
import { ACTIVE_NETWORK, STARKNET_CONFIG } from '@/constants'
import { AddFundsProvider } from '@/contexts/AddFundsContext'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { argent, braavos } from "@starknet-react/core";

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
  argent(),
  braavos(),
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
        <div className="bg-[url('/img/abstract_bg.png')] bg-cover bg-repeat-y">
          <Header />
          {children}
          <Footer />
        </div>
      </AddFundsProvider>
    </StarknetConfig>
  )
}
