import { Contract, RpcProvider, uint256, Abi } from 'starknet'
import { TEECEPTION_AGENT_ABI } from '@/abis/TEECEPTION_AGENT_ABI'
import { TEECEPTION_AGENTREGISTRY_ABI } from '@/abis/TEECEPTION_AGENTREGISTRY_ABI'
import { TEECEPTION_ERC20_ABI } from '@/abis/TEECEPTION_ERC20_ABI'
import { ACTIVE_NETWORK } from '../config/starknet'
import { debug } from './debug'

// Cache for agent addresses by name
const AGENT_ADDRESS_CACHE = new Map<string, string>()
let LAST_CACHE_UPDATE = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Shared provider instance
let provider: RpcProvider | null = null

export const getProvider = () => {
  if (!provider) {
    provider = new RpcProvider({ nodeUrl: ACTIVE_NETWORK.rpc })
  }
  return provider
}

export const normalizeAddress = (address: string | bigint): string => {
  try {
    if (typeof address === 'bigint') {
      // Convert to hex, remove '0x' if present, pad to 64 characters
      const hex = address.toString(16).replace('0x', '').padStart(64, '0')
      return `0x${hex}`
    }
    // If it's already a hex string, ensure proper format
    const hex = address.replace('0x', '').padStart(64, '0')
    return `0x${hex}`
  } catch (error) {
    debug.error('Contracts', 'Error normalizing address', { address, error })
    throw error
  }
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
      TEECEPTION_AGENTREGISTRY_ABI as Abi,
      normalizeAddress(ACTIVE_NETWORK.agentRegistryAddress),
      provider
    )

    // Get all agents
    const agents = await registry.get_agents()

    // Clear old cache
    AGENT_ADDRESS_CACHE.clear()
    LAST_CACHE_UPDATE = Date.now()

    // Check each agent's name
    for (const agentAddress of agents) {
      try {
        const normalizedAddress = normalizeAddress(agentAddress)
        const agent = new Contract(
          TEECEPTION_AGENT_ABI as Abi,
          normalizedAddress,
          provider
        )
        const nameResult = await agent.get_name()
        const name = nameResult.toString()
        
        // Cache the result
        AGENT_ADDRESS_CACHE.set(name, normalizedAddress)

        if (name === agentName) {
          return normalizedAddress
        }
      } catch (error) {
        debug.error('Contracts', 'Error checking agent', { agentAddress, error })
        continue
      }
    }

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
      TEECEPTION_AGENT_ABI as Abi,
      normalizeAddress(agentAddress),
      provider
    )
    
    // Convert tweet ID to uint64
    const tweetIdBN = BigInt(tweetId)
    
    // Call is_prompt_paid function
    const isPaid = await agentContract.is_prompt_paid(tweetIdBN)
    
    return isPaid
  } catch (error) {
    debug.error('Contracts', 'Error checking tweet payment status', error)
    return false
  }
}

/**
 * Approves token spending for a contract
 * @param tokenAddress - The address of the token contract
 * @param spenderAddress - The address of the contract that will spend the tokens
 * @param amount - The amount to approve in smallest token units
 * @param account - The user's account
 */
const approveToken = async (
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint,
  account: any
): Promise<string> => {
  const provider = getProvider()
  const normalizedTokenAddress = normalizeAddress(tokenAddress)
  debug.log('Contracts', 'Approving token', {
    rawTokenAddress: tokenAddress,
    normalizedTokenAddress,
    spenderAddress,
    amount: amount.toString()
  })

  const tokenContract = new Contract(
    TEECEPTION_ERC20_ABI as Abi,
    normalizedTokenAddress,
    provider
  )
  
  tokenContract.connect(account)
  
  const amountUint256 = uint256.bnToUint256(amount)
  const result = await tokenContract.approve(spenderAddress, amountUint256)
  
  return result.transaction_hash
}

/**
 * Pays for a tweet challenge
 * @param agentAddress - The address of the agent contract
 * @param tweetId - The ID of the tweet to pay for
 * @param account - The user's account to send the transaction from
 * @returns Promise that resolves to the transaction hash
 */
export const payForTweet = async (agentAddress: string, tweetId: string, account: any): Promise<string> => {
  try {
    debug.log('Contracts', 'Paying for tweet', { 
      agentAddress, 
      tweetId,
      accountAddress: account.address
    })

    const provider = getProvider()
    const agentContract = new Contract(
      TEECEPTION_AGENT_ABI as Abi,
      normalizeAddress(agentAddress),
      provider
    )
    
    // Get token and price
    const tokenAddress = await getAgentToken(agentAddress)
    const price = await getPromptPrice(agentAddress)
    
    debug.log('Contracts', 'Approving token spend', {
      tokenAddress,
      price: price.toString()
    })

    // Approve token spending
    await approveToken(tokenAddress, agentAddress, price, account)
    
    // Connect the contract to the user's account
    agentContract.connect(account)
    
    // Convert tweet ID to uint64
    const tweetIdBN = BigInt(tweetId)
    
    // Call pay_for_prompt function
    const result = await agentContract.pay_for_prompt(tweetIdBN)
    
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
      TEECEPTION_AGENT_ABI as Abi,
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

/**
 * Gets the token address used by an agent
 * @param agentAddress - The address of the agent contract
 * @returns Promise that resolves to the token address
 */
export async function getAgentToken(agentAddress: string): Promise<string> {
  try {
    const provider = getProvider()
    const contract = new Contract(TEECEPTION_AGENT_ABI as Abi, normalizeAddress(agentAddress), provider)
    const token = await contract.get_token()
    return token.toString()
  } catch (error) {
    debug.error('Contracts', 'Error getting agent token', error)
    throw error
  }
} 