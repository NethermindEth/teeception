import { useContract } from '@starknet-react/core';
import { Abi } from 'starknet';
import { AGENT_REGISTRY_ABI } from '@/abis/AGENT_REGISTRY';
import { ACTIVE_NETWORK } from '../config/starknet';

export const useAgentRegistry = () => {
  const { contract } = useContract({
    abi: AGENT_REGISTRY_ABI as Abi,
    address: ACTIVE_NETWORK.agentRegistryAddress,
  });

  return {
    address: ACTIVE_NETWORK.agentRegistryAddress,
    contract,
  };
}; 