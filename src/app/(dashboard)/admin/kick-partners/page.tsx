import { createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import KickPartnersClient from './KickPartnersClient'
import { mapPartnerRow } from '@/lib/services/kick-partners'

export default async function AdminKickPartnersPage() {
  const superAdmin = await isSuperAdmin()
  if (!superAdmin) {
    redirect('/kronix')
  }

  const supabase = await createAdminClient()

  // Fetch all users with connected Kick accounts
  const { data: kickUsersData } = await supabase
    .from('kick_connections')
    .select(`
      id,
      user_id,
      kick_user_id,
      kick_username,
      created_at,
      profiles:user_id (id, username, role)
    `)
    .order('created_at', { ascending: false })

  // Fetch current partner configurations
  const { data: partnersData } = await supabase
    .from('kick_streamer_partners')
    .select(`
      *,
      profiles:user_id (username),
      kick_connections:user_id (kick_username)
    `)
    .order('created_at', { ascending: false })

  const kickUsers = (kickUsersData || []).map((u: Record<string, unknown>) => {
    const profiles = u.profiles as { id: string; username: string | null; role: string } | null | undefined
    return {
      id: String(u.id),
      user_id: String(u.user_id),
      kick_user_id: String(u.kick_user_id),
      kick_username: u.kick_username ? String(u.kick_username) : null,
      created_at: String(u.created_at),
      profiles: profiles || null,
    }
  })

  const formattedPartners = (partnersData || []).map((p) => mapPartnerRow(p as Record<string, unknown>))

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              ← Volver al Panel Admin
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-white mt-2 flex items-center gap-3">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-lg">
              🎮
            </span>
            Kronix Kick Streamer Partners
          </h1>
          <p className="text-xs text-white/50 mt-1">
            Gestión centralizada de streamers autorizados por Super Admin para integración Kick y torneos exclusivos.
          </p>
        </div>
      </div>

      {/* Main Client UI */}
      <KickPartnersClient
        kickUsers={kickUsers}
        initialPartners={formattedPartners}
      />
    </div>
  )
}
