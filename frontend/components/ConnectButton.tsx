'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useNetwork } from '@starknet-react/core'
import { Copy } from 'lucide-react'
import clsx from 'clsx'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip'
import { useTokenBalance } from '@/hooks/useTokenBalance'
import { useAddFunds } from '@/hooks/useAddFunds'
import { StarknetkitConnector, useStarknetkitConnectModal } from 'starknetkit'

interface ConnectButtonProps {
  className?: string
  showAddress?: boolean
}

export const ConnectButton = ({ className = '', showAddress = true }: ConnectButtonProps) => {
  const { address, status } = useAccount()
  const [copied, setCopied] = useState(false)
  const { balance: tokenBalance, isLoading: loading } = useTokenBalance('STRK')
  const { chain } = useNetwork()
  const addFunds = useAddFunds()

  const { connectAsync, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
  })

  // Auto-connect on initial page load only
  useEffect(() => {
    const autoConnect = async () => {
      try {
        // Try to connect with the first available connector
        const connector = connectors[0]
        if (connector) {
          await connectAsync({ connector })
        }
      } catch (err) {
        console.error('Header', 'Auto-connect failed', err)
      }
    }

    autoConnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array ensures this only runs once on mount

  async function connectWalletWithModal() {
    const { connector } = await starknetkitConnectModal()
    if (!connector) return
    await connectAsync({ connector })
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }
  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  const strkBalance = useMemo(() => Number(tokenBalance?.formatted || 0), [tokenBalance])

  if (address) {
    return showAddress ? (
      <div
        className={clsx(
          'lg:flex items-center gap-3 grid grid-cols-12 w-full p-3 justify-items-end'
        )}
      >
        {/* {strkBalance < 0.01 && <button>Add funds</button>} */}
        {
          <button className="text-xs underline col-span-5" onClick={addFunds.showAddFundsModal}>
            Add funds to your wallet
          </button>
        }
        {chain?.network && (
          <div className="flex border px-2 py-2 text-xs justify-center items-center gap-2 border-white/30 rounded-md col-span-4">
            <div className="w-[6px] h-[6px] bg-[#58F083] rounded-full"></div>
            <div className="uppercase"> {chain?.network}</div>
          </div>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-[#A4A4A4] text-xs col-span-3">
                {loading ? '...' : `${strkBalance.toFixed(2)} STRK`}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              <p>Your balance</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => disconnect()} className={className}>
                {formatAddress(address)}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click to disconnect</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center gap-1.5 -ml-[6px] col-span-1"
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
    ) : null
  }

  return (
    <div>
      <button onClick={connectWalletWithModal} className={className}>
        Connect Wallet
      </button>
    </div>
  )
}
