import { useState, useEffect } from 'react';
import { validateChecksumAddress } from 'starknet';
import { CONFIG } from '../config';

const STORAGE_KEY = 'agentRegistryAddress';

export const useAgentRegistry = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedAddress = localStorage.getItem(STORAGE_KEY);
    if (storedAddress && validateChecksumAddress(storedAddress)) {
      setAddress(storedAddress);
    } else if (CONFIG.agentRegistryAddress && validateChecksumAddress(CONFIG.agentRegistryAddress)) {
      setAddress(CONFIG.agentRegistryAddress);
      localStorage.setItem(STORAGE_KEY, CONFIG.agentRegistryAddress);
    } else {
      setIsModalOpen(true);
    }
  }, []);

  const updateAddress = (newAddress: string) => {
    if (!validateChecksumAddress(newAddress)) {
      setError('Invalid address format. Please provide a valid checksum address.');
      return false;
    }
    
    setAddress(newAddress);
    localStorage.setItem(STORAGE_KEY, newAddress);
    setError(null);
    setIsModalOpen(false);
    return true;
  };

  return {
    address,
    isModalOpen,
    error,
    updateAddress,
    setIsModalOpen
  };
}; 