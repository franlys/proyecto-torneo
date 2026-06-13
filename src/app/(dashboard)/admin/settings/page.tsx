import { getLandingSettings } from '@/lib/actions/landing-settings'
import { isAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'
import { createAdminClient } from '@/lib/supabase/server'

export default async function AdminSettingsPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/tournaments')

  const settings = await getLandingSettings()
  const adminSupabase = await createAdminClient()

  // Fetch real active tournament statistics
  const { data: activeTournaments } = await adminSupabase
    .from('tournaments')
    .select('total_live_viewers')
    .eq('status', 'active')

  const activeCount = activeTournaments?.length || 0
  const totalViewers = activeTournaments?.reduce((acc, curr) => acc + (curr.total_live_viewers || 0), 0) || 0

  return (
    <SettingsClient 
      initialSettings={settings} 
      activeCount={activeCount} 
      totalViewers={totalViewers} 
    />
  )
}
