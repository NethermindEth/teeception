import { useEffect, useState } from 'react';
import { Contract, Abi } from 'starknet';
import { TEECEPTION_AGENT_ABI } from '@/abis/TEECEPTION_AGENT_ABI';
import { TEECEPTION_ERC20_ABI } from '@/abis/TEECEPTION_ERC20_ABI';
import { debug } from '../utils/debug';
import { useAgentRegistry } from './useAgentRegistry';
import { getProvider } from '../utils/contracts';

interface AgentDetails {
    address: string;
    name: string;
    systemPrompt: string;
    token: {
        address: string;
        minPromptPrice: string;
        minInitialBalance: string;
    };
    balance: string;
}

export const useAgents = () => {
    const { contract: registry } = useAgentRegistry();
    const [agents, setAgents] = useState<AgentDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const provider = getProvider();

    useEffect(() => {
        const fetchAgentDetails = async () => {
            if (!registry) {
                debug.log('useAgents', 'Registry not available yet');
                setError('Registry not available');
                setLoading(false);
                return;
            }

            try {
                debug.log('useAgents', 'Starting to fetch agents');
                
                // Call get_agents directly through the contract
                const rawAgentAddresses = await registry.get_agents(0, 100).catch((e: any) => {
                    debug.error('useAgents', 'Failed to get agents from registry', e);
                    throw e;
                });
                
                debug.log('useAgents', 'Got raw agent addresses', { rawAgentAddresses });

                if (!Array.isArray(rawAgentAddresses)) {
                    debug.error('useAgents', 'Unexpected response format from get_agents', { rawAgentAddresses });
                    throw new Error('Unexpected response format from get_agents');
                }

                // If there are no agents, we can return early
                if (rawAgentAddresses.length === 0) {
                    debug.log('useAgents', 'No agents found');
                    setAgents([]);
                    setError(null);
                    setLoading(false);
                    return;
                }

                const addresses = rawAgentAddresses.map((address: string) => {
                    try {
                        const hexAddress = `0x${BigInt(address).toString(16)}`;
                        // Ensure the address is properly formatted as a hex string with 0x prefix
                        const paddedHex = hexAddress.toLowerCase().padStart(66, '0');
                        return paddedHex.startsWith('0x') ? paddedHex as `0x${string}` : `0x${paddedHex}` as `0x${string}`;
                    } catch (e) {
                        debug.error('useAgents', 'Failed to format address', { address, error: e });
                        throw e;
                    }
                });
                
                debug.log('useAgents', 'Formatted addresses', { addresses });

                const agentDetails = await Promise.all(
                    addresses.map(async (address: `0x${string}`) => {
                        try {
                            debug.log('useAgents', 'Initializing agent contract', { address });
                            
                            // Initialize contract directly instead of using hook
                            const agent = new Contract(TEECEPTION_AGENT_ABI as Abi, address, provider);
                            
                            debug.log('useAgents', 'Fetching agent details', { address });
                            
                            // Get agent details and token info
                            const [nameResult, systemPromptResult, tokenAddress] = await Promise.all([
                                agent.get_name().catch((e: any) => {
                                    debug.error('useAgents', 'Error fetching name', { address, error: e });
                                    return 'Unknown';
                                }),
                                agent.get_system_prompt().catch((e: any) => {
                                    debug.error('useAgents', 'Error fetching system prompt', { address, error: e });
                                    return 'Error fetching system prompt';
                                }),
                                agent.get_token().catch((e: any) => {
                                    debug.error('useAgents', 'Error fetching token', { address, error: e });
                                    throw e;
                                })
                            ]);

                            debug.log('useAgents', 'Got agent details', { 
                                address, 
                                name: nameResult, 
                                systemPrompt: systemPromptResult,
                                tokenAddress 
                            });

                            // Get token params from registry
                            const tokenParams = await registry.get_token_params(tokenAddress).catch((e: any) => {
                                debug.error('useAgents', 'Error fetching token params', { address, tokenAddress, error: e });
                                throw e;
                            });

                            const hexTokenAddress = `0x${BigInt(tokenAddress).toString(16)}`;
                            const normalizedTokenAddress = (hexTokenAddress.startsWith('0x') ? 
                                hexTokenAddress : `0x${hexTokenAddress}`).toLowerCase().padStart(66, '0') as `0x${string}`;
                            
                            debug.log('useAgents', 'Got token params', { 
                                address, 
                                tokenAddress: normalizedTokenAddress,
                                tokenParams 
                            });

                            // Initialize token contract directly
                            const tokenContract = new Contract(TEECEPTION_ERC20_ABI as Abi, normalizedTokenAddress, provider);

                            const balanceResult = await tokenContract.balance_of(address).catch((e: any) => {
                                debug.error('useAgents', 'Error fetching token balance', { address, error: e });
                                return { low: 0, high: 0 };
                            });

                            const balanceValue = balanceResult.low !== undefined ?
                                BigInt(balanceResult.low) + (BigInt(balanceResult.high || 0) << BigInt(128)) :
                                BigInt(0);

                            debug.log('useAgents', 'Got token balance', { 
                                address, 
                                balance: balanceValue.toString() 
                            });

                            return {
                                address,
                                name: nameResult?.toString() || 'Unknown',
                                systemPrompt: systemPromptResult?.toString() || 'Error fetching system prompt',
                                token: {
                                    address: normalizedTokenAddress,
                                    minPromptPrice: tokenParams.min_prompt_price.toString(),
                                    minInitialBalance: tokenParams.min_initial_balance.toString(),
                                },
                                balance: balanceValue.toString(),
                            };
                        } catch (err) {
                            debug.error('useAgents', 'Error processing agent', { address, error: err });
                            return {
                                address,
                                name: 'Error',
                                systemPrompt: 'Error fetching agent details',
                                token: {
                                    address: '0x0',
                                    minPromptPrice: '0',
                                    minInitialBalance: '0',
                                },
                                balance: '0',
                            };
                        }
                    })
                );

                debug.log('useAgents', 'Successfully fetched all agent details', { 
                    agentCount: agentDetails.length 
                });

                setAgents(agentDetails);
                setError(null);
            } catch (err) {
                debug.error('useAgents', 'Error in fetchAgentDetails', err);
                setError('Failed to fetch agents');
                setAgents([]);
            } finally {
                setLoading(false);
            }
        };

        // Reset loading state when registry changes
        setLoading(true);
        fetchAgentDetails();

        // Cleanup function to handle component unmount
        return () => {
            setLoading(true);
            setError(null);
            setAgents([]);
        };
    }, [registry, provider]);

    return {
        agents,
        loading,
        error,
    };
}; 