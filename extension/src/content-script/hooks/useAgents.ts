import { useEffect, useState } from 'react';
import { Contract, Abi } from 'starknet';
import { TEECEPTION_AGENT_ABI } from '@/abis/TEECEPTION_AGENT_ABI';
import { TEECEPTION_ERC20_ABI } from '@/abis/TEECEPTION_ERC20_ABI';
import { debug } from '../utils/debug';
import { useAgentRegistry } from './useAgentRegistry';
import { getProvider } from '../utils/contracts';
import { byteArray } from 'starknet';
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
                debug.log('useAgents', 'Registry not available yet');
                setError('Registry not available');
                setLoading(false);
                return;
            }

            try {
                debug.log('useAgents', 'Starting to fetch agents');
                
                const rawAgentAddresses = await registry.get_agents(0, 100).catch((e: any) => {
                    debug.error('useAgents', 'Failed to get agents from registry', e);
                    throw e;
                });
                
                debug.log('useAgents', 'Got raw agent addresses', { rawAgentAddresses });

                if (!Array.isArray(rawAgentAddresses)) {
                    debug.error('useAgents', 'Unexpected response format from get_agents', { rawAgentAddresses });
                    throw new Error('Unexpected response format from get_agents');
                }

                if (rawAgentAddresses.length === 0) {
                    debug.log('useAgents', 'No agents found');
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
                
                debug.log('useAgents', 'Formatted addresses', { addresses });

                const agentDetails = await Promise.all(
                    addresses.map(async (address: `0x${string}`) => {
                        try {
                            debug.log('useAgents', 'Initializing agent contract', { address });
                            
                            const agent = new Contract(TEECEPTION_AGENT_ABI as Abi, address, provider);
                            
                            debug.log('useAgents', 'Fetching agent details', { address });
                            
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

                            debug.log('useAgents', 'Got agent details', { 
                                address, 
                                name: nameResult, 
                                systemPrompt: systemPromptResult,
                                tokenAddress,
                                promptPrice: promptPriceResult,
                                prizePool: prizePoolResult,
                                pendingPool: pendingPoolResult,
                                endTime: endTimeResult,
                                isFinalized: isFinalizedResult
                            });

                            const hexTokenAddress = `0x${BigInt(tokenAddress).toString(16)}`;
                            const normalizedTokenAddress = (hexTokenAddress.startsWith('0x') ? 
                                hexTokenAddress : `0x${hexTokenAddress}`).toLowerCase().padStart(66, '0') as `0x${string}`;

                            // Get token params from registry
                            const tokenParams = await registry.get_token_params(tokenAddress).catch((e: any) => {
                                debug.error('useAgents', 'Error fetching token params', { address, tokenAddress, error: e });
                                throw e;
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
                                balance: balanceValue.toString(),
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