'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deleteTournament } from '@/lib/actions/tournaments'
import type { Tournament } from '@/types'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Tournament['status'] }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
        <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
        Activo
      </span>
    )
  }
  if (status === 'finished') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        bg-gold/10 text-gold border border-gold/20">
        Finalizado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
      bg-white/5 text-white/40 border border-white/10">
      Borrador
    </span>
  )
}

// ─── Format badge ─────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<Tournament['format'], { label: string; color: string }> = {
  battle_royale_clasico: { label: 'Battle Royale', color: 'text-neon-purple bg-neon-purple/10 border-neon-purple/20' },
  kill_race: { label: 'Kill Race', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
  custom_rooms: { label: 'Custom Rooms', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  eliminacion_directa: { label: 'Eliminación Directa', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  fase_de_grupos: { label: 'Fase de Grupos', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
}

function FormatBadge({ format }: { format: Tournament['format'] }) {
  const { label, color } = FORMAT_LABELS[format]
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      {label}
    </span>
  )
}

// ─── Tournament card ──────────────────────────────────────────────────────────

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault() // prevent Link navigation
    e.stopPropagation()

    const confirmed = window.confirm(
      `¿Eliminar "${tournament.name}"?\n\nEsta acción es permanente y borrará todos los equipos, partidas y estadísticas del torneo.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const result = await deleteTournament(tournament.id)
      if ('error' in result) {
        alert(`Error: ${result.error}`)
        setDeleting(false)
        return
      }
      router.refresh()
    } catch {
      alert('Error inesperado al eliminar el torneo.')
      setDeleting(false)
    }
  }

  return (
    <div className={`relative group bg-dark-card border border-white/5 rounded-2xl
      hover:border-neon-purple/30 hover:bg-white/[0.03]
      transition-all duration-150 ${deleting ? 'opacity-50 pointer-events-none' : ''}`}>

      {/* Clickable area — goes to tournament detail */}
      <Link
        href={`/tournaments/${tournament.id}`}
        className="block p-5"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold text-white text-sm leading-snug group-hover:text-neon-cyan
            transition-colors duration-150 line-clamp-2 pr-8">
            {tournament.name}
          </h3>
          <StatusBadge status={tournament.status} />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <FormatBadge format={tournament.format} />
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
            bg-white/5 text-white/40 border border-white/10 capitalize">
            {tournament.level}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-white/30">
          <span>{tournament.totalMatches} partidas</span>
          {tournament.startDate && (
            <span>
              {new Date(tournament.startDate).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
          )}
        </div>
      </Link>

      {/* Delete button — appears on hover, positioned top-right over the card */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        title="Eliminar torneo"
        className="absolute top-3 right-3 p-1.5 rounded-lg
          text-white/0 group-hover:text-white/30
          hover:!text-red-400 hover:bg-red-400/10
          transition-all duration-150
          disabled:cursor-not-allowed"
        aria-label="Eliminar torneo"
      >
        {deleting ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </button>
    </div>
  )
}
