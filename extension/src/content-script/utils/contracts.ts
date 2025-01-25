import { Contract, RpcProvider } from 'starknet'
import { AGENT_ABI } from '../../abis/AGENT_ABI'
import { AGENT_REGISTRY_COPY_ABI } from '../../abis/AGENT_REGISTRY'
import { ACTIVE_NETWORK } from '../config/starknet'
import { debug } from './debug'

// Cache for agent addresses by name
const AGENT_ADDRESS_CACHE = new Map<string, string>()
let LAST_CACHE_UPDATE = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Shared provider instance
let provider: RpcProvider | null = null

const getProvider = () => {
  if (!provider) {
    provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc })
  }
  return provider
}

const normalizeAddress = (address: string | bigint): string => {
  if (typeof address === 'bigint') {
    return '0x' + address.toString(16)
  }
  return address.startsWith('0x') ? address : '0x' + address
}

/**
 * Gets an agent's address by name
 * @param agentName - The name of the agent
 * @returns Promise that resolves to the agent's address or null if not found
 */
export const getAgentAddressByName = async (agentName: string): Promise<string | null> => {
  try {
    // Check cache first
    if (AGENT_ADDRESS_CACHE.has(agentName)) {
      // If cache is still fresh, use it
      if (Date.now() - LAST_CACHE_UPDATE < CACHE_TTL) {
        return AGENT_ADDRESS_CACHE.get(agentName) || null
      }
    }

    const provider = getProvider()
    const registry = new Contract(
      AGENT_REGISTRY_COPY_ABI,
      normalizeAddress(ACTIVE_NETWORK.agentRegistryAddress),
      provider
    )

    // Get all agents
    const agents = await registry.get_agents()
    debug.log('Contracts', 'Got agents from registry', { count: agents.length })

    // Clear old cache
    AGENT_ADDRESS_CACHE.clear()
    LAST_CACHE_UPDATE = Date.now()

    // Check each agent's name
    for (const agentAddress of agents) {
      try {
        const normalizedAddress = normalizeAddress(agentAddress)
        const agent = new Contract(
          AGENT_ABI,
          normalizedAddress,
          provider
        )
        const nameResult = await agent.get_name()
        const name = nameResult.toString()
        
        // Cache the result
        AGENT_ADDRESS_CACHE.set(name, normalizedAddress)

        if (name === agentName) {
          debug.log('Contracts', 'Found agent address', { name, address: normalizedAddress })
          return normalizedAddress
        }
      } catch (error) {
        debug.error('Contracts', 'Error checking agent', { agentAddress, error })
        continue
      }
    }

    debug.log('Contracts', 'Agent not found', { agentName })
    return null
  } catch (error) {
    debug.error('Contracts', 'Error getting agent address', error)
    return null
  }
}

/**
 * Checks if a tweet has been paid for
 * @param agentAddress - The address of the agent contract
 * @param tweetId - The ID of the tweet to check
 * @returns Promise that resolves to true if the tweet has been paid for
 */
export const checkTweetPaid = async (agentAddress: string, tweetId: string): Promise<boolean> => {
  try {
    const provider = getProvider()
    const agentContract = new Contract(
      AGENT_ABI,
      normalizeAddress(agentAddress),
      provider
    )
    
    // Convert tweet ID to uint64
    const tweetIdBN = BigInt(tweetId)
    
    // Call is_prompt_paid function
    const isPaid = await agentContract.is_prompt_paid(tweetIdBN)
    
    debug.log('Contracts', 'Checked tweet payment status', { tweetId, isPaid })
    return isPaid
  } catch (error) {
    debug.error('Contracts', 'Error checking tweet payment status', error)
    return false
  }
}

/**
 * Pays for a tweet challenge
 * @param agentAddress - The address of the agent contract
 * @param tweetId - The ID of the tweet to pay for
 * @returns Promise that resolves to the transaction hash
 */
export const payForTweet = async (agentAddress: string, tweetId: string): Promise<string> => {
  try {
    const provider = getProvider()
    const agentContract = new Contract(
      AGENT_ABI,
      normalizeAddress(agentAddress),
      provider
    )
    
    // Convert tweet ID to uint64
    const tweetIdBN = BigInt(tweetId)
    
    // Call pay_for_prompt function
    const result = await agentContract.pay_for_prompt(tweetIdBN)
    
    debug.log('Contracts', 'Payment transaction sent', { result })
    return result.transaction_hash
  } catch (error) {
    debug.error('Contracts', 'Error paying for tweet', error)
    throw error
  }
}

/**
 * Gets the price for challenging an agent
 * @param agentAddress - The address of the agent contract
 * @returns Promise that resolves to the price in wei
 */
export const getPromptPrice = async (agentAddress: string): Promise<bigint> => {
  try {
    const provider = getProvider()
    const agentContract = new Contract(
      AGENT_ABI,
      normalizeAddress(agentAddress),
      provider
    )
    const price = await agentContract.get_prompt_price()
    return price
  } catch (error) {
    debug.error('Contracts', 'Error getting prompt price', error)
    throw error
  }
} 