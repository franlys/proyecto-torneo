import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/revalidate-tournament?slug=xxx
// Forces Vercel to re-render the public leaderboard page for the given slug.
// This is useful when the tournament status changes but the cached page is stale.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  // Verify slug exists in DB before revalidating
  const supabase = await createAdminClient()
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, status, slug, champion_image_url')
    .eq('slug', slug)
    .single()

  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

  revalidatePath(`/t/${slug}`)

  return NextResponse.json({
    revalidated: true,
    slug,
    status: tournament.status,
    champion_image_url: tournament.champion_image_url,
  })
}
