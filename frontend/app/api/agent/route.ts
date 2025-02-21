import { NextResponse } from 'next/server'
import { INDEXER_BASE_URL } from '@/constants'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')
    const address = searchParams.get('address')

    if (!name && !address) {
      return NextResponse.json({ error: 'Name or Address parameter is required' }, { status: 400 })
    }
    let response: Response | null = null
    if (name) {
      response = await fetch(`${INDEXER_BASE_URL}/search?name=${encodeURIComponent(name)}`, {
        next: {
          revalidate: 1,
        },
      })
    } else {
      response = await fetch(`${INDEXER_BASE_URL}/agent/${address}`, {
        next: {
          revalidate: 1,
        },
      })
    }

    if (!response || !response.ok) {
      throw new Error(`Indexer API error: ${response.statusText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Failed to fetch agent data' }, { status: 500 })
  }
}
