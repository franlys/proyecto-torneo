import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/cron/decay
// Trigger rankings decay for inactive players.
// Can be secured via Vercel Cron headers or secret search param.
export async function GET(request: Request) {
  try {
    // 1. Optional security check for Vercel Cron header
    const authHeader = request.headers.get('authorization')
    const hasCronSecret = process.env.CRON_SECRET ? authHeader === `Bearer ${process.env.CRON_SECRET}` : true

    // Check query param key if no header secret is configured
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const hasParamSecret = process.env.CRON_SECRET ? key === process.env.CRON_SECRET : true

    if (process.env.CRON_SECRET && !hasCronSecret && !hasParamSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Initialize Supabase Admin client
    const adminSupabase = await createAdminClient()

    // 3. Call apply_rankings_decay function
    const { error } = await adminSupabase.rpc('apply_rankings_decay')

    if (error) {
      console.error('[CRON DECAY] RPC Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Rankings decay processed successfully',
      timestamp: new Date().toISOString()
    })
  } catch (err: any) {
    console.error('[CRON DECAY] Exception:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
