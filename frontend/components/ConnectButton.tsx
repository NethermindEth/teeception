'use client'

import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core'
import { Loader2 } from 'lucide-react'

interface ConnectButtonProps {
  className?: string
  showAddress?: boolean
}

export const ConnectButton = ({ className = '', showAddress = true }: ConnectButtonProps) => {
  const { address } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [isConnecting, setIsConnecting] = useState(false)

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

  if (address) {
    return showAddress ? (
      <button
        onClick={() => disconnect()}
        className={className}
      >
        {formatAddress(address)}
      </button>
    ) : null
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className={className}
    >
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