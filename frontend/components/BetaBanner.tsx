'use client'

import React, { useState, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface BetaBannerProps {
  onDismiss?: () => void
  persistDismissal?: boolean
}

export const BetaBanner: React.FC<BetaBannerProps> = ({ onDismiss, persistDismissal = true }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    // Check for dismissal after component mounts to prevent hydration mismatch
    if (persistDismissal) {
      const dismissed = localStorage.getItem('betaBannerDismissed')
      if (dismissed !== 'true') {
        // Only show if not dismissed
        setIsVisible(true)
      }
    } else {
      setIsVisible(true)
    }

    const animationInterval = setInterval(() => {
      setIsAnimating((prev) => !prev)
    }, 5000)

    return () => clearInterval(animationInterval)
  }, [persistDismissal])

  const handleDismiss = () => {
    setIsVisible(false)
    if (persistDismissal) {
      localStorage.setItem('betaBannerDismissed', 'true')
    }
    if (onDismiss) {
      onDismiss()
    }
  }

  // Always render a placeholder div to prevent layout shifts
  // Only animate content when visible
  return (
    <div className="beta-banner-container">
      {isMounted && (
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`w-full bg-[#12121266] border-b border-white/60  text-white transition duration-500 ease-in-out ${
                isAnimating ? 'bg-opacity-90' : 'bg-opacity-100'
              }`}
            >
              <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between flex-wrap">
                  <div className="flex items-center">
                    <span className="flex p-2 rounded-lg bg-[#121212] bg-opacity-70 -mt-[2px]">
                      <AlertTriangle
                        className={`h-5 w-5 text-[#E53922] transition-transform duration-700 ${
                          isAnimating ? 'scale-110' : 'scale-100'
                        }`}
                      />
                    </span>
                    <p className="font-medium truncate">
                      <span className="md:hidden text-[#B5B5B5]">
                        Beta on Sepolia. Bugs expected.
                      </span>
                      <span className="hidden md:inline">
                        <span className="font-bold text-white uppercase">BETA LAUNCH:</span>{' '}
                        <span className="text-[#B5B5B5]">
                          Teeception is live on Sepolia testnet! Expect some bugs as we optimize —
                          your feedback helps us improve!
                        </span>
                      </span>
                    </p>
                  </div>
                  <div className="order-2 flex-shrink-0 sm:order-3 sm:ml-3">
                    <button
                      type="button"
                      onClick={handleDismiss}
                      className="-mr-1 flex p-2 rounded-md hover:bg-[#121212] focus:outline-none focus:ring-2 focus:ring-[#558EB4] sm:-mr-2 transition-colors duration-200"
                    >
                      <span className="sr-only">Dismiss</span>
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
