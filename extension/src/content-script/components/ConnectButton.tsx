import React, { useState } from 'react'
import { Connector, useAccount, useConnect, useDisconnect } from '@starknet-react/core'
import { Button } from '@/components/ui/button'
import { StarknetkitConnector, useStarknetkitConnectModal } from 'starknetkit'
import { X, Copy, ExternalLink } from 'lucide-react'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { ACTIVE_NETWORK } from '../config/starknet'
import { useAgentRegistry } from '../hooks/useAgentRegistry'
import { AgentRegistryModal } from './AgentRegistryModal'
import { AgentView } from './AgentView'
const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '12px',
  right: '12px',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const bannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  borderRadius: '8px',
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  backdropFilter: 'blur(4px)',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
}

const topUpBannerStyle: React.CSSProperties = {
  ...bannerStyle,
  backgroundColor: 'rgba(234, 179, 8, 0.9)',
  cursor: 'pointer',
}

export const ConnectButton = () => {
  const { address, status } = useAccount()
  const { balance, symbol, loading } = useTokenBalance(address)
  const [copied, setCopied] = useState(false)
  const { connectAsync, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
  })
  const {
    address: agentRegistryAddress,
    isModalOpen,
    error,
    updateAddress,
    setIsModalOpen,
  } = useAgentRegistry()
  const [isShowAgentView, setIsShowAgentView] = useState(false)

  async function connectWalletWithModal() {
    const { connector } = await starknetkitConnectModal()
    if (!connector) return
    await connectAsync({ connector: connector as Connector })
  }

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const addressDisplay = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''
  const agentRegistryDisplay = agentRegistryAddress
    ? `${agentRegistryAddress.slice(0, 6)}...${agentRegistryAddress.slice(-4)}`
    : 'Not Set'

  if (status !== 'connected') {
    return (
      <>
        <Button
          variant="default"
          size="sm"
          onClick={connectWalletWithModal}
          className="fixed top-3 right-3 rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          Connect Wallet
        </Button>
        <AgentRegistryModal
          isOpen={isModalOpen}
          onSubmit={updateAddress}
          error={error}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    )
  }

  const showTopUpBanner = Number(balance) === 0 && !loading
  console.log('Status', status)

  return (
    <>
      <div style={containerStyle}>
        <div style={bannerStyle}>
          <button
            onClick={() => {
              setIsShowAgentView(!isShowAgentView)
            }}
            className="text-white"
          >
            {' '}
            {isShowAgentView ? 'HIDE' : 'SHOW'}
          </button>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#4ade80',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
            onClick={handleCopyAddress}
          >
            <span style={{ color: 'white', fontSize: '14px' }}>{addressDisplay}</span>
            <Copy size={12} style={{ color: copied ? '#4ade80' : 'white' }} />
          </div>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>|</span>
          <span style={{ color: 'white', fontSize: '14px' }}>
            {loading ? '...' : `${balance} ${symbol}`}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>|</span>
          <span style={{ color: 'white', fontSize: '14px' }}>{ACTIVE_NETWORK.name}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>|</span>
          <span
            style={{ color: 'white', fontSize: '14px', cursor: 'pointer' }}
            onClick={() => setIsModalOpen(true)}
          >
            Registry: {agentRegistryDisplay}
          </span>
          <button
            onClick={() => disconnect()}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgb(239, 68, 68)',
              borderRadius: '4px',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {showTopUpBanner && (
          <a
            href={ACTIVE_NETWORK.starkgate}
            target="_blank"
            rel="noopener noreferrer"
            style={topUpBannerStyle}
          >
            <ExternalLink size={14} style={{ color: 'white' }} />
            <span style={{ color: 'white', fontSize: '14px' }}>Get {symbol} on Starkgate</span>
          </a>
        )}
      </div>
      <AgentRegistryModal
        isOpen={isModalOpen}
        onSubmit={updateAddress}
        error={error}
        onClose={() => setIsModalOpen(false)}
      />
      {status === 'connected' && isShowAgentView && <AgentView />}
    </>
  )
}
