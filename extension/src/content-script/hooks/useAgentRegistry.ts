import { useState, useEffect } from 'react';
import { validateChecksumAddress } from 'starknet';
import { STARKNET_CONFIG } from '../config/starknet';

const STORAGE_KEY_PREFIX = 'agentRegistryAddress';

export const useAgentRegistry = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<'mainnet' | 'sepolia'>('mainnet');

  const getStorageKey = (network: string) => `${STORAGE_KEY_PREFIX}_${network}`;

  useEffect(() => {
    const storedAddress = localStorage.getItem(getStorageKey(network));
    if (storedAddress && validateChecksumAddress(storedAddress)) {
      setAddress(storedAddress);
    } else if (
      network === 'mainnet' && 
      STARKNET_CONFIG.mainnet.agentRegistryAddress && 
      validateChecksumAddress(STARKNET_CONFIG.mainnet.agentRegistryAddress)
    ) {
      setAddress(STARKNET_CONFIG.mainnet.agentRegistryAddress);
      localStorage.setItem(getStorageKey('mainnet'), STARKNET_CONFIG.mainnet.agentRegistryAddress);
    } else if (
      network === 'sepolia' && 
      STARKNET_CONFIG.sepolia.agentRegistryAddress && 
      validateChecksumAddress(STARKNET_CONFIG.sepolia.agentRegistryAddress)
    ) {
      setAddress(STARKNET_CONFIG.sepolia.agentRegistryAddress);
      localStorage.setItem(getStorageKey('sepolia'), STARKNET_CONFIG.sepolia.agentRegistryAddress);
    } else {
      setIsModalOpen(true);
    }
  }, [network]);

  const updateAddress = (newAddress: string, network: 'mainnet' | 'sepolia' = 'mainnet') => {
    if (!validateChecksumAddress(newAddress)) {
      setError('Invalid address format. Please provide a valid checksum address.');
      return false;
    }
    
    setAddress(newAddress);
    localStorage.setItem(getStorageKey(network), newAddress);
    setError(null);
    setIsModalOpen(false);
    return true;
  };

  return {
    address,
    isModalOpen,
    error,
    updateAddress,
    setIsModalOpen,
    network,
    setNetwork
  };
}; 