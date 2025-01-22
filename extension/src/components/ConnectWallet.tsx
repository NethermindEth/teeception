import React from 'react'
import { Button } from './ui/button'
import { connect, disconnect } from 'starknetkit'
import { WebWalletConnector } from 'starknetkit/webwallet'

export const ConnectWallet: React.FC = () => {
  const []
  const handleConnect = async () => {
    const { wallet, connector, connectorData } = await connect({
      connectors: [new WebWalletConnector()],
    })
    // Implement wallet connection logic here
    console.log('Connecting wallet...')
    console.log('Wallet', wallet, connector, connectorData)
  }

  return (
    <Button onClick={handleConnect} className="w-full">
      Connect Wallet
    </Button>
  )
}
