'use client'

import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core'
import { Copy, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip'

interface ConnectButtonProps {
  className?: string
  showAddress?: boolean
}

export const ConnectButton = ({ className = '', showAddress = true }: ConnectButtonProps) => {
  const { address } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [isConnecting, setIsConnecting] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleConnect = async () => {
    const connector = connectors[0]
    if (!connector) return

    try {
      setIsConnecting(true)
      await connect({ connector })
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setIsConnecting(false)
    }
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

  if (address) {
    return showAddress ? (
      <div className={clsx(className, 'flex items-center gap-2')}>
        <div className="w-[6px] h-[6px] bg-[#58F083] rounded-full"></div>
        <TooltipProvider>
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
              <button className="flex items-center gap-1.5" onClick={handleCopyAddress}>
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
    <button onClick={handleConnect} disabled={isConnecting} className={className}>
      {isConnecting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Connecting...
        </>
      ) : (
        'Connect Wallet'
      )}
    </button>
  )
}
