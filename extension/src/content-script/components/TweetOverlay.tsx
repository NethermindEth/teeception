import React from 'react'
import { Check, CreditCard } from 'lucide-react'

interface TweetOverlayProps {
  tweetId: string
  isPaid: boolean
  isOwnTweet: boolean
  onPayClick?: () => void
}

export const TweetOverlay: React.FC<TweetOverlayProps> = ({ 
  tweetId, 
  isPaid, 
  isOwnTweet,
  onPayClick 
}) => {
  if (isPaid) {
    return (
      <div 
        className="absolute top-2 right-2 p-1 rounded-full bg-green-500 text-white cursor-pointer hover:bg-green-600"
        onClick={() => window.open(`https://teeception.ai/tweet/${tweetId}`, '_blank')}
      >
        <Check size={16} />
      </div>
    )
  }

  if (isOwnTweet) {
    return (
      <div 
        className="absolute top-2 right-2 p-1 rounded-full bg-blue-500 text-white cursor-pointer hover:bg-blue-600"
        onClick={onPayClick}
      >
        <CreditCard size={16} />
      </div>
    )
  }

  return null
} 