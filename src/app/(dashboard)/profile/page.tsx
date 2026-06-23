import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import { ProfileStatsClient } from './ProfileStatsClient'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getProfile()

  // 1. Fetch user tournament history
  const { data: participations } = await supabase
    .from('participants')
    .select(`
      id,
      tournament_id,
      team_id,
      total_kills,
      kd_ratio,
      avg_kills,
      br_avg_placement,
      tournaments (
        id,
        name,
        slug,
        discipline,
        start_date,
        status
      ),
      teams (
        id,
        name,
        team_standings (
          rank,
          total_points,
          total_kills
        )
      )
    `)
    .eq('user_id', user.id)

  // 2. Fetch badges
  const { data: badges } = await supabase
    .from('user_badges')
    .select('*')
    .eq('user_id', user.id)
    .order('awarded_at', { ascending: false })

  // 3. Fetch aggregate discipline rankings
  const { data: rankings } = await supabase
    .from('user_discipline_rankings')
    .select('*')
    .eq('user_id', user.id)
    .order('points', { ascending: false })

  // 4. Fetch points history
  const { data: pointsHistory } = await supabase
    .from('user_points_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  // 5. Fetch game accounts
  const { data: gameAccounts } = await supabase
    .from('game_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('game')

  // 6. Check if they are a staff member of any streamer
  const { data: staffData } = await supabase
    .from('streamer_staff')
    .select('id')
    .eq('staff_id', user.id)
    .limit(1)
  const isStaff = (staffData && staffData.length > 0) || false

  const defaultTab = searchParams?.tab === 'ajustes' ? 'profile' : 'inicio'

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
        <p className="text-white/40 text-sm mt-1">Gestiona tu información personal y visualiza tu rendimiento</p>
      </div>

      <ProfileStatsClient
        profile={profile}
        user={user}
        participations={participations || []}
        badges={badges || []}
        rankings={rankings || []}
        pointsHistory={pointsHistory || []}
        gameAccounts={gameAccounts || []}
        isStaff={isStaff}
        defaultTab={defaultTab}
      />
    </div>
  )
}
