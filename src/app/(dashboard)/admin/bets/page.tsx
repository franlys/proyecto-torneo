import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AdminBetsClient } from './AdminBetsClient'

export default async function AdminBetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'SUPER_ADMIN' && profile.role !== 'ADMIN')) {
    redirect('/dashboard')
  }

  const adminSupabase = await createAdminClient()

  const { data: tournaments } = await adminSupabase
    .from('tournaments')
    .select('id, name, slug, arena_betting_enabled')
    .order('created_at', { ascending: false })

  const { data: matches } = await adminSupabase
    .from('matches')
    .select('id, tournament_id, name, match_number, is_completed')
    .order('match_number', { ascending: true })

  const { data: betMarkets } = await adminSupabase
    .from('bet_markets')
    .select('*, tournaments(name)')
    .order('created_at', { ascending: false })

  const { data: teams } = await adminSupabase
    .from('teams')
    .select('id, name, tournament_id')
    .eq('registration_status', 'confirmed')
    .order('name', { ascending: true })

  return (
    <div className="min-h-screen bg-transparent text-white">
      <AdminBetsClient
        tournaments={tournaments || []}
        matches={matches || []}
        betMarkets={betMarkets || []}
        confirmedTeams={teams || []}
      />
    </div>
  )
}
