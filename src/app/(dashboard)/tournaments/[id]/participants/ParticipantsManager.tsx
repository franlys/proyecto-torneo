'use client'

import { useState } from 'react'
import type { Team, Participant, TournamentMode } from '@/types'
import { createTeam, addParticipant, deleteTeam, deleteParticipant } from '@/lib/actions/participants'

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
    
    // Optimistic UI could be done here
    const res = await deleteTeam(tournamentId, teamId)
    if ('error' in res) {
      alert(res.error)
    } else {
      setTeams(teams.filter(t => t.id !== teamId))
      setParticipants(participants.filter(p => p.teamId !== teamId))
    }
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
                  <div className="flex-1">
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
                      <ul className="space-y-2 mb-4">
                        {roster.map(p => (
                          <li key={p.id} className="flex justify-between items-center text-sm px-3 py-2 bg-white/[0.02] rounded-lg">
                            <div className="flex items-center gap-2 text-white/80">
                              {p.displayName} 
                              {p.isCaptain && <span className="text-neon-cyan text-xs ml-1">(Capitán)</span>}
                              {p.streamUrl && (
                                <a href={p.streamUrl} target="_blank" rel="noreferrer" title="Ver stream" className="inline-flex items-center ml-1 text-red-500 hover:text-red-400">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" className="animate-pulse"/></svg>
                                </a>
                              )}
                            </div>
                            <button
                              onClick={async () => {
                                if(confirm('¿Eliminar jugador?')) {
                                  await deleteParticipant(tournamentId, p.id);
                                  setParticipants(participants.filter(x => x.id !== p.id))
                                }
                              }}
                              className="text-white/30 hover:text-red-400"
                            >×</button>
                          </li>
                        ))}
                      </ul>
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
    </div>
  )
}
