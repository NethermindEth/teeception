import { Contract } from 'starknet'
import { AGENT_ABI } from '../../abis/AGENT_ABI'
import { AGENT_REGISTRY_COPY_ABI } from '../../abis/AGENT_REGISTRY'
import { ACTIVE_NETWORK } from '../config/starknet'
import { debug } from './debug'

// Cache for agent addresses by name
const AGENT_ADDRESS_CACHE = new Map<string, string>()
let LAST_CACHE_UPDATE = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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

    // Create registry contract instance
    const registryContract = new Contract(
      AGENT_REGISTRY_COPY_ABI,
      ACTIVE_NETWORK.agentRegistryAddress
    )

    // Get all agents
    const agents = await registryContract.get_agents()
    debug.log('Contracts', 'Got agents from registry', { count: agents.length })

    // Clear old cache
    AGENT_ADDRESS_CACHE.clear()
    LAST_CACHE_UPDATE = Date.now()

    // Check each agent's name
    for (const agentAddress of agents) {
      const agentContract = new Contract(AGENT_ABI, agentAddress)
      const nameResult = await agentContract.get_name()
      const name = nameResult.toString()
      
      // Cache the result
      AGENT_ADDRESS_CACHE.set(name, agentAddress)

      if (name === agentName) {
        debug.log('Contracts', 'Found agent address', { name, address: agentAddress })
        return agentAddress
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
    const agentContract = new Contract(AGENT_ABI, agentAddress)
    
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
    const agentContract = new Contract(AGENT_ABI, agentAddress)
    
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
    const agentContract = new Contract(AGENT_ABI, agentAddress)
    const price = await agentContract.get_prompt_price()
    return price
  } catch (error) {
    debug.error('Contracts', 'Error getting prompt price', error)
    throw error
  }
} 