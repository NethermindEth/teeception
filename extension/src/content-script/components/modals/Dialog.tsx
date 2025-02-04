import React from 'react'
import { cn } from '@/lib/utils'

interface DialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the dialog should close */
  onClose: () => void
  /** Dialog content */
  children: React.ReactNode
}

/**
 * A modal dialog component that displays content in a centered overlay
 * Features:
 * - Backdrop blur effect
 * - Click outside to close
 * - Smooth animations
 * - Event isolation from parent elements
 */
export const Dialog = ({ open, onClose, children }: DialogProps) => {
  if (!open) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }

  const handleContentClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50',
        'bg-background/80 backdrop-blur-sm',
        'flex items-center justify-center',
        'animate-in fade-in-0 duration-200'
      )}
      onClick={handleBackdropClick}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          'relative',
          'bg-black text-white',
          'rounded-lg border shadow-lg',
          'w-[90vw] max-w-[440px]',
          'p-6',
          'animate-in zoom-in-95 duration-200'
        )}
        onClick={handleContentClick}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
