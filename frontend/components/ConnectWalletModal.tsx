import { useConnectWallet } from '@/hooks/useConnetWallet'
import { Dialog } from './Dialog'
import { Connector, useConnect } from '@starknet-react/core'

interface ConnectWalletModal {
  open: boolean
  onCancel: () => void
}

export const getConnectorName = (connectorId: string) => {
  const connectorIdLCase = connectorId.toLowerCase()
  switch (connectorIdLCase) {
    case 'controller':
      return 'Cartridge Controller'
    case 'argentwebwallet':
      return 'Argent Web Wallet'
    default:
      return connectorId
  }
}

export const ConnectWalletModal = ({ open, onCancel }: ConnectWalletModal) => {
  const { connect, connectors, isSuccess } = useConnect()
  const connectWallet = useConnectWallet()

  const handleConnect = async (connector: Connector) => {
    try {
      await connect({ connector })
      if (isSuccess) {
        connectWallet.hideWalletModal()
      }
    } catch (error: unknown) {
      console.error('error', error)
    }
  }

  return (
    <Dialog open={open} onClose={onCancel}>
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 text-white">Connect Wallet</h2>
          <p className="text-gray-400 mb-6">Select your preferred wallet to connect</p>
        </div>

        <div className="space-y-3">
          {connectors
            .filter((connector) => connector.available())
            .map((connector) => (
              <button
                key={connector.id}
                onClick={() => {
                  handleConnect(connector)
                }}
                className="w-full bg-zinc-800 text-white rounded-lg py-3 font-medium 
                          hover:bg-zinc-700 transition-colors duration-200
                          disabled:opacity-50 disabled:cursor-not-allowed 
                          flex items-center justify-center gap-2"
              >
                {getConnectorName(connector.id)}
              </button>
            ))}
        </div>

        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </Dialog>
  )
}

export default ConnectWalletModal