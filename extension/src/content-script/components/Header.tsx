import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { useAccount, useConnect } from '@starknet-react/core'
import { useState, useEffect } from 'react'
import { StarknetkitConnector, useStarknetkitConnectModal } from 'starknetkit'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { AgentView } from './AgentView'
import { debug } from '../utils/debug'

interface HeaderProps {
  isShowAgentView: boolean
  setIsShowAgentView: (show: boolean) => void
}

export default function Header({ isShowAgentView, setIsShowAgentView }: HeaderProps) {
  const { address, status } = useAccount()
  const { balance: tokenBalance, isLoading: loading } = useTokenBalance('STRK')
  const [copied, setCopied] = useState(false)
  const { connectAsync, connectors } = useConnect()
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
  })

  // Auto-connect on load
  useEffect(() => {
    const autoConnect = async () => {
      if (status === 'disconnected') {
        try {
          // Try to connect with the first available connector
          const connector = connectors[0]
          if (connector) {
            await connectAsync({ connector })
          }
        } catch (err) {
          debug.error('Header', 'Auto-connect failed', err)
        }
      }
    }

    autoConnect()
  }, [status, connectAsync, connectors])

  async function connectWalletWithModal() {
    const { connector } = await starknetkitConnectModal()
    if (!connector) return
    await connectAsync({ connector })
  }

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const addressDisplay = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''

  if (status !== 'connected') {
    return (
      <div className="fixed top-3 right-3 z-[9999]">
        <div className="bg-black/80 backdrop-blur-sm px-4 py-2 rounded-[12px] border border-[#2F3336]">
          <button
            onClick={connectWalletWithModal}
            className="text-white text-sm hover:opacity-80 transition-opacity"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed top-3 right-3 z-[9999]">
        <div 
          className={`
            bg-black/80 backdrop-blur-sm rounded-[12px] border border-[#2F3336] 
            transition-all duration-300 ease-in-out
            ${isShowAgentView ? 'w-[500px]' : 'w-[300px]'}
          `}
        >
          <div className="px-5 py-3 flex items-center">
            <button
              onClick={() => setIsShowAgentView(!isShowAgentView)}
              className="w-[26px] h-[26px] bg-white rounded-full flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
            >
              {isShowAgentView ? (
                <ChevronRight className="text-black" width={20} height={20} />
              ) : (
                <ChevronLeft className="text-black" width={20} height={20} />
              )}
            </button>

            <div className="text-[#A4A4A4] text-xs flex items-center gap-4 justify-end flex-1">
              <div className="w-[6px] h-[6px] bg-[#58F083] rounded-full shrink-0"></div>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center gap-1.5 shrink-0" onClick={handleCopyAddress}>
                      <p>{addressDisplay}</p>
                      <Copy width={12} height={12} className={copied ? "text-[#58F083]" : ""} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Click to copy address</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="shrink-0">{loading ? "..." : `${tokenBalance?.formatted || '0'} STRK`}</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Your balance</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          <AgentView isShowAgentView={isShowAgentView} />
        </div>
      </div>
    </>
  )
}
