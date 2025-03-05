import { NextResponse } from 'next/server'
import { INDEXER_BASE_URL } from '@/constants'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const promptId = searchParams.get('prompt_id')
    const agentAddr = searchParams.get('agent_addr')

    if (!promptId || !agentAddr) {
      return NextResponse.json({ error: 'Prompt ID and Agent Address are required' }, { status: 400 })
    }

    const response = await fetch(`${INDEXER_BASE_URL}/prompt?prompt_id=${promptId}&agent_addr=${agentAddr}`, {
      next: {
        revalidate: 1,
      },
    })

    if (!response || !response.ok) {
      throw new Error(`Indexer API error: ${response.statusText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Prompt API error:', error)
    return NextResponse.json({ error: 'Failed to fetch prompt data' }, { status: 500 })
  }
} 