import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from './Dialog'
import { cn } from '@/lib/utils'
import { CreditCard, Loader2, CheckCircle2 } from 'lucide-react'
import { debug } from '../../utils/debug'
import { getPromptPrice, getAgentAddressByName, getAgentToken } from '../../utils/contracts'
import { ACTIVE_NETWORK } from '../../config/starknet'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { useContract, useAccount } from '@starknet-react/core'
import { ERC20_ABI } from '@/abis/ERC20_ABI'
import { AGENT_ABI } from '@/abis/AGENT_ABI'
import { uint256, Abi } from 'starknet'

interface TweetPrice {
  price: bigint
  token: string
}

interface PaymentModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  agentName: string
  tweetId: string
}

type TransactionStatus = {
  approve: 'idle' | 'loading' | 'success' | 'error'
  payment: 'idle' | 'loading' | 'success' | 'error'
}

/**
 * Modal component that shows payment confirmation when a user wants to pay for a challenge
 */
export const PaymentModal = ({ open, onConfirm, onCancel, agentName, tweetId }: PaymentModalProps) => {
  const [loading, setLoading] = useState(true)
  const [price, setPrice] = useState<TweetPrice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txStatus, setTxStatus] = useState<TransactionStatus>({
    approve: 'idle',
    payment: 'idle'
  })
  const [agentAddress, setAgentAddress] = useState<string | null>(null)
  const [tokenAddress, setTokenAddress] = useState<string | null>(null)

  const { account } = useAccount()

  // Get contract instances
  const { contract: tokenContract } = useContract({
    abi: ERC20_ABI as Abi,
    address: tokenAddress ? `0x${BigInt(tokenAddress).toString(16).padStart(64, '0')}` : '0x0',
  })

  const { contract: agentContract } = useContract({
    abi: AGENT_ABI as Abi,
    address: agentAddress ? `0x${BigInt(agentAddress).toString(16).padStart(64, '0')}` : '0x0',
  })

  // Get user's token balance
  const { balance: tokenBalance } = useTokenBalance(price?.token || '')

  const fetchPrice = async () => {
    try {
      setLoading(true)
      setError(null)
      setPrice(null)
      setTxStatus({ approve: 'idle', payment: 'idle' })
      
      // Get agent address
      const address = await getAgentAddressByName(agentName)
      debug.log('PaymentModal', 'Got agent address', { address })
      
      if (!address) {
        throw new Error(`Agent ${agentName} not found`)
      }
      setAgentAddress(address)
      
      // Get the agent's token
      const token = await getAgentToken(address)
      debug.log('PaymentModal', 'Got token address', { token })
      setTokenAddress(token)
      
      // Find token symbol from address
      const tokenInfo = Object.entries(ACTIVE_NETWORK.tokens).find(
        ([_, t]) => BigInt(t.address).toString() === token
      )
      debug.log('PaymentModal', 'Found token info', { 
        token,
        foundToken: tokenInfo ? tokenInfo[0] : null,
        allTokens: ACTIVE_NETWORK.tokens
      })

      if (!tokenInfo) {
        throw new Error(`Unsupported token: ${token}`)
      }

      // Get the price for the challenge
      const challengePrice = await getPromptPrice(address)
      debug.log('PaymentModal', 'Got challenge price', { 
        price: challengePrice.toString(),
        token: tokenInfo[0],
        decimals: ACTIVE_NETWORK.tokens[tokenInfo[0]].decimals
      })
      
      setPrice({ price: challengePrice, token: tokenInfo[0] })
    } catch (error) {
      debug.error('PaymentModal', 'Error fetching price', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch challenge price. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchPrice()
    }
  }, [open])

  const formattedPrice = price 
    ? `${Number(price.price) / Math.pow(10, ACTIVE_NETWORK.tokens[price.token].decimals)} ${price.token}`
    : '...'

  // Check if user has sufficient balance
  const hasInsufficientBalance = price && tokenBalance?.balance ? 
    tokenBalance.balance.toString() < price.price.toString() : 
    false

  const getButtonText = () => {
    if (loading) return 'Loading...'
    if (txStatus.approve === 'loading') return 'Approving...'
    if (txStatus.approve === 'success' && txStatus.payment === 'loading') return 'Paying...'
    if (hasInsufficientBalance) return `Insufficient ${price?.token} balance`
    return `Pay ${formattedPrice}`
  }

  const handleConfirm = async () => {
    if (!account || !tokenContract || !agentContract || !price) return

    try {
      setTxStatus(prev => ({ ...prev, approve: 'loading' }))

      // Prepare multicall transactions
      const approveCalldata = {
        contractAddress: tokenContract.address,
        entrypoint: 'approve',
        calldata: [agentContract.address, uint256.bnToUint256(price.price)]
      }

      const payCalldata = {
        contractAddress: agentContract.address,
        entrypoint: 'pay_for_prompt',
        calldata: [BigInt(tweetId)]
      }

      // Execute multicall
      const multicallResult = await account.execute([approveCalldata, payCalldata])
      debug.log('PaymentModal', 'Multicall sent', { multicallResult })

      setTxStatus({ approve: 'success', payment: 'success' })
      onConfirm()
    } catch (error) {
      debug.error('PaymentModal', 'Error executing transactions', error)
      setTxStatus({ approve: 'error', payment: 'error' })
      setError(error instanceof Error ? error.message : 'Transaction failed. Please try again.')
      throw error
    }
  }

  return (
    <Dialog open={open} onClose={onCancel}>
      <div className="space-y-6">
        <div className="flex gap-4 items-start">
          <div className="space-y-2 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Confirm Challenge Payment
            </h2>
            <div className="space-y-4">
              <p className={cn('text-sm leading-6', 'text-muted-foreground')}>
                You're about to pay for a challenge to <span className="font-medium">{agentName}</span>
              </p>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading challenge price...
                </div>
              ) : error ? (
                <div className="space-y-4">
                  <p className="text-sm text-red-500">{error}</p>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      setError(null)
                      setLoading(true)
                      fetchPrice()
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Challenge Fee</div>
                    <div className="text-xl font-medium text-white">{formattedPrice}</div>
                    {tokenBalance && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Balance: {tokenBalance.formatted}
                      </div>
                    )}
                    {hasInsufficientBalance && (
                      <div className="text-sm text-red-500 mt-1">
                        Insufficient balance
                      </div>
                    )}
                  </div>
                  {(txStatus.approve === 'loading' || txStatus.payment === 'loading') && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing transaction...
                    </div>
                  )}
                  {txStatus.approve === 'success' && txStatus.payment === 'success' && (
                    <div className="flex items-center gap-2 text-sm text-green-500">
                      <CheckCircle2 className="w-4 h-4" />
                      Transaction successful!
                    </div>
                  )}
                  <ul className="text-sm leading-6 text-muted-foreground space-y-2 list-disc pl-4">
                    <li>This payment will activate the challenge for this tweet</li>
                    <li>The agent will begin processing your challenge immediately</li>
                    <li>You can view the challenge progress after payment</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="flex flex-col justify-end gap-3">
          {txStatus.approve === 'success' && txStatus.payment === 'success' ? (
            <Button
              variant="default"
              size="lg"
              onClick={onConfirm}
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="default"
                size="lg"
                onClick={handleConfirm}
                disabled={loading || !!error || !price || hasInsufficientBalance || 
                         txStatus.approve === 'loading' || txStatus.payment === 'loading'}
              >
                {loading || txStatus.approve === 'loading' || txStatus.payment === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {getButtonText()}
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={onCancel}
                disabled={txStatus.approve === 'loading' || txStatus.payment === 'loading'}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
} 