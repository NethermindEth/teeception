import React from 'react';
import { Button } from './ui/button';

export const ConnectWallet: React.FC = () => {
  const handleConnect = async () => {
    // Implement wallet connection logic here
    console.log('Connecting wallet...');
  };

  return (
    <Button onClick={handleConnect} className="w-full">
      Connect Wallet
    </Button>
  );
}; 