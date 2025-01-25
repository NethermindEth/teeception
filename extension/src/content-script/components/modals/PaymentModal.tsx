import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from './Dialog'
import { CONFIG } from '../../config'
import { cn } from '@/lib/utils'
import { CreditCard, Loader2 } from 'lucide-react'
import { debug } from '../../utils/debug'
import { getPromptPrice, getAgentAddressByName, getAgentToken } from '../../utils/contracts'
import { ACTIVE_NETWORK } from '../../config/starknet'

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

/**
 * Modal component that shows payment confirmation when a user wants to pay for a challenge
 */
export const PaymentModal = ({ open, onConfirm, onCancel, agentName, tweetId }: PaymentModalProps) => {
  const [loading, setLoading] = useState(true)
  const [price, setPrice] = useState<TweetPrice | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPrice = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get agent address
      const agentAddress = await getAgentAddressByName(agentName)
      if (!agentAddress) {
        throw new Error(`Agent ${agentName} not found`)
      }
      
      // Get the agent's token
      const tokenAddress = await getAgentToken(agentAddress)
      // Find token symbol from address
      const token = Object.entries(ACTIVE_NETWORK.tokens).find(
        ([_, t]) => t.address.toLowerCase() === tokenAddress.toLowerCase()
      )
      if (!token) {
        throw new Error('Unsupported token')
      }

      // Get the price for the challenge
      const challengePrice = await getPromptPrice(agentAddress)
      setPrice({ price: challengePrice, token: token[0] })
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
                  </div>
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
          <Button
            variant="default"
            size="lg"
            onClick={onConfirm}
            disabled={loading || !!error || !price}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>Pay {formattedPrice}</>
            )}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  )
} 