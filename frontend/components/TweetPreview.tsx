'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Tweet } from 'react-tweet'

interface TweetPreviewProps {
  tweetId: string | null
  isPaid?: boolean
}

export function TweetPreview({ tweetId, isPaid = false }: TweetPreviewProps) {
  if (!tweetId) return null

  return (
    <div className="border border-[#6F6F6F] rounded-lg p-4">
      {isPaid && (
        <div className="text-sm text-green-500 font-medium mb-4">
          Paid ✓
        </div>
      )}
      <div className="tweet-embed [&_div]:!bg-transparent [&_article]:!bg-transparent">
        <Tweet id={tweetId} />
      </div>
    </div>
  )
}

// Add TypeScript type for Twitter widgets
declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: () => void
      }
    }
  }
} 