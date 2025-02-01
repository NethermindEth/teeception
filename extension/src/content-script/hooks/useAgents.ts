import { useEffect, useState } from 'react';
import { Contract, RpcProvider, Abi } from 'starknet';
import { useContract } from '@starknet-react/core';
import { AGENT_REGISTRY_ABI } from '@/abis/AGENT_REGISTRY';
import { AGENT_ABI } from '@/abis/AGENT_ABI';
import { ERC20_ABI } from '@/abis/ERC20_ABI';
import { ACTIVE_NETWORK } from '../config/starknet';
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

    useEffect(() => {
        const fetchAgentDetails = async () => {
            if (!registry) {
                return;
            }

            try {
                const provider = getProvider();
                
                const rawAgentAddresses = await registry.get_agents(0, 100); // Fetch first 100 agents

                const addresses = rawAgentAddresses.map((address: string) => {
                    return `0x${BigInt(address).toString(16)}`;
                });
                
                const agentDetails = await Promise.all(
                    addresses.map(async (address: string) => {
                        try {
                            const agent = new Contract(AGENT_ABI as Abi, address, provider);
                            
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

                            // Get token params from registry
                            const tokenParams = await registry.get_token_params(tokenAddress);
                            const normalizedTokenAddress = `0x${BigInt(tokenAddress).toString(16)}`;
                            
                            // Get token balance
                            const tokenContract = new Contract(ERC20_ABI as Abi, normalizedTokenAddress, provider);
                            const balanceResult = await tokenContract.balance_of(address).catch((e: any) => {
                                debug.error('useAgents', 'Error fetching token balance', { address, error: e });
                                return { low: 0, high: 0 };
                            });

                            const balanceValue = balanceResult.low !== undefined ?
                                BigInt(balanceResult.low) + (BigInt(balanceResult.high || 0) << BigInt(128)) :
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

                setAgents(agentDetails);
                setError(null);
            } catch (err) {
                debug.error('useAgents', 'Error in fetchAgentDetails', err);
                setError('Failed to fetch agents');
            } finally {
                setLoading(false);
            }
        };

        fetchAgentDetails();
    }, [registry]);

    return {
        agents,
        loading,
        error,
    };
}; 