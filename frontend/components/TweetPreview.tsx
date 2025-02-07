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
    <div className="flex flex-col items-center">
      <div className="tweet-embed [&_div]:!bg-transparent [&_article]:!bg-transparent max-w-[550px] mx-auto w-full">
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