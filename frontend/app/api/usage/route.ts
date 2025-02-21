import { NextResponse } from 'next/server'
import { INDEXER_BASE_URL } from '@/constants'

export async function GET() {
  try {
    const response = await fetch(`${INDEXER_BASE_URL}/usage`, {
      next: {
        revalidate: 1,
      },
    })

    if (!response.ok) {
      throw new Error(`Indexer API error: ${response.statusText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 })
  }
}
