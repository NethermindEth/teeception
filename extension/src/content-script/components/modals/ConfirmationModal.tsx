import React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from './Dialog'
import { CONFIG } from '../../config'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'
import { debug } from '../../utils/debug'

interface ConfirmationModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal component that shows a confirmation dialog when a user mentions a specific account in their tweet
 */
export const ConfirmationModal = ({ open, onConfirm, onCancel }: ConfirmationModalProps) => {
  debug.log('ConfirmationModal', 'Rendering', { open })

  return (
    <Dialog open={open} onClose={onCancel}>
      <div className="space-y-6">
        <div className="flex gap-4 items-start">
          <div className="space-y-2 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Account Mention Detected
            </h2>
            <p className={cn('text-sm leading-6', 'text-muted-foreground')}>
              You are about to transfer $24 to the agent and tweet a challenge to{' '}
              <span className="font-medium">{CONFIG.accountName}</span>. Are you sure you want to
              proceed?
            </p>
          </div>
        </div>
        {/* Actions */}
        <div className="flex flex-col justify-end gap-3">
          <Button
            variant="default"
            size="lg"
            onClick={() => {
              debug.log('ConfirmationModal', 'Confirm button clicked')
              onConfirm()
            }}
          >
            Confirm and transfer
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => {
              debug.log('ConfirmationModal', 'Cancel button clicked')
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
