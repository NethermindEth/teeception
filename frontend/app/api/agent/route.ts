import { NextResponse } from 'next/server'
import { INDEXER_BASE_URL } from '@/constants'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    if (!name) {
      return NextResponse.json({ error: 'Name parameter is required' }, { status: 400 })
    }

    const response = await fetch(`${INDEXER_BASE_URL}/search?name=${encodeURIComponent(name)}`, {
      next: {
        revalidate: 30,
      },
    })

    if (!response.ok) {
      throw new Error(`Indexer API error: ${response.statusText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Failed to fetch agent data' }, { status: 500 })
  }
}
