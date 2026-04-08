import { createAdminClient } from '@/lib/supabase/server'
import { recalculateStandings } from '@/lib/actions/submissions'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('tournamentId')

  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 })

  const supabase = await createAdminClient()
  await recalculateStandings(supabase, tournamentId)

  return NextResponse.json({ success: true, message: 'Standings recalculated' })
}
