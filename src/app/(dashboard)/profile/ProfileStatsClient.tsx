'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { updateProfile, uploadProfileAvatar } from '@/lib/actions/profile'
import { updateDiscordUsername } from '@/lib/actions/game-accounts'
import { getFriendsList, searchUsersForFriends, sendFriendRequest, removeFriend } from '@/lib/actions/friends'
import { getPendingInvitations, confirmTeamParticipation, rejectTeamParticipation } from '@/lib/actions/registration'
import { toast } from 'sonner'
import { SubscriptionUpload } from './SubscriptionUpload'
import { GameAccountsSection } from '@/components/profile/GameAccountsSection'
import { 
  Trophy, 
  Settings, 
  Users, 
  Award, 
  Activity, 
  Ticket, 
  User, 
  Coins, 
  Calendar,
  Lock,
  Mail,
  Gamepad2,
  Share2,
  Trash2,
  UserMinus,
  Check,
  UserPlus,
  Flame,
  TrendingUp
} from 'lucide-react'
import { GlowCard } from '@/components/ui/GlowCard'

interface ProfileStatsClientProps {
  profile: any
  user: any
  participations: any[]
  badges: any[]
  rankings: any[]
  pointsHistory: any[]
  gameAccounts?: any[]
  isStaff?: boolean
  defaultTab?: 'inicio' | 'profile' | 'history' | 'badges' | 'stats' | 'friends' | 'sorteos'
  tickets?: any[]
}

const GAME_NAMES: Record<string, string> = {
  warzone: 'Call of Duty: Warzone',
  clash_royale: 'Clash Royale',
  fortnite: 'Fortnite',
  free_fire: 'Free Fire',
  call_of_duty_mobile: 'Call of Duty Mobile',
  street_fighter_6: 'Street Fighter 6',
  super_smash_bros_ultimate: 'Super Smash Bros Ultimate',
  league_of_legends: 'League of Legends',
  valorant: 'Valorant',
}

function TournamentCountdown({ startDate }: { startDate: string }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const target = new Date(startDate).getTime()

    const updateTimer = () => {
      const now = new Date().getTime()
      const diff = target - now

      if (diff <= 0) {
        setTimeLeft('¡Ha comenzado!')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft(`Comienza en: ${days}d ${hours}h ${minutes}m ${seconds}s`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [startDate])

  return (
    <span className="text-[9px] bg-neon-cyan/15 text-neon-cyan px-2.5 py-1 rounded-full font-black uppercase tracking-wider block mt-1.5 w-max">
      {timeLeft}
    </span>
  )
}

export function ProfileStatsClient({
  profile,
  user,
  participations,
  badges,
  rankings,
  pointsHistory,
  gameAccounts = [],
  isStaff = false,
  tickets = [],
  defaultTab = 'inicio',
}: ProfileStatsClientProps) {
  const [activeTab, setActiveTab] = useState<'inicio' | 'profile' | 'history' | 'badges' | 'stats' | 'friends' | 'sorteos'>(defaultTab)

  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  const [username, setUsername] = useState(profile?.username ?? '')
  const [streamUrl, setStreamUrl] = useState(profile?.stream_url ?? '')
  const [discordUsername, setDiscordUsername] = useState(profile?.discord_username ?? '')
  const [discordGuildId, setDiscordGuildId] = useState(profile?.discord_guild_id ?? '')
  const [isSaving, setIsSaving] = useState(false)

  // Invitations states
  const [invitations, setInvitations] = useState<any[]>([])
  const [loadingInvitations, setLoadingInvitations] = useState(false)

  const fetchInvitations = async () => {
    setLoadingInvitations(true)
    const res = await getPendingInvitations()
    if (res && 'invitations' in res) {
      setInvitations(res.invitations || [])
    }
    setLoadingInvitations(false)
  }

  useEffect(() => {
    fetchInvitations()
  }, [])

  const handleConfirmInvitation = async (invitationId: string) => {
    const toastId = toast.loading('Confirmando tu participación...')
    const res = await confirmTeamParticipation(invitationId)
    if (res && 'success' in res) {
      toast.success('¡Participación confirmada con éxito!', { id: toastId })
      fetchInvitations()
    } else if (res && 'error' in res) {
      if ((res as any).discordUrl) {
        toast.error(
          <div className="space-y-2">
            <p>{res.error}</p>
            <a 
              href={(res as any).discordUrl} 
              target="_blank" 
              rel="noreferrer"
              className="inline-block px-3 py-1 bg-[#5865F2] hover:bg-[#4752C4] text-white text-[10px] uppercase font-bold rounded-lg tracking-wider"
            >
              Unirse al Servidor de Discord
            </a>
          </div>,
          { id: toastId, duration: 8000 }
        )
      } else {
        toast.error(res.error, { id: toastId })
      }
    }
  }

  const handleRejectInvitation = async (invitationId: string) => {
    if (!confirm('¿Estás seguro de que deseas rechazar esta invitación al equipo?')) return
    const toastId = toast.loading('Rechazando invitación...')
    const res = await rejectTeamParticipation(invitationId)
    if (res && 'success' in res) {
      toast.success('Invitación rechazada', { id: toastId })
      fetchInvitations()
    } else if (res && 'error' in res) {
      toast.error(res.error, { id: toastId })
    }
  }

  // Friends states
  const [friends, setFriends] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [searchingUsers, setSearchingUsers] = useState(false)

  useEffect(() => {
    if (activeTab === 'friends' || activeTab === 'inicio') {
      const loadFriends = async () => {
        setLoadingFriends(true)
        const res = await getFriendsList()
        if (res && 'data' in res) {
          setFriends(res.data || [])
        } else if (res && 'error' in res) {
          toast.error(res.error)
        }
        setLoadingFriends(false)
      }
      loadFriends()
    }
  }, [activeTab])

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim().length < 2) {
      toast.error('Ingresa al menos 2 caracteres para buscar')
      return
    }
    setSearchingUsers(true)
    const res = await searchUsersForFriends(searchQuery)
    if (res && 'data' in res) {
      setSearchResults(res.data || [])
    } else if (res && 'error' in res) {
      toast.error(res.error)
    }
    setSearchingUsers(false)
  }

  const handleAddFriend = async (friendId: string) => {
    const res = await sendFriendRequest(friendId)
    if (res && 'success' in res) {
      toast.success('¡Amigo agregado con éxito!')
      setSearchResults(prev => prev.filter(p => p.id !== friendId))
      const listRes = await getFriendsList()
      if (listRes && 'data' in listRes) {
        setFriends(listRes.data || [])
      }
    } else if (res && 'error' in res) {
      toast.error(res.error)
    }
  }

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar a este amigo?')) return
    const res = await removeFriend(friendId)
    if (res && 'success' in res) {
      toast.success('Amigo eliminado')
      setFriends(prev => prev.filter(f => f.id !== friendId))
    } else if (res && 'error' in res) {
      toast.error(res.error)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!username || username.trim().length < 2) {
      toast.error('Mínimo 2 caracteres')
      return
    }
    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.append('username', username.trim())
      formData.append('stream_url', streamUrl.trim())
      formData.append('discord_username', discordUsername.trim())
      formData.append('discord_guild_id', discordGuildId.trim())
      const res = await updateProfile(formData)
      if (res && 'error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Perfil y Discord actualizados correctamente')
      }
    } catch (err: any) {
      toast.error('Error al actualizar perfil: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || null)
  const [isUploading, setIsUploading] = useState(false)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const toastId = toast.loading('Subiendo foto de perfil...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await uploadProfileAvatar(formData)
      if (res && 'error' in res) {
        toast.error(res.error, { id: toastId })
      } else {
        toast.success('Foto de perfil actualizada con éxito', { id: toastId })
        if (res.url) {
          setAvatarUrl(res.url)
        }
      }
    } catch (err: any) {
      toast.error('Error al subir foto: ' + err.message, { id: toastId })
    } finally {
      setIsUploading(false)
    }
  }

  const roleLabel = (isStaff && (profile?.role === 'USER' || !profile?.role))
    ? { label: 'Colaborador Staff', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' }
    : ((({
        SUPER_ADMIN: { label: 'Super Admin', color: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10' },
        ADMIN: { label: 'Administrador', color: 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10' },
        KRONIX_STAFF: { label: 'Staff', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
        STREAMER: { label: 'Streamer', color: 'text-neon-purple border-neon-purple/30 bg-neon-purple/10' },
        USER: { label: 'Usuario', color: 'text-white/40 border-white/10 bg-white/5' },
      } as any)[profile?.role ?? 'USER']) || { label: 'Usuario', color: 'text-white/40 border-white/10 bg-white/5' })

  let subLabel = (({
    ACTIVE: { label: 'Activa', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
    PENDING: { label: 'Pendiente', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
    NONE: { label: 'Free', color: 'text-white/30 border-white/10 bg-white/5' },
    EXPIRED: { label: 'Expirada', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  } as any)[profile?.subscriptionStatus ?? 'NONE']) || { label: 'Free', color: 'text-white/30 border-white/10 bg-white/5' }

  if (profile?.role === 'SUPER_ADMIN') {
    subLabel = { label: 'Infinita ♾️', color: 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10' }
  }

  // 1. Chart Data: Ranking Evolution (Cumulative Points)
  const rankingChartData = useMemo(() => {
    let accumulatedPoints = 0
    return (pointsHistory || []).map((h, index) => {
      accumulatedPoints += Number(h.points_awarded)
      return {
        name: `T${index + 1}`,
        puntos: accumulatedPoints,
        fecha: new Date(h.created_at).toLocaleDateString('es', { month: 'short', day: 'numeric' }),
      }
    })
  }, [pointsHistory])

  // 2. Chart Data: Placement distribution
  const placementChartData = useMemo(() => {
    const distribution: Record<string, number> = {
      '1er Lugar': 0,
      '2do Lugar': 0,
      '3er Lugar': 0,
      '4to/5to': 0,
      'Otro': 0,
    }

    participations.forEach((p) => {
      const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
      const rank = standing?.rank
      if (rank === 1) distribution['1er Lugar']++
      else if (rank === 2) distribution['2do Lugar']++
      else if (rank === 3) distribution['3er Lugar']++
      else if (rank === 4 || rank === 5) distribution['4to/5to']++
      else if (rank !== undefined) distribution['Otro']++
    })

    return Object.entries(distribution).map(([key, count]) => ({
      name: key,
      cantidad: count,
    }))
  }, [participations])

  // 3. Aggregate stats by game discipline
  const disciplineStats = useMemo(() => {
    const statsMap: Record<string, {
      discipline: string
      tournamentsPlayed: number
      totalKills: number
      totalPoints: number
      bestRank: number | null
      kdRatios: number[]
      avgKillsList: number[]
      brPlacements: number[]
    }> = {}

    participations.forEach((p) => {
      const disc = p.tournaments?.discipline
      if (!disc) return

      if (!statsMap[disc]) {
        statsMap[disc] = {
          discipline: disc,
          tournamentsPlayed: 0,
          totalKills: 0,
          totalPoints: 0,
          bestRank: null,
          kdRatios: [],
          avgKillsList: [],
          brPlacements: []
        }
      }

      const ds = statsMap[disc]
      ds.tournamentsPlayed++

      if (p.total_kills !== undefined && p.total_kills !== null) {
        ds.totalKills += Number(p.total_kills)
      }

      if (p.kd_ratio !== undefined && p.kd_ratio !== null && Number(p.kd_ratio) > 0) {
        ds.kdRatios.push(Number(p.kd_ratio))
      }

      if (p.avg_kills !== undefined && p.avg_kills !== null && Number(p.avg_kills) > 0) {
        ds.avgKillsList.push(Number(p.avg_kills))
      }

      if (p.br_avg_placement !== undefined && p.br_avg_placement !== null && Number(p.br_avg_placement) > 0) {
        ds.brPlacements.push(Number(p.br_avg_placement))
      }

      const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
      if (standing) {
        if (standing.total_points !== undefined && standing.total_points !== null) {
          ds.totalPoints += Number(standing.total_points)
        }
        const r = Number(standing.rank)
        if (r > 0) {
          if (ds.bestRank === null || r < ds.bestRank) {
            ds.bestRank = r
          }
        }
      }
    })

    return Object.values(statsMap).map((ds) => {
      const avgKd = ds.kdRatios.length > 0
        ? ds.kdRatios.reduce((a, b) => a + b, 0) / ds.kdRatios.length
        : null

      const avgKills = ds.avgKillsList.length > 0
        ? ds.avgKillsList.reduce((a, b) => a + b, 0) / ds.avgKillsList.length
        : ds.tournamentsPlayed > 0
          ? ds.totalKills / ds.tournamentsPlayed
          : 0

      const avgBrPlacement = ds.brPlacements.length > 0
        ? ds.brPlacements.reduce((a, b) => a + b, 0) / ds.brPlacements.length
        : null

      return {
        discipline: ds.discipline,
        tournamentsPlayed: ds.tournamentsPlayed,
        totalKills: ds.totalKills,
        totalPoints: ds.totalPoints,
        bestRank: ds.bestRank,
        avgKd,
        avgKills,
        avgBrPlacement
      }
    })
  }, [participations])

  const calculatedStats = useMemo(() => {
    const totalTournaments = participations.length
    let podiums = 0
    let totalKills = 0
    let top5 = 0

    participations.forEach(p => {
      const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
      const rank = standing?.rank
      if (rank) {
        if (rank === 1 || rank === 2 || rank === 3) {
          podiums++
        }
        if (rank <= 5) {
          top5++
        }
      }
      totalKills += p.total_kills || 0
    })

    const winRate = totalTournaments > 0 ? Math.round((participations.filter(p => {
      const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
      return standing?.rank === 1
    }).length / totalTournaments) * 100) : 0
    
    const avgKills = totalTournaments > 0 ? (totalKills / totalTournaments).toFixed(1) : '0'

    return {
      totalTournaments,
      podiums,
      totalKills,
      avgKills,
      winRate,
      top5
    }
  }, [participations])

  return (
    <div className="space-y-6">
      {/* Account Info Card */}
      <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex items-start gap-4">
          <label className="relative w-16 h-16 rounded-2xl border border-neon-cyan/20 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden group">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleAvatarChange} 
              className="hidden" 
              disabled={isUploading}
            />
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="Avatar" 
                className="w-full h-full object-cover transition-opacity group-hover:opacity-40" 
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 flex items-center justify-center transition-opacity group-hover:opacity-40">
                <span className="text-neon-cyan text-2xl font-black font-orbitron">
                  {(profile?.username?.[0] || user.email?.[0] || '?').toUpperCase()}
                </span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[9px] font-black uppercase text-neon-cyan tracking-wider">Subir</span>
            </div>
          </label>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white text-lg font-bold font-orbitron truncate">
                {profile?.username || 'Usuario Sin Nickname'}
              </p>
              {(profile?.subscription_status === 'ACTIVE' || profile?.subscriptionStatus === 'ACTIVE') && (
                <div title="Usuario VIP" className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.5 19h19v2h-19zm18.57-11.45c-.24-.46-.74-.72-1.25-.66L15.5 7.53 12.63 2.1c-.24-.45-.7-.71-1.2-.67s-.92.35-1.11.81L7.75 7.37 3.53 6.78c-.52-.08-1.02.16-1.27.61-.26.46-.2.1.06.52l4.16 7.63c.2.37.59.61 1.01.61h9.04c.42 0 .8-.24 1-.61l4.16-7.63c.27-.42.33-.96.08-1.42z"/></svg>
                </div>
              )}
            </div>
            <p className="text-white/40 text-xs mt-0.5">{user.email}</p>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border ${roleLabel.color}`}>
                {roleLabel.label}
              </span>
              <span className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border ${(profile?.subscription_status === 'ACTIVE' || profile?.subscriptionStatus === 'ACTIVE') ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : subLabel.color}`}>
                Membresía: {(profile?.subscription_status === 'ACTIVE' || profile?.subscriptionStatus === 'ACTIVE') ? 'VIP Activa' : subLabel.label}
              </span>
            </div>
          </div>
        </div>

        {/* Platform points summary */}
        {rankings && rankings.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-white/5">
            {rankings.map((r) => (
              <div key={r.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5">
                <p className="text-white/40 text-[9px] uppercase font-black tracking-widest truncate">
                  {GAME_NAMES[r.discipline] || r.discipline}
                </p>
                <p className="text-xl font-bold font-orbitron text-neon-cyan mt-1">
                  {Number(r.points).toFixed(1)} <span className="text-xs text-white/50">pts</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>



      {/* Tab Contents */}
      <div className="space-y-6">
          {activeTab === 'sorteos' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider">Mis Boletos Adquiridos</h3>
                <p className="text-xs text-white/40">Consulta el estado de verificación y resultados de tus sorteos.</p>
              </div>
              <a
                href="/raffles"
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 uppercase tracking-wider transition-all"
              >
                Ver Sorteos Activos
              </a>
            </div>

            {tickets.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white/[0.005] border border-white/5 border-dashed space-y-4">
                <Ticket className="w-10 h-10 text-white/20 mx-auto animate-pulse" />
                <p className="text-white/30 text-xs">No has adquirido boletos en ningún sorteo actualmente.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.map((t: any) => {
                  const isVerified = t.payment_status === 'verified'
                  const isFinished = t.raffle?.status === 'finished'
                  const isWinner = isFinished && t.raffle?.winner_name === t.buyer_name

                  return (
                    <motion.div
                      key={t.id}
                      whileHover={{ scale: 1.015, y: -2 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                      className="w-full"
                    >
                      <GlowCard
                        glowColor="#00F5FF"
                        borderColor="rgba(255, 255, 255, 0.05)"
                        className="bg-dark-card flex flex-col md:flex-row justify-between items-stretch gap-0 group hover:border-white/10 transition-all shadow-lg overflow-hidden relative"
                      >
                        {/* Holographic Gloss Shine Effect */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-20">
                          <div className="absolute -inset-y-12 left-[-30%] w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-[25deg] transition-all duration-1000 ease-out group-hover:left-[130%]" />
                        </div>

                        {/* Main Stub */}
                        <div className="p-5 flex-1 flex gap-4 items-center min-w-0">
                          <div className="w-14 h-14 rounded-xl bg-neutral-900 overflow-hidden shrink-0 border border-white/10 relative">
                            {t.raffle?.prize_image ? (
                              <img src={t.raffle.prize_image} alt={t.raffle.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">🎁</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <span className="text-[8px] font-orbitron font-black text-neon-cyan uppercase tracking-widest block">KRONIX BOLETO OFICIAL</span>
                            <h4 className="text-xs font-bold text-white font-orbitron line-clamp-1">
                              {t.raffle?.title}
                            </h4>
                            <p className="text-[9px] text-white/40 font-mono">
                              ADQUIRIDO: {new Date(t.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            {/* Simulated Barcode */}
                            <div className="pt-2.5 flex items-center gap-1 opacity-40 group-hover:opacity-85 transition-opacity relative overflow-hidden">
                              {/* Neon scanning laser line for barcode */}
                              <motion.div
                                initial={{ top: '0%' }}
                                animate={{ top: ['0%', '100%', '0%'] }}
                                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                                className="absolute left-0 right-0 h-[1.5px] bg-neon-cyan/80 blur-[0.5px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                              />

                              <div className="h-3.5 w-[2px] bg-white"></div>
                              <div className="h-3.5 w-[1px] bg-white"></div>
                              <div className="h-3.5 w-[3px] bg-white"></div>
                              <div className="h-3.5 w-[1px] bg-white"></div>
                              <div className="h-3.5 w-[2px] bg-white"></div>
                              <div className="h-3.5 w-[4px] bg-white"></div>
                              <div className="h-3.5 w-[1px] bg-white"></div>
                              <div className="h-3.5 w-[2px] bg-white"></div>
                              <div className="h-3.5 w-[3px] bg-white"></div>
                              <span className="text-[7px] font-mono text-white/80 tracking-widest pl-2">KRNX-{t.id.slice(0, 8).toUpperCase()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Ticket Divider */}
                        <div className="hidden md:flex flex-col justify-between items-center relative py-2 shrink-0 w-4">
                          {/* Top notch */}
                          <div className="absolute -top-1.5 left-0.5 w-3 h-3 bg-dark-bg border-b border-white/5 rounded-full z-10"></div>
                          {/* Dashed line */}
                          <div className="w-[1px] h-full border-r border-dashed border-white/10"></div>
                          {/* Bottom notch */}
                          <div className="absolute -bottom-1.5 left-0.5 w-3 h-3 bg-dark-bg border-t border-white/5 rounded-full z-10"></div>
                        </div>

                        {/* Receipt Stub */}
                        <div className="p-5 bg-white/[0.01] md:w-44 shrink-0 flex flex-col justify-center items-center gap-2 text-center border-t md:border-t-0 md:border-l border-white/5 relative">
                          <span className="text-[8px] font-orbitron font-bold text-white/30 uppercase tracking-wider block">NÚMERO DE BOLETO</span>
                          <span className="text-lg font-orbitron font-black text-neon-cyan tracking-wider drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                            #{t.ticket_number}
                          </span>

                          <div className="flex flex-col items-center gap-1.5 mt-0.5">
                            {isVerified ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[8px] font-bold uppercase tracking-wider">
                                ✓ Confirmado
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[8px] font-bold uppercase tracking-wider animate-pulse">
                                ⚡ Verificando
                              </span>
                            )}

                            {isFinished && (
                              <div>
                                {isWinner ? (
                                  <span className="px-2 py-0.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-[8px] font-orbitron font-bold uppercase tracking-widest animate-bounce flex items-center gap-1">
                                    <Trophy className="w-3 h-3 text-gold inline" /> Ganador
                                  </span>
                                ) : (
                                  <span className="text-[8px] text-white/20 uppercase tracking-widest block font-orbitron">
                                    No premiado
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </GlowCard>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'inicio' && (
          <div className="space-y-6">
            {/* General Announcements & Welcome Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-neon-purple/20 via-neon-cyan/10 to-transparent border border-white/5 relative overflow-hidden">
              <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
                <Trophy size={100} className="text-neon-cyan" />
              </div>
              <h4 className="font-orbitron font-black text-lg text-white uppercase tracking-tight mb-2">
                ¡Bienvenido a tu Centro de Mando, {profile?.username || 'Gamer'}!
              </h4>
              <p className="text-xs text-white/60 leading-relaxed max-w-xl">
                Desde aquí puedes gestionar tu historial competitivo, consultar tus estadísticas, revisar tus boletos de sorteos activos y conectar con tu escuadra. ¡Que comience el juego!
              </p>
            </div>

            {/* Pending Team Invitations Section */}
            {invitations && invitations.length > 0 && (
              <div className="space-y-4 bg-neon-cyan/5 border border-neon-cyan/20 p-6 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚔️</span>
                  <h4 className="font-orbitron font-black text-sm text-neon-cyan uppercase tracking-wider">
                    Invitaciones de Equipo Pendientes
                  </h4>
                </div>
                <p className="text-xs text-white/60">
                  Has sido invitado a los siguientes equipos. Para confirmar tu participación, debes verificar tu cuenta de Discord y estar dentro del servidor de Discord correspondiente.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {invitations.map((inv) => {
                    const tourney = inv.tournaments
                    const team = inv.teams
                    return (
                      <div 
                        key={inv.id} 
                        className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-neon-purple">
                            Torneo: {tourney?.name}
                          </p>
                          <h5 className="text-white font-orbitron font-bold text-sm mt-0.5">
                            Equipo: {team?.name}
                          </h5>
                          {tourney?.start_date && (
                            <p className="text-[10px] text-white/40 mt-1">
                              Inicia: {new Date(tourney.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleConfirmInvitation(inv.id)}
                            className="flex-1 px-3 py-1.5 bg-neon-cyan text-black font-black uppercase tracking-widest text-[9px] rounded-lg hover:bg-neon-cyan/80 transition-colors flex items-center justify-center gap-1"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => handleRejectInvitation(inv.id)}
                            className="px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 font-bold uppercase tracking-widest text-[9px] rounded-lg hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Quick Action Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <a 
                href="/torneos"
                className="p-4 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-neon-cyan/30 transition-all text-center space-y-2 group"
              >
                <div className="text-xl">🏆</div>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50 group-hover:text-neon-cyan transition-colors">
                  Torneos Públicos
                </span>
              </a>
              <a 
                href="/rankings"
                className="p-4 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-neon-purple/30 transition-all text-center space-y-2 group"
              >
                <div className="text-xl">📈</div>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50 group-hover:text-neon-purple transition-colors">
                  Rankings Nacionales
                </span>
              </a>
              <a 
                href="/raffles"
                className="p-4 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-yellow-500/30 transition-all text-center space-y-2 group"
              >
                <div className="text-xl">🎟️</div>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50 group-hover:text-yellow-400 transition-colors">
                  Sorteos Activos
                </span>
              </a>
              <a 
                href="/wallet"
                className="p-4 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-green-500/30 transition-all text-center space-y-2 group"
              >
                <div className="text-xl">💳</div>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50 group-hover:text-green-400 transition-colors">
                  Mi Billetera
                </span>
              </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Main Dashboard Section */}
            <div className="lg:col-span-2 space-y-6">
              {/* Torneos Inscritos widget */}
              <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-neon-cyan" /> Torneos Inscritos
                </h3>
                
                {(() => {
                  const upcoming = participations.filter(p => {
                    const status = p.tournaments?.status
                    return status === 'pending' || status === 'active'
                  })
                  
                  if (upcoming.length === 0) {
                    return (
                      <div className="text-center py-8 border border-dashed border-white/5 rounded-2xl bg-white/[0.005]">
                        <p className="text-white/30 text-xs mb-3">No estás inscrito en ningún torneo activo o pendiente actualmente.</p>
                        <a 
                          href="/torneos"
                          className="inline-block px-4 py-2 bg-neon-cyan/10 border border-neon-cyan/20 hover:bg-neon-cyan/20 text-neon-cyan text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                        >
                          Explorar Torneos Públicos
                        </a>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="space-y-4">
                      {upcoming.map(p => {
                        const t = p.tournaments
                        const status = t?.status
                        const isPending = status === 'pending'
                        return (
                          <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
                                <Trophy className="w-4 h-4 text-white/50" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-white font-orbitron">{t?.name}</h4>
                                <p className="text-[10px] text-neon-cyan uppercase mt-0.5">{GAME_NAMES[t?.discipline] || t?.discipline}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-start sm:items-end gap-1">
                              {t?.start_date && (
                                <TournamentCountdown startDate={t.start_date} />
                              )}
                              <a 
                                href={`/t/${t?.slug}`}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-wider text-white border border-white/10 rounded-lg transition-all"
                              >
                                Ver Detalles
                              </a>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>

              {/* Sorteos Participando widget */}
              <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-neon-cyan" /> Sorteos Participando
                </h3>
                
                {tickets.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-white/5 rounded-2xl bg-white/[0.005]">
                    <p className="text-white/30 text-xs mb-3">No has adquirido boletos en ningún sorteo activo actualmente.</p>
                    <a 
                      href="/raffles"
                      className="inline-block px-4 py-2 bg-neon-cyan/10 border border-neon-cyan/20 hover:bg-neon-cyan/20 text-neon-cyan text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                    >
                      Explorar Sorteos
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const rafflesMap: Record<string, { title: string; prize_image: string; count: number; status: string; id: string }> = {}
                      tickets.forEach(t => {
                        const r = t.raffle
                        if (r) {
                          if (!rafflesMap[t.raffle_id]) {
                            rafflesMap[t.raffle_id] = {
                              id: t.raffle_id,
                              title: r.title,
                              prize_image: r.prize_image,
                              count: 0,
                              status: r.status
                            }
                          }
                          rafflesMap[t.raffle_id].count++
                        }
                      })
                      const raffleParticipations = Object.values(rafflesMap)

                      return raffleParticipations.map(rp => (
                        <div key={rp.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 overflow-hidden shrink-0">
                              {rp.prize_image ? (
                                <img src={rp.prize_image} alt={rp.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Ticket className="w-4 h-4 text-white/40" />
                                </div>
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white font-orbitron line-clamp-1">{rp.title}</h4>
                              <p className="text-[10px] text-white/40 mt-0.5">
                                Tienes <strong className="text-neon-cyan">{rp.count}</strong> boletos
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-start sm:items-end gap-1">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-orbitron font-bold uppercase tracking-wider ${
                              rp.status === 'finished' ? 'bg-white/10 text-white/50 border border-white/5' : 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                            }`}>
                              {rp.status === 'finished' ? 'Finalizado' : 'Activo'}
                            </span>
                            <a 
                              href={rp.status === 'finished' ? `/raffles` : `/raffles/${rp.id}`}
                              className="px-3 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-wider text-white border border-white/10 rounded-lg transition-all"
                            >
                              Ver Sorteo
                            </a>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </div>

              {/* Top Skills / Discipline Rankings widget */}
              <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-neon-cyan shrink-0" />
                  <span>Mis Estadísticas y Skills</span>
                </h3>
                
                {rankings.length === 0 ? (
                  <div className="text-center py-8 text-white/30 text-xs border border-dashed border-white/5 rounded-2xl bg-white/[0.005]">
                    Participa en partidas puntuadas para ver tu clasificación de skill aquí.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {rankings.slice(0, 4).map((r) => (
                      <div key={r.id} className="p-4 rounded-xl bg-white/[0.01] border border-white/5">
                        <span className="text-[9px] uppercase font-bold tracking-widest text-white/30 block mb-1">
                          {GAME_NAMES[r.discipline] || r.discipline}
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-xl font-bold font-orbitron text-neon-cyan">{Number(r.points).toFixed(1)}</span>
                          <span className="text-[9px] text-white/50 font-bold uppercase">Puntos de Rango</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Widget Sidebar Section */}
            <div className="space-y-6">
              {/* Amigos Widget */}
              <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                    <span>👥</span> Amigos
                  </h3>
                  <button 
                    onClick={() => setActiveTab('friends')}
                    className="text-[9px] uppercase font-bold tracking-wider text-neon-cyan hover:underline"
                  >
                    Ver todos
                  </button>
                </div>
                
                {friends.length === 0 ? (
                  <div className="text-center py-6 text-white/30 text-[10px] border border-dashed border-white/5 rounded-xl bg-white/[0.005]">
                    Sin amigos agregados.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {friends.slice(0, 3).map(f => (
                      <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.005]">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden text-xs shrink-0">
                            👤
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{f.username}</p>
                            <p className="text-[8px] text-white/30 font-mono truncate">{f.short_id}</p>
                          </div>
                        </div>
                        {f.stream_url && (
                          <a 
                            href={f.stream_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/20 text-neon-cyan text-[8px] font-bold uppercase tracking-wider rounded"
                          >
                            Live
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Medallas Ganadas Widget */}
              <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-neon-cyan" />
                    <span>Medallas Ganadas</span>
                  </h3>
                  <button 
                    onClick={() => setActiveTab('badges')}
                    className="text-[9px] uppercase font-bold tracking-wider text-neon-cyan hover:underline"
                  >
                    Ver todas
                  </button>
                </div>
                
                {badges.length === 0 ? (
                  <div className="text-center py-6 text-white/30 text-[10px] border border-dashed border-white/5 rounded-xl bg-white/[0.005]">
                    Aún no tienes medallas.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {badges.slice(0, 8).map(b => (
                      <div key={b.id} className="aspect-square rounded-lg bg-black/40 border border-white/10 flex items-center justify-center p-1.5 overflow-hidden transition-all hover:border-white/20" title={b.name}>
                        {b.badge_url ? (
                          <img src={b.badge_url} alt={b.name} className="w-full h-full object-contain drop-shadow-[0_0_5px_rgba(0,245,255,0.2)]" />
                        ) : (
                          <Trophy className="w-4 h-4 text-yellow-400/80" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

        {activeTab === 'profile' && (
          <>
            <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6 space-y-4">
              <h2 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-2">Editar perfil</h2>
              <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-1.5 mb-4">
                <span className="text-[9px] uppercase font-bold tracking-wider text-white/40">Tu ID Único de Amigo</span>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs font-mono text-neon-cyan select-all">{profile?.shortId || 'KX-XXXXXX'}</code>
                  <button
                    type="button"
                    onClick={() => {
                      if (profile?.shortId) {
                        navigator.clipboard.writeText(profile.shortId)
                        toast.success('¡ID Copiado al portapapeles!')
                      }
                    }}
                    className="px-2.5 py-1 bg-white/5 border border-white/10 hover:bg-neon-cyan hover:text-black hover:border-neon-cyan transition-all rounded text-[9px] font-black uppercase tracking-wider shrink-0"
                  >
                    Copiar
                  </button>
                </div>
                <p className="text-[9px] text-white/30">Comparte este ID con tus amigos para que te agreguen al instante.</p>
              </div>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-xs text-white/50 uppercase tracking-widest font-bold mb-1.5">
                    Username / Nickname
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Tu nombre de usuario"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
                  />
                  <p className="text-[10px] text-white/40 mt-2">
                    Solo se permiten letras, números y guiones bajos (sin espacios). Mínimo 2, máximo 30 caracteres.
                    <span className="text-yellow-500/80 block mt-1 font-semibold">
                      Límite: Tienes 1 cambio gratuito de nombre. (Cambios realizados: {profile?.usernameChangesCount || 0}/1)
                    </span>
                  </p>
                </div>

                <div>
                  <label htmlFor="stream_url" className="block text-xs text-white/50 uppercase tracking-widest font-bold mb-1.5">
                    Canal de Transmisión (URL)
                  </label>
                  <input
                    id="stream_url"
                    name="stream_url"
                    type="text"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="https://twitch.tv/tu_canal"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
                  />
                  <p className="text-[10px] text-white/40 mt-1">
                    Ingresa tu canal de Twitch, Kick, YouTube o Facebook Gaming para precargarlo en tus inscripciones.
                  </p>
                </div>

                <div>
                  <label htmlFor="discord_username" className="block text-xs text-white/50 uppercase tracking-widest font-bold mb-1.5">
                    Cuenta de Discord
                  </label>
                  <input
                    id="discord_username"
                    name="discord_username"
                    type="text"
                    value={discordUsername}
                    onChange={(e) => setDiscordUsername(e.target.value)}
                    placeholder="Ej: nombre_usuario#0000 o nombre_usuario"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
                  />
                  <p className="text-[10px] text-white/40 mt-1">
                    Vincula tu usuario de Discord para coordinar partidas y verificar tu identidad social.
                  </p>
                </div>

                <div>
                  <label htmlFor="discord_guild_id" className="block text-xs text-white/50 uppercase tracking-widest font-bold mb-1.5">
                    Servidor de Discord (Enlace de Invitación o ID)
                  </label>
                  <input
                    id="discord_guild_id"
                    name="discord_guild_id"
                    type="text"
                    value={discordGuildId}
                    onChange={(e) => setDiscordGuildId(e.target.value)}
                    placeholder="Ej: https://discord.gg/4CFcdEC7V o ID de Servidor"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
                  />
                  <p className="text-[10px] text-white/40 mt-1">
                    Solo para Organizadores/Streamers. Puedes pegar el <strong>enlace de invitación de tu servidor</strong> (ej: <code className="text-neon-cyan">https://discord.gg/...</code>) o el ID numérico. El sistema lo detectará automáticamente.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-xs uppercase font-bold tracking-widest rounded-xl hover:bg-neon-cyan/20 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </form>
            </div>
            {/* Subscription card */}
            {profile?.role !== 'ADMIN' && profile?.role !== 'SUPER_ADMIN' && (
              <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6 space-y-4">
                <h2 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-2">Suscripción</h2>
                {profile?.subscriptionStatus === 'ACTIVE' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <p className="text-green-400 text-sm font-semibold">Suscripción activa</p>
                    </div>
                    {profile?.subscriptionExpiry && (
                      <p className="text-white/30 text-xs">
                        Renovar antes del: {new Date(profile.subscriptionExpiry).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                    <p className="text-white/20 text-xs">Para renovar, sube un nuevo comprobante antes de que expire.</p>
                  </div>
                ) : profile?.subscriptionStatus === 'PENDING' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                      <p className="text-yellow-400 text-sm font-semibold">Solicitud en revisión</p>
                    </div>
                    <p className="text-white/40 text-sm">Tu comprobante fue recibido. Te notificaremos cuando el administrador lo apruebe.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-neon-purple/5 border border-neon-purple/20 rounded-xl">
                      <p className="text-neon-purple text-sm font-bold">Plan Streamer Pro — $15 / mes</p>
                      <p className="text-white/40 text-xs mt-1">Torneos ilimitados · Leaderboard en vivo · Bridge Apuestas Kronix · Streamer codes</p>
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
            {/* Game accounts */}
            <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider">🎮 Mis Cuentas de Juego</h2>
                  <p className="text-white/30 text-xs mt-0.5">Vincula tu ID y nombre de cuenta para cada juego. Se usarán en tus inscripciones.</p>
                </div>
              </div>
              <GameAccountsSection initialAccounts={gameAccounts} />
            </div>
          </>
        )}

        {activeTab === 'friends' && (
          <div className="space-y-6">
            {/* Search users to add */}
            <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-4">
                Buscar y Agregar Amigos
              </h3>
              <form onSubmit={handleSearchUsers} className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nickname..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors text-xs"
                />
                <button
                  type="submit"
                  disabled={searchingUsers}
                  className="px-5 py-3 bg-neon-cyan text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all hover:bg-neon-cyan/90 disabled:opacity-50 shrink-0"
                >
                  {searchingUsers ? 'Buscando...' : 'Buscar'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="mt-4 border-t border-white/5 pt-4 space-y-3">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-white/40">Resultados de búsqueda:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {searchResults.map((result) => (
                      <div key={result.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            {result.avatar_url ? (
                              <img src={result.avatar_url} alt={result.username} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs">👤</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{result.username || 'Sin Nickname'}</p>
                            <span className="text-[9px] text-white/40 block font-mono">{result.short_id}</span>
                            {result.stream_url && (
                              <span className="text-[9px] text-neon-cyan block truncate max-w-[120px]">📺 {result.stream_url}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddFriend(result.id)}
                          className="px-2.5 py-1.5 bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-neon-cyan/20 transition-all"
                        >
                          + Agregar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Friends list */}
            <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-4">
                Mi Lista de Amigos ({friends.length})
              </h3>

              {loadingFriends ? (
                <div className="text-center py-10 text-white/30 text-sm">
                  Cargando amigos...
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-10 text-white/30 text-xs border border-dashed border-white/5 rounded-2xl bg-white/[0.005]">
                  Aún no tienes amigos agregados. Usa la barra de búsqueda superior para encontrar a tus compañeros de juego.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                          {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt={friend.username} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-white/30" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{friend.username || 'Sin Nickname'}</p>
                          <span className="text-[9px] text-white/40 block font-mono mb-1">{friend.short_id}</span>
                          {friend.stream_url ? (
                            <a 
                              href={friend.stream_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[9px] text-neon-cyan hover:underline block truncate max-w-[180px]"
                            >
                              📺 Ver canal
                            </a>
                          ) : (
                            <span className="text-[9px] text-white/20">Sin canal de transmisión</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFriend(friend.id)}
                        className="p-2 text-white/30 hover:text-red-400 rounded-lg hover:bg-red-500/5 transition-all text-xs"
                        title="Eliminar amigo"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6 overflow-hidden">
            <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-4">
              Historial de Torneos
            </h3>

            {participations.length === 0 ? (
              <div className="text-center py-10 text-white/30 text-sm">
                Aún no has participado en ningún torneo. ¡Inscríbete en uno para comenzar!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-white/40 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                      <th className="pb-3">Torneo</th>
                      <th className="pb-3">Juego</th>
                      <th className="pb-3">Equipo</th>
                      <th className="pb-3 text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {participations.map((p) => {
                      const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
                      const rank = standing?.rank
                      const isUpcoming = p.tournaments?.status === 'pending' || (p.tournaments?.start_date && new Date(p.tournaments.start_date) > new Date())
                      return (
                        <tr key={p.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3.5 font-bold text-white">
                            <div className="flex flex-col">
                              <a href={`/t/${p.tournaments?.slug}`} className="hover:text-neon-cyan transition-colors">
                                {p.tournaments?.name}
                              </a>
                              {isUpcoming && p.tournaments?.start_date && (
                                <TournamentCountdown startDate={p.tournaments.start_date} />
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 text-white/50 text-xs">
                            {GAME_NAMES[p.tournaments?.discipline] || p.tournaments?.discipline}
                          </td>
                          <td className="py-3.5 text-white/70 font-semibold">{p.teams?.name}</td>
                          <td className="py-3.5 text-right font-orbitron font-black">
                            {isUpcoming ? (
                              <span className="text-neon-cyan/50 text-[10px] uppercase font-bold tracking-widest">Inscrito</span>
                            ) : rank ? (
                              <span className={`inline-flex items-center gap-1 ${rank === 1 ? 'text-gold' : rank === 2 ? 'text-white/95' : rank === 3 ? 'text-orange-400' : 'text-white/40'}`}>
                                #{rank} {rank === 1 && <Trophy size={12} className="inline text-gold shrink-0" />}
                              </span>
                            ) : (
                              <span className="text-white/20">En juego</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
            <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-6">
              Medallas Obtenidas
            </h3>

            {badges.length === 0 ? (
              <div className="text-center py-10 text-white/30 text-sm">
                Las medallas e insignias se desbloquean al quedar en el Podio (Top 3) de los torneos finalizados.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {badges.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col items-center text-center p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
                  >
                    <div className="relative w-16 h-16 mb-3 flex items-center justify-center">
                      <div className="absolute inset-0 bg-neon-cyan/5 rounded-full blur-md group-hover:bg-neon-cyan/15 transition-colors" />
                      <img
                        src={b.badge_url}
                        alt={b.name}
                        className="w-14 h-14 object-contain relative z-10 drop-shadow-[0_0_10px_rgba(0,245,255,0.2)]"
                      />
                    </div>
                    <p className="text-white text-xs font-bold font-orbitron truncate max-w-full">{b.name}</p>
                    <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mt-1">
                      Desbloqueado: {new Date(b.awarded_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6 animate-fade-in">
            {/* Historical Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Copas Jugadas', value: calculatedStats.totalTournaments, color: 'text-yellow-450', icon: Trophy, bg: 'bg-yellow-500/5 border-yellow-500/15' },
                { label: 'Podios (Top 3)', value: calculatedStats.podiums, color: 'text-neon-cyan', icon: Award, bg: 'bg-neon-cyan/5 border-neon-cyan/15' },
                { label: 'Kills Históricas', value: calculatedStats.totalKills, color: 'text-red-400', icon: Activity, bg: 'bg-red-500/5 border-red-500/15' },
                { label: 'Promedio Kills', value: calculatedStats.avgKills, color: 'text-orange-400', icon: Flame, bg: 'bg-orange-500/5 border-orange-500/15' },
                { label: 'Win Rate', value: `${calculatedStats.winRate}%`, color: 'text-green-400', icon: TrendingUp, bg: 'bg-green-500/5 border-green-500/15' },
                { label: 'Llegadas Top 5', value: calculatedStats.top5, color: 'text-purple-400', icon: Trophy, bg: 'bg-purple-500/5 border-purple-500/15' },
              ].map((stat, i) => {
                const Icon = stat.icon
                return (
                  <div key={i} className={`bg-[#0d0d0f]/60 border rounded-2xl p-5 flex flex-col justify-between ${stat.bg}`}>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] text-white/50 uppercase tracking-widest font-black line-clamp-1">{stat.label}</span>
                      <Icon className={`w-4 h-4 shrink-0 ${stat.color}`} />
                    </div>
                    <p className={`text-2xl font-black font-orbitron mt-2.5 ${stat.color}`}>{stat.value}</p>
                  </div>
                )
              })}
            </div>

            {/* Resumen de Promedios por Juego */}
            <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6 space-y-4">
              <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider">
                Desempeño Promedio por Juego
              </h3>
              {disciplineStats.length === 0 ? (
                <div className="text-center py-10 text-white/30 text-sm">
                  Participa en torneos para ver tus promedios por juego aquí.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {disciplineStats.map((ds) => {
                    const isShooter = ['warzone', 'fortnite', 'free_fire', 'call_of_duty_mobile'].includes(ds.discipline)
                    return (
                      <div
                        key={ds.discipline}
                        className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4 hover:border-white/10 transition-colors animate-fade-in"
                      >
                        <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                          <span className="font-orbitron font-black text-sm text-neon-cyan uppercase tracking-wider">
                            {GAME_NAMES[ds.discipline] || ds.discipline}
                          </span>
                          <span className="text-[10px] bg-white/5 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-white/50">
                            {ds.tournamentsPlayed} {ds.tournamentsPlayed === 1 ? 'Torneo' : 'Torneos'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Mejor Puesto</span>
                            <span className="text-white font-orbitron font-bold text-base">
                              {ds.bestRank ? `#${ds.bestRank}` : '—'}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Puntos Totales</span>
                            <span className="text-white font-orbitron font-bold text-base">
                              {ds.totalPoints.toFixed(1)}
                            </span>
                          </div>

                          {isShooter ? (
                            <>
                              <div className="space-y-1">
                                <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Promedio K/D</span>
                                <span className="text-neon-purple font-orbitron font-bold text-base">
                                  {ds.avgKd !== null ? ds.avgKd.toFixed(2) : '—'}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Kills Promedio</span>
                                <span className="text-white font-orbitron font-bold text-base">
                                  {ds.avgKills.toFixed(1)}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="col-span-2 space-y-1">
                              <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Asesinatos (Kills) Totales</span>
                              <span className="text-white font-orbitron font-bold text-base">
                                {ds.totalKills}
                              </span>
                            </div>
                          )}

                          {ds.avgBrPlacement !== null && (
                            <div className="col-span-2 space-y-1 border-t border-white/5 pt-2">
                              <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Puesto Promedio (BR)</span>
                              <span className="text-yellow-500 font-orbitron font-bold text-base">
                                #{ds.avgBrPlacement.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Evolution chart */}
            <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-4">
                Progreso del Ranking (Puntos Totales)
              </h3>
              {rankingChartData.length < 2 ? (
                <div className="text-center py-10 text-white/30 text-sm">
                  Necesitas participar y puntuar en al menos 2 torneos para graficar tu evolución.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rankingChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                      <XAxis dataKey="name" stroke="#ffffff30" style={{ fontSize: '10px' }} />
                      <YAxis stroke="#ffffff30" style={{ fontSize: '10px' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0d0d0f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase' }}
                        formatter={(value: any, name: any) => [
                          typeof value === 'number' ? Math.round(value * 100) / 100 : value,
                          String(name)
                        ]}
                      />
                      <Line type="monotone" dataKey="puntos" stroke="#00F5FF" strokeWidth={3} dot={{ fill: '#00F5FF', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Placement Chart */}
            <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-4">
                Distribución de Posiciones Obtenidas
              </h3>
              {participations.filter((p) => p.teams?.team_standings?.[0]?.rank || p.teams?.team_standings?.rank).length === 0 ? (
                <div className="text-center py-10 text-white/30 text-sm">
                  Aún no tienes posiciones registradas para graficar.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={placementChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                      <XAxis dataKey="name" stroke="#ffffff30" style={{ fontSize: '10px' }} />
                      <YAxis stroke="#ffffff30" style={{ fontSize: '10px' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0d0d0f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                        formatter={(value: any, name: any) => [
                          typeof value === 'number' ? Math.round(value * 100) / 100 : value,
                          String(name)
                        ]}
                      />
                      <Bar dataKey="cantidad" fill="#a855f7" radius={[6, 6, 0, 0]}>
                        {placementChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? '#E2C222' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#a855f7'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
  )
}
