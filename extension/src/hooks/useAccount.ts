import { useState, useEffect } from 'react';

export const useAccount = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    // Implement wallet connection status check here
    // This is just a placeholder
    const checkConnection = async () => {
      // Add actual wallet connection check logic
    };

    checkConnection();
  }, []);

  return {
    isConnected,
    address,
  };
}; 