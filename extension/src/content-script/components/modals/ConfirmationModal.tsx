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
        {/* Header with Icon */}
        <div className="flex gap-4 items-start">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
          </div>
          <div className="space-y-2 flex-1">
            <h2
              className={cn('text-xl font-semibold tracking-tight', 'text-black dark:text-white')}
            >
              Account Mention Detected
            </h2>
            <p className={cn('text-sm leading-6', 'text-muted-foreground')}>
              You're about to tweet a message mentioning{' '}
              <span className="font-medium text-foreground">{CONFIG.accountName}</span>. Are you
              sure you want to proceed?
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              debug.log('ConfirmationModal', 'Cancel button clicked')
              onCancel()
            }}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={() => {
              debug.log('ConfirmationModal', 'Confirm button clicked')
              onConfirm()
            }}
          >
            Confirm and transfer
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
