'use client'

import React, { useEffect, useState, useMemo, useCallback, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Orbitron } from 'next/font/google'
import Link from 'next/link'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { TeamStanding, Participant, Match, Submission, ScoringRule } from '@/types'
import { MatchRecap } from './MatchRecap'
import { TeamDetails } from './TeamDetails'
import { NumberTicker } from '@/components/ui/NumberTicker'

import { AdPlacement } from '@/components/federation/AdPlacement'
import type { AdBanner } from '@/lib/actions/federation'
import { trackEvent } from '@/lib/analytics'
import { registerTournament } from '@/lib/actions/registration'
import { getFriendsList, searchUsersForFriends, sendFriendRequest } from '@/lib/actions/friends'
import { getGameAccountForUser, upsertGameAccount, GAME_LABELS } from '@/lib/actions/game-accounts'
import { toast } from 'sonner'
import { NicknameModal } from '@/components/profile/NicknameModal'
import { placePredictionAction } from '@/lib/actions/predictions'
import { calculatePayPalGrossAmount } from '@/lib/services/paypal-fee'
import { ParticipantProfileModal } from '@/components/tournaments/ParticipantProfileModal'

const orbitron = Orbitron({ subsets: ['latin'] })

function PaymentEvidenceUpload({ 
  teamId, 
  isKronixOfficial,
  isCollaboration,
  onUploadSuccess 
}: { 
  teamId: string, 
  isKronixOfficial: boolean,
  isCollaboration: boolean,
  onUploadSuccess: (url: string) => void 
}) {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTermsDetails, setShowTermsDetails] = useState(false)

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !termsAccepted) return
    setLoading(true)
    setError('')

    try {
      const { uploadEvidence } = await import('@/lib/actions/storage')
      const { uploadPaymentEvidence } = await import('@/lib/actions/registration-flow')
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).slice(2, 10)}.${fileExt}`
      const filePath = `payments/${teamId}/${fileName}`

      const formData = new FormData()
      formData.append('file', file)
      formData.append('filePath', filePath)

      const res = await uploadEvidence(formData)
      if (!res || 'error' in res) {
        throw new Error(res?.error || 'Error al subir comprobante')
      }

      const flowRes = await uploadPaymentEvidence(teamId, res.path)
      if ('error' in flowRes) {
        throw new Error(flowRes.error)
      }

      onUploadSuccess(res.path)
    } catch (err: any) {
      setError(err.message || 'Error al subir la transferencia')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleUpload} className="space-y-4">
      <p className="font-bold text-neon-cyan uppercase tracking-widest text-[10px]">Subir Comprobante de Transferencia</p>
      <div className="flex flex-col gap-3">
        <input 
          type="file" 
          required
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-xs text-white/40 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/5 file:text-white file:cursor-pointer hover:file:bg-white/10"
        />

        {/* Disclaimer / Policies section */}
        <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-left">
          <div className="flex items-start gap-2.5">
            <input 
              id="terms-checkbox"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 rounded border-white/10 bg-black/50 text-neon-cyan focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
            />
            <label htmlFor="terms-checkbox" className="text-[11px] text-white/70 leading-normal select-none cursor-pointer">
              Acepto los términos de inscripción y la{' '}
              <button 
                type="button"
                onClick={() => setShowTermsDetails(!showTermsDetails)}
                className="text-neon-cyan hover:underline font-bold"
              >
                política de pagos y reembolsos
              </button>.
            </label>
          </div>

          {showTermsDetails && (
            <div className="mt-3 pt-3 border-t border-white/5 space-y-2 text-[10px] text-white/50 leading-relaxed animate-fadeIn">
              {isKronixOfficial ? (
                <div className="border-l-2 border-neon-cyan pl-2 bg-neon-cyan/5 p-2 rounded">
                  <span className="text-neon-cyan font-bold block mb-1">🛡️ Torneo Oficial de Kronix</span>
                  Este es un torneo oficial de Kronix E-sports. Las transacciones y reembolsos son gestionados y garantizados directamente por Kronix. En caso de cancelación o remoción de tu equipo, tu dinero de inscripción será devuelto en su totalidad.
                </div>
              ) : isCollaboration ? (
                <div className="border-l-2 border-neon-purple pl-2 bg-neon-purple/5 p-2 rounded">
                  <span className="text-neon-purple font-bold block mb-1">🤝 Torneo en Colaboración (50/50)</span>
                  Este torneo cuenta con el respaldo y coorganización de Kronix. La devolución de tu pago de inscripción se coordinará en un 50% por el streamer organizador y el otro 50% por Kronix.
                </div>
              ) : (
                <div className="border-l-2 border-red-500 pl-2 bg-red-500/5 p-2 rounded">
                  <span className="text-red-400 font-bold block mb-1">⚠️ Deslinde de Responsabilidad</span>
                  Este torneo es de organización independiente por el streamer. <strong>Kronix no se hace responsable por los cobros, pagos ni devoluciones</strong> de las inscripciones. Cualquier reembolso debe ser coordinado y reclamado directamente con el organizador.
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-[10px]">{error}</p>}
        <button 
          type="submit"
          disabled={loading || !file || !termsAccepted}
          className="w-full bg-neon-cyan text-black font-black uppercase tracking-wider py-2.5 rounded-xl hover:bg-[#00D1DB] transition-all disabled:opacity-30 disabled:hover:bg-neon-cyan disabled:cursor-not-allowed text-center flex items-center justify-center gap-2"
        >
          {loading ? 'Subiendo...' : 'Enviar Comprobante'}
        </button>
      </div>
    </form>
  )
}

const renderPaymentDetailsWithRichContent = (text: string | null | undefined) => {
  if (!text) return null

  const urlRegex = /(https?:\/\/[^\s]+)/g
  const lines = text.split('\n')

  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const parts = line.split(urlRegex)
        return (
          <div key={idx} className="leading-relaxed">
            {parts.map((part, pIdx) => {
              if (part.match(urlRegex)) {
                const trimmedPart = part.trim()
                const isImage = /\.(jpeg|jpg|gif|png|webp|svg)/i.test(trimmedPart) || trimmedPart.includes('/storage/v1/object/public/evidences/')
                
                if (isImage) {
                  return (
                    <div key={pIdx} className="my-2.5 flex flex-col items-center justify-center gap-1 bg-black/40 p-2 rounded-xl border border-white/5">
                      <span className="text-[8px] text-white/40 uppercase tracking-widest font-bold font-orbitron">
                        Código QR / Imagen de Pago
                      </span>
                      <img
                        src={trimmedPart}
                        alt="QR Pago"
                        className="max-w-[180px] w-full h-auto rounded-lg border border-white/10 shadow-lg bg-white p-0.5"
                      />
                    </div>
                  )
                }

                return (
                  <a
                    key={pIdx}
                    href={trimmedPart}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neon-cyan hover:underline font-bold inline-flex items-center gap-0.5"
                  >
                    {trimmedPart} 🔗
                  </a>
                )
              }
              return part
            })}
          </div>
        )
      })}
    </div>
  )
}

export function LeaderboardClient({
  tournamentId,
  tournamentName,
  tournamentLogoUrl,
  hideLogoInLeaderboard = false,
  description,
  format,
  status,
  initialStandings,
  teams,
  theme,
  matches,
  submissions,
  killRateEnabled,
  potTopEnabled,
  vipEnabled,
  rulesText,
  scoringRule,
  participants,
  championImageUrl,
  totalLiveViewers,
  adBanners,
  slug,
  mode,
  isPrivate,
  maxTeams,
  registrationStartDate,
  registrationEndDate,
  startDate,
  prize1st = 0,
  prize2nd = 0,
  prize3rd = 0,
  prizeMvp = 0,
  clashRoyaleTag,
  discipline = 'warzone',
  streamUrl,
  creatorProfile,
  collaboratorProfile,
  creatorId,
  collaboratorId,
  entryFee = 0,
  maxPointsLimit,
  discordUrl,
  betMarkets = [],
  initialBalance = 0,
  userBets = [],
  isLoggedIn = false,
  arenaBettingEnabled = false,
  exchangeRate = 58.25,
}: {
  tournamentId: string
  tournamentName: string
  tournamentLogoUrl?: string
  hideLogoInLeaderboard?: boolean
  description?: string
  format: string
  creatorProfile?: {
    organization_name: string | null
    payment_details: string | null
    discord_link: string | null
    whatsapp_link: string | null
    role?: string | null
  } | null
  collaboratorProfile?: {
    organization_name: string | null
    payment_details: string | null
    discord_link: string | null
    whatsapp_link: string | null
    username: string | null
  } | null
  creatorId?: string | null
  collaboratorId?: string | null
  entryFee?: number
  status: string
  initialStandings: any[]
  teams?: any[]
  theme?: any
  matches?: Match[]
  submissions?: Submission[]
  killRateEnabled?: boolean
  potTopEnabled?: boolean
  vipEnabled?: boolean
  rulesText?: string
  scoringRule?: ScoringRule
  participants: Participant[]
  championImageUrl?: string
  totalLiveViewers?: number
  adBanners?: AdBanner[]
  slug: string
  mode: string
  isPrivate: boolean
  maxTeams?: number | null
  registrationStartDate?: string | null
  registrationEndDate?: string | null
  startDate?: string | null
  prize1st?: number
  prize2nd?: number
  prize3rd?: number
  prizeMvp?: number
  clashRoyaleTag?: string | null
  discipline?: string
  streamUrl?: string | null
  maxPointsLimit?: number
  discordUrl?: string | null
  betMarkets?: any[]
  initialBalance?: number
  userBets?: any[]
  isLoggedIn?: boolean
  arenaBettingEnabled?: boolean
  exchangeRate?: number
}) {
  // Stable supabase client — created once, not on every render.
  // If this were inside the component body without useMemo, every render would produce
  // a new object reference, causing refreshStandingsFromDB (useCallback) to be
  // recreated each render, which would re-trigger the useEffect on every render.
  const supabase = useMemo(() => createClient(), [])
  const isShooter = discipline !== 'clash_royale' && 
    discipline !== 'street_fighter_6' && 
    discipline !== 'super_smash_bros_ultimate' && 
    discipline !== 'league_of_legends' && 
    discipline !== 'valorant'

  const isKronixOfficial = creatorProfile?.role === 'SUPER_ADMIN' || creatorProfile?.role === 'ADMIN'
  const isCollaboration = !isKronixOfficial && !!collaboratorId

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isUserRegistered, setIsUserRegistered] = useState(false)
  const [isForbiddenUser, setIsForbiddenUser] = useState(false)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [regTeamName, setRegTeamName] = useState('')
  const [regStreamUrl, setRegStreamUrl] = useState('')
  const [regParticipants, setRegParticipants] = useState<string[]>([])
  const [regParticipantUserIds, setRegParticipantUserIds] = useState<(string | null)[]>([])
  const [regParticipantStreams, setRegParticipantStreams] = useState<string[]>([])
  const [userFriends, setUserFriends] = useState<any[]>([])
  const [regPassword, setRegPassword] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  // Game account fields for all participants (captain + teammates)
  const [regParticipantGameIds, setRegParticipantGameIds] = useState<string[]>([])
  const [regParticipantGameUsernames, setRegParticipantGameUsernames] = useState<string[]>([])
  // Nickname modal: show if user has no username
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  // Direct Payment Modal inside registration
  const [showRegPayModal, setShowRegPayModal] = useState(false)
  const [paypalSdkLoaded, setPaypalSdkLoaded] = useState(false)
  const [isRegPaying, setIsRegPaying] = useState(false)
  // Quick friend add state inside registration modal
  const [quickFriendQuery, setQuickFriendQuery] = useState('')
  const [isSearchingFriend, setIsSearchingFriend] = useState(false)
  const [friendSearchResults, setFriendSearchResults] = useState<any[]>([])
  const [showQuickAddFriend, setShowQuickAddFriend] = useState(false)
  const isSubmittingReg = React.useRef(false)
  const router = useRouter()

  // Auto-save registration draft to sessionStorage
  useEffect(() => {
    if (!isRegistering) return
    try {
      const draft = {
        regTeamName,
        regStreamUrl,
        regPassword,
        regParticipants,
        regParticipantUserIds,
        regParticipantStreams,
        regParticipantGameIds,
        regParticipantGameUsernames,
      }
      sessionStorage.setItem('kronix_reg_draft_' + tournamentId, JSON.stringify(draft))
    } catch (e) {}
  }, [
    isRegistering,
    tournamentId,
    regTeamName,
    regStreamUrl,
    regPassword,
    regParticipants,
    regParticipantUserIds,
    regParticipantStreams,
    regParticipantGameIds,
    regParticipantGameUsernames,
  ])

  const handleOpenRegistration = async () => {
    const size = { individual: 1, duos: 2, trios: 3, cuartetos: 4, quintas: 5 }[mode] || 1
    const initialParticipants = Array(size).fill('')
    const initialUserIds = Array(size).fill(null)
    const initialStreams = Array(size).fill('')
    const initialGameIds = Array(size).fill('')
    const initialGameUsernames = Array(size).fill('')

    if (currentUser) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('username, stream_url')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (prof) {
          initialParticipants[0] = prof.username || currentUser.email.split('@')[0]
          initialStreams[0] = prof.stream_url || ''
        } else {
          initialParticipants[0] = currentUser.email.split('@')[0]
        }
      } catch (err) {
        initialParticipants[0] = currentUser.email.split('@')[0]
      }
      initialUserIds[0] = currentUser.id

      // Auto-load captain's game account for this discipline
      try {
        const gameRes = await getGameAccountForUser(currentUser.id, discipline)
        if ('data' in gameRes && gameRes.data) {
          initialGameIds[0] = gameRes.data.game_id || ''
          initialGameUsernames[0] = gameRes.data.game_username || ''
        }
      } catch {}
    }

    // Try restoring saved draft
    try {
      const savedDraft = sessionStorage.getItem('kronix_reg_draft_' + tournamentId)
      if (savedDraft) {
        const draft = JSON.parse(savedDraft)
        if (draft.regTeamName) setRegTeamName(draft.regTeamName)
        else setRegTeamName('')
        if (draft.regStreamUrl) setRegStreamUrl(draft.regStreamUrl)
        else setRegStreamUrl(initialStreams[0] || '')
        if (draft.regPassword) setRegPassword(draft.regPassword)
        else setRegPassword('')

        if (Array.isArray(draft.regParticipants) && draft.regParticipants.length === size) {
          setRegParticipants(draft.regParticipants)
        } else {
          setRegParticipants(initialParticipants)
        }

        if (Array.isArray(draft.regParticipantUserIds) && draft.regParticipantUserIds.length === size) {
          setRegParticipantUserIds(draft.regParticipantUserIds)
        } else {
          setRegParticipantUserIds(initialUserIds)
        }

        if (Array.isArray(draft.regParticipantStreams) && draft.regParticipantStreams.length === size) {
          setRegParticipantStreams(draft.regParticipantStreams)
        } else {
          setRegParticipantStreams(initialStreams)
        }

        if (Array.isArray(draft.regParticipantGameIds) && draft.regParticipantGameIds.length === size) {
          setRegParticipantGameIds(draft.regParticipantGameIds)
        } else {
          setRegParticipantGameIds(initialGameIds)
        }

        if (Array.isArray(draft.regParticipantGameUsernames) && draft.regParticipantGameUsernames.length === size) {
          setRegParticipantGameUsernames(draft.regParticipantGameUsernames)
        } else {
          setRegParticipantGameUsernames(initialGameUsernames)
        }
      } else {
        setRegParticipants(initialParticipants)
        setRegParticipantUserIds(initialUserIds)
        setRegParticipantStreams(initialStreams)
        setRegParticipantGameIds(initialGameIds)
        setRegParticipantGameUsernames(initialGameUsernames)
        setRegTeamName('')
        setRegStreamUrl(initialStreams[0] || '')
        setRegPassword('')
      }
    } catch (e) {
      setRegParticipants(initialParticipants)
      setRegParticipantUserIds(initialUserIds)
      setRegParticipantStreams(initialStreams)
      setRegParticipantGameIds(initialGameIds)
      setRegParticipantGameUsernames(initialGameUsernames)
      setRegTeamName('')
      setRegStreamUrl(initialStreams[0] || '')
      setRegPassword('')
    }

    try {
      const friendsRes = await getFriendsList()
      if (friendsRes && 'data' in friendsRes) {
        // Consultar los IDs del staff del creador del torneo
        const { data: staffData } = await supabase
          .from('streamer_staff')
          .select('staff_id')
          .eq('streamer_id', creatorId)

        const staffIds = new Set<string>()
        if (creatorId) staffIds.add(creatorId)
        if (collaboratorId) staffIds.add(collaboratorId)
        if (staffData) {
          staffData.forEach((s: any) => {
            if (s.staff_id) staffIds.add(s.staff_id)
          })
        }

        const filteredFriends = (friendsRes.data || []).filter((f: any) => !staffIds.has(f.id))
        setUserFriends(filteredFriends)
      }
    } catch (err) {
      console.error('Error fetching friends:', err)
    }

    setIsRegistering(true)
  }

  const handleSearchFriend = async () => {
    if (!quickFriendQuery.trim()) return
    setIsSearchingFriend(true)
    try {
      const res = await searchUsersForFriends(quickFriendQuery.trim())
      if (res && 'data' in res && res.data) {
        setFriendSearchResults(res.data)
        if (res.data.length === 0) {
          toast.info('No se encontró ningún usuario con ese nombre o ID.')
        }
      } else if (res && 'error' in res) {
        toast.error(res.error)
      }
    } catch (err: any) {
      toast.error('Error al buscar usuario: ' + (err.message || err))
    } finally {
      setIsSearchingFriend(false)
    }
  }

  const handleAddFriendFromModal = async (friendId: string) => {
    try {
      const res = await sendFriendRequest(friendId)
      if (res && 'success' in res) {
        toast.success('¡Amigo agregado con éxito!')
        const friendsRes = await getFriendsList()
        if (friendsRes && 'data' in friendsRes) {
          setUserFriends(friendsRes.data || [])
        }
        setFriendSearchResults([])
        setQuickFriendQuery('')
        setShowQuickAddFriend(false)
      } else if (res && 'error' in res) {
        toast.error(res.error)
      }
    } catch (err: any) {
      toast.error('Error al agregar amigo: ' + (err.message || err))
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingReg.current) return
    isSubmittingReg.current = true
    setRegLoading(true)
    try {
      if (mode !== 'individual') {
        for (let i = 1; i < regParticipants.length; i++) {
          if (!regParticipantUserIds[i]) {
            toast.error(`Por favor, selecciona un amigo registrado para el Integrante ${i + 1}. Todos los compañeros deben tener cuenta en Kronix.`)
            setRegLoading(false)
            isSubmittingReg.current = false
            return
          }
        }

        // Validar que no se repitan usuarios (compañeros o capitán)
        const allSelectedUserIds = [currentUser?.id, ...regParticipantUserIds.slice(1).filter(Boolean)].filter(Boolean)
        const uniqueUsers = new Set(allSelectedUserIds)
        if (uniqueUsers.size !== allSelectedUserIds.length) {
          toast.error('No puedes inscribir al mismo usuario más de una vez en el equipo.')
          setRegLoading(false)
          isSubmittingReg.current = false
          return
        }

        // Validar nombres de integrantes duplicados
        const cleanNames = regParticipants.map(n => n.trim().toLowerCase()).filter(Boolean)
        if (new Set(cleanNames).size !== cleanNames.length) {
          toast.error('No puedes repetir el mismo nombre de jugador en el equipo.')
          setRegLoading(false)
          isSubmittingReg.current = false
          return
        }
      }

      const emptyNameIndex = regParticipants.findIndex(name => name.trim() === '')
      if (emptyNameIndex !== -1) {
        toast.error(`Por favor, completa el nombre del Integrante ${emptyNameIndex + 1}`)
        setRegLoading(false)
        isSubmittingReg.current = false
        return
      }

      const gameInfo = GAME_LABELS[discipline] || {
        label: discipline,
        idLabel: 'ID de cuenta',
        usernameLabel: 'Nombre en el juego',
        idPlaceholder: 'Ej: TuID123',
        usernamePlaceholder: 'Ej: TuNombre',
        icon: '🎮'
      }

      for (let i = 0; i < regParticipants.length; i++) {
        const memberLabel = i === 0 ? 'del Capitán' : `del Integrante ${i + 1} (${regParticipants[i] || 'compañero'})`
        if (!regParticipantGameIds[i]?.trim()) {
          toast.error(`Por favor, ingresa el ${gameInfo.idLabel} ${memberLabel}`)
          setRegLoading(false)
          isSubmittingReg.current = false
          return
        }
        if (!regParticipantGameUsernames[i]?.trim()) {
          toast.error(`Por favor, ingresa el ${gameInfo.usernameLabel} ${memberLabel}`)
          setRegLoading(false)
          isSubmittingReg.current = false
          return
        }
      }

      // Validar IDs y Nombres de cuenta en el juego duplicados en el equipo
      const cleanGameIds = regParticipantGameIds.map(g => g.trim()).filter(Boolean)
      if (new Set(cleanGameIds).size !== cleanGameIds.length) {
        toast.error('No puedes ingresar el mismo ID de cuenta del juego para varios integrantes del equipo.')
        setRegLoading(false)
        isSubmittingReg.current = false
        return
      }

      const cleanGameUsernames = regParticipantGameUsernames.map(g => g.trim().toLowerCase()).filter(Boolean)
      if (new Set(cleanGameUsernames).size !== cleanGameUsernames.length) {
        toast.error('No puedes ingresar el mismo nombre de cuenta del juego para varios integrantes del equipo.')
        setRegLoading(false)
        isSubmittingReg.current = false
        return
      }

      const members = regParticipants.map((name, index) => ({
        displayName: name,
        userId: regParticipantUserIds[index] || undefined,
        streamUrl: index === 0 ? (regStreamUrl || undefined) : (regParticipantStreams[index] || undefined),
        gameId: regParticipantGameIds[index]?.trim(),
        gameUsername: regParticipantGameUsernames[index]?.trim(),
      }))

      // Auto-save captain game account to profile for future use (silent, no blocking)
      if (regParticipantGameIds[0] && regParticipantGameUsernames[0]) {
        upsertGameAccount({
          game: discipline,
          gameId: regParticipantGameIds[0].trim(),
          gameUsername: regParticipantGameUsernames[0].trim()
        }).catch(() => {})
      }

      const res = await registerTournament(tournamentId, {
        teamName: mode === 'individual' ? regParticipants[0] : regTeamName,
        streamUrl: regStreamUrl || undefined,
        participants: members,
        password: regPassword || undefined,
      })

      if (res && 'error' in res) {
        toast.error(res.error)
      } else {
        toast.success('¡Inscripción completada con éxito!')
        try {
          sessionStorage.removeItem('kronix_reg_draft_' + tournamentId)
        } catch (e) {}
        setIsUserRegistered(true)
        setIsRegistering(false)
        router.refresh()
      }
    } catch (err: any) {
      toast.error('Ocurrió un error al enviar la inscripción.')
    } finally {
      setRegLoading(false)
      isSubmittingReg.current = false
    }
  }

  const [payPendingLoading, setPayPendingLoading] = useState(false)

  const handlePayPendingFee = async () => {
    if (!userTeam) return
    const rate = exchangeRate || 58.25
    const entryFeeInKCoins = Math.round(entryFee * rate)
    const currentPaid = Math.round(userTeam.amount_paid || userTeam.amountPaid || 0)
    const remaining = Math.max(0, entryFeeInKCoins - currentPaid)

    if (remaining <= 0) {
      toast.error('El equipo ya ha pagado la cuota completa.')
      return
    }

    setPayPendingLoading(true)
    try {
      const { contributeToTeamFeeAction } = await import('@/lib/actions/team-payments')
      const res = await contributeToTeamFeeAction(userTeam.id, remaining.toString())
      if (res && 'error' in res) {
        toast.error(res.error)
      } else {
        toast.success('¡Pago completado con éxito! Inscripción confirmada.')
        setUserTeam((prev: any) => ({
          ...prev,
          registration_status: 'confirmed',
          amount_paid: entryFeeInKCoins
        }))
        router.refresh()
      }
    } catch (err: any) {
      toast.error('Error al procesar el pago.')
    } finally {
      setPayPendingLoading(false)
    }
  }

  const [isMounted, setIsMounted] = useState(false)
  const [host, setHost] = useState('localhost')
  const [standings, setStandings] = useState(initialStandings)
  const [currentTeams, setCurrentTeams] = useState(teams || [])
  const confirmedTeams = useMemo(() => {
    return (currentTeams || []).filter((team: any) => !team.registration_status || team.registration_status === 'confirmed')
  }, [currentTeams])
  const [currentSubmissions, setCurrentSubmissions] = useState(submissions || [])
  const [currentMatches, setCurrentMatches] = useState(matches || [])
  const [currentLiveViewers, setCurrentLiveViewers] = useState(totalLiveViewers || 0)
  const [activeTab, setActiveTab] = useState<'ranking' | 'participants' | 'matches' | 'rules' | 'statistics' | 'evidences' | 'bets'>('ranking')
  // Bets state
  const [localBalance, setLocalBalance] = useState(initialBalance)
  const [selectedParticipantForProfile, setSelectedParticipantForProfile] = useState<{
    id: string
    displayName: string
    userId?: string | null
    avatarUrl?: string | null
    teamName?: string | null
  } | null>(null)

  // Render PayPal Smart Buttons for embedded registration payment
  useEffect(() => {
    if (!showRegPayModal || !paypalSdkLoaded || !(window as any).paypal) return

    const container = document.getElementById('paypal-reg-modal-container')
    if (container) container.innerHTML = ''

    const neededUsd = Math.max(1, parseFloat((entryFee - (localBalance / (exchangeRate || 58.25))).toFixed(2)))

    try {
      ;(window as any).paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'pay',
          height: 48,
          tagline: false,
          borderRadius: 12
        },
        createOrder: async () => {
          try {
            const res = await fetch('/api/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: neededUsd })
            })
            const data = await res.json()
            if (data.error) {
              toast.error(data.error)
              throw new Error(data.error)
            }
            return data.id
          } catch (err: any) {
            toast.error('Error al iniciar orden en PayPal: ' + (err.message || ''))
            throw err
          }
        },
        onApprove: async (data: any) => {
          setIsRegPaying(true)
          try {
            const res = await fetch('/api/paypal/capture-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderID: data.orderID })
            })
            const capture = await res.json()
            if (capture.error) {
              toast.error(`Error al capturar el pago: ${capture.error}`)
            } else if (capture.success) {
              const newBal = capture.balance !== undefined ? capture.balance : (localBalance + (capture.dopAmount || 0))
              setLocalBalance(newBal)
              setShowRegPayModal(false)
              toast.success(`¡Pago completado con éxito! Se acreditaron ${capture.dopAmount || Math.round(neededUsd * (exchangeRate || 58.25))} K-Coins.`)
            }
          } catch (err: any) {
            toast.error('Error al acreditar pago: ' + (err.message || ''))
          } finally {
            setIsRegPaying(false)
          }
        },
        onError: (err: any) => {
          console.error('PayPal reg error:', err)
          toast.error('Hubo un error con la pasarela de PayPal')
        }
      }).render('#paypal-reg-modal-container')
    } catch (err) {
      console.error('Error rendering PayPal in reg modal:', err)
    }
  }, [showRegPayModal, paypalSdkLoaded, entryFee, localBalance, exchangeRate])
  const [localUserBets, setLocalUserBets] = useState<any[]>(userBets)
  const [betsLoading, setBetsLoading] = useState(false)
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [betAmount, setBetAmount] = useState<string>('')
  const [selectedMatchFilter, setSelectedMatchFilter] = useState('all')

  const matchFilterOptions = useMemo(() => {
    const list = [
      { id: 'all', name: 'Todas las Apuestas' },
      { id: 'general', name: 'Torneo General' }
    ]
    const sortedMatches = [...(currentMatches || [])]
      .filter(m => !m.parentMatchId)
      .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0))
    
    sortedMatches.forEach(m => {
      list.push({ id: m.id, name: m.name })
    })
    return list
  }, [currentMatches])

  const displayedMarkets = useMemo(() => {
    const activeMarkets = betMarkets.filter((m: any) => m.status !== 'cancelled')
    if (selectedMatchFilter === 'all') return activeMarkets
    if (selectedMatchFilter === 'general') return activeMarkets.filter((m: any) => !m.match_id)
    return activeMarkets.filter((m: any) => m.match_id === selectedMatchFilter)
  }, [betMarkets, selectedMatchFilter])

  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)
  const [watchingStream, setWatchingStream] = useState<string | null>(null)

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)

  // Real-time metadata states
  const [currentTheme, setCurrentTheme] = useState(theme)
  const [currentStatus, setCurrentStatus] = useState(status)
  const [currentChampionImg, setCurrentChampionImg] = useState(championImageUrl)
  const [isMobile, setIsMobile] = useState(false)
  const [showHallOfFame, setShowHallOfFame] = useState(false)
  const [isTableMaximized, setIsTableMaximized] = useState(false)

  const isClosedOrFull = useMemo(() => {
    const totalTeamsRegistered = currentTeams.length
    const isFull = maxTeams ? totalTeamsRegistered >= maxTeams : false
    const now = new Date()
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null
    const hasRegEnded = regEnd ? now > regEnd : false
    return isFull || hasRegEnded || currentStatus === 'active' || currentStatus === 'finished'
  }, [currentTeams.length, maxTeams, registrationEndDate, currentStatus])

  const captainTeam = useMemo(() => {
    if (!currentUser) return null
    return currentTeams.find((team: any) => 
      (team.participants || []).some((p: any) => p.userId === currentUser.id)
    )
  }, [currentUser, currentTeams])

  useEffect(() => {
    setIsMounted(true)
    setHost(window.location.hostname)
    // Track leaderboard page view
    trackEvent({
      tournamentId,
      eventType: 'page_view',
      metadata: { tournamentName }
    })
  }, [tournamentId, tournamentName])

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)

        // Check if user is staff/creator/collaborator
        const isCreatorOrCollab = user.id === creatorId || user.id === collaboratorId
        if (isCreatorOrCollab) {
          setIsForbiddenUser(true)
        } else {
          const { data: staffRel } = await supabase
            .from('streamer_staff')
            .select('id')
            .eq('streamer_id', creatorId)
            .eq('staff_id', user.id)
            .maybeSingle()
          
          if (staffRel) {
            setIsForbiddenUser(true)
          }
        }

        // Check if user is registered in this tournament
        const { data: registration } = await supabase
          .from('participants')
          .select('id, team:teams(id, name, registration_status, payment_evidence_url, amount_paid)')
          .eq('tournament_id', tournamentId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (registration) {
          setIsUserRegistered(true)
          if (registration.team) {
            setUserTeam(registration.team)
          }
        }
        // Check if user has a nickname set — if not, show modal
        const { data: prof } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()
        if (!prof?.username || prof.username.trim() === '') {
          setShowNicknameModal(true)
        }

        // Auto-open registration if redirected from wallet
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          if (params.get('openRegister') === 'true' && !registration) {
            handleOpenRegistration()
          }
        }
      }
    }
    fetchUser()
  }, [supabase, tournamentId, creatorId, collaboratorId])


  const primaryColor = currentTheme?.primary_color || currentTheme?.primaryColor || '#00F5FF'
  const backgroundValue = currentTheme?.background_value
  const backgroundMobileValue = currentTheme?.background_mobile_value
  const activeBackground = (isMobile && backgroundMobileValue) ? backgroundMobileValue : backgroundValue
  const logoUrl = currentTheme?.logo_url || currentTheme?.logoUrl || tournamentLogoUrl

  // Prop Sync: Ensure internal state handles server-side updates/navigation
  useEffect(() => {
    if (theme) setCurrentTheme(theme)
  }, [theme])

  useEffect(() => {
    if (status) setCurrentStatus(status)
  }, [status])

  useEffect(() => {
    if (championImageUrl !== undefined) {
      setCurrentChampionImg(championImageUrl)
    }
  }, [championImageUrl])

  useEffect(() => {
    if (initialStandings) setStandings(initialStandings)
  }, [initialStandings])

  useEffect(() => {
    if (teams) setCurrentTeams(teams)
  }, [teams])

  useEffect(() => {
    if (submissions) setCurrentSubmissions(submissions)
  }, [submissions])

  useEffect(() => {
    if (matches) setCurrentMatches(matches)
  }, [matches])

  useEffect(() => {
    setExpandedTeamId(null)
  }, [activeTab])

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncStatus('Sincronizando...')
    try {
      // Call the public API route (uses admin client, no user auth required)
      const res = await fetch(`/api/sync-standings?tournamentId=${tournamentId}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setSyncStatus('¡Marcador actualizado!')
        // Refresh standings from DB without full page reload
        await refreshStandingsFromDB()
        setTimeout(() => setSyncStatus(null), 3000)
      } else {
        setSyncStatus('Error al sincronizar')
        setTimeout(() => setSyncStatus(null), 3000)
      }
    } catch (err) {
      setSyncStatus('Fallo de red')
      setTimeout(() => setSyncStatus(null), 3000)
    } finally {
      setIsSyncing(false)
    }
  }

  // 1. Agregación Atómica: Calculamos las bajas reales sumando las partidas aprobadas
  // Esta es la "Fuente de Verdad" que evita la latencia de la base de datos.
  const participantsWithCalculatedKills = useMemo(() => {
    // Mapa de bajas acumuladas por ID de jugador
    const killsMap: Record<string, number> = {}
    
    currentSubmissions
      .filter(s => s.status === 'approved')
      .forEach(s => {
        if (s.playerKills && typeof s.playerKills === 'object') {
          Object.entries(s.playerKills).forEach(([pId, kills]) => {
            killsMap[pId] = (killsMap[pId] || 0) + (Number(kills) || 0)
          })
        }
      })

    // Enriquecemos los participantes con sus bajas calculadas
    return (confirmedTeams || []).flatMap((t: any) => 
      (t.participants || []).map((p: any) => ({
        ...p,
        teamId: t.id,
        teamName: t.name,
        teamAvatar: t.avatarUrl,
        totalKills: killsMap[p.id] || 0 // Sobrescribimos con el dato real/calculado
      }))
    )
  }, [confirmedTeams, currentSubmissions])

  // NUEVO: Mapa de búsqueda rápida por ID de jugador para las listas
  const calculatedKillsLookup = useMemo(() => {
    const map: Record<string, number> = {}
    participantsWithCalculatedKills.forEach(p => {
      map[p.id] = p.totalKills || 0
    })
    return map
  }, [participantsWithCalculatedKills])
  
  const topFraggers = [...participantsWithCalculatedKills]
    .sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0))
    .filter(p => (p.totalKills || 0) > 0)
    .slice(0, 5)

  const renderStandingsTable = () => {
    return (
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/5 text-xs text-white/40 uppercase tracking-widest font-semibold">
            <th className="px-6 py-4 w-20 text-center">Rank</th>
            <th className="px-6 py-4">Equipo</th>
            <th className="px-6 py-4 text-center">PTS</th>
            {isShooter && <th className="px-6 py-4 text-center">Kills</th>}
            {potTopEnabled && <th className="hidden md:table-cell px-6 py-4 text-center">Top 1</th>}
            {isShooter && killRateEnabled && <th className="hidden md:table-cell px-6 py-4 text-center">Kill Rate</th>}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {standings.map((s, idx) => {
              const rankDiff = (s.previousRank || s.rank) - s.rank
              return (
                <Fragment key={s.teamId}>
                <motion.tr
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 400, 
                    damping: 40,
                    opacity: { duration: 0.2 },
                    layout: { duration: 0.6 }
                  }}
                  className={`border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer group ${
                    expandedTeamId === s.teamId ? 'bg-white/[0.03]' : ''
                  }`}
                  onClick={() => setExpandedTeamId(expandedTeamId === s.teamId ? null : s.teamId)}
                >
                  <td className="px-3 sm:px-6 py-4 sm:py-6">
                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                       <div className="flex flex-col items-center">
                          <span className={`font-orbitron font-black text-base sm:text-2xl ${
                            (idx + 1) === 1 ? 'text-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]' : 
                            (idx + 1) === 2 ? 'text-gray-300' : 
                            (idx + 1) === 3 ? 'text-orange-400' : 'text-white/40'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="flex items-center gap-1 mt-1 h-3">
                             <AnimatePresence mode="wait">
                               {rankDiff > 0 && (
                                 <motion.span 
                                   key="up"
                                   initial={{ opacity: 0, y: 5 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   exit={{ opacity: 0, y: -5 }}
                                   className="text-[9px] font-bold text-green-400 flex items-center"
                                 >
                                   ▲{rankDiff}
                                 </motion.span>
                               )}
                               {rankDiff < 0 && (
                                 <motion.span 
                                   key="down"
                                   initial={{ opacity: 0, y: -5 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   exit={{ opacity: 0, y: 5 }}
                                   className="text-[9px] font-bold text-red-400 flex items-center"
                                 >
                                   ▼{Math.abs(rankDiff)}
                                 </motion.span>
                               )}
                             </AnimatePresence>
                          </div>
                       </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 sm:py-6">
                    <div className="flex items-center gap-3 sm:gap-5">
                      <div className="relative">
                         {s.avatarUrl ? (
                           <img src={s.avatarUrl} alt="" className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-white/10 shadow-xl" />
                         ) : (
                           <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 font-orbitron font-black text-xl italic">
                             {s.teamName.substring(0, 1)}
                           </div>
                         )}
                         {expandedTeamId === s.teamId && (
                           <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-neon-cyan border-2 border-dark-card flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                           </div>
                         )}
                      </div>
                      <div className="flex-1">
                         <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-orbitron font-black text-sm sm:text-xl tracking-tight text-white group-hover:text-neon-cyan transition-colors">{s.teamName}</span>
                            {s.streams && s.streams.length > 0 && (
                              <div className="flex items-center gap-1 text-[8px] bg-red-500/20 text-red-500 font-bold px-1.5 py-0.5 rounded border border-red-500/30 uppercase tracking-tighter">
                                 LIVE
                              </div>
                            )}
                            {/* Badge Match Point */}
                            {maxPointsLimit && maxPointsLimit > 0 && s.totalPoints >= maxPointsLimit && (
                              <div className="flex items-center gap-1 animate-pulse">
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.4)]">
                                  🎯 MATCH POINT
                                </span>
                              </div>
                            )}
                         </div>
                         <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Ver Detalles</span>
                            <svg className={`w-3 h-3 text-white/20 transition-transform ${expandedTeamId === s.teamId ? 'rotate-90 text-neon-cyan' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                         </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 sm:py-6 text-center font-orbitron font-black text-2xl sm:text-4xl text-neon-cyan">
                    <NumberTicker value={s.totalPoints} precision={s.totalPoints % 1 === 0 ? 0 : 1} />
                  </td>
                  {isShooter && (
                    <td className="px-3 sm:px-6 py-4 sm:py-6 text-center">
                       <div className="flex flex-col items-center">
                          <span className="text-white font-black text-lg sm:text-xl">
                            <NumberTicker value={s.totalKills} />
                          </span>
                          <span className="text-[8px] text-white/40 uppercase font-black tracking-widest mt-1">TOTAL KILLS</span>
                       </div>
                    </td>
                  )}
                  {potTopEnabled && (
                    <td className="hidden md:table-cell px-6 py-4 text-center">
                       <div className="flex flex-col items-center">
                          <span className="text-gold font-black text-lg">{s.potTopCount}</span>
                          <span className="text-[8px] text-white/40 uppercase font-black tracking-widest mt-1">VICTORIAS</span>
                       </div>
                    </td>
                  )}
                  {isShooter && killRateEnabled && (
                    <td className="hidden md:table-cell px-6 py-4 text-center">
                       <div className="flex flex-col items-center">
                          <span className="text-white/60 font-mono text-xs">
                            <NumberTicker value={s.killRate} precision={1} />
                          </span>
                          <span className="text-[8px] text-white/20 uppercase font-black tracking-tighter mt-1">AVG K/M</span>
                       </div>
                    </td>
                  )}
                </motion.tr>

                {/* Expansion Row */}
                <AnimatePresence>
                  {expandedTeamId === s.teamId && (
                    <motion.tr
                      key={`details-${s.teamId}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-black/40 overflow-hidden"
                    >
                      <td colSpan={6} className="p-0">
                         <TeamDetails 
                           teamId={s.teamId}
                           teamName={s.teamName}
                           matches={currentMatches || []}
                           submissions={currentSubmissions || []}
                           scoringRule={scoringRule!}
                           participants={participantsWithCalculatedKills}
                           primaryColor={primaryColor}
                           discipline={discipline}
                           totalPoints={s.totalPoints}
                           rank={s.rank}
                           tournamentMode={mode}
                         />
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
                </Fragment>
              )
            })}
          </AnimatePresence>
          {standings.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-white/40">
                Aún no hay posiciones registradas
              </td>
            </tr>
          )}
        </tbody>
      </table>
    )
  }

  const renderSplitStandings = () => {
    if (standings.length === 0) {
      return (
        <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl w-full bg-[#0e0e18]/90">
          <p className="text-white/40 font-orbitron text-sm">Aún no hay posiciones registradas</p>
        </div>
      )
    }
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start w-full relative">
        {/* Left Table: General Standings & Kills */}
        <div className="lg:col-span-6 bg-[#0e0e18]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <span className="font-orbitron font-bold text-xs sm:text-sm text-white uppercase tracking-widest">Puntuación y Bajas</span>
            <button 
              onClick={() => setIsTableMaximized(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] uppercase font-bold rounded-lg border border-white/5 transition-all"
            >
              <svg className="w-3 h-3 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Maximizar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5 text-[10px] text-white/40 uppercase tracking-widest font-semibold">
                  <th className="px-3 sm:px-4 py-3 w-12 sm:w-16 text-center">Rank</th>
                  <th className="px-3 sm:px-4 py-3">Equipo</th>
                  <th className="px-3 sm:px-4 py-3 text-center">PTS</th>
                  {isShooter && <th className="px-3 sm:px-4 py-3 text-center">Kills</th>}
                </tr>
              </thead>
              <tbody>
                {standings.map((s, idx) => (
                  <tr 
                    key={s.teamId} 
                    className={`border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer ${
                      expandedTeamId === s.teamId ? 'bg-white/[0.03]' : ''
                    }`}
                    onClick={() => setExpandedTeamId(expandedTeamId === s.teamId ? null : s.teamId)}
                  >
                    <td className="px-3 sm:px-4 py-3 text-center font-orbitron font-black text-sm" style={{ color: (idx+1) === 1 ? '#FFD700' : (idx+1) === 2 ? '#C0C0C0' : (idx+1) === 3 ? '#CD7F32' : 'rgba(255,255,255,0.4)' }}>
                      {idx + 1}
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.avatarUrl ? (
                          <img src={s.avatarUrl} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {s.teamName.substring(0, 1)}
                          </div>
                        )}
                        <span className="font-orbitron font-bold text-xs truncate max-w-[130px] sm:max-w-[180px]">{s.teamName}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-center font-orbitron font-black text-sm text-neon-cyan">
                      {Math.round(s.totalPoints * 10) / 10}
                    </td>
                    {isShooter && (
                      <td className="px-3 sm:px-4 py-3 text-center font-orbitron font-bold text-xs text-white/80">
                        {s.totalKills}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Table: Top 3 Top Fraggers (MVPs) */}
        <div className="lg:col-span-6 bg-[#0e0e18]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center bg-gradient-to-r from-neon-purple/10 to-transparent">
            <span className="font-orbitron font-bold text-xs sm:text-sm text-white uppercase tracking-widest flex items-center gap-2">
              <span className="text-neon-purple">⚔️</span> Top Fraggers (MVP)
            </span>
            <span className="text-[10px] text-neon-purple font-bold uppercase tracking-wider">Top 3 Jugadores</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5 text-[10px] text-white/40 uppercase tracking-widest font-semibold">
                  <th className="px-3 sm:px-4 py-3 w-12 sm:w-16 text-center">Rank</th>
                  <th className="px-3 sm:px-4 py-3">Jugador</th>
                  <th className="px-3 sm:px-4 py-3">Equipo</th>
                  <th className="px-3 sm:px-4 py-3 text-center">Kills</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const topFraggers = [...participantsWithCalculatedKills]
                    .sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0))
                    .slice(0, 3)

                  return topFraggers.map((p, idx) => (
                    <tr 
                      key={p.id} 
                      className="border-b border-white/5 hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="px-3 sm:px-4 py-3 text-center font-orbitron font-black text-sm" style={{ color: (idx+1) === 1 ? '#FFD700' : (idx+1) === 2 ? '#C0C0C0' : '#CD7F32' }}>
                        {idx + 1 === 1 ? '🥇' : idx + 1 === 2 ? '🥈' : '🥉'}
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex items-center gap-2">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center text-[10px] font-bold text-neon-purple shrink-0">
                              {p.displayName.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="font-orbitron font-bold text-xs text-white truncate max-w-[120px] sm:max-w-[160px]">{p.displayName}</span>
                          {currentStatus === 'finished' && idx === 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-neon-purple/20 text-neon-purple border border-neon-purple/30 uppercase tracking-widest animate-pulse shrink-0">
                              👑 MVP
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {p.teamAvatar ? (
                            <img src={p.teamAvatar} alt="" className="w-4 h-4 rounded object-cover shrink-0" />
                          ) : (
                            <span className="text-[10px]">🎮</span>
                          )}
                          <span className="text-xs text-white/50 truncate max-w-[100px] sm:max-w-[130px]">{p.teamName}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center font-orbitron font-black text-sm text-neon-purple">
                        {p.totalKills || 0}
                      </td>
                    </tr>
                  ))
                })()}
                {confirmedTeams.flatMap(t => t.participants || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-white/20 text-xs italic">
                      Aún no hay bajas registradas en este torneo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Shared helper: fetch all teams + standings and rebuild the standings state.
  // Used by both Realtime subscriptions so the merge logic is not duplicated.
  const refreshStandingsFromDB = React.useCallback(async () => {
    const [
      { data: standingsData }, 
      { data: teamsData },
      { data: subsData },
      { data: matchesData }
    ] = await Promise.all([
      supabase
        .from('team_standings')
        .select('*')
        .eq('tournament_id', tournamentId),
      supabase
        .from('teams')
        .select('id, name, avatar_url, stream_url, amount_paid, registration_status, participants(id, team_id, user_id, display_name, avatar_url, stream_url, is_captain, total_kills, kd_ratio, avg_kills, classification_rank, br_avg_placement, color)')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true }),
      supabase
        .from('submissions')
        .select('*, evidence_files(*)')
        .eq('tournament_id', tournamentId)
        .order('submitted_at', { ascending: false }),
      supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('match_number', { ascending: true })
    ])

    if (!teamsData) return

    // 1. Normalización de Partidas (Matches)
    const normalizedMatches = (matchesData || []).map((m: any) => ({
      ...m,
      matchNumber: m.match_number,
      isCompleted: m.is_completed,
      isWarmup: m.is_warmup,
      roundNumber: m.round_number,
      parentMatchId: m.parent_match_id,
      mapName: m.map_name,
      createdAt: m.created_at
    }))

    // 2. Normalización de Envíos (Submissions)
    const normalizedSubmissions = (subsData || []).map((s: any) => ({
      ...s,
      tournamentId: s.tournament_id,
      teamId: s.team_id,
      matchId: s.match_id,
      submittedBy: s.submitted_by,
      killCount: s.kill_count,
      potTop: s.pot_top,
      submittedAt: s.submitted_at,
      playerKills: s.player_kills,
      aiStatus: s.ai_status,
      aiConfidence: s.ai_confidence,
      evidenceFiles: (s.evidence_files || []).map((f: any) => ({
        id: f.id,
        storagePath: f.storage_path,
        mimeType: f.mime_type,
        fileSize: f.file_size,
        evidenceType: f.evidence_type || 'kills'
      }))
    }))

    // 3. Normalización de Equipos y Participantes
    const normalizedTeams = teamsData.map((t: any) => ({
      ...t,
      avatarUrl: t.avatar_url,
      streamUrl: t.stream_url,
      registrationStatus: t.registration_status,
      amountPaid: Number(t.amount_paid) || 0,
      participants: (t.participants || []).map((p: any) => ({
        id: p.id,
        teamId: p.team_id,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
        streamUrl: p.stream_url,
        isCaptain: p.is_captain,
        totalKills: Number(p.total_kills || 0),
        kdRatio:            p.kd_ratio            ?? undefined,
        avgKills:           p.avg_kills            ?? undefined,
        classificationRank: p.classification_rank  ?? undefined,
        brAvgPlacement:     p.br_avg_placement      ?? undefined,
        color:              p.color                 ?? undefined,
        userId:             p.user_id,
      }))
    }))

    // 4. Cáculo Dinámico de Posiciones (Single Source of Truth)
    const calculatedStandingsMap = new Map()
    
    // Inicializar mapa de equipos (asegura que todos aparezcan aunque tengan 0 bajas/puntos)
    normalizedTeams.forEach((t: any) => {
      calculatedStandingsMap.set(t.id, {
        teamId: t.id,
        teamName: t.name,
        avatarUrl: t.avatarUrl,
        streamUrl: t.streamUrl,
        totalPoints: 0,
        totalKills: 0,
        potTopCount: 0,
        submissionsCount: 0,
        participants: t.participants || []
      })
    })

    // Agregación de envíos aprobados
    normalizedSubmissions
      .filter(s => s.status === 'approved')
      .forEach(s => {
        const stats = calculatedStandingsMap.get(s.teamId)
        if (stats) {
          let matchPts = 0
          if (scoringRule?.useMultiplier) {
            const multiplier = s.rank && scoringRule.placementPoints[String(s.rank)] !== undefined
              ? Number(scoringRule.placementPoints[String(s.rank)])
              : 1
            matchPts = ((s.killCount || 0) * (scoringRule?.killPoints || 0)) * multiplier
          } else {
            const killPts = (s.killCount || 0) * (scoringRule?.killPoints || 0)
            const placementPts = s.rank && scoringRule?.placementPoints 
              ? (scoringRule.placementPoints[String(s.rank)] || 0)
              : (s.potTop ? (scoringRule?.placementPoints?.[ '1'] || 0) : 0)
            matchPts = killPts + placementPts
          }
          
          stats.totalPoints += matchPts
          stats.totalKills += (s.killCount || 0)
          stats.submissionsCount += 1
          if (s.potTop || s.rank === 1) stats.potTopCount += 1
        }
      })

    const merged = Array.from(calculatedStandingsMap.values()).map((t: any) => {
      const killRate = t.submissionsCount > 0 ? (t.totalKills / t.submissionsCount) : 0
      
      // For API-synced tournaments (e.g. Clash Royale), points come from DB standings, not submissions.
      // If DB has higher points than the submission-calculated total, use DB data as source of truth.
      const dbStanding = (standingsData || []).find((s: any) => s.team_id === t.teamId)
      const dbPoints = dbStanding ? (dbStanding.total_points || 0) : 0
      const dbKills = dbStanding ? (dbStanding.total_kills || 0) : 0
      const dbPotTop = dbStanding ? (dbStanding.pot_top_count || 0) : 0

      // Use the higher value: either from DB sync (CR API) or from submissions calculation
      const finalPoints = Math.max(t.totalPoints, dbPoints)
      const finalKills = Math.max(t.totalKills, dbKills)
      const finalPotTop = Math.max(t.potTopCount, dbPotTop)

      const teamStreams: { name: string; url: string }[] = []
      if (t.streamUrl) teamStreams.push({ name: 'Equipo', url: t.streamUrl })
      if (t.participants) {
        t.participants.forEach((p: any) => {
          if (p.streamUrl) teamStreams.push({ name: p.displayName, url: p.streamUrl })
        })
      }

      return {
        ...t,
        totalPoints: finalPoints,
        totalKills: finalKills,
        potTopCount: finalPotTop,
        streams: teamStreams,
        killRate,
        rank: dbStanding ? dbStanding.rank : 999, // Se recalculará en el sort siguiente
        previousRank: dbStanding ? dbStanding.previous_rank : 999
      }
    }).sort((a: any, b: any) => {
      // Ordenamiento Dinámico: Puntos > Kills > Victorias > Nombre
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills
      if (b.potTopCount !== a.potTopCount) return b.potTopCount - a.potTopCount
      return a.teamName.localeCompare(b.teamName)
    }).map((t, index) => ({
      ...t,
      rank: index + 1 // Asignamos el rango dinámico real
    }))

    setStandings(merged)
    setCurrentTeams(normalizedTeams)
    setCurrentSubmissions(normalizedSubmissions)
    setCurrentMatches(normalizedMatches)
  }, [tournamentId, supabase])
 
  useEffect(() => {
    refreshStandingsFromDB()
  }, [refreshStandingsFromDB])

  useEffect(() => {
    // Subscribe to team_standings changes (score updates)
    const standingsChannel = supabase
      .channel(`standings:${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_standings', filter: `tournament_id=eq.${tournamentId}` },
        () => refreshStandingsFromDB()
      )
      .subscribe()

    // Subscribe to teams changes (new team added / team deleted / team renamed)
    // Without this subscription, a newly-created team only becomes visible on next
    // full page reload — it never triggers a standings event.
    const teamsChannel = supabase
      .channel(`teams:${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` },
        () => refreshStandingsFromDB()
      )
      .subscribe()

    // Subscribe to participants changes (individual kills)
    const participantsChannel = supabase
      .channel(`participants:${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        () => {
          console.log('[REALTIME] Participant stats updated, refreshing...')
          refreshStandingsFromDB()
        }
      )
      .subscribe()

    // Subscribe to theme changes
    const themeChannel = supabase
      .channel(`theme:${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard_themes', filter: `tournament_id=eq.${tournamentId}` },
        (payload: any) => {
          console.log('[REALTIME] Theme updated:', payload.new)
          setCurrentTheme(payload.new)
        }
      )
      .subscribe()

    // Subscribe to tournament status/champion updates
    const tournamentChannel = supabase
      .channel(`tournament:${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` },
        (payload: any) => {
          console.log('[REALTIME] Tournament metadata updated:', payload.new)
          if (payload.new.status) setCurrentStatus(payload.new.status)
          if (payload.new.champion_image_url !== undefined) {
             setCurrentChampionImg(payload.new.champion_image_url)
          }
          if (payload.new.total_live_viewers !== undefined) {
             setCurrentLiveViewers(payload.new.total_live_viewers || 0)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(standingsChannel)
      supabase.removeChannel(teamsChannel)
      supabase.removeChannel(participantsChannel)
      supabase.removeChannel(themeChannel)
      supabase.removeChannel(tournamentChannel)
    }
  }, [tournamentId, supabase, refreshStandingsFromDB])

  const isVideoBackground = activeBackground?.toLowerCase().match(/\.(mp4|webm|ogg)$/)
  
  // YouTube Detection
  const youtubeId = activeBackground?.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{11})/)?.[1]
  
  // Twitch Detection
  const twitchUser = activeBackground?.match(/(?:twitch\.tv\/)([\w\-]+)/)?.[1]

  // Kick Detection
  const kickUser = activeBackground?.match(/(?:kick\.com\/)([\w\-]+)/)?.[1]

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-neon-cyan rounded-full animate-spin" />
      </div>
    )
  }


  const handleWatchTeam = (streamUrl: string) => {
    setWatchingStream(streamUrl)
  }

  const renderStreamPlayer = (url: string) => {
    const ytId = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{11})/)?.[1]
    const twitchU = url.match(/(?:twitch\.tv\/)([\w\-]+)/)?.[1]
    const kickU = url.match(/(?:kick\.com\/)([\w\-]+)/)?.[1]

    if (ytId) return <iframe src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`} className="w-full h-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
    if (twitchU) return <iframe src={`https://player.twitch.tv/?channel=${twitchU}&parent=${host}&autoplay=true`} className="w-full h-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
    if (kickU) return <iframe src={`https://player.kick.com/${kickU}?autoplay=true`} className="w-full h-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
    
    return <div className="flex items-center justify-center h-full text-white/40">URL de stream no soportada</div>
  }

  return (
    <>
      {/* ── Background Handler (Root Level) ─────────────────────────── */}
      {activeBackground && (
        <div className="fixed inset-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
          {youtubeId ? (
            <div 
              className="absolute top-1/2 left-1/2 min-w-full min-h-full w-[177.77vh] h-[56.25vw] -translate-x-1/2 -translate-y-1/2"
              style={{ opacity: (currentTheme?.background_opacity ?? 40) / 100 }}
            >
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0&privacy_mode=1`}
                className="w-full h-full border-0 pointer-events-none scale-[1.05]"
                allow="autoplay; encrypted-media"
              />
            </div>
          ) : (
            <>
              {twitchUser ? (
                <div 
                  className="absolute top-1/2 left-1/2 min-w-full min-h-full w-[177.77vh] h-[56.25vw] -translate-x-1/2 -translate-y-1/2"
                  style={{ opacity: (currentTheme?.background_opacity ?? 40) / 100 }}
                >
                  <iframe
                    src={`https://player.twitch.tv/?channel=${twitchUser}&parent=${host}&muted=true&autoplay=true&controls=false`}
                    className="w-full h-full border-0 pointer-events-none scale-[1.05]"
                    allowFullScreen
                  />
                </div>
              ) : kickUser ? (
                <div 
                  className="absolute top-1/2 left-1/2 min-w-full min-h-full w-[177.77vh] h-[56.25vw] -translate-x-1/2 -translate-y-1/2"
                  style={{ opacity: (currentTheme?.background_opacity ?? 40) / 100 }}
                >
                  <iframe
                    src={`https://player.kick.com/${kickUser}?muted=true&autoplay=true`}
                    className="w-full h-full border-0 pointer-events-none scale-[1.1]"
                  />
                </div>
              ) : isVideoBackground ? (
                <video 
                  key={activeBackground}
                  src={activeBackground} 
                  autoPlay loop muted playsInline 
                  className="w-full h-full object-cover block absolute inset-0" 
                  style={{ opacity: (currentTheme?.background_opacity ?? 40) / 100 }}
                />
              ) : (
                <div 
                  key={activeBackground}
                  className="w-full h-full bg-cover bg-center block" 
                  style={{ 
                    backgroundImage: `url(${activeBackground})`,
                    opacity: (currentTheme?.background_opacity ?? 40) / 100 
                  }} 
                />
              )}
            </>
          )}
          {/* Subtle vignette for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
        </div>
      )}

      {/* ── Main UI Content (With Glow Effect) ──────────────────────── */}
      <div 
        className="w-full max-w-7xl mx-auto p-4 md:p-8 relative z-10 min-h-[90vh] flex flex-col justify-center py-10"
        style={{ 
          filter: `drop-shadow(0 0 50px ${primaryColor}15)`,
        }}
      >


        <div className="text-center mb-12 flex flex-col items-center">
          {logoUrl && !hideLogoInLeaderboard ? (
            <div className="mb-6">
              <img 
                src={logoUrl} 
                alt={tournamentName} 
                className="max-h-32 md:max-h-48 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" 
              />
              <h1 className="sr-only">{tournamentName}</h1>
            </div>
          ) : (
            <h1 className="font-orbitron font-bold text-2xl sm:text-4xl md:text-5xl uppercase tracking-wider mb-4 px-4"
                style={{ color: primaryColor, textShadow: `0 0 20px ${primaryColor}40` }}>
              {tournamentName}
            </h1>
          )}

          {description && <p className="text-white/60 text-lg max-w-2xl mx-auto">{description}</p>}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            {currentStatus === 'draft' && (
              <span className="text-xs font-bold bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full text-white/50 uppercase tracking-widest">
                Pre-torneo
              </span>
            )}
            {currentStatus === 'active' && (
              <span className="text-xs font-bold bg-red-500/10 border border-red-500/20 px-3.5 py-1.5 rounded-full text-red-400 uppercase tracking-widest animate-pulse flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                En Vivo
              </span>
            )}
            {currentStatus === 'pending' && (
              <span className="text-xs font-bold bg-green-500/10 border border-green-500/20 px-3.5 py-1.5 rounded-full text-green-400 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Inscripciones Abiertas
              </span>
            )}
            {currentStatus === 'finished' && (
              <span className="text-xs font-bold bg-gold/10 border border-gold/20 px-3.5 py-1.5 rounded-full text-gold uppercase tracking-widest flex items-center gap-1.5">
                <span>🏆</span> Torneo Finalizado
              </span>
            )}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase tracking-widest text-white/70">
              <span className={`w-1.5 h-1.5 rounded-full ${currentLiveViewers > 0 ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
              <span>
                {currentLiveViewers > 0 
                  ? `${currentLiveViewers.toLocaleString()} Espectadores` 
                  : '0 Espectadores'
                }
              </span>
            </div>
            {clashRoyaleTag && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-xs font-black uppercase tracking-widest text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span>Clash Royale</span>
                </div>
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  title="Actualizar marcador desde Clash Royale"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-500/60 rounded-full text-xs font-black uppercase tracking-widest text-blue-300 hover:text-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncing ? (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {syncStatus ?? 'Actualizar'}
                </button>
              </div>
            )}
          </div>
          {currentStatus === 'finished' && (
            <div className="flex flex-col items-center gap-4 mt-6">
              <button
                onClick={() => setShowHallOfFame(true)}
                className="group relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-gold/10 border border-gold/40 text-gold font-orbitron font-black text-base uppercase tracking-widest hover:bg-gold/20 hover:border-gold/60 transition-all shadow-[0_0_30px_rgba(255,215,0,0.15)] hover:shadow-[0_0_50px_rgba(255,215,0,0.25)] animate-pulse"
              >
                <div className="absolute inset-0 bg-gold/5 blur-xl group-hover:bg-gold/10 transition-colors rounded-2xl" />
                <span className="relative flex items-center gap-3 text-2xl">🏆</span>
                <span className="relative">Salón de la Fama</span>
              </button>
            </div>
          )}
          {currentStatus !== 'finished' && currentChampionImg && (
            <button
              onClick={() => setShowHallOfFame(true)}
              className="mt-6 group relative flex items-center gap-3 px-6 py-3 rounded-2xl bg-gold/10 border border-gold/30 text-gold font-orbitron font-black text-sm uppercase tracking-widest hover:bg-gold/20 hover:border-gold/50 transition-all shadow-[0_0_20px_rgba(255,215,0,0.1)] hover:shadow-[0_0_30px_rgba(255,215,0,0.2)]"
            >
              <div className="absolute inset-0 bg-gold/5 blur-xl group-hover:bg-gold/10 transition-colors rounded-2xl" />
              <span className="relative flex items-center gap-2">
                <span className="text-lg">🏆</span>
                Salón de la Fama
              </span>
            </button>
          )}

          {/* Registration Section */}
          {(() => {
            const totalTeamsRegistered = currentTeams.length
            const isFull = maxTeams ? totalTeamsRegistered >= maxTeams : false
            
            const now = new Date()
            const regStart = registrationStartDate ? new Date(registrationStartDate) : null
            const regEnd = registrationEndDate ? new Date(registrationEndDate) : null
            const tourneyStart = startDate ? new Date(startDate) : null
            const totalPrize = (prize1st || 0) + (prize2nd || 0) + (prize3rd || 0) + (prizeMvp || 0)

            const hasRegStarted = regStart ? now >= regStart : true
            const hasRegEnded = regEnd ? now > regEnd : false

            const formatDate = (date: Date) => {
              return date.toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            }

            if (isClosedOrFull) {
              return (
                <div className="mt-8 flex flex-col items-center gap-6 w-full max-w-4xl mx-auto">
                  {/* Clean start date display */}
                  {currentStatus === 'finished' ? (
                    <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md">
                      <span className="text-xl">🏆</span>
                      <span className="text-xs sm:text-sm font-orbitron font-bold text-emerald-400 uppercase tracking-wider">
                        Torneo Finalizado
                      </span>
                    </div>
                  ) : tourneyStart ? (
                    <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md">
                      <span className="text-xl">🚀</span>
                      <span className="text-xs sm:text-sm font-orbitron font-bold text-white uppercase tracking-wider">
                        Inicio del Torneo: <span className="text-neon-cyan">{formatDate(tourneyStart)}</span>
                      </span>
                    </div>
                  ) : null}

                  {/* Center stream player */}
                  {streamUrl && (
                    <div className="w-full max-w-lg rounded-2xl overflow-hidden border border-neon-cyan/30 shadow-[0_0_20px_rgba(0,245,255,0.15)] bg-black/50 aspect-video relative">
                      <div className="absolute top-3 left-3 z-10 bg-red-600 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                        EN VIVO
                      </div>
                      {renderStreamPlayer(streamUrl)}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div className="mt-8 p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md max-w-2xl mx-auto flex flex-col md:flex-row items-center gap-6 w-full text-left relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/5 to-neon-purple/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Logo & Mode Section */}
                {logoUrl && !hideLogoInLeaderboard && (
                  <div className="shrink-0 relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center shadow-inner">
                    <img 
                      src={logoUrl} 
                      alt={tournamentName} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="flex-1 min-w-0 z-10 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-orbitron font-bold text-base text-white uppercase tracking-wider">Inscripción al Torneo</h3>
                    {isPrivate && (
                      <span className="text-[9px] bg-neon-purple/20 text-neon-purple font-bold px-2 py-0.5 rounded border border-neon-purple/30 uppercase tracking-wide flex items-center gap-1">
                        <span>🔒</span> Privado
                      </span>
                    )}
                    <span className="text-[9px] bg-neon-cyan/20 text-neon-cyan font-bold px-2 py-0.5 rounded border border-neon-cyan/30 uppercase tracking-wide">
                      {mode.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-white/60 text-xs mt-1.5 leading-relaxed">
                    {isUserRegistered 
                      ? '¡Ya estás inscrito en este torneo! Revisa tu equipo en la pestaña de Participantes.'
                      : `Regístrate para competir en la modalidad de ${mode.toUpperCase()} (${format.replace(/_/g, ' ').toUpperCase()}).`
                    }
                  </p>

                  {/* Dates / Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-[11px] text-white/40">
                    {regStart && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-neon-cyan">📅</span>
                        <span>
                          <strong>Inscripciones:</strong> {formatDate(regStart)}
                        </span>
                      </div>
                    )}
                    {regEnd && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-neon-purple">⏳</span>
                        <span>
                          <strong>Cierre:</strong> {formatDate(regEnd)}
                        </span>
                      </div>
                    )}
                    {currentStatus === 'finished' ? (
                      <div className="flex items-center gap-1.5 sm:col-span-2 text-emerald-400 font-bold">
                        <span>🏆</span>
                        <span>
                          <strong>Estado del Torneo:</strong> Finalizado
                        </span>
                      </div>
                    ) : tourneyStart ? (
                      <div className="flex items-center gap-1.5 sm:col-span-2">
                        <span className="text-gold">🚀</span>
                        <span>
                          <strong>Inicio del Torneo:</strong> {formatDate(tourneyStart)}
                        </span>
                      </div>
                    ) : null}
                    {totalPrize > 0 && (
                      <div className="flex items-center gap-1.5 sm:col-span-2 text-gold font-bold mt-1">
                        <span>💰</span>
                        <span>
                          <strong>Premio total:</strong> ${totalPrize.toLocaleString('es-ES')} USD <span className="text-[11px] text-yellow-300">(~{(totalPrize * exchangeRate).toLocaleString('es-ES', { maximumFractionDigits: 0 })} K-Coins)</span>
                          <span className="text-[9px] text-white/40 font-normal block mt-0.5">
                            (1º: ${prize1st} USD / ~{Math.round(prize1st * exchangeRate)} K-Coins | 2º: ${prize2nd} USD / ~{Math.round(prize2nd * exchangeRate)} K-Coins | 3º: ${prize3rd} USD / ~{Math.round(prize3rd * exchangeRate)} K-Coins {prizeMvp > 0 && `| MVP: $${prizeMvp} USD / ~${Math.round(prizeMvp * exchangeRate)} K-Coins`})
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-neon-cyan text-[10px] font-bold uppercase tracking-widest mt-3">
                    {maxTeams ? `Cupos: ${totalTeamsRegistered} / ${maxTeams} Equipos` : `Inscritos: ${totalTeamsRegistered} Equipos`}
                  </p>

                  {entryFee > 0 && !isUserRegistered && (
                    <div className="mt-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 space-y-2 text-left">
                      <div className="flex items-center gap-2 text-yellow-400">
                        <span className="text-sm">🪙</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Costo de Inscripción</span>
                      </div>
                      <p className="text-[12px] text-white/70 leading-relaxed">
                        Esta inscripción tiene un costo de{' '}
                        <strong className="text-white">${entryFee} USD</strong>{' '}
                        <span className="text-yellow-300 font-bold">(~{(entryFee * exchangeRate).toLocaleString('es-ES', { maximumFractionDigits: 2 })} K-Coins)</span>.
                        Se descontará automáticamente el equivalente en K-Coins de tu billetera al inscribirte.
                      </p>
                      {!isLoggedIn && (
                        <p className="text-[10px] text-white/40 italic">Inicia sesión para verificar tu saldo.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="shrink-0 w-full md:w-auto text-right z-10">
                  {isUserRegistered ? (
                    (() => {
                      const status = userTeam?.registration_status
                      if (status === 'pending_approval') {
                        return (
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-yellow-500/20 text-yellow-400 px-5 py-3 rounded-xl border border-yellow-500/30 uppercase tracking-wider">
                              ⏳ Solicitud Pendiente
                            </span>
                            <span className="text-[9px] text-white/40 text-right max-w-[200px] leading-tight">
                              El organizador debe aprobar tu solicitud para que puedas pagar.
                            </span>
                          </div>
                        )
                      }
                      if (status === 'approved_to_pay') {
                        const rate = exchangeRate || 58.25
                        const entryFeeInKCoins = Math.round(entryFee * rate)
                        const currentPaid = Math.round(userTeam?.amount_paid || userTeam?.amountPaid || 0)
                        const remaining = Math.max(0, entryFeeInKCoins - currentPaid)
                        const hasEnough = localBalance >= remaining
                        const remainingUsd = parseFloat((remaining / rate).toFixed(2))

                        return (
                          <div className="flex flex-col items-end gap-2.5">
                            <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-orange-500/20 text-orange-400 px-5 py-2.5 rounded-xl border border-orange-500/30 uppercase tracking-wider">
                              💳 Pendiente de Pago
                            </span>
                            <span className="text-[10px] text-white/50 text-right max-w-[200px] leading-snug">
                              Costo: <strong className="text-white">${entryFee} USD</strong> (~{entryFeeInKCoins.toLocaleString('es-ES')} K-Coins)
                            </span>
                            <span className="text-[9px] text-white/30 text-right max-w-[200px] block">
                              Tu Saldo: {localBalance.toFixed(2)} K-Coins
                            </span>

                            {hasEnough ? (
                              <button
                                onClick={handlePayPendingFee}
                                disabled={payPendingLoading}
                                className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-wider text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)] disabled:opacity-40"
                              >
                                {payPendingLoading ? 'Procesando Pago...' : 'Pagar Inscripción 🪙'}
                              </button>
                            ) : (
                              <Link
                                href={`/wallet?amount=${remainingUsd}&redirect=${encodeURIComponent(window.location.pathname)}`}
                                className="px-5 py-2.5 bg-gradient-to-r from-neon-cyan to-blue-500 hover:opacity-90 active:scale-[0.98] text-black font-black uppercase tracking-wider text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(0,245,255,0.25)] text-center block"
                              >
                                Pagar con PayPal / Tarjeta 💳
                              </Link>
                            )}
                          </div>
                        )
                      }
                      if (status === 'pending_payment_validation') {
                        const evidencePublicUrl = userTeam.payment_evidence_url
                          ? supabase.storage.from('evidences').getPublicUrl(userTeam.payment_evidence_url).data.publicUrl
                          : null
                        return (
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-blue-500/20 text-blue-400 px-5 py-3 rounded-xl border border-blue-500/30 uppercase tracking-wider">
                              ⏳ Validando Transferencia
                            </span>
                            {evidencePublicUrl && (
                              <a
                                href={evidencePublicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-neon-cyan hover:underline flex items-center gap-1 font-semibold"
                              >
                                🖼️ Ver Comprobante Enviado
                              </a>
                            )}
                            <span className="text-[9px] text-white/40 text-right max-w-[200px] leading-tight">
                              El organizador está validando tu comprobante de pago.
                            </span>
                          </div>
                        )
                      }
                      
                      // Default is 'confirmed'
                      return (
                        <div className="flex flex-col items-end gap-2">
                          <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-green-500/20 text-green-400 px-5 py-3 rounded-xl border border-green-500/30 uppercase tracking-wider">
                            ✓ Inscrito
                          </span>
                          
                        </div>
                      )
                    })()
                  ) : !hasRegStarted ? (
                    <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-white/10 text-white/40 px-5 py-3 rounded-xl border border-white/5 uppercase tracking-wider">
                      Próximamente
                    </span>
                  ) : hasRegEnded ? (
                    <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-red-500/10 text-red-400 px-5 py-3 rounded-xl border border-red-500/20 uppercase tracking-wider">
                      Registro Cerrado
                    </span>
                  ) : isFull ? (
                    <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-red-500/10 text-red-400 px-5 py-3 rounded-xl border border-red-500/20 uppercase tracking-wider">
                      🚫 Cupos Llenos
                    </span>
                  ) : currentUser ? (
                    isForbiddenUser ? (
                      <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-yellow-500/10 text-yellow-500 px-5 py-3 rounded-xl border border-yellow-500/20 uppercase tracking-wider font-mono">
                        🚫 Staff / Organizador
                      </span>
                    ) : (
                      <button
                        onClick={handleOpenRegistration}
                        className="w-full md:w-auto px-6 py-3 bg-neon-cyan hover:bg-neon-cyan/90 active:scale-95 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(0,245,255,0.2)] hover:shadow-[0_0_35px_rgba(0,245,255,0.35)]"
                      >
                        Inscribirse Ahora
                      </button>
                    )
                  ) : (
                    <Link
                      href={`/login?redirectTo=/t/${slug}`}
                      className="inline-block w-full text-center px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-white/10"
                    >
                      Inicia Sesión
                    </Link>
                  )}
                </div>
              </div>
            )
          })()}
        </div>



      {/* Tabs — scrollable on mobile without ugly scrollbars */}
      <div className="flex items-center gap-1.5 mb-6 sm:mb-8 sm:justify-center overflow-x-auto pb-1 px-3 sm:px-0 scrollbar-none no-scrollbar max-w-full">
        <button
          onClick={() => setActiveTab('ranking')}
          className={`shrink-0 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg whitespace-nowrap ${
            activeTab === 'ranking' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'ranking' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Posiciones
        </button>
        <button
          onClick={() => setActiveTab('participants')}
          className={`shrink-0 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg whitespace-nowrap ${
            activeTab === 'participants' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'participants' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Participantes
        </button>
        {isShooter && (
          <button
            onClick={() => setActiveTab('matches')}
            className={`shrink-0 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg whitespace-nowrap ${
              activeTab === 'matches' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
            }`}
            style={{ borderColor: activeTab === 'matches' ? primaryColor : 'transparent', borderWidth: 1 }}
          >
            Partidas
          </button>
        )}
        {isShooter && (
          <button
            onClick={() => setActiveTab('statistics')}
            className={`shrink-0 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg whitespace-nowrap ${
              activeTab === 'statistics' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
            }`}
            style={{ borderColor: activeTab === 'statistics' ? primaryColor : 'transparent', borderWidth: 1 }}
          >
            Estadísticas
          </button>
        )}
        <button
          onClick={() => setActiveTab('rules')}
          className={`shrink-0 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg whitespace-nowrap ${
            activeTab === 'rules' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'rules' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Reglas
        </button>
        <button
          onClick={() => setActiveTab('evidences')}
          className={`shrink-0 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg whitespace-nowrap ${
            activeTab === 'evidences' ? 'bg-neon-purple/20 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'evidences' ? '#b026ff' : 'transparent', borderWidth: 1 }}
        >
          Subir Evidencias
        </button>
        {arenaBettingEnabled && (
          <button
            onClick={() => setActiveTab('bets')}
            className={`shrink-0 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg relative whitespace-nowrap ${
              activeTab === 'bets' ? 'bg-yellow-500/20 text-yellow-300' : 'text-white/40 hover:text-white/80'
            }`}
            style={{ borderColor: activeTab === 'bets' ? '#eab308' : 'transparent', borderWidth: 1 }}
          >
            Apuestas 🪙
          </button>
        )}
      </div>

      {activeTab === 'ranking' ? (
        currentTheme?.preset_name === 'split' ? (
          renderSplitStandings()
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-9 bg-dark-card/80 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                <span className="font-orbitron font-bold text-xs sm:text-sm text-white uppercase tracking-wider">Tabla de Posiciones</span>
                <button 
                  onClick={() => setIsTableMaximized(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-xs border border-white/5 font-semibold"
                >
                  <svg className="w-3.5 h-3.5 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  Maximizar Vista
                </button>
              </div>
              <div className="overflow-x-auto">
                {renderStandingsTable()}
              </div>
            </div>
            <div className="lg:col-span-3 lg:sticky lg:top-24 space-y-6">
              {streamUrl && !isClosedOrFull && (
                <div className="w-full rounded-2xl overflow-hidden border border-neon-cyan/30 shadow-[0_0_20px_rgba(0,245,255,0.1)] bg-black/50 aspect-video relative">
                  <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                    EN VIVO
                  </div>
                  {renderStreamPlayer(streamUrl)}
                </div>
              )}
              {vipEnabled && (
                <div className="bg-dark-card/85 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center bg-gradient-to-r from-neon-purple/10 to-transparent">
                    <span className="font-orbitron font-bold text-xs text-white uppercase tracking-widest flex items-center gap-2">
                      <span className="text-neon-purple">⚔️</span> Top Fraggers (MVP)
                    </span>
                    <span className="text-[10px] text-neon-purple font-bold uppercase tracking-wider">Top 3</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {(() => {
                      const topFraggersList = [...participantsWithCalculatedKills]
                        .sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0))
                        .slice(0, 3)

                      if (topFraggersList.length === 0 || !topFraggersList.some(p => (p.totalKills || 0) > 0)) {
                        return (
                          <div className="p-5 text-center text-xs text-white/40 font-orbitron">
                            Aún no hay bajas registradas
                          </div>
                        )
                      }

                      return topFraggersList.map((p, idx) => (
                        <div key={p.id} className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-orbitron font-black text-sm" style={{ color: (idx+1) === 1 ? '#FFD700' : (idx+1) === 2 ? '#C0C0C0' : '#CD7F32' }}>
                              {idx + 1 === 1 ? '🥇' : idx + 1 === 2 ? '🥈' : '🥉'}
                            </span>
                            <div className="min-w-0">
                               <div className="flex items-center gap-1.5 min-w-0">
                                 <p className="font-orbitron font-bold text-xs text-white truncate max-w-[140px]">{p.displayName}</p>
                                 {currentStatus === 'finished' && idx === 0 && (
                                   <span className="shrink-0 px-1 py-0.5 rounded text-[8px] font-black bg-neon-purple/20 text-neon-purple border border-neon-purple/30 uppercase tracking-widest animate-pulse">
                                     👑 MVP
                                   </span>
                                 )}
                               </div>
                              <p className="text-[10px] text-white/40 truncate max-w-[140px]">{p.teamName}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-orbitron font-black text-sm text-neon-cyan block leading-none mb-1">{p.totalKills || 0}</span>
                            <span className="text-[8px] text-white/30 block leading-none font-bold uppercase tracking-tighter">Kills</span>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}
              <AdPlacement banners={adBanners || []} slotName="leaderboard_sidebar" tournamentId={tournamentId} />
            </div>
          </div>
        )
      ) : activeTab === 'participants' ? (
        <div className="space-y-4">
          {(!confirmedTeams || confirmedTeams.length === 0) ? (
            <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl">
              <p className="text-white/40">No hay participantes registrados aún</p>
            </div>
          ) : (
            confirmedTeams.map((team: any) => (
              <div key={team.id} className="bg-dark-card/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {team.avatarUrl ? (
                      <img src={team.avatarUrl} alt={team.name} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">🎮</div>
                    )}
                    <h3 className="font-orbitron font-bold text-white text-lg">{team.name}</h3>
                  </div>
                  {/* Team stream buttons */}
                  <div className="flex gap-2">
                    {team.streamUrl && (
                      <>
                        <button
                          onClick={() => handleWatchTeam(team.streamUrl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-600/30 transition-all"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Ver en app
                        </button>
                        <a
                          href={team.streamUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-white/60 rounded-lg text-xs font-medium hover:bg-white/10 transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          Ir al canal
                        </a>
                      </>
                    )}
                  </div>
                </div>
                {/* Participants list */}
                {team.participants && team.participants.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {team.participants.map((p: any) => {
                      const hasStats = p.kdRatio != null || p.avgKills != null || p.classificationRank || p.brAvgPlacement != null
                      const pStream = p.streamUrl || (p.isCaptain ? team.streamUrl : null)
                      return (
                      <div 
                        key={p.id} 
                        onClick={() => setSelectedParticipantForProfile({
                          id: p.id,
                          displayName: p.displayName,
                          userId: p.userId || p.user_id,
                          avatarUrl: p.avatarUrl,
                          teamName: team.name
                        })}
                        className="bg-white/[0.03] border border-white/5 hover:border-neon-cyan/40 hover:bg-white/[0.06] rounded-xl overflow-hidden transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
                      >
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt="" className="w-9 h-9 rounded-lg object-contain shrink-0 group-hover:scale-105 transition-transform" style={{ background: 'transparent' }} />
                          ) : (
                            <div className={`w-2 h-2 rounded-full shrink-0 ${pStream ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm text-white/80 group-hover:text-white font-medium truncate transition-colors">{p.displayName}</span>
                              {p.isCaptain && <span className="text-[9px] font-bold text-neon-cyan uppercase tracking-wider border border-neon-cyan/30 px-1 py-0.5 rounded shrink-0">Cap</span>}
                            </div>
                            <span className="text-[9px] text-neon-cyan/70 group-hover:text-neon-cyan flex items-center gap-1 font-orbitron transition-colors mt-0.5">
                              <span>📊</span> Ver Expediente & Copas
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {isShooter && (
                              <div className="text-right">
                                <span className="text-xs font-orbitron font-bold text-white block leading-none">{calculatedKillsLookup[p.id] || 0}</span>
                                <span className="text-[7px] text-white/30 uppercase font-black tracking-tighter">Kills</span>
                              </div>
                            )}
                            {pStream && (
                              <div className="flex gap-1">
                                <button onClick={() => handleWatchTeam(pStream)} title="Ver stream" className="p-1 bg-red-600/20 hover:bg-red-600/40 rounded text-red-400 transition-colors">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                </button>
                                <a href={pStream} target="_blank" rel="noreferrer" className="p-1 bg-white/5 hover:bg-white/10 rounded text-white/40 transition-colors">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {isShooter && hasStats && (
                          <div className="grid grid-cols-4 divide-x divide-white/5 border-t border-white/5">
                            {p.kdRatio != null && (
                              <div className="px-2 py-1.5 text-center">
                                <p className="text-[7px] text-white/30 uppercase font-bold tracking-wider">K/D</p>
                                <p className="text-[11px] font-black text-neon-cyan font-orbitron">{Number(p.kdRatio).toFixed(2)}</p>
                              </div>
                            )}
                            {p.avgKills != null && (
                              <div className="px-2 py-1.5 text-center">
                                <p className="text-[7px] text-white/30 uppercase font-bold tracking-wider">AVG K</p>
                                <p className="text-[11px] font-black text-purple-400 font-orbitron">{Number(p.avgKills).toFixed(1)}</p>
                              </div>
                            )}
                            {p.classificationRank && (
                              <div className="px-2 py-1.5 text-center">
                                <p className="text-[7px] text-white/30 uppercase font-bold tracking-wider">RANGO</p>
                                <p className="text-[9px] font-black text-yellow-400 font-orbitron truncate">{p.classificationRank}</p>
                              </div>
                            )}
                            {p.brAvgPlacement != null && (
                              <div className="px-2 py-1.5 text-center">
                                <p className="text-[7px] text-white/30 uppercase font-bold tracking-wider">BR</p>
                                <p className="text-[11px] font-black text-white/60 font-orbitron">#{Number(p.brAvgPlacement).toFixed(0)}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'statistics' ? (
        <div className="space-y-6">
          {/* Top Fragger Hero Section (Individual) */}
          {topFraggers.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 bg-dark-card/30 border border-white/5 rounded-3xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
                <div className="flex flex-col items-center gap-2">
                  <h2 className={`${orbitron.className} text-xl font-black text-neon-cyan uppercase tracking-widest flex items-center gap-3`}>
                    <span className="p-1 px-2 rounded bg-neon-cyan/20 text-[10px] sm:text-xs font-sans">Individual</span>
                    Top Fragger MVP
                  </h2>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                {topFraggers.slice(0, 3).map((player, idx) => (
                  <motion.div
                    key={player.id}
                    whileHover={{ scale: 1.02, y: -5 }}
                    className={`relative group bg-dark-card/40 backdrop-blur-xl border rounded-2xl p-3.5 mb-2 overflow-hidden transition-all duration-300 w-full md:w-[calc(50%-1rem)] lg:w-[calc(33.33%-1rem)] max-w-sm ${
                      idx === 0 ? 'border-neon-cyan/50 shadow-[0_0_20px_rgba(0,245,255,0.15)]' : 'border-white/5'
                    }`}
                  >
                    {/* Accent background */}
                    <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full blur-3xl opacity-10 ${
                      idx === 0 ? 'bg-neon-cyan' : 'bg-neon-purple'
                    }`} />

                    <div className="flex items-center gap-3 relative z-10">
                      <div className="relative">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border ${
                          idx === 0 ? 'bg-neon-cyan/10 border-neon-cyan/40' : 'bg-white/5 border-white/10'
                        }`}>
                          {idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'}
                        </div>
                        {idx === 0 && (
                          <div className="absolute -top-1.5 -left-1.5 bg-neon-cyan text-black font-black text-[8px] px-1.5 py-0.5 rounded-full animate-bounce">
                            MVP
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-orbitron font-bold text-white text-base truncate group-hover:text-neon-cyan transition-colors">
                          {player.displayName}
                        </h4>
                        <p className="text-white/40 text-[10px] truncate uppercase tracking-tighter">Equipo: {(player as any).teamName}</p>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-black text-white leading-none">{(player as any).totalKills || 0}</div>
                        <div className="text-[9px] font-bold text-white/30 uppercase tracking-tighter">Kills</div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                      {player.streamUrl ? (
                        <button
                          onClick={() => handleWatchTeam(player.streamUrl!)}
                          className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-red-600/20 border border-red-500/20 text-red-400 rounded-lg text-[10px] font-bold hover:bg-red-600/30 transition-all group/btn"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Live Stream
                          <svg className="w-2.5 h-2.5 group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </button>
                      ) : (
                        <div className="flex-1 py-1.5 text-center text-[9px] text-white/10 font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-lg">
                          Offline
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {standings.map((team, idx) => (
                <div 
                  key={team.teamId}
                  className={`group relative overflow-hidden rounded-2xl border transition-all cursor-pointer ${
                    expandedTeamId === team.teamId 
                      ? 'border-neon-cyan bg-white/[0.05] ring-1 ring-neon-cyan/20' 
                      : 'border-white/5 bg-white/[0.02] hover:border-white/20'
                  }`}
                  onClick={() => setExpandedTeamId(expandedTeamId === team.teamId ? null : team.teamId)}
                >
                  <div className="p-6 flex items-center justify-between relative z-10">
                     <div className="flex items-center gap-4">
                        <div className="relative">
                           <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden shadow-inner">
                              {team.avatarUrl ? (
                                <img src={team.avatarUrl} alt={team.teamName} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl bg-gradient-to-br from-white/5 to-transparent">🛡️</div>
                              )}
                           </div>
                           <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-[10px] font-black text-white">
                              {idx + 1}
                           </div>
                        </div>
                        <div className="space-y-0.5">
                           <div className="flex items-center gap-2">
                              <h4 className="font-orbitron font-bold text-white group-hover:text-neon-cyan transition-colors truncate max-w-[120px]">{team.teamName}</h4>
                              {maxPointsLimit && maxPointsLimit > 0 && team.totalPoints >= maxPointsLimit && (
                                 <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 uppercase tracking-widest animate-pulse shrink-0">
                                    🎯 MP
                                 </span>
                              )}
                           </div>
                           <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Analizar Equipo</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="text-xl font-black text-white leading-none">
                          <NumberTicker value={Math.round(team.totalPoints * 10) / 10} precision={1} />
                        </div>
                        <div className="text-[8px] text-white/30 uppercase font-bold tracking-tighter">Puntos</div>
                     </div>
                  </div>
                  
                  {/* Small progress bar */}
                  <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan to-transparent w-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
             ))}
          </div>

          <AnimatePresence>
            {expandedTeamId && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden bg-dark-card/50 backdrop-blur-xl border border-neon-cyan/20 rounded-[32px] shadow-2xl"
              >
                {standings
                  .filter(s => s.teamId === expandedTeamId)
                  .map(s => {
                    const team = currentTeams.find(t => t.id === s.teamId)
                    return (
                      <TeamDetails
                        key={s.teamId}
                        teamId={s.teamId}
                        teamName={s.teamName}
                        matches={currentMatches}
                        submissions={currentSubmissions}
                        scoringRule={scoringRule!}
                        participants={participantsWithCalculatedKills}
                        primaryColor={primaryColor}
                        discipline={discipline}
                        totalPoints={s.totalPoints}
                        rank={s.rank}
                        tournamentMode={mode}
                        entryFee={entryFee}
                        amountPaid={team?.amountPaid || 0}
                        registrationStatus={team?.registrationStatus || 'confirmed'}
                      />
                    )
                  })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : activeTab === 'matches' ? (
        <MatchRecap 
          matches={currentMatches} 
          submissions={currentSubmissions} 
          participants={participantsWithCalculatedKills}
          primaryColor={primaryColor} 
        />
      ) : activeTab === 'rules' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-card/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(0,245,255,0.1)]">
              📜
            </div>
            <div>
              <h2 className={`${orbitron.className} text-2xl font-black text-white uppercase tracking-tighter`}>
                Reglamento Oficial
              </h2>
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Normativas y Conducta del Torneo</p>
            </div>
          </div>
          
          <div className="prose prose-invert max-w-none">
            {rulesText ? (
              <p className="text-white/70 leading-relaxed whitespace-pre-wrap font-sans text-base sm:text-lg bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                {rulesText}
              </p>
            ) : (
              <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl">
                <p className="text-white/20 italic">No se han definido reglas específicas para este torneo aún.</p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] font-black text-neon-cyan uppercase tracking-[0.2em] block mb-2">Formato de Juego</span>
              <span className="text-white font-orbitron font-bold text-sm uppercase">{format.replace(/_/g, ' ')}</span>
            </div>
            <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] font-black text-neon-cyan uppercase tracking-[0.2em] block mb-2">Estado del Torneo</span>
              <span className="text-white font-orbitron font-bold text-sm uppercase">{currentStatus}</span>
            </div>
          </div>
        </motion.div>
      ) : activeTab === 'bets' ? (
        <motion.div
          key="bets-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Balance Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-yellow-500/10 via-yellow-400/5 to-transparent border border-yellow-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-2xl">
                🪙
              </div>
              <div>
                <p className="text-[10px] text-yellow-400/60 uppercase tracking-widest font-bold">Tu Saldo</p>
                <p className="font-orbitron font-black text-2xl text-yellow-300">{localBalance.toFixed(2)} K-Coins</p>
              </div>
            </div>
            <Link
              href="/wallet"
              className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 hover:border-yellow-500/40 text-yellow-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              + Recargar Saldo
            </Link>
          </div>

          {/* Match Selector Pill Bar */}
          <div className="flex flex-wrap gap-2 mb-6">
            {matchFilterOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => {
                  setSelectedMatchFilter(opt.id)
                  setSelectedMarketId(null)
                  setSelectedOptionId(null)
                }}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-all ${
                  selectedMatchFilter === opt.id
                    ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300'
                    : 'bg-white/[0.03] border-white/5 text-white/50 hover:text-white/80 hover:border-white/10'
                }`}
              >
                {opt.name}
              </button>
            ))}
          </div>

          {/* Markets */}
          {displayedMarkets.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl">
              <p className="text-4xl mb-3">🪙</p>
              <p className="text-white/40 text-sm font-semibold uppercase tracking-widest">No hay mercados de apuestas en esta sección</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedMarkets.map((market: any) => {
                const opts = market.options as { id: string; name: string; odds: number }[]
                const isSelected = selectedMarketId === market.id
                const userBetForMarket = localUserBets.find((b: any) => b.market_id === market.id)
                const potentialWin = betAmount && selectedOptionId
                  ? (parseFloat(betAmount) * (opts.find(o => o.id === selectedOptionId)?.odds || 1)).toFixed(2)
                  : null

                // Sequential Lock Calculation
                const isLocked = (() => {
                  if (!market.match_id) return false
                  const currentMatch = currentMatches.find(m => m.id === market.match_id)
                  if (!currentMatch) return false
                  if (currentMatch.matchNumber > 1) {
                    const prevMatch = currentMatches.find(m => m.matchNumber === currentMatch.matchNumber - 1 && !m.parentMatchId)
                    if (prevMatch && !prevMatch.isCompleted) {
                      return true
                    }
                  }
                  return false
                })()

                return (
                  <div key={market.id} className={`bg-dark-card/60 backdrop-blur-xl border rounded-2xl overflow-hidden transition-all ${
                    isLocked ? 'border-white/5 opacity-70' :
                    market.status === 'open' ? 'border-yellow-500/20 hover:border-yellow-500/30' :
                    market.status === 'closed' ? 'border-white/10' :
                    market.status === 'resolved' ? 'border-blue-500/20' : 'border-white/5'
                  }`}>
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-semibold text-white text-sm leading-snug">{market.question}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <p className="text-white/30 text-[10px] uppercase tracking-widest">
                            {market.market_type === 'winner' ? '🏆 Ganador' : market.market_type === 'most_kills' ? '💀 Más Kills' : '✏️ Custom'}
                          </p>
                          {isLocked && (
                            <span className="text-yellow-500/60 text-[9px] font-semibold uppercase tracking-wider bg-yellow-500/5 px-2 py-0.5 rounded border border-yellow-500/10">
                              🔒 Se habilitará al finalizar la partida anterior
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                        isLocked ? 'text-white/30 bg-white/5 border-white/10' :
                        market.status === 'open' ? 'text-green-400 bg-green-400/10 border-green-400/30' :
                        market.status === 'closed' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' :
                        market.status === 'resolved' ? 'text-blue-400 bg-blue-400/10 border-blue-400/30' :
                        'text-white/30 bg-white/5 border-white/10'
                      }`}>
                        {isLocked ? '🔒 Bloqueado' : market.status === 'open' ? 'Abierto' : market.status === 'closed' ? 'Cerrado' : market.status === 'resolved' ? 'Resuelto' : 'Cancelado'}
                      </span>
                    </div>

                    {/* Options grid */}
                    <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {opts.map(opt => (
                        <button
                          key={opt.id}
                          disabled={market.status !== 'open' || !isLoggedIn || isLocked || currentStatus === 'finished'}
                          onClick={() => {
                            setSelectedMarketId(market.id)
                            setSelectedOptionId(opt.id)
                          }}
                          className={`py-3 px-3 rounded-xl text-left border transition-all ${
                            market.winning_option_id === opt.id
                              ? 'bg-green-500/20 border-green-500/40 text-green-300'
                              : isSelected && selectedOptionId === opt.id
                              ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200'
                              : isLocked
                              ? 'bg-white/[0.01] border-white/5 text-white/20 cursor-not-allowed'
                              : 'bg-white/[0.03] border-white/5 text-white/70 hover:border-yellow-500/30 hover:bg-yellow-500/5 disabled:cursor-not-allowed'
                          }`}
                        >
                          <p className="font-bold text-xs leading-tight">{opt.name}</p>
                          <p className="font-orbitron font-black text-sm mt-1 text-yellow-400">{opt.odds}x</p>
                        </button>
                      ))}
                    </div>

                    {/* Bet form — only if open, logged in, and this market is selected */}
                    {market.status === 'open' && isLoggedIn && isSelected && selectedOptionId && (
                      <div className="px-5 pb-5 pt-1 border-t border-white/5 space-y-3">
                        <div className="flex gap-3 items-center">
                          <div className="flex-1">
                            <label className="text-[10px] text-white/30 uppercase tracking-widest font-bold block mb-1.5">Monto (K-Coins)</label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={betAmount}
                              onChange={e => setBetAmount(e.target.value)}
                              placeholder="Ej: 50"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-yellow-500/50 font-mono"
                            />
                          </div>
                          {potentialWin && (
                            <div className="text-right">
                              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Ganancia Potencial</p>
                              <p className="font-orbitron font-black text-xl text-yellow-300">{potentialWin}</p>
                              <p className="text-[9px] text-white/20">K-Coins</p>
                            </div>
                          )}
                        </div>
                        <button
                          disabled={betsLoading || !betAmount || parseFloat(betAmount) <= 0}
                          onClick={async () => {
                            if (!selectedOptionId || !betAmount) return
                            setBetsLoading(true)
                            try {
                              const res = await placePredictionAction({
                                marketId: market.id,
                                selectedOptionId,
                                amount: parseFloat(betAmount),
                              })
                              if ('error' in res) {
                                toast.error(res.error)
                              } else {
                                toast.success('¡Apuesta registrada con éxito!')
                                setLocalBalance(res.balance)
                                setLocalUserBets(prev => [res.bet, ...prev])
                                setSelectedMarketId(null)
                                setSelectedOptionId(null)
                                setBetAmount('')
                              }
                            } finally {
                              setBetsLoading(false)
                            }
                          }}
                          className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                        >
                          {betsLoading ? 'Procesando...' : 'Confirmar Apuesta 🪙'}
                        </button>
                      </div>
                    )}

                    {/* Login prompt */}
                    {market.status === 'open' && !isLoggedIn && (
                      <div className="px-5 pb-5">
                        <Link href={`/login?redirectTo=/t/${slug}`} className="block w-full text-center py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all">
                          Inicia sesión para apostar
                        </Link>
                      </div>
                    )}

                    {/* Existing user bet badge */}
                    {userBetForMarket && (
                      <div className={`mx-5 mb-4 px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                        userBetForMarket.status === 'won' ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                        userBetForMarket.status === 'lost' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                        userBetForMarket.status === 'refunded' ? 'bg-white/5 border-white/10 text-white/40' :
                        'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
                      }`}>
                        <span>Tu apuesta: {opts.find(o => o.id === userBetForMarket.selected_option_id)?.name}</span>
                        <span>{userBetForMarket.amount} K-Coins → {parseFloat(userBetForMarket.potential_payout).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* User Bet History */}
          {localUserBets.length > 0 && (
            <div className="bg-dark-card/40 border border-white/5 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h3 className="font-orbitron font-bold text-sm text-white uppercase tracking-widest">Mis Apuestas en este Torneo</h3>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {localUserBets.map((bet: any) => {
                  const market = betMarkets.find((m: any) => m.id === bet.market_id)
                  const opts = market?.options as { id: string; name: string; odds: number }[] || []
                  const chosenOpt = opts.find(o => o.id === bet.selected_option_id)
                  return (
                    <div key={bet.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white/80 text-xs font-semibold truncate">{market?.question}</p>
                        <p className="text-white/40 text-[10px] mt-0.5">Aposté a: <b className="text-white/60">{chosenOpt?.name || '—'}</b></p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-sm text-white">{parseFloat(bet.amount).toFixed(0)} K-Coins</p>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          bet.status === 'won' ? 'bg-green-500/20 text-green-300' :
                          bet.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                          bet.status === 'refunded' ? 'bg-white/10 text-white/40' :
                          'bg-yellow-500/10 text-yellow-300'
                        }`}>
                          {bet.status === 'won' ? '✓ Ganada' : bet.status === 'lost' ? '✗ Perdida' : bet.status === 'refunded' ? 'Reembolsada' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>
      ) : activeTab === 'evidences' ? (
        <motion.div 
          key="evidences-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-card/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(176,38,255,0.1)]">
              📤
            </div>
            <div>
              <h2 className={`${orbitron.className} text-2xl font-black text-white uppercase tracking-tighter`}>
                Portal de Evidencias
              </h2>
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Accede al panel para subir capturas</p>
            </div>
          </div>
          
          {!currentUser ? (
            <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              <p className="text-white/60 mb-4 text-sm font-semibold uppercase tracking-wider">Debes iniciar sesión para acceder al portal de tu equipo.</p>
              <Link 
                href={`/login?redirectTo=/t/${slug}`}
                className="inline-block px-6 py-2.5 bg-neon-purple hover:bg-neon-purple/80 text-white font-orbitron font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-neon-purple/50"
              >
                Iniciar Sesión
              </Link>
            </div>
          ) : !captainTeam ? (
            <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              <p className="text-white/40 italic text-sm">Este portal es de acceso exclusivo para los participantes de los equipos registrados.</p>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <Link 
                href={`/t/${slug}/team/${captainTeam.id}`}
                className="group flex items-center gap-4 p-5 bg-white/[0.03] hover:bg-neon-purple/10 border border-white/5 hover:border-neon-purple/50 rounded-2xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(176,38,255,0.15)]"
              >
                {captainTeam.avatarUrl ? (
                  <img src={captainTeam.avatarUrl} alt={captainTeam.name} className="w-14 h-14 rounded-xl object-cover border border-white/10 group-hover:border-neon-purple/50 transition-colors" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-white/5 group-hover:bg-neon-purple/20 border border-white/10 group-hover:border-neon-purple/30 flex items-center justify-center text-2xl transition-colors">
                    🎮
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] text-neon-cyan font-bold uppercase tracking-widest block mb-1">Mi Equipo</span>
                  <h3 className="font-orbitron font-bold text-lg text-white group-hover:text-neon-purple transition-colors truncate">
                    {captainTeam.name}
                  </h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest group-hover:text-neon-purple/60 transition-colors mt-1">
                    Ingresar al Portal →
                  </p>
                </div>
              </Link>
            </div>
          )}
        </motion.div>
      ) : null}
      </div> {/* Close the main filter wrapper here to make modals fixed relative to viewport */}

      <AnimatePresence>
        {watchingStream && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setWatchingStream(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-dark-card w-full max-w-5xl aspect-video rounded-2xl overflow-hidden border border-white/10 relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <a
                  href={watchingStream}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-neon-cyan/20 hover:bg-neon-cyan/40 text-neon-cyan rounded-lg transition-colors text-sm font-medium border border-neon-cyan/50 backdrop-blur-md flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Ver en sitio original
                </a>
                <button 
                  onClick={() => setWatchingStream(null)}
                  className="p-2 bg-black/50 hover:bg-black/80 rounded-lg text-white/50 hover:text-white transition-all backdrop-blur-md border border-white/10"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {renderStreamPlayer(watchingStream)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
          {showHallOfFame && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
              onClick={() => setShowHallOfFame(false)}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 30 }}
                className="relative max-w-5xl w-full flex flex-col items-center"
                onClick={e => e.stopPropagation()}
              >
                {/* Decorative glow */}
                <div className="absolute -top-20 -z-10 w-64 h-64 bg-gold/20 rounded-full blur-[100px] animate-pulse" />

                <h2 className="font-orbitron font-black text-2xl sm:text-4xl text-gold mb-6 uppercase tracking-widest text-center flex flex-col items-center gap-2">
                  <span className="text-4xl sm:text-6xl drop-shadow-[0_0_20px_rgba(255,215,0,0.4)]">🏆</span>
                  Salón de la Fama
                  <div className="h-1 w-24 bg-gradient-to-r from-transparent via-gold to-transparent mt-2" />
                </h2>

                {/* Champion team name from standings rank 1 */}
                {standings[0] && (
                  <div className="flex flex-col items-center gap-3 mb-6">
                    <span className="text-xs font-bold text-gold/60 uppercase tracking-[0.3em]">Campeón</span>
                    <div className="flex items-center gap-4">
                      {standings[0].avatarUrl ? (
                        <img src={standings[0].avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-gold/50 shadow-[0_0_20px_rgba(255,215,0,0.3)]" />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gold/10 border-2 border-gold/30 flex items-center justify-center text-2xl font-black text-gold">
                          {standings[0].teamName?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-orbitron font-black text-3xl sm:text-5xl text-white drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]">
                        {standings[0].teamName}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-white/60 font-orbitron mt-1">
                      {discipline === 'clash_royale' ? (
                        <span><b className="text-neon-cyan">{Math.round(standings[0].totalPoints * 10) / 10}</b> COPAS</span>
                      ) : (
                        <span><b className="text-neon-cyan">{Math.round(standings[0].totalPoints * 10) / 10}</b> PTS</span>
                      )}
                      {isShooter && (
                        <span><b className="text-white">{standings[0].totalKills}</b> KILLS</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Victory photo (if uploaded) */}
                {currentChampionImg && (
                  <div className="relative group p-1 bg-gradient-to-b from-gold/50 via-gold/10 to-transparent rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(255,215,0,0.15)]">
                    <img
                      src={currentChampionImg.startsWith('http')
                        ? currentChampionImg
                        : `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')}/storage/v1/object/public/evidences/${currentChampionImg.replace(/^evidences\//, '')}`}
                      alt="Foto de victoria"
                      className="max-h-[50vh] rounded-2xl object-contain shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                  </div>
                )}

                <button
                  onClick={() => setShowHallOfFame(false)}
                  className="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl font-bold text-sm transition-all border border-white/10 flex items-center gap-3 group"
                >
                  <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Volver al Marcador
                </button>
              </motion.div>
            </motion.div>
          )}
          {isTableMaximized && (
            <motion.div
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 bg-black/45 backdrop-blur-xl overflow-y-auto"
              onClick={() => setIsTableMaximized(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="bg-dark-card/95 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] w-full max-w-6xl my-8 flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div 
                  className="flex justify-between items-center px-6 sm:px-8 py-5 border-b border-white/5 bg-white/[0.03]"
                  style={{ borderLeft: `4px solid ${primaryColor}` }}
                >
                  <div>
                    <h2 className="font-orbitron font-black text-lg sm:text-2xl text-white uppercase tracking-wider">
                      Clasificación General
                    </h2>
                    <p className="text-white/40 text-xs mt-0.5 uppercase tracking-widest font-semibold">
                      {tournamentName} • Vista Expandida
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsTableMaximized(false)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-sm border border-white/5 font-semibold group"
                  >
                    <span className="group-hover:rotate-90 transition-transform duration-300">✕</span>
                    Minimizar
                  </button>
                </div>
                <div className="overflow-x-auto p-4 sm:p-6 max-h-[75vh] overflow-y-auto">
                  {renderStandingsTable()}
                </div>
              </motion.div>
            </motion.div>
          )}
          {isRegistering && (
            <motion.div
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xl overflow-y-auto"
              onClick={() => setIsRegistering(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="bg-dark-card/95 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] w-full max-w-lg flex flex-col max-h-[85vh] sm:max-h-[90vh] my-4 sm:my-8"
                onClick={e => e.stopPropagation()}
              >
                <div 
                  className="flex justify-between items-center px-6 sm:px-8 py-5 border-b border-white/5 bg-white/[0.03]"
                  style={{ borderLeft: `4px solid ${primaryColor}` }}
                >
                  <div>
                    <h2 className="font-orbitron font-black text-lg sm:text-xl text-white uppercase tracking-wider">
                      Formulario de Inscripción
                    </h2>
                    <p className="text-white/40 text-xs mt-0.5 uppercase tracking-widest font-semibold">
                      Modalidad: {mode.toUpperCase()}
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsRegistering(false)}
                    className="p-2 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-lg transition-all border border-white/10"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleRegisterSubmit} className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {mode !== 'individual' && (
                    <div>
                      <label className="block text-xs text-white/60 uppercase tracking-widest font-bold mb-1.5 ml-1">
                        Nombre del Equipo
                      </label>
                      <input
                        required
                        type="text"
                        value={regTeamName}
                        onChange={e => setRegTeamName(e.target.value)}
                        placeholder="Ej. Los Reyes del Barrio"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-white/60 uppercase tracking-widest font-bold mb-1.5 ml-1">
                      Link de Stream (Opcional)
                    </label>
                    <input
                      type="url"
                      value={regStreamUrl}
                      onChange={e => setRegStreamUrl(e.target.value)}
                      placeholder="https://twitch.tv/tu_canal"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all"
                    />
                  </div>



                  <div className="space-y-4">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-xs text-white/60 uppercase tracking-widest font-bold">
                        Integrantes ({regParticipants.length})
                      </label>
                      {mode !== 'individual' && (
                        <button
                          type="button"
                          onClick={() => setShowQuickAddFriend(prev => !prev)}
                          className="text-[11px] text-neon-cyan hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>{showQuickAddFriend ? '✖ Cerrar buscador' : '➕ Buscar amigo por ID / @usuario'}</span>
                        </button>
                      )}
                    </div>

                    {/* Buscador Rápido de Amigos Integrado */}
                    {showQuickAddFriend && (
                      <div className="p-3.5 rounded-xl bg-neon-purple/10 border border-neon-purple/30 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-orbitron font-bold text-white uppercase tracking-wider">
                            🔍 Agregar Amigo a Kronix
                          </span>
                          <a
                            href="/profile?tab=friends"
                            target="_blank"
                            className="text-[10px] text-white/50 hover:text-white underline"
                          >
                            Abrir lista completa ↗
                          </a>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={quickFriendQuery}
                            onChange={e => setQuickFriendQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchFriend() } }}
                            placeholder="Nombre de usuario o ID (ej: KX-ABC123)"
                            className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-neon-purple"
                          />
                          <button
                            type="button"
                            onClick={handleSearchFriend}
                            disabled={isSearchingFriend}
                            className="px-3.5 py-2 rounded-xl bg-neon-purple hover:bg-neon-purple/80 text-white font-bold text-xs transition-all disabled:opacity-50"
                          >
                            {isSearchingFriend ? 'Buscando...' : 'Buscar'}
                          </button>
                        </div>

                        {friendSearchResults.length > 0 && (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto">
                            {friendSearchResults.map(u => (
                              <div
                                key={u.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">
                                    👤
                                  </div>
                                  <div>
                                    <span className="text-xs text-white font-bold block">{u.username || 'Usuario'}</span>
                                    {u.short_id && <span className="text-[9px] text-white/40 block">{u.short_id}</span>}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddFriendFromModal(u.id)}
                                  className="px-2.5 py-1 rounded-lg bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan hover:text-black font-bold text-[10px] transition-all"
                                >
                                  ➕ Agregar
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {regParticipants.map((name, idx) => {
                      const gameInfo = GAME_LABELS[discipline] || {
                        label: discipline,
                        idLabel: 'ID de cuenta',
                        usernameLabel: 'Nombre en el juego',
                        idPlaceholder: 'Ej: TuID123',
                        usernamePlaceholder: 'Ej: TuNombre',
                        icon: '🎮'
                      }

                      return (
                        <div key={idx} className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-orbitron font-bold text-white uppercase tracking-wider">
                              {mode === 'individual' ? '👤 Datos del Jugador' : idx === 0 ? '👑 Capitán (Tú)' : `👤 Integrante ${idx + 1}`}
                            </span>
                            {regParticipantUserIds[idx] && (
                              <span className="text-[9px] text-neon-cyan/90 bg-neon-cyan/10 px-2 py-0.5 rounded-full border border-neon-cyan/30 font-semibold">
                                ✓ Registrado
                              </span>
                            )}
                          </div>

                          {idx === 0 ? (
                            <div>
                              <label className="block text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1 ml-1">
                                Tu Nombre / Nickname en Kronix
                              </label>
                              <input
                                required
                                type="text"
                                value={name}
                                onChange={e => {
                                  const newParticipants = [...regParticipants]
                                  newParticipants[idx] = e.target.value
                                  setRegParticipants(newParticipants)
                                }}
                                placeholder="Tu display name / GamerTag"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all"
                              />
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <label className="block text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1 ml-1">
                                Amigo de Kronix <span className="text-red-400">*</span>
                              </label>
                              <select
                                required
                                value={regParticipantUserIds[idx] || ''}
                                onChange={e => {
                                  const val = e.target.value
                                  const newParticipants = [...regParticipants]
                                  const newIds = [...regParticipantUserIds]
                                  const newStreams = [...regParticipantStreams]

                                  if (!val) {
                                    newIds[idx] = null
                                    newParticipants[idx] = ''
                                  } else {
                                    const friend = userFriends.find(f => f.id === val)
                                    if (friend) {
                                      newIds[idx] = friend.id
                                      newParticipants[idx] = friend.username || friend.short_id || 'Amigo'
                                      newStreams[idx] = friend.stream_url || ''

                                      // Auto-load friend's game credentials
                                      getGameAccountForUser(friend.id, discipline).then(res => {
                                        if (res && 'data' in res && res.data) {
                                          const gameData = res.data;
                                          setRegParticipantGameIds(prev => {
                                            const updated = [...prev]
                                            updated[idx] = gameData.game_id || ''
                                            return updated
                                          })
                                          setRegParticipantGameUsernames(prev => {
                                            const updated = [...prev]
                                            updated[idx] = gameData.game_username || ''
                                            return updated
                                          })
                                        }
                                      }).catch(() => {})
                                    }
                                  }
                                  setRegParticipants(newParticipants)
                                  setRegParticipantUserIds(newIds)
                                  setRegParticipantStreams(newStreams)
                                }}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30"
                              >
                                <option value="">-- Seleccionar de mi Lista de Amigos --</option>
                                {userFriends.map(f => {
                                  const isAlreadySelected = regParticipantUserIds.some((uid, uIdx) => uIdx !== idx && uid === f.id) || f.id === currentUser?.id
                                  return (
                                    <option key={f.id} value={f.id} disabled={isAlreadySelected}>
                                      👤 {f.username || 'Usuario'} {f.short_id ? `(${f.short_id})` : ''} {isAlreadySelected ? '(Ya seleccionado)' : ''}
                                    </option>
                                  )
                                })}
                              </select>

                              {userFriends.length === 0 && (
                                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300 leading-snug">
                                  ⚠️ No tienes amigos agregados aún. Usa el buscador de arriba para agregar a tu compañero por su <strong>@usuario</strong> o <strong>ID</strong> de Kronix.
                                </div>
                              )}
                            </div>
                          )}

                          {/* Credenciales de juego para este integrante */}
                          <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] text-neon-cyan/70 uppercase tracking-widest font-bold mb-1 ml-1 flex items-center gap-1">
                                <span>{gameInfo.icon}</span>
                                <span>{gameInfo.idLabel} <span className="text-red-400">*</span></span>
                              </label>
                              <input
                                required
                                type="text"
                                value={regParticipantGameIds[idx] || ''}
                                onChange={e => {
                                  const updated = [...regParticipantGameIds]
                                  updated[idx] = e.target.value
                                  setRegParticipantGameIds(updated)
                                }}
                                placeholder={gameInfo.idPlaceholder}
                                className="w-full bg-black/40 border border-neon-cyan/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/60 focus:ring-1 focus:ring-neon-cyan/30 transition-all font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-neon-cyan/70 uppercase tracking-widest font-bold mb-1 ml-1 flex items-center gap-1">
                                <span>🏷️</span>
                                <span>{gameInfo.usernameLabel} <span className="text-red-400">*</span></span>
                              </label>
                              <input
                                required
                                type="text"
                                value={regParticipantGameUsernames[idx] || ''}
                                onChange={e => {
                                  const updated = [...regParticipantGameUsernames]
                                  updated[idx] = e.target.value
                                  setRegParticipantGameUsernames(updated)
                                }}
                                placeholder={gameInfo.usernamePlaceholder}
                                className="w-full bg-black/40 border border-neon-cyan/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/60 focus:ring-1 focus:ring-neon-cyan/30 transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Password for private tournaments */}
                  {isPrivate && (
                    <div className="rounded-xl border border-neon-purple/30 bg-neon-purple/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-neon-purple">
                        <span>🔒</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Torneo Privado</span>
                      </div>
                      <label className="block text-[10px] text-white/60 uppercase tracking-widest font-bold mb-1 ml-1">
                        Contraseña de Inscripción <span className="text-red-400">*</span>
                      </label>
                      <input
                        required
                        type="password"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        placeholder="Contraseña proporcionada por el organizador"
                        className="w-full bg-black/40 border border-neon-purple/30 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-purple/60 focus:ring-1 focus:ring-neon-purple/30 transition-all"
                      />
                    </div>
                  )}

                  {/* Entry fee K-Coins notice inside the form */}
                  {entryFee > 0 && (
                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 flex flex-col gap-2.5">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🪙</span>
                        <div>
                          <p className="text-xs font-black text-yellow-300 uppercase tracking-wider">
                            Costo: ${entryFee} USD (~{Math.round(entryFee * (exchangeRate || 58.25)).toLocaleString('es-ES')} K-Coins)
                          </p>
                          <p className="text-[10px] text-white/40 mt-0.5">
                            Se descontará el equivalente en K-Coins de tu billetera al confirmar.
                          </p>
                        </div>
                      </div>

                      {isLoggedIn && localBalance < (entryFee * (exchangeRate || 58.25)) && (
                        <div className="mt-1 p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex flex-col gap-2.5 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                          <p className="text-[11px] text-yellow-300 font-semibold text-left">
                            ⚠️ Tu Saldo: <strong>{localBalance.toFixed(2)} K-Coins</strong> (Faltan {Math.max(0, (entryFee * (exchangeRate || 58.25)) - localBalance).toFixed(2)} K-Coins para pagar la inscripción)
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowRegPayModal(true)}
                            className="w-full py-2.5 px-4 bg-gradient-to-r from-yellow-400 to-amber-500 hover:opacity-95 active:scale-[0.98] text-black text-xs font-black uppercase rounded-xl transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)] flex items-center justify-center gap-2 font-orbitron"
                          >
                            <span>💳 Pagar Cuota de Inscripción (${Math.max(1, parseFloat((entryFee - (localBalance / (exchangeRate || 58.25))).toFixed(2)))} USD)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  </div>
                  <div className="flex gap-3 p-6 pt-4 border-t border-white/5 bg-white/[0.01]">
                    {entryFee > 0 && isLoggedIn && localBalance < (entryFee * (exchangeRate || 58.25)) ? (
                      <button
                        type="button"
                        onClick={() => setShowRegPayModal(true)}
                        className="flex-1 py-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:opacity-90 active:scale-95 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(234,179,8,0.25)] flex items-center justify-center gap-2 text-center font-orbitron"
                      >
                        <span>💳 Pagar Cuota para Inscribirse</span>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={regLoading}
                        className="flex-1 py-3 bg-neon-cyan hover:bg-neon-cyan/95 active:scale-95 text-black font-bold text-sm uppercase tracking-wider rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(0,245,255,0.15)] font-orbitron"
                      >
                        {regLoading ? 'Procesando Inscripción...' : 'Enviar Inscripción'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsRegistering(false)}
                      className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-sm font-bold uppercase tracking-wider rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}

          {/* Modal Embebido de Pago Directo PayPal */}
          {showRegPayModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl"
              onClick={() => { if (!isRegPaying) setShowRegPayModal(false) }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-[#0e0e12] border border-white/15 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] w-full max-w-2xl flex flex-col md:flex-row max-h-[90vh] my-4 relative"
                onClick={e => e.stopPropagation()}
              >
                {/* Left Col: Order Summary */}
                <div className="md:w-5/12 bg-[#08080a] p-6 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🛡️</span>
                      <h3 className="font-orbitron font-black text-sm text-white uppercase tracking-wider">Pago Seguro</h3>
                    </div>

                    {(() => {
                      const netNeeded = Math.max(1, parseFloat((entryFee - (localBalance / (exchangeRate || 58.25))).toFixed(2)))
                      const { grossAmount, fee } = calculatePayPalGrossAmount(netNeeded)
                      return (
                        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2.5">
                          <div>
                            <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Torneo</p>
                            <p className="text-xs font-bold text-white leading-tight mt-0.5">{tournamentName}</p>
                          </div>
                          <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-white/50">Cuota Torneo:</span>
                              <span className="font-bold text-white">${netNeeded.toFixed(2)} USD</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-white/40">Tarifa Pasarela (PayPal):</span>
                              <span className="text-white/60">+${fee.toFixed(2)} USD</span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-white/5 font-bold">
                              <span className="text-white/80">Total a Pagar:</span>
                              <span className="font-orbitron font-black text-neon-cyan">${grossAmount.toFixed(2)} USD</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5">
                            <span className="text-white/50">Recibirás:</span>
                            <span className="font-orbitron font-bold text-yellow-400">🪙 {Math.round(netNeeded * (exchangeRate || 58.25))} K-Coins</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="pt-4 text-[10px] text-white/40 space-y-1">
                    <p className="flex items-center gap-1.5"><span>🔒</span> Cifrado SSL 256-bit</p>
                    <p className="flex items-center gap-1.5"><span>⚡</span> Acreditación instantánea</p>
                    <p className="flex items-center gap-1.5"><span>🎮</span> Retorno automático a tu inscripción</p>
                  </div>
                </div>

                {/* Right Col: PayPal & Card Buttons */}
                <div className="flex-1 p-6 bg-[#0c0c10] flex flex-col justify-between space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-orbitron font-bold text-white uppercase tracking-wider">Elige tu método de pago</p>
                    <button
                      disabled={isRegPaying}
                      onClick={() => setShowRegPayModal(false)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all text-xs disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex-1 flex flex-col justify-center min-h-[220px]">
                    {isRegPaying ? (
                      <div className="py-12 flex flex-col items-center justify-center space-y-3">
                        <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-white/60 font-semibold">Procesando pago y acreditando K-Coins...</p>
                      </div>
                    ) : (
                      <div id="paypal-reg-modal-container" className="w-full space-y-2">
                        {/* PayPal Smart Payment Buttons */}
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-center text-white/30">
                    🔒 Desarrollado y procesado de forma segura por PayPal
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Participant Career Profile & Cups History Modal */}
        <ParticipantProfileModal
          isOpen={!!selectedParticipantForProfile}
          onClose={() => setSelectedParticipantForProfile(null)}
          participant={selectedParticipantForProfile}
        />

        {/* Script for PayPal SDK in Leaderboard */}
        <Script
          src={`https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=USD&enable-funding=card,paylater,venmo`}
          onLoad={() => setPaypalSdkLoaded(true)}
          onError={() => console.error('Failed to load PayPal SDK in Leaderboard')}
        />
    </>
  )
}
