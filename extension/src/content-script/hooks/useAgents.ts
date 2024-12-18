import { useEffect, useState } from 'react';
import { Contract, RpcProvider } from 'starknet';
import { AGENT_REGISTRY_COPY_ABI } from '@/abis/AGENT_REGISTRY';
import { AGENT_ABI } from '@/abis/AGENT_ABI';
import { ERC20_ABI } from '@/abis/ERC20_ABI';
import { CONFIG } from '../config';

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
            if (!registryAddress) {
                setLoading(false);
                return;
            }

            try {
                const provider = new RpcProvider({ nodeUrl: CONFIG.nodeUrl });
                const registry = new Contract(AGENT_REGISTRY_COPY_ABI, registryAddress, provider);

                const tokenAddressRaw = await registry.get_token();
                const tokenAddress = `0x${BigInt(tokenAddressRaw).toString(16)}`;
                const tokenContract = new Contract(ERC20_ABI, tokenAddress, provider);

                const rawAgentAddresses = await registry.get_agents();
                const agentAddresses = rawAgentAddresses.map((address: string) => {
                    return `0x${BigInt(address).toString(16)}`;
                });

                const agentDetails = await Promise.all(
                    agentAddresses.map(async (address: string) => {
                        try {
                            const agent = new Contract(AGENT_ABI, address, provider);
                            const nameResult = await agent.get_name().catch((e: any) => {
                                console.error(`[useAgents] Error fetching name for agent ${address}:`, e);
                                return 'Unknown';
                            });
                            const systemPromptResult = await agent.get_system_prompt().catch((e: any) => {
                                console.error(`[useAgents] Error fetching system prompt for agent ${address}:`, e);
                                return 'Error fetching system prompt';
                            });
                            const balanceResult = await tokenContract.balance_of(address).catch((e: any) => {
                                console.error(`[useAgents] Error fetching token balance for agent ${address}:`, e);
                                return { low: 0, high: 0 };
                            });
                            const balanceValue = balanceResult.low !== undefined ?
                                BigInt(balanceResult.low) + (BigInt(balanceResult.high || 0) << BigInt(128)) :
                                BigInt(0);

                            const result = {
                                address,
                                name: nameResult?.toString() || 'Unknown',
                                systemPrompt: systemPromptResult?.toString() || 'Error fetching system prompt',
                                balance: balanceValue.toString(),
                            };
                            return result;
                        } catch (err) {
                            console.error(`[useAgents] Error processing agent ${address}:`, err);
                            return {
                                address,
                                name: 'Error',
                                systemPrompt: 'Error fetching agent details',
                                balance: '0',
                            };
                        }
                    })
                );

                setAgents(agentDetails);
                setError(null);
            } catch (err) {
                console.error('[useAgents] Error in fetchAgents:', err);
                setError('Failed to fetch agents');
            } finally {
                setLoading(false);
            }
        };
        fetchAgents();
    }, [registryAddress]);

    return { agents, loading, error };
} 