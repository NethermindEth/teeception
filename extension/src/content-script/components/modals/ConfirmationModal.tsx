import { Button } from '@/components/ui/button'
import { Dialog } from './Dialog'
import { cn } from '@/lib/utils'
import { MessageCircle } from 'lucide-react'

interface ConfirmationModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  agentName?: string
  checkForNewTweets: () => void
}

/**
 * Modal component that shows a confirmation dialog when a user mentions a specific account in their tweet
 */
export const ConfirmationModal = ({
  open,
  onConfirm,
  onCancel,
  agentName,
  checkForNewTweets,
}: ConfirmationModalProps) => {
  const handleConfirm = () => {
    onConfirm()
    
    // Try multiple checks with shorter intervals
    const checkIntervals = [100, 200, 300] // Check at 100ms, 200ms, and 300ms after sending
    checkIntervals.forEach(delay => {
      setTimeout(() => {
        checkForNewTweets()
      }, delay)
    })
  }

  return (
    <Dialog open={open} onClose={onCancel}>
      <div className="space-y-6">
        <div className="flex gap-4 items-start">
          <div className="space-y-2 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Challenge Confirmation
            </h2>
            <div className="space-y-4">
              <p className={cn('text-sm leading-6', 'text-muted-foreground')}>
                You're about to send a challenge to <span className="font-medium">{agentName}</span>
              </p>
              <ul className="text-sm leading-6 text-muted-foreground space-y-2 list-disc pl-4">
                <li>Your tweet will be sent to initiate the challenge</li>
                <li>You'll need to pay for the challenge attempt before it's processed</li>
                <li>A button to pay and activate the challenge will appear on your tweet</li>
              </ul>
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="flex flex-col justify-end gap-3">
          <Button
            variant="default"
            size="lg"
            onClick={handleConfirm}
          >
            Send Tweet
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
