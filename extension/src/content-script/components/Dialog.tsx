import React, { useEffect } from 'react'
import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export const Dialog = ({ open, onClose, children }: DialogProps) => {
  if (!open) return null

  // Enable pointer events when dialog is open
  useEffect(() => {
    const container = document.getElementById('jack-the-ether-modal-container')
    if (container) {
      container.style.pointerEvents = 'auto'
      return () => {
        container.style.pointerEvents = 'none'
      }
    }
  }, [])

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
        "fixed inset-0 z-50",
        "bg-background/80 backdrop-blur-sm",
        "flex items-center justify-center",
        "animate-in fade-in-0 duration-200"
      )}
      style={{ pointerEvents: 'auto' }}
      onClick={handleBackdropClick}
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
    >
      <div 
        className={cn(
          "relative",
          "bg-background",
          "rounded-lg border shadow-lg",
          "w-[90vw] max-w-[440px]",
          "p-6",
          "animate-in zoom-in-95 duration-200"
        )}
        style={{ pointerEvents: 'auto' }}
        onClick={handleContentClick}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
} 