import { getProfile } from '@/lib/actions/auth-helpers'
import { getStaffMembers, getPendingInvitations, getMyInvitations } from '@/lib/actions/streamer-staff'
import { StaffPortalClient } from './StaffPortalClient'
import { Orbitron } from 'next/font/google'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function StaffManagementPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  // Only streamers, admins, or federation can have/manage staff
  if (
    profile.role !== 'STREAMER' &&
    profile.role !== 'SUPER_ADMIN' &&
    profile.role !== 'ADMIN'
  ) {
    redirect('/tournaments')
  }

  // Fetch data
  const activeStaffResult = await getStaffMembers()
  const pendingInvitesResult = await getPendingInvitations()
  const myInvitesResult = await getMyInvitations()

  const activeStaff = JSON.parse(JSON.stringify('error' in activeStaffResult ? [] : activeStaffResult))
  const pendingInvites = JSON.parse(JSON.stringify('error' in pendingInvitesResult ? [] : pendingInvitesResult))
  const myInvites = JSON.parse(JSON.stringify('error' in myInvitesResult ? [] : myInvitesResult))

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header>
        <h1 className={`${orbitron.className} text-4xl font-black uppercase tracking-tighter mb-2`}>
          Gestión de <span className="text-neon-cyan">Staff</span>
        </h1>
        <p className="text-white/40 text-lg">
          Delegar accesos y designar moderadores para la gestión de tus torneos.
        </p>
      </header>

      <StaffPortalClient
        activeStaff={activeStaff}
        pendingInvites={pendingInvites}
        myInvites={myInvites}
      />
    </div>
  )
}
