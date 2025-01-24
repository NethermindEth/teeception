import { ACTIVE_NETWORK } from '../config/starknet';

export const useAgentRegistry = () => {
  return {
    address: ACTIVE_NETWORK.agentRegistryAddress,
  };
}; 