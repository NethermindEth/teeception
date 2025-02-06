import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from './Dialog'
import { cn } from '@/lib/utils'
import { CreditCard, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { debug } from '../../utils/debug'
import { getPromptPrice, getAgentAddressByName, getAgentToken } from '../../utils/contracts'
import { ACTIVE_NETWORK } from '../../config/starknet'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { useContract, useAccount, useSendTransaction } from '@starknet-react/core'
import { TEECEPTION_ERC20_ABI } from '@/abis/TEECEPTION_ERC20_ABI'
import { TEECEPTION_AGENT_ABI } from '@/abis/TEECEPTION_AGENT_ABI'
import { uint256 } from 'starknet'
import { SELECTORS } from '../../constants/selectors'
import { Contract } from 'starknet'
import { provider } from '../../config/starknet'
import { cleanPromptText } from '@/content-script/utils/twitter'

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
  updateBanner?: (tweetId: string) => void
  checkUnpaidTweets?: () => void
  markTweetAsPaid?: (tweetId: string) => void
}

type TransactionStatus = {
  approve: 'idle' | 'loading' | 'success' | 'error'
  payment: 'idle' | 'loading' | 'success' | 'error'
}

/**
 * Modal component that shows payment confirmation when a user wants to pay for a challenge
 */
export const PaymentModal = ({
  open,
  onConfirm,
  onCancel,
  agentName,
  tweetId,
  updateBanner,
  checkUnpaidTweets,
  markTweetAsPaid,
}: PaymentModalProps) => {
  const [loading, setLoading] = useState(true)
  const [price, setPrice] = useState<TweetPrice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existingAttempts, setExistingAttempts] = useState<bigint>(0n)
  const [txStatus, setTxStatus] = useState<TransactionStatus>({
    approve: 'idle',
    payment: 'idle',
  })
  const [agentAddress, setAgentAddress] = useState<string | null>(null)
  const [tokenAddress, setTokenAddress] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [shouldRemount, setShouldRemount] = useState(true)

  const { account } = useAccount()

  // Get contract instances
  const { contract: tokenContract } = useContract({
    abi: TEECEPTION_ERC20_ABI,
    address: tokenAddress ? `0x${BigInt(tokenAddress).toString(16).padStart(64, '0')}` : '0x0',
  })

  const { contract: agentContract } = useContract({
    abi: TEECEPTION_AGENT_ABI,
    address: agentAddress ? `0x${BigInt(agentAddress).toString(16).padStart(64, '0')}` : '0x0',
  })

  // Get user's token balance
  const { balance: tokenBalance } = useTokenBalance(price?.token || '')

  const { sendAsync } = useSendTransaction({
    calls: useMemo(() => {
      if (!tokenContract || !agentContract || !price) return undefined

      try {
        const tweetIdBigInt = BigInt(tweetId)

        // Find the specific tweet by ID
        const tweetElement = document
          .querySelector(`article[data-testid="tweet"] a[href*="/${tweetId}"]`)
          ?.closest('article[data-testid="tweet"]')
        const tweetTextElement = tweetElement?.querySelector(SELECTORS.TWEET_TEXT)
        const tweetText = tweetTextElement?.textContent || ''

        if (!tweetText) {
          debug.error('PaymentModal', 'Could not find tweet text', {
            tweetId,
            tweetElement: !!tweetElement,
            tweetTextElement: !!tweetTextElement,
          })
          return undefined
        }

        return [
          tokenContract.populate('approve', [
            agentContract.address,
            uint256.bnToUint256(price.price),
          ]),
          agentContract.populate('pay_for_prompt', [tweetIdBigInt, cleanPromptText(tweetText)]),
        ]
      } catch (error) {
        debug.error('PaymentModal', 'Error preparing transaction calls:', error)
        return undefined
      }
    }, [tokenContract, agentContract, price, tweetId]),
  })

  const fetchPrice = async () => {
    try {
      setLoading(true)
      setError(null)
      setPrice(null)
      setExistingAttempts(0n)
      setTxStatus({ approve: 'idle', payment: 'idle' })

      // Get agent address
      const address = await getAgentAddressByName(agentName)
      if (!address) {
        throw new Error(`Agent ${agentName} not found`)
      }
      setAgentAddress(address)

      // Get the agent's token
      const token = await getAgentToken(address)
      setTokenAddress(token)

      // Check if user has already paid for this tweet
      if (account?.address) {
        try {
          // Create contract instance with properly formatted address
          const formattedAddress = `0x${BigInt(address).toString(16).padStart(64, '0')}`

          const agentContract = new Contract(TEECEPTION_AGENT_ABI, formattedAddress, provider)

          const userPromptCount = await agentContract.get_user_tweet_prompts_count(
            `0x${BigInt(account.address).toString(16).padStart(64, '0')}`,
            BigInt(tweetId)
          )

          setExistingAttempts(userPromptCount)
        } catch (error) {
          debug.error('PaymentModal', 'Error getting prompt count', error)
          // Don't throw here, just log the error and continue
        }
      } else {
      }

      // Find token symbol from address
      const tokenInfo = Object.entries(ACTIVE_NETWORK.tokens).find(
        ([_, t]) => BigInt(t.address).toString() === token
      )

      if (!tokenInfo) {
        throw new Error(`Unsupported token: ${token}`)
      }

      // Get the price for the challenge
      const challengePrice = await getPromptPrice(address)

      setPrice({ price: challengePrice, token: tokenInfo[0] })
    } catch (error) {
      debug.error('PaymentModal', 'Error fetching price', error)
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to fetch challenge price. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchPrice()
    }
  }, [open, account?.address]) // Also refetch when wallet changes

  const formattedPrice = price
    ? `${Number(price.price) / Math.pow(10, ACTIVE_NETWORK.tokens[price.token].decimals)} ${
        price.token
      }`
    : '...'

  // Check if user has sufficient balance
  const hasInsufficientBalance =
    price && tokenBalance?.balance
      ? tokenBalance.balance.toString() < price.price.toString()
      : false

  const getButtonText = () => {
    if (loading) return 'Loading...'
    if (txStatus.approve === 'loading') return 'Processing Transaction...'
    if (txStatus.approve === 'success' && txStatus.payment === 'loading')
      return 'Processing Payment...'
    if (hasInsufficientBalance) return `Insufficient ${price?.token} balance`
    return `Pay ${formattedPrice}`
  }

  const handleConfirm = async () => {
    if (!account || !tokenContract || !agentContract || !price) return

    try {
      setTxStatus((prev) => ({ ...prev, approve: 'loading' }))
      //Note: We unmounting the component to fix occlusion issue which disables click event in cartridge payment modal
      setShouldRemount(false)
      setIsExecuting(true)
      await new Promise((resolve) => setTimeout(resolve, 100))

      const response = await sendAsync()

      if (response?.transaction_hash) {
        await account.waitForTransaction(response.transaction_hash)
        setTxStatus({ approve: 'success', payment: 'success' })

        // Mark the tweet as temporarily paid and update UI immediately
        if (markTweetAsPaid) {
          markTweetAsPaid(tweetId)
        }
        if (updateBanner) {
          updateBanner(tweetId)
        }

        // Only check once after a reasonable delay to confirm chain state
        setTimeout(() => {
          if (checkUnpaidTweets) {
            checkUnpaidTweets()
          }
        }, 5000) // Single check after 5 seconds

        onConfirm()
      }
    } catch (error) {
      debug.error('PaymentModal', 'Error executing transactions', error)
      setTxStatus({ approve: 'error', payment: 'error' })
      setError(error instanceof Error ? error.message : 'Transaction failed. Please try again.')
      throw error
    } finally {
      setIsExecuting(false)
      //Here we remount again :)
      setTimeout(() => {
        setShouldRemount(true)
      }, 100)
    }
  }

  if (!shouldRemount || isExecuting) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50">
        <div className="bg-background p-6 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing transaction...</span>
          </div>
        </div>
      </div>
    )
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
                You're about to pay for a challenge to{' '}
                <span className="font-medium">{agentName}</span>
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
                    variant="secondary"
                    onClick={() => {
                      setError(null)
                      setLoading(true)
                      fetchPrice()
                    }}
                    className="bg-gray-800 hover:bg-gray-700 text-white"
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {existingAttempts > 0n && (
                    <div className="flex items-center gap-2 p-4 bg-yellow-500/10 rounded-lg text-yellow-500">
                      <AlertTriangle className="w-5 h-5" />
                      <div>
                        <p className="text-sm font-medium">
                          You've paid for this challenge {existingAttempts.toString()} time
                          {existingAttempts === 1n ? '' : 's'} before
                        </p>
                        <p className="text-sm text-yellow-500/80">
                          You can always pay to run the same tweet against {agentName} again to get
                          a new response. Are you sure you want to pay for another attempt?
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-white/5 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Challenge Fee</div>
                    <div className="text-xl font-medium text-white">{formattedPrice}</div>
                    {tokenBalance && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Balance: {tokenBalance.formatted}
                      </div>
                    )}
                    {hasInsufficientBalance && (
                      <div className="text-sm text-red-500 mt-1">Insufficient balance</div>
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
            <Button variant="default" size="lg" onClick={onCancel}>
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="default"
                size="lg"
                onClick={handleConfirm}
                disabled={
                  loading ||
                  !!error ||
                  !price ||
                  hasInsufficientBalance ||
                  txStatus.approve === 'loading' ||
                  txStatus.payment === 'loading'
                }
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
