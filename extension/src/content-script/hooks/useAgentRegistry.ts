import { ACTIVE_NETWORK } from '../config/starknet';
import { debug } from '../utils/debug';

export const useAgentRegistry = () => {
  debug.log('useAgentRegistry', 'Getting registry address', { address: ACTIVE_NETWORK.agentRegistryAddress })
  return {
    address: ACTIVE_NETWORK.agentRegistryAddress,
  };
}; 