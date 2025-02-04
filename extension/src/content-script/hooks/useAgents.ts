import { useEffect, useState } from 'react';
import { Contract, Abi } from 'starknet';
import { TEECEPTION_AGENT_ABI } from '@/abis/TEECEPTION_AGENT_ABI';
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
    promptPrice: string;
    prizePool: string;
    pendingPool: string;
    endTime: string;
    isFinalized: boolean;
}

const normalizeAddress = (address: string | number | bigint): string => {
    // If it's a number/bigint, convert to hex string
    if (typeof address === 'number' || typeof address === 'bigint') {
        return `0x${address.toString(16)}`.toLowerCase();
    }
    
    // For string addresses
    const trimmed = address.trim();
    // Remove all 0x prefixes and any leading zeros after that
    const cleanAddr = trimmed.replace(/^(0x)+/, '').replace(/^0+/, '');
    // Add back single 0x prefix
    return `0x${cleanAddr}`.toLowerCase();
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
                setError('Registry not available');
                setLoading(false);
                return;
            }

            try {
                const rawAgentAddresses = await registry.get_agents(0, 100).catch((e: any) => {
                    debug.error('useAgents', 'Failed to get agents from registry', e);
                    throw e;
                });

                if (!Array.isArray(rawAgentAddresses)) {
                    debug.error('useAgents', 'Unexpected response format from get_agents', { rawAgentAddresses });
                    throw new Error('Unexpected response format from get_agents');
                }

                if (rawAgentAddresses.length === 0) {
                    setAgents([]);
                    setError(null);
                    setLoading(false);
                    return;
                }

                const addresses = rawAgentAddresses.map((address: string) => {
                    try {
                        return normalizeAddress(address) as `0x${string}`;
                    } catch (e) {
                        debug.error('useAgents', 'Failed to format address', { address, error: e });
                        throw e;
                    }
                });
                
                const agentDetails = await Promise.all(
                    addresses.map(async (address: `0x${string}`) => {
                        try {
                            const agent = new Contract(TEECEPTION_AGENT_ABI as Abi, address, provider);
                            
                            // Get all agent details in parallel
                            const [
                                nameResult,
                                systemPromptResult,
                                tokenAddress,
                                promptPriceResult,
                                prizePoolResult,
                                pendingPoolResult,
                                endTimeResult,
                                isFinalizedResult
                            ] = await Promise.all([
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
                                }),
                                agent.get_prompt_price().catch((e: any) => {
                                    debug.error('useAgents', 'Error fetching prompt price', { address, error: e });
                                    return { low: 0, high: 0 };
                                }),
                                agent.get_prize_pool().catch((e: any) => {
                                    debug.error('useAgents', 'Error fetching prize pool', { address, error: e });
                                    return { low: 0, high: 0 };
                                }),
                                agent.get_pending_pool().catch((e: any) => {
                                    debug.error('useAgents', 'Error fetching pending pool', { address, error: e });
                                    return { low: 0, high: 0 };
                                }),
                                agent.get_end_time().catch((e: any) => {
                                    debug.error('useAgents', 'Error fetching end time', { address, error: e });
                                    return 0;
                                }),
                                agent.is_finalized().catch((e: any) => {
                                    debug.error('useAgents', 'Error fetching finalized status', { address, error: e });
                                    return false;
                                })
                            ]);

                            const hexTokenAddress = `0x${BigInt(tokenAddress).toString(16)}`;
                            const normalizedTokenAddress = (hexTokenAddress.startsWith('0x') ? 
                                hexTokenAddress : `0x${hexTokenAddress}`).toLowerCase().padStart(66, '0') as `0x${string}`;

                            // Get token params from registry
                            const tokenParams = await registry.get_token_params(tokenAddress).catch((e: any) => {
                                debug.error('useAgents', 'Error fetching token params', { address, tokenAddress, error: e });
                                throw e;
                            });
                            const promptPriceValue = promptPriceResult.low !== undefined ?
                                BigInt(promptPriceResult.low) + (BigInt(promptPriceResult.high || 0) << BigInt(128)) :
                                BigInt(0);

                            const prizePoolValue = prizePoolResult.low !== undefined ?
                                BigInt(prizePoolResult.low) + (BigInt(prizePoolResult.high || 0) << BigInt(128)) :
                                BigInt(0);

                            const pendingPoolValue = pendingPoolResult.low !== undefined ?
                                BigInt(pendingPoolResult.low) + (BigInt(pendingPoolResult.high || 0) << BigInt(128)) :
                                BigInt(0);

                            return {
                                address,
                                name: nameResult?.toString() || 'Unknown',
                                systemPrompt: systemPromptResult?.toString() || 'Error fetching system prompt',
                                token: {
                                    address: normalizedTokenAddress,
                                    minPromptPrice: tokenParams.min_prompt_price.toString(),
                                    minInitialBalance: tokenParams.min_initial_balance.toString(),
                                },
                                promptPrice: promptPriceValue.toString(),
                                prizePool: prizePoolValue.toString(),
                                pendingPool: pendingPoolValue.toString(),
                                endTime: endTimeResult.toString(),
                                isFinalized: isFinalizedResult
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
                                promptPrice: '0',
                                prizePool: '0',
                                pendingPool: '0',
                                endTime: '0',
                                isFinalized: false
                            };
                        }
                    })
                );

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

        setLoading(true);
        fetchAgentDetails();

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