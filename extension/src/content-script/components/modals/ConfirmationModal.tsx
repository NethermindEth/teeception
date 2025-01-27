import React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from './Dialog'
import { cn } from '@/lib/utils'
import { AlertTriangle, MessageCircle } from 'lucide-react'
import { debug } from '../../utils/debug'

interface ConfirmationModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  agentName?: string
}

/**
 * Modal component that shows a confirmation dialog when a user mentions a specific account in their tweet
 */
export const ConfirmationModal = ({
  open,
  onConfirm,
  onCancel,
  agentName,
}: ConfirmationModalProps) => {
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
            onClick={() => {
              onConfirm()
            }}
          >
            Send Tweet
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => {
              onCancel()
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
