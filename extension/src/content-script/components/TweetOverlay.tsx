import React from 'react'

interface TweetOverlayProps {
  tweetId: string
  isPaid: boolean
  isOwnTweet: boolean
  onPayClick?: () => void
  isRegisteredAgent: boolean
}

export const TweetOverlay: React.FC<TweetOverlayProps> = ({ 
  isRegisteredAgent
}) => {
  if (!isRegisteredAgent) return null

  return (
    <div 
      className="absolute inset-0 border-2 border-red-500 pointer-events-none rounded-2xl"
    />
  )
} 