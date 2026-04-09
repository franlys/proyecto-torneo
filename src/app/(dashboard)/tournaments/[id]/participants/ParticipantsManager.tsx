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
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set())
  
  const toggleTeamCollapse = (teamId: string) => {
    const newCollapsed = new Set(collapsedTeams)
    if (newCollapsed.has(teamId)) {
      newCollapsed.delete(teamId)
    } else {
      newCollapsed.add(teamId)
    }
    setCollapsedTeams(newCollapsed)
  }
  
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

  const handleRemoveParticipant = async (participantId: string) => {
    if (!confirm('¿Eliminar a este jugador del equipo?')) return
    const res = await deleteParticipant(tournamentId, participantId)
    if ('error' in res) toast.error(res.error)
    else {
      setParticipants(participants.filter(x => x.id !== participantId))
      toast.success('Jugador eliminado')
    }
  }

  const handleAddParticipant = async (teamId: string, name: string) => {
    const pRes = await addParticipant(tournamentId, {
      displayName: name,
      teamId: teamId,
      isCaptain: false,
    })
    if ('error' in pRes) toast.error(pRes.error)
    else {
      setParticipants([...participants, pRes.data])
      toast.success('Jugador añadido')
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
        <div className="grid gap-4">
          {teams.map((team) => {
            const roster = getTeamRoster(team.id)
            const isCollapsed = collapsedTeams.has(team.id)
            
            return (
              <div key={team.id} className="bg-dark-card border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                <div className={`p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${!isCollapsed ? 'border-b border-white/5' : ''}`}>
                  <div className="flex items-center gap-4 group">
                    <button 
                      onClick={() => toggleTeamCollapse(team.id)}
                      className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    >
                      <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div 
                      className="relative cursor-pointer"
                      onClick={() => triggerUpload(team.id, 'team')}
                    >
                      {team.avatarUrl ? (
                        <img src={team.avatarUrl} alt="" className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-white/10" />
                      ) : (
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          </svg>
                        </div>
                      )}
                      {uploadingId === team.id && (
                        <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-orbitron font-black text-white text-lg sm:text-xl tracking-tight leading-none">{team.name}</h3>
                        {team.streamUrl && (
                          <span className="text-[8px] bg-red-500/20 text-red-500 font-bold px-1.5 py-0.5 rounded border border-red-500/30 uppercase">LIVE</span>
                        )}
                      </div>
                      <p className="text-white/40 text-xs mt-1 font-medium">{roster.length} / {maxPerTeam} jugadores</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/t/${tournamentSlug}/team/${team.id}`
                        navigator.clipboard.writeText(url)
                        toast.success('¡Enlace del portal copiado!')
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-neon-cyan/10 
                        hover:bg-neon-cyan/20 text-neon-cyan rounded-xl text-xs font-bold border border-neon-cyan/20 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copiar Portal
                    </button>
                    <button
                      onClick={() => handleRemoveTeam(team.id)}
                      className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-4 sm:p-6 bg-white/[0.01]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      {roster.map((p) => (
                        <div key={p.id} className="relative group bg-white/5 border border-white/5 p-4 rounded-2xl hover:border-neon-purple/50 transition-all">
                          <div className="flex items-center gap-3">
                            <div 
                              className="relative cursor-pointer"
                              onClick={() => triggerUpload(p.id, 'participant')}
                            >
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              )}
                              {uploadingId === p.id && (
                                <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                                  <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-bold text-sm truncate">{p.displayName}</h4>
                              {p.isCaptain ? (
                                <span className="text-[8px] font-black text-neon-cyan uppercase tracking-widest block">Capitán de Equipo</span>
                              ) : (
                                <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest block">Jugador</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="mt-3 flex items-center justify-between gap-1 pt-3 border-t border-white/5">
                            <div className="flex items-center gap-2">
                                <div className="px-2 py-0.5 bg-black/40 rounded text-[9px] text-white/40 font-bold uppercase tracking-tighter">
                                  Bajas Totales <b className="text-neon-purple ml-1">{p.totalKills || 0}</b>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {p.streamUrl && (
                                  <a href={p.streamUrl} target="_blank" rel="noreferrer" className="text-red-500/50 hover:text-red-500 transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                                    </svg>
                                  </a>
                                )}
                                <button 
                                  onClick={() => handleRemoveParticipant(p.id)}
                                  className="text-white/20 hover:text-red-500 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
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
