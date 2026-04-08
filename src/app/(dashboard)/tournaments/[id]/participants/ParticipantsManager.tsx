'use client'

import { useState, useRef } from 'react'
import type { Team, Participant, TournamentMode } from '@/types'
import { createTeam, addParticipant, deleteTeam, deleteParticipant, updateTeam, updateParticipant } from '@/lib/actions/participants'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function ParticipantsManager({
  tournamentId,
  tournamentSlug,
  tournamentMode,
  initialTeams,
  initialParticipants,
}: {
  tournamentId: string
  tournamentSlug: string
  tournamentMode: TournamentMode
  initialTeams: Team[]
  initialParticipants: Participant[]
}) {
  const [teams, setTeams] = useState(initialTeams)
  const [participants, setParticipants] = useState(initialParticipants)
  const [isAdding, setIsAdding] = useState(false)
  
  const isIndividual = tournamentMode === 'individual'
  const maxPerTeam = { individual: 1, duos: 2, trios: 3, cuartetos: 4 }[tournamentMode]

  // Form states
  const [teamName, setTeamName] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentUploadRef = useRef<{ id: string, type: 'team' | 'participant' } | null>(null)
  
  const supabase = createClient()

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isIndividual) {
        if (!playerName.trim()) throw new Error('El nombre es requerido')
        
        const tRes = await createTeam(tournamentId, { 
          name: playerName,
          streamUrl: streamUrl || undefined 
        })
        if ('error' in tRes) throw new Error(tRes.error)
        
        const pRes = await addParticipant(tournamentId, {
          displayName: playerName,
          teamId: tRes.data.id,
          isCaptain: true,
        })
        if ('error' in pRes) throw new Error(pRes.error)
        
        setTeams([...teams, tRes.data])
        setParticipants([...participants, pRes.data])
        setPlayerName('')
        setStreamUrl('')
      } else {
        if (!teamName.trim()) throw new Error('El nombre de equipo es requerido')
        
        const tRes = await createTeam(tournamentId, { 
          name: teamName,
          streamUrl: streamUrl || undefined
        })
        if ('error' in tRes) throw new Error(tRes.error)
        
        setTeams([...teams, tRes.data])
        setTeamName('')
        setStreamUrl('')
      }
      setIsAdding(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTeam = async (teamId: string) => {
    if (!confirm('¿Estás seguro de eliminar este participante/equipo?')) return
    
    const res = await deleteTeam(tournamentId, teamId)
    if ('error' in res) {
      alert(res.error)
    } else {
      setTeams(teams.filter(t => t.id !== teamId))
      setParticipants(participants.filter(p => p.teamId !== teamId))
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUploadRef.current) return

    const { id, type } = currentUploadRef.current
    setUploadingId(id)
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${id}-${type}-avatar.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidences')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('evidences')
        .getPublicUrl(filePath)

      if (type === 'team') {
        const res = await updateTeam(tournamentId, id, { avatarUrl: publicUrl })
        if ('error' in res) throw new Error(res.error)
        setTeams(teams.map(t => t.id === id ? { ...t, avatarUrl: publicUrl } : t))
      } else {
        const res = await updateParticipant(tournamentId, id, { avatarUrl: publicUrl })
        if ('error' in res) throw new Error(res.error)
        setParticipants(participants.map(p => p.id === id ? { ...p, avatarUrl: publicUrl } : p))
      }

      toast.success('Imagen actualizada con éxito')
    } catch (err: any) {
      toast.error('Error al subir imagen: ' + err.message)
    } finally {
      setUploadingId(null)
      currentUploadRef.current = null
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const triggerUpload = (id: string, type: 'team' | 'participant') => {
    currentUploadRef.current = { id, type }
    fileInputRef.current?.click()
  }

  // Find participants for a team
  const getTeamRoster = (teamId: string) => participants.filter(p => p.teamId === teamId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white/80">Listado ({teams.length})</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 
            text-sm text-white rounded-lg transition-colors border border-white/10"
        >
          {isAdding ? 'Cancelar' : (isIndividual ? '+ Agregar Jugador' : '+ Agregar Equipo')}
        </button>
      </div>

      {isAdding && (
        <div className="bg-dark-card border border-neon-purple/20 rounded-xl p-5 shadow-lg shadow-neon-purple/5">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-white/50 mb-1.5 ml-1">
                  {isIndividual ? 'Nombre del Jugador' : 'Nombre del Equipo'}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={isIndividual ? playerName : teamName}
                  onChange={(e) => isIndividual ? setPlayerName(e.target.value) : setTeamName(e.target.value)}
                  placeholder={isIndividual ? 'Ej. Faker' : 'Ej. Team Liquid'}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none
                    focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/50 transition-all text-sm
                    text-white placeholder:text-white/20"
                />
              </div>
              <div className="flex-[0.6]">
                <label className="block text-xs text-white/50 mb-1.5 ml-1">
                  Link de Stream (Twitch/YouTube/Kick)
                </label>
                <input
                  type="url"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="https://twitch.tv/..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none
                    focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/50 transition-all text-sm
                    text-white placeholder:text-white/20"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-neon-purple hover:bg-neon-purple/90 active:scale-95 text-white 
                  text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  shadow-lg shadow-neon-purple/20"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
          {error && <p className="text-red-400 text-xs mt-2 ml-1">{error}</p>}
        </div>
      )}

      {teams.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
          <p className="text-white/40 text-sm">No hay {isIndividual ? 'jugadores' : 'equipos'} registrados aún</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {teams.map(team => {
            const roster = getTeamRoster(team.id)
            const isFull = roster.length >= maxPerTeam
            
            return (
              <div key={team.id} className="bg-dark-card border border-white/5 rounded-xl p-4 group
                hover:border-white/10 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <button 
                      type="button"
                      onClick={() => triggerUpload(team.id, 'team')}
                      className="relative w-14 h-14 rounded-xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer hover:border-neon-purple/50 hover:ring-2 hover:ring-neon-purple/20 transition-all shrink-0 group/logo"
                      title="Subir logo del equipo"
                    >
                      {team.avatarUrl ? (
                        <img src={team.avatarUrl} alt={team.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl grayscale opacity-30 group-hover/logo:opacity-10 transition-opacity">🛡️</div>
                      )}
                      
                      {/* Overlay always visible but subtle */}
                      <div className="absolute inset-0 bg-black/40 opacity-40 group-hover/logo:opacity-70 flex flex-col items-center justify-center transition-all">
                        <svg className="w-5 h-5 text-white mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[7px] font-black text-white uppercase tracking-tighter opacity-0 group-hover/logo:opacity-100">Logo</span>
                      </div>

                      {uploadingId === team.id && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                          <div className="w-5 h-5 border-2 border-neon-purple border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-orbitron font-medium text-white">
                          {team.name}
                        </h3>
                        {team.streamUrl && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-500 font-bold uppercase tracking-wider animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-red-500"></span>
                            Stream
                          </div>
                        )}
                      </div>
                      {!isIndividual && (
                         <p className="text-xs text-white/40">
                           {roster.length} / {maxPerTeam} jugadores
                         </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Copy Portal Link - Always visible */}
                    <button
                      onClick={() => {
                        const baseUrl = window.location.origin
                        const url = `${baseUrl}/t/${tournamentSlug}/team/${team.id}`
                        navigator.clipboard.writeText(url)
                          .then(() => alert('✓ Link del portal copiado. Envíalo al capitán por WhatsApp o Discord.'))
                          .catch(() => {
                            // Fallback for non-HTTPS
                            const ta = document.createElement('textarea')
                            ta.value = url
                            document.body.appendChild(ta)
                            ta.select()
                            document.execCommand('copy')
                            document.body.removeChild(ta)
                            alert('✓ Link del portal copiado.')
                          })
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/30 text-neon-cyan rounded-lg transition-all text-xs font-medium"
                      title="Copiar Link para el Capitán"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copiar Portal
                    </button>
                    <button
                      onClick={() => handleRemoveTeam(team.id)}
                      className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Eliminar Equipo/Jugador"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {!isIndividual && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    {roster.length > 0 && (
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Roster & Estadísticas Individuales</span>
                          <div className="h-px flex-1 bg-white/5" />
                        </div>
                        {roster.map(p => (
                          <div key={p.id} className="group/item flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 hover:bg-white/[0.04] transition-all">
                            <div className="flex items-center gap-3">
                              <button 
                                type="button"
                                onClick={() => triggerUpload(p.id, 'participant')}
                                className="relative w-11 h-11 rounded-full bg-white/5 border border-white/10 overflow-hidden cursor-pointer hover:border-neon-cyan/50 hover:ring-2 hover:ring-neon-cyan/20 transition-all shrink-0 group/avatar"
                                title="Subir foto del jugador"
                              >
                                {p.avatarUrl ? (
                                  <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs grayscale opacity-30 group-hover/avatar:opacity-10 transition-opacity">👤</div>
                                )}
                                
                                {/* Overlay for photo */}
                                <div className="absolute inset-0 bg-black/40 opacity-40 group-hover/avatar:opacity-70 flex items-center justify-center transition-all">
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                  </svg>
                                </div>

                                {uploadingId === p.id && (
                                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                                    <div className="w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
                                  </div>
                                )}
                              </button>
                              <div className="min-w-0">
                                <span className="text-sm font-bold text-white/90 truncate block">
                                  {p.displayName} 
                                </span>
                                {p.isCaptain && <span className="text-[9px] font-black text-neon-cyan uppercase tracking-widest">Capitán de Equipo</span>}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              {/* Kill Display (Read Only) */}
                              <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-lg px-3 py-1.5">
                                <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">Bajas Totales</span>
                                <span className="text-sm font-black text-neon-purple leading-none">{p.totalKills}</span>
                              </div>

                              <div className="flex items-center gap-1.5 border-l border-white/5 pl-4">
                                {p.streamUrl && (
                                  <a href={p.streamUrl} target="_blank" rel="noreferrer" title="Ver stream" className="p-2 text-red-500/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>
                                  </a>
                                )}
                                <button
                                  onClick={async () => {
                                    if(confirm(`¿Eliminar a ${p.displayName} del equipo?`)) {
                                      const res = await deleteParticipant(tournamentId, p.id);
                                      if ('error' in res) toast.error(res.error)
                                      else {
                                        setParticipants(participants.filter(x => x.id !== p.id))
                                        toast.success('Jugador eliminado')
                                      }
                                    }
                                  }}
                                  className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                  title="Eliminar Jugador"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!isFull ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault()
                          const form = e.currentTarget
                          const nameInput = form.elements.namedItem('pName') as HTMLInputElement
                          const streamInput = form.elements.namedItem('pStream') as HTMLInputElement
                          const name = nameInput.value.trim()
                          const streamUrl = streamInput.value.trim()
                          if (!name) return

                          const isFirst = roster.length === 0
                          const pRes = await addParticipant(tournamentId, {
                            displayName: name,
                            teamId: team.id,
                            isCaptain: isFirst,
                            streamUrl: streamUrl || undefined,
                          })

                          if ('error' in pRes) {
                            alert(pRes.error)
                          } else {
                            setParticipants([...participants, pRes.data])
                            nameInput.value = ''
                            streamInput.value = ''
                          }
                        }}
                        className="flex flex-col sm:flex-row gap-2"
                      >
                        <input
                          type="text"
                          name="pName"
                          placeholder="Nombre del jugador..."
                          className="flex-[2] bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-sm outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan text-white placeholder:text-white/30"
                        />
                        <input
                          type="url"
                          name="pStream"
                          placeholder="Link Stream (Opcional)"
                          className="flex-[2] bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-sm outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan text-white placeholder:text-white/30"
                        />
                        <button type="submit" className="flex-[1] px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-sm transition-colors whitespace-nowrap">
                          Añadir
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-neon-cyan/80 mt-2">Equipo completo</p>
                    )}
                  </div>
                )}

                {/* Portal Link Banner - Always visible */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
                    <svg className="w-3.5 h-3.5 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 005.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <p className="text-[10px] text-white/30 font-mono truncate flex-1">
                      {typeof window !== 'undefined' ? `${window.location.origin}/t/${tournamentSlug}/team/${team.id}` : `/t/${tournamentSlug}/team/${team.id}`}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Hidden File Input for Avatars */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />
    </div>
  )
}
