'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Tournament, Team, Participant } from '@/types'
import { getTeamsWithParticipants } from '@/lib/actions/participants'
import { ParticipantsManager } from '../[id]/participants/ParticipantsManager'
import { toast } from 'sonner'

export function ApprovalsClient({
  initialTournaments,
}: {
  initialTournaments: Tournament[]
}) {
  const [tournaments] = useState<Tournament[]>(initialTournaments)
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    initialTournaments.length > 0 ? initialTournaments[0].id : ''
  )
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(
    initialTournaments.length > 0 ? initialTournaments[0] : null
  )
  const [teams, setTeams] = useState<Team[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(false)

  // Cargar participantes cuando cambia el torneo seleccionado
  useEffect(() => {
    if (!selectedTournamentId) return

    const loadData = async () => {
      setLoading(true)
      try {
        const res = await getTeamsWithParticipants(selectedTournamentId)
        if ('error' in res) {
          toast.error(`Error al cargar datos: ${res.error}`)
          setTeams([])
          setParticipants([])
        } else {
          setTeams(res.teams || [])
          setParticipants(res.participants || [])
        }
      } catch (err) {
        toast.error('Error inesperado al cargar la lista de participantes.')
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const tourney = tournaments.find((t) => t.id === selectedTournamentId)
    setSelectedTournament(tourney || null)
  }, [selectedTournamentId, tournaments])

  if (tournaments.length === 0) {
    return (
      <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-white/60 text-sm font-medium mb-1">No hay torneos activos para administrar</p>
        <p className="text-white/25 text-xs">Crea o publica un torneo primero para gestionar sus solicitudes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Selector de Torneos */}
      <div className="bg-[#121219]/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <label className="block text-[10px] font-black uppercase tracking-widest text-white/45">
            Selecciona un Torneo
          </label>
          <div className="relative">
            <select
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className="w-full sm:w-64 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-neon-purple/50 text-white font-medium cursor-pointer transition-all"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#121219] text-white">
                  🏆 {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedTournament && (
          <div className="flex flex-wrap gap-2 text-xs text-white/40 self-end sm:self-auto">
            <span className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
              Formato: <span className="text-white/70 font-semibold uppercase">{selectedTournament.format.replace(/_/g, ' ')}</span>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 capitalize">
              Modo: <span className="text-white/70 font-semibold">{selectedTournament.mode}</span>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 capitalize">
              Estado: <span className="text-white/70 font-semibold">{selectedTournament.status === 'pending' ? 'Inscripciones Abiertas' : selectedTournament.status}</span>
            </span>
          </div>
        )}
      </div>

      {/* Cargando */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center py-20 space-y-4"
          >
            <div className="w-10 h-10 border-2 border-t-neon-purple border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
            <p className="text-xs text-white/30 font-bold uppercase tracking-widest animate-pulse">
              Cargando inscripciones...
            </p>
          </motion.div>
        ) : (
          selectedTournament && (
            <motion.div
              key={selectedTournament.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#121219]/20 border border-white/5 rounded-2xl p-4 sm:p-6"
            >
              <ParticipantsManager
                tournamentId={selectedTournament.id}
                tournamentSlug={selectedTournament.slug}
                tournamentMode={selectedTournament.mode}
                tournamentDiscipline={selectedTournament.discipline}
                tournamentStatus={selectedTournament.status}
                initialTeams={teams}
                initialParticipants={participants}
              />
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  )
}
