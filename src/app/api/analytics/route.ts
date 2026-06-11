import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tournamentId, eventType, path, visitorId, metadata } = body

    if (!eventType || !path || !visitorId) {
      return NextResponse.json({ error: 'Missing required tracking fields' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { error } = await supabase
      .from('tournament_analytics')
      .insert({
        tournament_id: tournamentId || null,
        event_type: eventType,
        path,
        visitor_id: visitorId,
        metadata: metadata || {}
      })

    if (error) {
      console.error('Error inserting analytics event:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Analytics endpoint error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
