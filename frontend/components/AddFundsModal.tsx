import { Dialog } from './Dialog'
import { useState } from 'react'
import { useAccount, useNetwork } from '@starknet-react/core'
import { useTokenBalance } from '@/hooks/useTokenBalance'
import { Copy } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/Tooltip'
import { ConnectButton } from '@/components/ConnectButton'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { SEPOLIA_FAUCET_URL, STARKGATE_FAUCET_URL } from '@/constants'

interface AddFundsModalProps {
  open: boolean
  onCancel: () => void
}

export const AddFundsModal = ({ open, onCancel }: AddFundsModalProps) => {
  const [copied, setCopied] = useState(false)
  const { chain } = useNetwork()
  const { balance: tokenBalance, isLoading: loading } = useTokenBalance('STRK')
  const { address: walletAddress = '' } = useAccount()

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  const handleExternalRedirect = (url: string) => {
    window.open(url, '_blank')
  }

  return (
    <Dialog open={open} onClose={onCancel}>
      <div className="p-6 space-y-6">
        {!walletAddress ? (
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
            <p className="text-gray-600">Please connect your wallet to continue</p>
            <div className="flex justify-center">
              <ConnectButton showAddress={false} />
            </div>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Add Funds to your Wallet</h2>
            </div>

            <div className="p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="">Network</span>
                <span className="font-medium">{chain?.network}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Balance</span>
                <span className="font-medium">
                  {loading
                    ? 'Loading...'
                    : `${Number(tokenBalance?.formatted || 0).toFixed(2)} STRK`}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Wallet Address</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="flex items-center gap-1.5 -ml-[6px]"
                          onClick={handleCopyAddress}
                        >
                          <Copy
                            width={12}
                            height={12}
                            className={copied ? 'text-[#58F083]' : 'text-[#A4A4A4]'}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Click to copy address</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleExternalRedirect(STARKGATE_FAUCET_URL)}
                className="w-full bg-white text-black rounded-full py-3 font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Funds via StarkGate
              </button>
              {chain?.network?.toLocaleLowerCase() === 'sepolia' && (
                <button
                  onClick={() => handleExternalRedirect(SEPOLIA_FAUCET_URL)}
                  className="w-full bg-white text-black rounded-full py-3 font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Get Test Tokens (Sepolia Faucet)
                </button>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
