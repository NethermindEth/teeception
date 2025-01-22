import { WebWalletConnector } from 'starknetkit/webwallet'
import { mainnet, sepolia } from '@starknet-react/chains'
import { StarknetConfig, publicProvider } from '@starknet-react/core'

const chains = [mainnet, sepolia]
const connectors = [new WebWalletConnector({ url: 'https://web.argent.xyz' })]

export const StarknetProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <StarknetConfig chains={chains} provider={publicProvider()} connectors={connectors}>
      {children}
    </StarknetConfig>
  )
}
