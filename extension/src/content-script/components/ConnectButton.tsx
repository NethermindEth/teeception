import React, { useState } from 'react';
import { Connector, useAccount, useConnect, useDisconnect, useSwitchChain } from "@starknet-react/core";
import { Button } from '@/components/ui/button';
import { StarknetkitConnector, useStarknetkitConnectModal } from 'starknetkit';
import { constants } from "starknet";
import { X, Copy, ExternalLink } from 'lucide-react';
import { useTokenBalance } from '../hooks/useTokenBalance';

const CHAINS = [
  { id: constants.StarknetChainId.SN_MAIN, name: 'Mainnet' },
  { id: constants.StarknetChainId.SN_SEPOLIA, name: 'Sepolia' },
] as const;

export const ConnectButton = () => {
  const { address, status, chainId } = useAccount();
  const { balance, symbol, loading } = useTokenBalance(address, chainId?.toString());
  const [copied, setCopied] = useState(false);
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain: switchToMain } = useSwitchChain({
    params: {
      chainId: constants.StarknetChainId.SN_MAIN,
    }
  });
  const { switchChain: switchToSepolia } = useSwitchChain({
    params: {
      chainId: constants.StarknetChainId.SN_SEPOLIA,
    }
  });
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
  });

  async function connectWalletWithModal() {
    const { connector } = await starknetkitConnectModal();
    if (!connector) return;
    await connectAsync({ connector: connector as Connector });
  }

  const handleChainSwitch = async (newChainId: string) => {
    try {
      if (newChainId === constants.StarknetChainId.SN_MAIN) {
        await switchToMain();
      } else if (newChainId === constants.StarknetChainId.SN_SEPOLIA) {
        await switchToSepolia();
      }
    } catch (error) {
      console.error('Failed to switch chain:', error);
    }
  };

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const bannerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(4px)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  };

  const topUpBannerStyle: React.CSSProperties = {
    ...bannerStyle,
    backgroundColor: 'rgba(234, 179, 8, 0.9)',
    cursor: 'pointer',
  };

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '4px',
    color: 'white',
    padding: '2px 8px',
    fontSize: '14px',
    cursor: 'pointer',
    outline: 'none',
  };

  const addressDisplay = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  if (status !== 'connected') {
    return (
      <Button 
        variant="default"
        size="sm"
        onClick={connectWalletWithModal}
        className="fixed top-3 right-3 rounded-full shadow-lg hover:shadow-xl transition-all"
      >
        Connect Wallet
      </Button>
    );
  }

  const showTopUpBanner = Number(balance) === 0 && !loading;

  return (
    <div style={containerStyle}>
      <div style={bannerStyle}>
        <span style={{ 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          backgroundColor: '#4ade80',
        }} />
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          cursor: 'pointer' 
        }} onClick={handleCopyAddress}>
          <span style={{ color: 'white', fontSize: '14px' }}>
            {addressDisplay}
          </span>
          <Copy size={12} style={{ color: copied ? '#4ade80' : 'white' }} />
        </div>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>|</span>
        <span style={{ color: 'white', fontSize: '14px' }}>
          {loading ? '...' : `${balance} ${symbol}`}
        </span>
        <select 
          style={selectStyle}
          value={chainId?.toString()}
          onChange={(e) => handleChainSwitch(e.target.value)}
        >
          {CHAINS.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>
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
          href={`https://jediswap.xyz`}
          target="_blank"
          rel="noopener noreferrer"
          style={topUpBannerStyle}
        >
          <ExternalLink size={14} style={{ color: 'white' }} />
          <span style={{ color: 'white', fontSize: '14px' }}>
            Get {symbol} on JediSwap
          </span>
        </a>
      )}
    </div>
  );
} 