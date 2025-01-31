import { ACTIVE_NETWORK } from '../config/starknet';
import { debug } from '../utils/debug';

export const useAgentRegistry = () => {
  return {
    address: ACTIVE_NETWORK.agentRegistryAddress,
  };
}; 