import { useEffect, useState } from 'react';
import { Contract, RpcProvider } from 'starknet';
import { AGENT_REGISTRY_COPY_ABI } from '@/abis/AGENT_REGISTRY';
import { AGENT_ABI } from '@/abis/AGENT_ABI';
import { ERC20_ABI } from '@/abis/ERC20_ABI';
import { ACTIVE_NETWORK } from '../config/starknet';
import { debug } from '../utils/debug';

interface AgentDetails {
    address: string;
    name: string;
    systemPrompt: string;
    balance: string;
}

export const useAgents = (registryAddress: string | null) => {
    const [agents, setAgents] = useState<AgentDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAgents = async () => {
            debug.log('useAgents', 'Starting to fetch agents', { registryAddress })
            
            if (!registryAddress) {
                debug.log('useAgents', 'No registry address provided')
                setLoading(false);
                return;
            }

            try {
                const provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc });
                const registry = new Contract(AGENT_REGISTRY_COPY_ABI, registryAddress, provider);

                debug.log('useAgents', 'Created registry contract instance')

                const tokenAddressRaw = await registry.get_token();
                const tokenAddress = `0x${BigInt(tokenAddressRaw).toString(16)}`;
                const tokenContract = new Contract(ERC20_ABI, tokenAddress, provider);

                debug.log('useAgents', 'Got token contract', { tokenAddress })

                const rawAgentAddresses = await registry.get_agents();
                const agentAddresses = rawAgentAddresses.map((address: string) => {
                    return `0x${BigInt(address).toString(16)}`;
                });

                debug.log('useAgents', 'Got agent addresses', { count: agentAddresses.length })

                const agentDetails = await Promise.all(
                    agentAddresses.map(async (address: string) => {
                        try {
                            debug.log('useAgents', 'Loading agent details', { address })
                            const agent = new Contract(AGENT_ABI, address, provider);
                            
                            const [nameResult, systemPromptResult, balanceResult] = await Promise.all([
                                agent.get_name().catch((e: any) => {
                                    debug.error('useAgents', 'Error fetching name', { address, error: e })
                                    return 'Unknown';
                                }),
                                agent.get_system_prompt().catch((e: any) => {
                                    debug.error('useAgents', 'Error fetching system prompt', { address, error: e })
                                    return 'Error fetching system prompt';
                                }),
                                tokenContract.balance_of(address).catch((e: any) => {
                                    debug.error('useAgents', 'Error fetching token balance', { address, error: e })
                                    return { low: 0, high: 0 };
                                })
                            ]);

                            const balanceValue = balanceResult.low !== undefined ?
                                BigInt(balanceResult.low) + (BigInt(balanceResult.high || 0) << BigInt(128)) :
                                BigInt(0);

                            const result = {
                                address,
                                name: nameResult?.toString() || 'Unknown',
                                systemPrompt: systemPromptResult?.toString() || 'Error fetching system prompt',
                                balance: balanceValue.toString(),
                            };

                            debug.log('useAgents', 'Loaded agent details', { 
                                address, 
                                name: result.name,
                                balance: result.balance 
                            })

                            return result;
                        } catch (err) {
                            debug.error('useAgents', 'Error processing agent', { address, error: err })
                            return {
                                address,
                                name: 'Error',
                                systemPrompt: 'Error fetching agent details',
                                balance: '0',
                            };
                        }
                    })
                );

                debug.log('useAgents', 'Finished loading all agents', { count: agentDetails.length })
                setAgents(agentDetails);
                setError(null);
            } catch (err) {
                debug.error('useAgents', 'Error in fetchAgents', err)
                setError('Failed to fetch agents');
            } finally {
                setLoading(false);
            }
        }

        fetchAgents();
    }, [registryAddress]);

    return { agents, loading, error };
} 