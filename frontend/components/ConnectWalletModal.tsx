import { Dialog } from './Dialog'
import { useConnect } from '@starknet-react/core'

interface ConnectWalletModal {
  open: boolean
  onCancel: () => void
}

export const ConnectWalletModal = ({ open, onCancel }: ConnectWalletModal) => {
  const { connect, connectors } = useConnect()

  return (
    <Dialog open={open} onClose={onCancel}>
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
          <p className="text-gray-600 mb-6">Select your preferred wallet to connect</p>
        </div>

        <div className="space-y-3">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => connect({ connector })}
              className="w-full bg-white text-black rounded-full py-3 font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Connect {connector.id}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancel
          </button>
        </div>
      </div>
    </Dialog>
  )
}

export default ConnectWalletModal
