import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import { updateProfile } from '@/lib/actions/profile'
import { SubscriptionUpload } from './SubscriptionUpload'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getProfile()

  const roleLabel = {
    ADMIN: { label: 'Administrador', color: 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10' },
    STREAMER: { label: 'Streamer', color: 'text-neon-purple border-neon-purple/30 bg-neon-purple/10' },
    USER: { label: 'Usuario', color: 'text-white/40 border-white/10 bg-white/5' },
  }[profile?.role ?? 'USER']

  const subLabel = {
    ACTIVE: { label: 'Activa', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
    PENDING: { label: 'Pendiente', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
    NONE: { label: 'Free', color: 'text-white/30 border-white/10 bg-white/5' },
    EXPIRED: { label: 'Expirada', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  }[profile?.subscriptionStatus ?? 'NONE']

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
        <p className="text-white/40 text-sm mt-1">Gestiona tu información personal</p>
      </div>

      {/* Account Info Card */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="text-white/60 text-xs uppercase tracking-widest font-semibold">Cuenta</h2>

        <div className="flex items-start gap-4">
          {/* Avatar placeholder */}
          <div className="w-14 h-14 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center shrink-0">
            <span className="text-neon-cyan text-xl font-bold">
              {(user.email?.[0] ?? '?').toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{user.email}</p>
            <p className="text-white/30 text-xs mt-0.5">
              Miembro desde {new Date(user.created_at).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${roleLabel.color}`}>
                {roleLabel.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${subLabel.color}`}>
                {subLabel.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="text-white/60 text-xs uppercase tracking-widest font-semibold">Editar perfil</h2>

        <form action={updateProfile} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm text-white/60 mb-1.5">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              defaultValue={profile?.username ?? ''}
              placeholder="Tu nombre de usuario"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-sm rounded-lg hover:bg-neon-cyan/20 transition-colors font-medium"
          >
            Guardar cambios
          </button>
        </form>
      </div>

      {/* Subscription Card */}
      {profile?.role !== 'ADMIN' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="text-white/60 text-xs uppercase tracking-widest font-semibold">Suscripción</h2>

          {profile?.subscriptionStatus === 'ACTIVE' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <p className="text-green-400 text-sm font-semibold">Suscripción activa</p>
              </div>
              {profile.subscriptionExpiry && (
                <p className="text-white/30 text-xs">
                  Renovar antes del: {new Date(profile.subscriptionExpiry).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              <p className="text-white/20 text-xs">
                Para renovar, sube un nuevo comprobante antes de que expire.
              </p>
            </div>
          ) : profile?.subscriptionStatus === 'PENDING' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <p className="text-yellow-400 text-sm font-semibold">Solicitud en revisión</p>
              </div>
              <p className="text-white/40 text-sm">
                Tu comprobante fue recibido. Te notificaremos cuando el administrador lo apruebe.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-neon-purple/5 border border-neon-purple/20 rounded-xl">
                <p className="text-neon-purple text-sm font-bold">Plan Streamer Pro — $15 / mes</p>
                <p className="text-white/40 text-xs mt-1">
                  Torneos ilimitados · Leaderboard en vivo · Bridge ArenaCrypto · Streamer codes
                </p>
              </div>
              <div className="text-white/40 text-xs space-y-1">
                <p className="font-semibold text-white/60">Cómo activar:</p>
                <p>1. Realiza el pago de $15 a la cuenta indicada por el administrador.</p>
                <p>2. Toma un screenshot del comprobante y súbelo aquí.</p>
                <p>3. El administrador lo revisará y activará tu cuenta.</p>
              </div>
              <SubscriptionUpload />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
