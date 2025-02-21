'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useNetwork } from '@starknet-react/core'
import { Copy, X, Check } from 'lucide-react'
import clsx from 'clsx'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip'
import { useTokenBalance } from '@/hooks/useTokenBalance'
import { useAddFunds } from '@/hooks/useAddFunds'
import { StarknetkitConnector, useStarknetkitConnectModal } from 'starknetkit'
import { AnimatePresence, motion } from 'framer-motion'

interface ConnectButtonProps {
  className?: string
  showAddress?: boolean
}

export const ConnectButton = ({ className = '', showAddress = true }: ConnectButtonProps) => {
  const { address } = useAccount()
  const [copied, setCopied] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
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
        const connector = connectors[0]
        if (connector) {
          setIsConnecting(true)
          await connectAsync({ connector })
        }
      } catch (err) {
        console.error('Header', 'Auto-connect failed', err)
      } finally {
        setIsConnecting(false)
      }
    }

    autoConnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function connectWalletWithModal() {
    try {
      setIsConnecting(true)
      const { connector } = await starknetkitConnectModal()
      if (!connector) return
      await connectAsync({ connector })
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
  
  const strkBalance = useMemo(() => Number(tokenBalance?.formatted) || null, [tokenBalance])

  return (
    <AnimatePresence mode="wait">
      {address ? (
        showAddress ? (
          <motion.div 
            key="connected"
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Network Pill */}
            <AnimatePresence>
              {chain?.network && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center px-3 py-1.5 bg-[#1A1B1F] rounded-full border border-[#383838] hover:border-[#4c4c4c] transition-colors"
                >
                  <div className="w-2 h-2 bg-[#58F083] rounded-full mr-2" />
                  <span className="text-sm text-[#FAFAFA] font-medium uppercase">{chain.network}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Balance + Address Pill */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div 
                    onClick={handleCopyAddress}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1B1F] rounded-full border border-[#383838] hover:border-[#4c4c4c] transition-colors cursor-pointer"
                  >
                    {/* Balance */}
                    <div className="flex items-center border-r border-[#383838] pr-3">
                      <span className="text-sm font-medium text-[#FAFAFA]">
                        {loading || strkBalance === null ? '...' : `${strkBalance.toFixed(2)} STRK`}
                      </span>
                    </div>

                    {/* Address */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#FAFAFA]">
                        {formatAddress(address)}
                      </span>
                      {copied ? (
                        <Check size={14} className="text-[#58F083]" />
                      ) : (
                        <Copy size={14} />
                      )}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                disconnect()
                              }}
                              className="hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Disconnect</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copied ? 'Address copied!' : 'Copy address'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Add Funds Button */}
            <AnimatePresence>
              {strkBalance !== null && strkBalance < 0.01 && (
                <motion.button 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2, delay: 0.2 }}
                  onClick={addFunds.showAddFundsModal}
                  className="text-sm font-medium text-[#58F083] hover:text-[#3da85c] transition-colors"
                >
                  Add funds
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        ) : null
      ) : (
        <motion.button 
          key="connect"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          onClick={connectWalletWithModal}
          disabled={isConnecting}
          className={clsx(
            "px-4 py-2 bg-[#1A1B1F] rounded-full border border-[#383838] hover:border-[#424242] transition-colors text-[#FAFAFA] font-medium",
            className,
            isConnecting && "relative overflow-hidden"
          )}
        >
          {isConnecting ? (
            <>
              <span>Connecting...</span>
              <div className="absolute bottom-0 left-0 h-[2px] w-full bg-[#383838]">
                <div className="h-full w-1/3 bg-[#58F083] animate-loading-progress" />
              </div>
            </>
          ) : (
            'Connect Wallet'
          )}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
