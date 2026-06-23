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

  return (
    <DashboardShell
      userRole={(profile?.role as any) ?? 'USER'}
      username={profile?.username ?? null}
      avatarUrl={profile?.avatarUrl ?? null}
      isStaff={isStaff}
    >
      {children}
    </DashboardShell>
  )
}
