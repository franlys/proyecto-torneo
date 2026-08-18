'use client'

import { useState, useEffect } from 'react'
import { AppNotification, markNotificationReadAction, markAllNotificationsReadAction, getMyNotificationsAction } from '@/lib/actions/notifications'
import { Bell, Check, Trash2, Eye, ShieldAlert, Trophy, Swords, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function NotificationsClient({ initialNotifications }: { initialNotifications: AppNotification[] }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications)
  const [markingAll, setMarkingAll] = useState(false)
  const router = useRouter()
  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    const supabase = createClient()
    
    const fetchLatestNotifications = async () => {
      const res = await getMyNotificationsAction()
      if (res.success && res.data) {
        setNotifications(res.data)
      }
    }

    const channel = supabase
      .channel('notifications_inbox_client')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          fetchLatestNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.is_read) {
      await handleMarkRead(n.id)
    }
    const url = getDestinationUrl(n.title, n.message)
    if (url) {
      router.push(url)
    }
  }

  const handleMarkRead = async (id: string) => {
    const original = [...notifications]
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))

    const res = await markNotificationReadAction(id)
    if (!res.success) {
      toast.error('No se pudo marcar la notificación como leída.')
      setNotifications(original)
    }
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return
    setMarkingAll(true)
    const original = [...notifications]
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))

    const res = await markAllNotificationsReadAction()
    setMarkingAll(false)
    if (res.success) {
      toast.success('Todas las notificaciones marcadas como leídas.')
    } else {
      toast.error('Error al actualizar las notificaciones.')
      setNotifications(original)
    }
  }

  const getIcon = (title: string) => {
    const t = title.toLowerCase()
    if (t.includes('premio') || t.includes('mvp') || t.includes('ganado')) {
      return <Trophy className="w-5 h-5 text-yellow-400" />
    }
    if (t.includes('partida') || t.includes('lista') || t.includes('lobby')) {
      return <Swords className="w-5 h-5 text-neon-cyan shrink-0" />
    }
    if (t.includes('inscrito') || t.includes('torneo')) {
      return <Calendar className="w-5 h-5 text-purple-400 shrink-0" />
    }
    return <Bell className="w-5 h-5 text-white/50 shrink-0" />
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Action Panel */}
      <div className="flex justify-between items-center bg-dark-card border border-white/5 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20">
            <Bell className="w-5 h-5 text-neon-cyan animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Historial de Alertas</h2>
            <p className="text-[10px] text-white/40">
              Tienes <span className="text-neon-cyan font-bold font-orbitron">{unreadCount}</span> notificaciones sin leer.
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/5 active:scale-[0.98] disabled:opacity-50"
          >
            <Check size={14} className="text-neon-cyan" />
            {markingAll ? 'Marcando...' : 'Marcar todas leídas'}
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="p-16 text-center bg-dark-card border border-dashed border-white/5 rounded-2xl space-y-4">
            <span className="text-4xl block">⚔️</span>
            <div>
              <h3 className="text-sm font-bold text-white uppercase">¡Todo al día, gladiador!</h3>
              <p className="text-xs text-white/40 mt-1 max-w-xs mx-auto">
                No tienes notificaciones pendientes. Te avisaremos cuando ocurra algo importante en tus torneos.
              </p>
            </div>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`p-4 rounded-xl border transition-all text-left flex items-start justify-between gap-4 cursor-pointer relative group ${
                n.is_read
                  ? 'bg-dark-card/40 border-white/[0.02] opacity-60 hover:opacity-80'
                  : 'bg-dark-card border-neon-cyan/20 shadow-[0_0_15px_rgba(0,180,216,0.05)] hover:border-neon-cyan/40'
              }`}
            >
              <div className="flex items-start gap-4 min-w-0">
                {/* Visual Icon */}
                <div className={`p-2.5 rounded-xl shrink-0 ${n.is_read ? 'bg-white/5' : 'bg-neon-cyan/10 border border-neon-cyan/10'}`}>
                  {getIcon(n.title)}
                </div>

                <div className="space-y-1 min-w-0">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${n.is_read ? 'text-white/60' : 'text-white'}`}>
                    {n.title}
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed break-words">{n.message}</p>
                  <span className="text-[9px] text-white/30 block font-orbitron font-semibold">
                    {formatDate(n.created_at)}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0 flex items-center justify-center">
                {!n.is_read ? (
                  <span className="w-2 h-2 rounded-full bg-neon-cyan animate-ping" title="Sin leer" />
                ) : (
                  <Eye className="w-4 h-4 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
