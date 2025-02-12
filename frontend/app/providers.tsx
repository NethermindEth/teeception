'use client'

'use client'
import React from 'react'
import {
  StarknetConfig,
  publicProvider,
  voyager,
  argent,
  braavos,
  useInjectedConnectors,
} from '@starknet-react/core'
import { ACTIVE_NETWORK } from '@/constants'
import { AddFundsProvider } from '@/contexts/AddFundsContext'

// const policies = {
//   contracts: {
//     [ACTIVE_NETWORK.agentRegistryAddress]: {
//       name: 'Agent Registry',
//       description: 'Allows interaction with the Agent Registry contract',
//       methods: [
//         {
//           name: 'Register Agent',
//           description: 'Register a new AI agent',
//           entrypoint: 'register_agent',
//         },
//         {
//           name: 'Transfer Agent',
//           description: 'Transfer ownership of an agent',
//           entrypoint: 'transfer',
//         },
//       ],
//     },
//   },
// }

// const cartridgeConnector = new ControllerConnector({
//   policies,
//   defaultChainId: ACTIVE_NETWORK.chainId,
//   chains: [{ rpcUrl: ACTIVE_NETWORK.rpc }, { rpcUrl: STARKNET_CONFIG.mainnet.rpc }],
// })

export function Providers({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: 'onlyIfNoConnectors',
  })
  return (
    <StarknetConfig
      chains={[ACTIVE_NETWORK.chain]}
      provider={publicProvider()}
      connectors={connectors}
      explorer={voyager}
    >
      <AddFundsProvider>{children}</AddFundsProvider>
    </StarknetConfig>
  )
}
