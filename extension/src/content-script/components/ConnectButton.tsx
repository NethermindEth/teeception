import { Connector, useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { Button } from '@/components/ui/button';
import { StarknetkitConnector, useStarknetkitConnectModal } from 'starknetkit';

export const ConnectButton = () => {
  const { address, status, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
  });

  async function connectWalletWithModal() {
    const { connector } = await starknetkitConnectModal();
    if (!connector) {
      return;
    }
    await connectAsync({ connector: connector as Connector });
  }

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px'
  };

  const bannerStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    backdropFilter: 'blur(4px)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      transform: 'translateY(-1px)'
    }
  };

  const addressDisplay = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const chainName = chainId?.toString() || '';

  return (
    <div style={containerStyle}>
      {status === 'connected' ? (
        <div 
          style={bannerStyle} 
          onClick={() => disconnect()}
          title="Click to disconnect"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#4ade80',
              marginRight: '4px'
            }} />
            <span>{addressDisplay}</span>
            {chainName && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>|</span>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{chainName}</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <Button 
          variant="default"
          size="sm"
          onClick={() => {
            console.log('connecting');
            connectWalletWithModal();
          }}
          className="rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          Connect Wallet
        </Button>
      )}
    </div>
  );
} 