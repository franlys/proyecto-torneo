'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { signOut } from '@/lib/actions/auth'
import { motion, AnimatePresence } from 'framer-motion'
import { updateTeammateGameCredentials, GAME_LABELS } from '@/lib/actions/game-accounts'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: '⭐ Super Admin', color: 'text-yellow-300' },
  ADMIN:       { label: '⚡ Admin',       color: 'text-neon-cyan' },
  KRONIX_STAFF:{ label: '🔧 Staff',       color: 'text-orange-300' },
  FEDERATION:  { label: '🏛 Federación',  color: 'text-green-400' },
  STREAMER:    { label: '🎮 Streamer',    color: 'text-purple-400' },
  USER:        { label: '👤 Usuario',     color: 'text-white/40' },
}

export default function DashboardShell({
  children,
  userRole,
  username,
  avatarUrl,
  isStaff = false,
  missingGameAccountInfo = null,
}: {
  children: React.ReactNode
  userRole: 'SUPER_ADMIN' | 'ADMIN' | 'KRONIX_STAFF' | 'FEDERATION' | 'STREAMER' | 'USER'
  username?: string | null
  avatarUrl?: string | null
  isStaff?: boolean
  missingGameAccountInfo?: { participantId: string; tournamentName: string; discipline: string; slug: string } | null
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isAdminUser = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'KRONIX_STAFF'

  // Game ID Modal states
  const [showGameIdModal, setShowGameIdModal] = useState(false)
  const [gameIdVal, setGameIdVal] = useState('')
  const [gameUsernameVal, setGameUsernameVal] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [])

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      <Link
        href="/profile"
        onClick={() => setDrawerOpen(false)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11V11a1 1 0 00-1-1h-3m-6 0a1 1 0 00-1 1v4a1 1 0 001 1h3m0 0l-3-3m3 3l-3-3" />
        </svg>
        Mi Inicio
      </Link>

      {(userRole !== 'USER' || isStaff) && (
        <>
          <Link
            href="/tournaments"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h18M3 12h18M3 17h18" />
            </svg>
            Mis Torneos
          </Link>
          
          {(userRole === 'STREAMER' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
            <>
              <Link
                href="/tournaments/approvals"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Aprobaciones
              </Link>
              <Link
                href="/tournaments/staff"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Mi Staff
              </Link>
              <Link
                href="/tournaments/payments"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Métodos de Pago
              </Link>
              <Link
                href="/tournaments/support"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Soporte Kronix
              </Link>
            </>
          )}
        </>
      )}

      {userRole === 'USER' && (
        <>
          <div className="px-3 pt-4 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Explorar</span>
          </div>
          <Link
            href="/torneos"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 13.5a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
            Torneos Públicos
          </Link>
          <Link
            href="/rankings"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Rankings Nacionales
          </Link>
          <Link
            href="/copas"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479L12 14zm0 0L5.84 10.578a12.083 12.083 0 00-.665 6.479L12 14z" />
            </svg>
            Copas Oficiales
          </Link>
          <Link
            href="/hall-of-fame"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.371 1.24.588 1.81l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.18 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.49 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            Hall of Fame
          </Link>
        </>
      )}

      {/* Sorteos (Visible to everyone) */}
      <div className="px-3 pt-4 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Sorteos</span>
      </div>
      <Link
        href="/raffles"
        onClick={() => setDrawerOpen(false)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
        🏆 Sorteos Activos
      </Link>
      <Link
        href="/profile?tab=sorteos"
        onClick={() => setDrawerOpen(false)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
        🎟️ Mis Boletos Sorteos
      </Link>

      {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'KRONIX_STAFF') && (
        <>
          <div className="px-3 pt-4 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Administración</span>
          </div>
          {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
            <>
              <Link
                href="/admin"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-neon-cyan/70 hover:text-neon-cyan hover:bg-neon-cyan/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Panel Admin
              </Link>
              <Link
                href="/admin/tournaments"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Torneos Admin
              </Link>
              <Link
                href="/admin/users"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Usuarios
              </Link>
              <Link
                href="/admin/subscriptions"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Suscripciones
              </Link>
              <Link
                href="/admin/revenue"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ingresos
              </Link>
              <Link
                href="/admin/analytics"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analíticas
              </Link>
              <Link
                href="/admin/ads"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                Publicidad
              </Link>
              <Link
                href="/admin/settings"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Personalizar Inicio
              </Link>
              <Link
                href="/admin/raffles"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                Gestión de Sorteos
              </Link>
            </>
          )}
          <Link
            href="/admin/tickets"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            Soporte Tickets
          </Link>
        </>
      )}
    </nav>
  )

  const SidebarFooter = () => (
    <div className="px-3 py-4 border-t border-white/5 space-y-1">
      {/* User Info */}
      <Link
        href="/profile"
        onClick={() => setDrawerOpen(false)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username || 'Avatar'}
            className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-sm">
            👤
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-bold text-white/80 group-hover:text-white transition-colors truncate">
            {username || 'Mi Perfil'}
          </p>
          <p className={`text-[10px] font-semibold ${isStaff && userRole === 'USER' ? 'text-orange-300' : (ROLE_BADGE[userRole]?.color ?? 'text-white/40')}`}>
            {isStaff && userRole === 'USER' ? '🔧 Staff Colaborador' : (ROLE_BADGE[userRole]?.label ?? userRole)}
          </p>
        </div>
      </Link>

      <form action={signOut}>
        <button
          type="submit"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </form>
      <div className="mt-4 text-center opacity-30 pointer-events-none select-none">
        <span className="text-[9px] uppercase tracking-widest block font-orbitron">Powered by</span>
        <span className="text-xs font-bold uppercase tracking-wider mt-0.5 block font-orbitron text-neon-cyan">GonzalezLabs</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-dark-bg flex">
      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-dark-card border-r border-white/5 flex-col h-screen sticky top-0 overflow-y-auto">
        <div className="px-6 py-5 border-b border-white/5">
          <Link href="/tournaments" className="flex items-center gap-2.5 group">
            <img 
              src="/logo.png" 
              alt="KRONIX Logo" 
              className="w-6 h-6 object-contain transition-transform duration-300 group-hover:scale-105" 
            />
            <div>
              <span className="font-sans font-black tracking-[0.2em] text-xs text-white uppercase group-hover:text-neon-cyan transition-colors">KRONIX</span>
              <span className="block font-sans text-[8px] tracking-[0.15em] text-white/30 uppercase -mt-0.5">by GonzalezLabs</span>
            </div>
          </Link>
        </div>
        <NavLinks />
        <SidebarFooter />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-dark-card/95 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 py-3">
        <Link href="/tournaments" className="flex items-center gap-2 group">
          <img 
            src="/logo.png" 
            alt="KRONIX Logo" 
            className="w-5 h-5 object-contain" 
          />
          <span className="font-sans font-black tracking-[0.2em] text-xs text-white uppercase">KRONIX</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Abrir menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            {/* Drawer panel */}
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-dark-card border-r border-white/5 flex flex-col overflow-y-auto"
            >
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <Link href="/tournaments" onClick={() => setDrawerOpen(false)}>
                  <span className="font-orbitron text-sm font-bold tracking-widest text-neon-cyan uppercase">Tournament</span>
                  <span className="block font-orbitron text-[10px] tracking-[0.25em] text-white/30 uppercase mt-0.5">Platform</span>
                </Link>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <NavLinks />
              <SidebarFooter />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content — padding top on mobile for the fixed header */}
      <main className="flex-1 overflow-auto pt-[52px] lg:pt-0">
        {missingGameAccountInfo && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 animate-bounce" />
              <div className="text-xs">
                <span className="font-bold text-white block">⚠️ ID de Juego Requerido</span>
                <span className="text-white/60">
                  Estás inscrito en el torneo <strong className="text-white">"{missingGameAccountInfo.tournamentName}"</strong> pero falta configurar tu ID de cuenta para <strong className="text-neon-cyan">{GAME_LABELS[missingGameAccountInfo.discipline]?.label || missingGameAccountInfo.discipline}</strong>.
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setGameIdVal('')
                setGameUsernameVal('')
                setModalError('')
                setShowGameIdModal(true)
              }}
              className="shrink-0 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black text-[11px] font-black uppercase tracking-wider rounded-lg transition-all active:scale-[0.97]"
            >
              Vincular ID de Cuenta
            </button>
          </div>
        )}
        {children}

        {/* Modal for vinculating Game ID */}
        <AnimatePresence>
          {showGameIdModal && missingGameAccountInfo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowGameIdModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.95, y: 15, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 15, opacity: 0 }}
                className="relative w-full max-w-md bg-[#121219] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden z-10"
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-yellow-500 to-neon-purple" />
                <h3 className="font-orbitron font-bold text-lg text-white mb-2 flex items-center gap-2">
                  <span>🎮</span> Vincular Cuenta de Juego
                </h3>
                <p className="text-xs text-white/50 leading-relaxed mb-5">
                  Ingresa los detalles de tu cuenta de juego para el torneo <strong>"{missingGameAccountInfo.tournamentName}"</strong>. Esto es necesario para que tus estadísticas se computen correctamente.
                </p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!gameIdVal.trim() || !gameUsernameVal.trim()) {
                      setModalError('Ambos campos son obligatorios.')
                      return
                    }
                    setModalLoading(true)
                    setModalError('')
                    try {
                      const res = await updateTeammateGameCredentials(
                        missingGameAccountInfo.participantId,
                        missingGameAccountInfo.discipline,
                        gameIdVal.trim(),
                        gameUsernameVal.trim()
                      )
                      if (res && 'error' in res) {
                        setModalError(res.error)
                      } else {
                        toast.success('¡Cuenta de juego vinculada con éxito!')
                        setShowGameIdModal(false)
                        window.location.reload()
                      }
                    } catch (err: any) {
                      setModalError(err.message || 'Error inesperado.')
                    } finally {
                      setModalLoading(false)
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/45">
                      {GAME_LABELS[missingGameAccountInfo.discipline]?.idLabel || 'ID de Cuenta'} *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder={GAME_LABELS[missingGameAccountInfo.discipline]?.idPlaceholder || 'Ej. ID de Jugador'}
                      value={gameIdVal}
                      onChange={(e) => setGameIdVal(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-yellow-500 transition-all text-white font-medium font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/45">
                      {GAME_LABELS[missingGameAccountInfo.discipline]?.usernameLabel || 'Nombre en el Juego'} *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder={GAME_LABELS[missingGameAccountInfo.discipline]?.usernamePlaceholder || 'Ej. Nombre de Usuario'}
                      value={gameUsernameVal}
                      onChange={(e) => setGameUsernameVal(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-yellow-500 transition-all text-white font-medium"
                    />
                  </div>

                  {modalError && (
                    <p className="text-red-400 text-[11px] font-semibold">{modalError}</p>
                  )}

                  <div className="flex gap-3 pt-3">
                    <button
                      type="submit"
                      disabled={modalLoading}
                      className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                    >
                      {modalLoading ? 'Vinculando...' : 'Vincular y Guardar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGameIdModal(false)}
                      className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
