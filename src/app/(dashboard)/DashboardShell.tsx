'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { signOut } from '@/lib/actions/auth'
import { motion, AnimatePresence } from 'framer-motion'
import { updateTeammateGameCredentials, GAME_LABELS } from '@/lib/actions/game-accounts'
import { AlertTriangle, User, Bell, X, Check, Calendar, ChevronRight, Coins } from 'lucide-react'
import { toast } from 'sonner'
import { getMyNotificationsAction, markNotificationReadAction, markAllNotificationsReadAction } from '@/lib/actions/notifications'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/actions/profile'

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'text-yellow-300' },
  ADMIN:       { label: 'Admin',       color: 'text-neon-cyan' },
  KRONIX_STAFF:{ label: 'Staff',       color: 'text-orange-300' },
  FEDERATION:  { label: 'Federación',  color: 'text-green-400' },
  STREAMER:    { label: 'Streamer',    color: 'text-purple-400' },
  USER:        { label: 'Usuario',     color: 'text-white/40' },
}

export default function DashboardShell({
  children,
  userRole,
  username,
  avatarUrl,
  isStaff = false,
  missingGameAccountInfo = null,
  balance = 0.00,
}: {
  children: React.ReactNode
  userRole: 'SUPER_ADMIN' | 'ADMIN' | 'KRONIX_STAFF' | 'FEDERATION' | 'STREAMER' | 'USER'
  username?: string | null
  avatarUrl?: string | null
  isStaff?: boolean
  missingGameAccountInfo?: { participantId: string; tournamentName: string; discipline: string; slug: string } | null
  balance?: number
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isAdminUser = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'KRONIX_STAFF'

  // Game ID Modal states
  const [showGameIdModal, setShowGameIdModal] = useState(false)
  const [gameIdVal, setGameIdVal] = useState('')
  const [gameUsernameVal, setGameUsernameVal] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false)
  const router = useRouter()

  const handleMarkRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadNotificationsCount(prev => Math.max(0, prev - 1))
    await markNotificationReadAction(id)
  }

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadNotificationsCount(0)
    await markAllNotificationsReadAction()
  }

  const getDestinationUrl = (title: string, message: string) => {
    const t = (title + ' ' + message).toLowerCase()
    if (t.includes('cartera') || t.includes('retiro') || t.includes('recarga') || t.includes('saldo') || t.includes('k-coin') || t.includes('paypal')) {
      return '/wallet'
    }
    if (t.includes('vip') || t.includes('suscripción') || t.includes('suscripcion')) {
      return '/subscription'
    }
    if (t.includes('perfil') || t.includes('credenciales') || t.includes('game id') || t.includes('vincular')) {
      return '/profile'
    }
    if (t.includes('torneo') || t.includes('inscrito') || t.includes('inscripción') || t.includes('inscripcion') || t.includes('partida') || t.includes('lobby') || t.includes('encuentro') || t.includes('ronda')) {
      return '/profile'
    }
    return null
  }

  const handleNotificationClick = async (n: any) => {
    if (!n.is_read) {
      await handleMarkRead(n.id)
    }
    setShowNotificationsDrawer(false)
    const url = getDestinationUrl(n.title, n.message)
    if (url) {
      router.push(url)
    }
  }

  // Force Nickname states
  const [forceNickname, setForceNickname] = useState(false)
  const [nicknameInput, setNicknameInput] = useState('')
  const [nicknameLoading, setNicknameLoading] = useState(false)
  const [nicknameError, setNicknameError] = useState('')

  useEffect(() => {
    const name = username || ''
    if (!name.trim() || name === 'null' || name.toLowerCase() === 'usuario sin nickname') {
      setForceNickname(true)
    } else {
      setForceNickname(false)
    }
  }, [username])

  const handleSetNickname = async () => {
    if (nicknameInput.trim().length < 3) {
      setNicknameError('El nickname debe tener al menos 3 caracteres.')
      return
    }
    if (nicknameInput.trim().length > 16) {
      setNicknameError('El nickname no puede superar los 16 caracteres.')
      return
    }
    setNicknameLoading(true)
    setNicknameError('')

    try {
      const formData = new FormData()
      formData.append('username', nicknameInput.trim())
      const res = await updateProfile(formData)

      if (res && 'error' in res && res.error) {
        setNicknameError(res.error)
      } else {
        toast.success('¡Nickname establecido con éxito!')
        setForceNickname(false)
        window.location.reload()
      }
    } catch (err: any) {
      setNicknameError(err.message || 'Ocurrió un error inesperado.')
    } finally {
      setNicknameLoading(false)
    }
  }

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  const loadNotifications = async () => {
    const res = await getMyNotificationsAction()
    if (res.success && res.data) {
      setNotifications(res.data)
      setUnreadNotificationsCount(res.data.filter(n => !n.is_read).length)
    }
  }

  useEffect(() => {
    loadNotifications()

    // Realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel('notifications_dashboard_shell')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          loadNotifications()
        }
      )
      .subscribe()
    
    // Refresh count every 30 seconds as fallback
    const interval = setInterval(loadNotifications, 30000)
    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  const SidebarLink = ({ href, onClick, children, className = "" }: { href: string; onClick?: () => void; children: React.ReactNode; className?: string }) => {
    const currentTab = searchParams.get('tab')
    
    const isActive = href === '/kronix' 
      ? (pathname === '/kronix' || (pathname.startsWith('/kronix/') && !pathname.startsWith('/kronix/approvals') && !pathname.startsWith('/kronix/staff') && !pathname.startsWith('/kronix/payments') && !pathname.startsWith('/kronix/support')))
      : href === '/profile'
      ? (pathname === '/profile' && !currentTab)
      : href.startsWith('/profile?')
      ? (pathname === '/profile' && currentTab === new URL(href, 'http://localhost').searchParams.get('tab'))
      : pathname === href

    return (
      <Link
        href={href}
        onClick={onClick}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group z-10 ${
          isActive 
            ? 'text-white font-bold' 
            : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
        } ${className}`}
      >
        {isActive && (
          <motion.div
            layoutId="sidebarActiveBg"
            className="absolute inset-0 bg-white/5 border border-white/5 rounded-lg -z-10"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        {isActive && (
          <motion.div
            layoutId="sidebarActiveIndicator"
            className="absolute left-0 top-2.5 bottom-2.5 w-[3px] bg-neon-cyan rounded-r-md shadow-[0_0_8px_#00F5FF]"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        {children}
      </Link>
    )
  }

  const SidebarButton = ({ onClick, children, isActive }: { onClick: (e: any) => void; children: React.ReactNode; isActive: boolean }) => {
    return (
      <button
        onClick={onClick}
        className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group z-10 ${
          isActive 
            ? 'text-white font-bold' 
            : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
        }`}
      >
        {isActive && (
          <motion.div
            layoutId="sidebarActiveBg"
            className="absolute inset-0 bg-white/5 border border-white/5 rounded-lg -z-10"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        {isActive && (
          <motion.div
            layoutId="sidebarActiveIndicator"
            className="absolute left-0 top-2.5 bottom-2.5 w-[3px] bg-neon-cyan rounded-r-md shadow-[0_0_8px_#00F5FF]"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        {children}
      </button>
    )
  }

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      <SidebarLink href="/profile">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11V11a1 1 0 00-1-1h-3m-6 0a1 1 0 00-1 1v4a1 1 0 001 1h3m0 0l-3-3m3 3l-3-3" />
        </svg>
        Mi Inicio
      </SidebarLink>
      
      {/* Sub-menu under Mi Inicio */}
      <div className="pl-3 space-y-0.5 mt-0.5 border-l border-white/15 ml-5">
        <SidebarLink href="/profile?tab=ajustes" className="!py-1.5 !px-2.5 text-xs text-white/50 hover:text-white">
          <span>⚙️</span> Ajustes Perfil
        </SidebarLink>
        <SidebarLink href="/profile?tab=amigos" className="!py-1.5 !px-2.5 text-xs text-white/50 hover:text-white">
          <span>👥</span> Amigos
        </SidebarLink>
        <SidebarLink href="/profile?tab=medallero" className="!py-1.5 !px-2.5 text-xs text-white/50 hover:text-white">
          <span>🏅</span> Medallero
        </SidebarLink>
        <SidebarLink href="/profile?tab=desempeno" className="!py-1.5 !px-2.5 text-xs text-white/50 hover:text-white">
          <span>📊</span> Desempeño
        </SidebarLink>
        <SidebarLink href="/profile?tab=sorteos" className="!py-1.5 !px-2.5 text-xs text-white/50 hover:text-white">
          <span>🎟️</span> Mis Boletos Sorteos
        </SidebarLink>
        <SidebarLink href="/wallet" className="!py-1.5 !px-2.5 text-xs text-white/50 hover:text-white">
          <span>💳</span> Mi Billetera (K-Coins)
        </SidebarLink>
      </div>

      <SidebarButton
        onClick={(e) => {
          e.preventDefault()
          setShowNotificationsDrawer(true)
          setDrawerOpen(false)
        }}
        isActive={showNotificationsDrawer}
      >
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Notificaciones
        </div>
        {unreadNotificationsCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-orbitron animate-pulse">
            {unreadNotificationsCount}
          </span>
        )}
      </SidebarButton>

      <SidebarLink href="/kronix">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h18M3 12h18M3 17h18" />
        </svg>
        {userRole === 'USER' ? 'Mis Inscripciones' : 'Mis Torneos'}
      </SidebarLink>

      {(userRole !== 'USER' || isStaff) && (
        <>
          {(userRole === 'STREAMER' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
            <>
              <SidebarLink href="/kronix/approvals">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Aprobaciones
              </SidebarLink>
              <SidebarLink href="/kronix/staff">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Mi Staff
              </SidebarLink>
              <SidebarLink href="/kronix/payments">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Métodos de Pago
              </SidebarLink>
            </>
          )}

          {userRole === 'STREAMER' && (
            <SidebarLink href="/kronix/support">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Soporte Kronix
            </SidebarLink>
          )}
        </>
      )}

      {/* Explorar Section */}
      <div className="px-3 pt-4 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Explorar</span>
      </div>
      <SidebarLink href="/torneos">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 13.5a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
        Torneos Públicos
      </SidebarLink>
      <SidebarLink href="/rankings">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
        Rankings Nacionales
      </SidebarLink>
      <SidebarLink href="/copas">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479L12 14zm0 0L5.84 10.578a12.083 12.083 0 00-.665 6.479L12 14z" />
        </svg>
        Copas Oficiales
      </SidebarLink>
      <SidebarLink href="/hall-of-fame">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.371 1.24.588 1.81l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.18 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.49 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        Hall of Fame
      </SidebarLink>
      <SidebarLink href="/raffles">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
        Sorteos Activos
      </SidebarLink>

      {(userRole === 'STREAMER' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
        <SidebarLink href="/subscription" className="text-yellow-500/80 hover:text-yellow-400 hover:bg-yellow-500/10">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          👑 Membresía VIP
        </SidebarLink>
      )}

      {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'KRONIX_STAFF') && (
        <>
          <div className="px-3 pt-4 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Administración</span>
          </div>
          {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
            <>
              <SidebarLink href="/admin" className="text-neon-cyan/70 hover:text-neon-cyan hover:bg-neon-cyan/5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Panel Admin
              </SidebarLink>
              <SidebarLink href="/admin/kronix">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Torneos Admin
              </SidebarLink>
              <SidebarLink href="/admin/users">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Usuarios
              </SidebarLink>
              <SidebarLink href="/admin/subscriptions">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Suscripciones
              </SidebarLink>
              <SidebarLink href="/admin/finance">
                <svg className="w-4 h-4 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Finanzas & Ingresos
              </SidebarLink>
              <SidebarLink href="/admin/analytics">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analíticas
              </SidebarLink>
              <SidebarLink href="/admin/ads">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                Publicidad
              </SidebarLink>
              <SidebarLink href="/admin/settings">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Personalizar Inicio
              </SidebarLink>
              <SidebarLink href="/admin/raffles">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                Gestión de Sorteos
              </SidebarLink>
              <SidebarLink href="/admin/bets">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Control Apuestas
              </SidebarLink>
            </>
          )}
          <SidebarLink href="/admin/tickets">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            Soporte Tickets
          </SidebarLink>
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
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-white/40" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-bold text-white/80 group-hover:text-white transition-colors truncate">
            {username || 'Mi Perfil'}
          </p>
          <p className={`text-[10px] font-semibold ${isStaff && userRole === 'USER' ? 'text-orange-300' : (ROLE_BADGE[userRole]?.color ?? 'text-white/40')}`}>
            {isStaff && userRole === 'USER' ? 'Staff Colaborador' : (ROLE_BADGE[userRole]?.label ?? userRole)}
          </p>
          <p className="text-[10px] font-orbitron font-bold text-neon-cyan mt-1 flex items-center gap-1.5">
            <Coins className="w-3 h-3 text-neon-cyan shrink-0" />
            <span>{balance.toFixed(2)} K-Coins</span>
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
      {/* Desktop & Split-screen Sidebar — visible on md and up */}
      <aside className="hidden md:flex md:w-56 lg:w-60 shrink-0 bg-dark-card border-r border-white/5 flex-col h-screen sticky top-0 overflow-y-auto z-30">
        <div className="px-5 lg:px-6 py-5 border-b border-white/5">
          <Link href="/kronix" className="flex items-center gap-2.5 group">
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

      {/* Mobile Header (under md) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-dark-card/95 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 py-3">
        <Link href="/kronix" className="flex items-center gap-2 group">
          <img 
            src="/logo.png" 
            alt="KRONIX Logo" 
            className="w-5 h-5 object-contain" 
          />
          <span className="font-sans font-black tracking-[0.2em] text-xs text-white uppercase">KRONIX</span>
        </Link>
        <div className="flex items-center gap-2">
          {/* Bell Icon for Mobile */}
          <button
            onClick={() => setShowNotificationsDrawer(true)}
            className="relative p-2 text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>

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
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            {/* Drawer panel */}
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-dark-card border-r border-white/5 flex flex-col overflow-y-auto"
            >
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <Link href="/kronix" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2.5">
                  <img src="/logo.png" alt="KRONIX Logo" className="w-5 h-5 object-contain" />
                  <div>
                    <span className="font-sans font-black tracking-[0.2em] text-xs text-white uppercase">KRONIX</span>
                    <span className="block font-sans text-[8px] tracking-[0.15em] text-white/30 uppercase -mt-0.5">by GonzalezLabs</span>
                  </div>
                </Link>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto pt-[52px] md:pt-0">
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

          {/* Mandatory Nickname Modal */}
          {forceNickname && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md bg-[#0d0d0f] border border-white/10 rounded-3xl p-6 space-y-6 shadow-[0_0_50px_rgba(0,180,216,0.15)] text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center mx-auto">
                  <User className="w-8 h-8 text-neon-cyan animate-pulse" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-white font-orbitron font-black text-lg uppercase tracking-wider">Elige tu Nickname Oficial</h2>
                  <p className="text-white/50 text-xs leading-relaxed">
                    Para participar en torneos, realizar apuestas y usar tu billetera de K-Coins, necesitas establecer un nombre de usuario oficial en Kronix.
                  </p>
                </div>

                <div className="space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Nickname (Nombre en pantalla)</label>
                    <input
                      type="text"
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="Ej. alex_gladiator"
                      disabled={nicknameLoading}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan transition-colors"
                    />
                    <span className="text-[9px] text-white/30 block">
                      Solo se permiten letras, números y guión bajo (_). Mínimo 3 caracteres, máximo 16.
                    </span>
                  </div>

                  {nicknameError && (
                    <p className="text-red-400 text-xs font-semibold">{nicknameError}</p>
                  )}

                  <button
                    onClick={handleSetNickname}
                    disabled={nicknameLoading || nicknameInput.trim().length < 3}
                    className="w-full py-3 bg-neon-cyan hover:bg-neon-cyan/95 text-black font-black text-[11px] uppercase tracking-wider rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-[0.98] shadow-[0_0_20px_rgba(0,180,216,0.2)]"
                  >
                    {nicknameLoading ? 'Guardando Nickname...' : 'Guardar y Comenzar'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Notifications Drawer */}
          {showNotificationsDrawer && (
            <div className="fixed inset-0 z-[110] flex justify-end">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowNotificationsDrawer(false)}
                className="absolute inset-0 bg-black backdrop-blur-sm cursor-pointer"
              />
              {/* Panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                className="relative w-full max-w-[450px] bg-[#0d0d0f] border-l border-white/5 h-full flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-neon-cyan" />
                    <h3 className="text-white font-orbitron font-black text-sm uppercase tracking-wider">Centro de Alertas</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadNotificationsCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-colors border border-white/5 flex items-center gap-1.5"
                      >
                        <Check className="w-3 h-3" />
                        Leídas
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotificationsDrawer(false)}
                      className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-none">
                  {notifications.length === 0 ? (
                    <div className="text-center py-20 text-white/30 text-xs border border-dashed border-white/5 rounded-2xl bg-white/[0.005]">
                      Sin notificaciones.
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isRead = n.is_read
                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-4 rounded-2xl border transition-all text-left cursor-pointer flex gap-3.5 relative group ${
                            isRead
                              ? 'bg-white/[0.002] border-white/5 hover:bg-white/[0.01]'
                              : 'bg-neon-cyan/5 border-neon-cyan/15 hover:bg-neon-cyan/[0.08] shadow-[0_0_15px_rgba(0,245,255,0.02)]'
                          }`}
                        >
                          {!isRead && (
                            <span className="absolute top-4 right-4 w-2 h-2 bg-neon-cyan rounded-full animate-pulse" />
                          )}
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                            isRead ? 'bg-white/5 border-white/5 text-white/30' : 'bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan'
                          }`}>
                            <Bell className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-xs font-black uppercase tracking-wider ${isRead ? 'text-white/60' : 'text-white'}`}>
                              {n.title}
                            </h4>
                            <p className={`text-[11px] leading-relaxed mt-1 ${isRead ? 'text-white/40' : 'text-white/60'}`}>
                              {n.message}
                            </p>
                            <div className="flex items-center gap-1.5 mt-2.5 text-[9px] text-white/20 font-bold uppercase">
                              <Calendar className="w-3 h-3 text-white/10" />
                              <span>
                                {new Date(n.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })} a las {new Date(n.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
