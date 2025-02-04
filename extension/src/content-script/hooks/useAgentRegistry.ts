import { useContract } from '@starknet-react/core';
import { Abi } from 'starknet';
import { TEECEPTION_AGENTREGISTRY_ABI } from '@/abis/TEECEPTION_AGENTREGISTRY_ABI';
import { ACTIVE_NETWORK } from '../config/starknet';

export const useAgentRegistry = () => {
  const { contract } = useContract({
    abi: TEECEPTION_AGENTREGISTRY_ABI as Abi,
    address: ACTIVE_NETWORK.agentRegistryAddress,
  });

  return {
    address: ACTIVE_NETWORK.agentRegistryAddress,
    contract,
  };
}; 