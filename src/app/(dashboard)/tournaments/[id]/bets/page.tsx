import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { TournamentBetsClient } from './TournamentBetsClient'
import { checkTournamentAccess } from '@/lib/actions/tournaments'

export const dynamic = 'force-dynamic'

export default async function TournamentBetsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = await createAdminClient()

  // 1. Fetch tournament details and verify access
  const { data: tournament } = await adminSupabase
    .from('tournaments')
    .select('id, name, slug, creator_id, collaborator_id, arena_betting_enabled')
    .eq('id', id)
    .single()

  if (!tournament) redirect('/dashboard')

  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) redirect('/dashboard')

  // 2. Fetch matches for this tournament
  const { data: matches } = await adminSupabase
    .from('matches')
    .select('id, tournament_id, name, match_number, is_completed')
    .eq('tournament_id', id)
    .order('match_number', { ascending: true })

  // 3. Fetch bet markets for this tournament
  const { data: betMarkets } = await adminSupabase
    .from('bet_markets')
    .select('*, tournaments(name)')
    .eq('tournament_id', id)
    .order('created_at', { ascending: false })

  // 4. Fetch confirmed teams for options autofill
  const { data: teams } = await adminSupabase
    .from('teams')
    .select('id, name, tournament_id')
    .eq('tournament_id', id)
    .eq('registration_status', 'confirmed')
    .order('name', { ascending: true })

  return (
    <TournamentBetsClient
      tournament={tournament}
      matches={matches || []}
      betMarkets={betMarkets || []}
      confirmedTeams={teams || []}
    />
  )
}
