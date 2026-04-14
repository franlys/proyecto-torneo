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

  return (
    <DashboardShell userRole={profile?.role ?? 'STREAMER'}>
      {children}
    </DashboardShell>
  )
}
