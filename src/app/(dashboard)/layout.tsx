import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from './DashboardShell'
import { getProfile } from '@/lib/actions/auth-helpers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await getProfile()

  // Check if they are a staff member of any streamer
  const { data: staffData } = await supabase
    .from('streamer_staff')
    .select('id')
    .eq('staff_id', user.id)
    .limit(1)
  const isStaff = (staffData && staffData.length > 0) || false

  // Check if they are registered in any active/pending tournament but lack a game_id
  const { data: participations } = await supabase
    .from('participants')
    .select('id, game_id, tournaments(id, name, discipline, slug, status)')
    .eq('user_id', user.id)

  const activePart = (participations || []).find((p: any) => {
    const tournament = Array.isArray(p.tournaments) ? p.tournaments[0] : p.tournaments
    return (
      (tournament?.status === 'pending' || tournament?.status === 'active') &&
      (!p.game_id || p.game_id.trim() === '')
    )
  })

  let missingGameAccountInfo = null
  if (activePart) {
    const tournament = Array.isArray(activePart.tournaments) ? activePart.tournaments[0] : activePart.tournaments
    if (tournament) {
      missingGameAccountInfo = {
        participantId: activePart.id,
        tournamentName: tournament.name,
        discipline: tournament.discipline,
        slug: tournament.slug,
      }
    }
  }

  return (
    <DashboardShell
      userRole={(profile?.role as any) ?? 'USER'}
      username={profile?.username ?? null}
      avatarUrl={profile?.avatarUrl ?? null}
      isStaff={isStaff}
      missingGameAccountInfo={missingGameAccountInfo}
    >
      {children}
    </DashboardShell>
  )
}
