import { NextResponse } from 'next/server'
import { INDEXER_BASE_URL } from '@/constants'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') ?? '0'
    const pageSize = searchParams.get('page_size') ?? '10'

    const response = await fetch(
      `${INDEXER_BASE_URL}/leaderboard?page=${page}&page_size=${pageSize}`,
      {
        next: {
          revalidate: 30,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Indexer API error: ${response.statusText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Leaderboard API error:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 })
  }
}
