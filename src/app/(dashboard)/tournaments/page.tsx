import Link from 'next/link'
import { getTournaments } from '@/lib/actions/tournaments'
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

function TournamentCard({ tournament }: { tournament: Tournament }) {
  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="group block bg-dark-card border border-white/5 rounded-2xl p-5
        hover:border-neon-purple/30 hover:bg-white/[0.03]
        transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-white text-sm leading-snug group-hover:text-neon-cyan
          transition-colors duration-150 line-clamp-2">
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
          <span>{new Date(tournament.startDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        )}
      </div>
    </Link>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="col-span-full bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-neon-purple/10 border border-neon-purple/20
        flex items-center justify-center mx-auto mb-5">
        <svg className="w-7 h-7 text-neon-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      </div>
      <p className="text-white/60 text-sm font-medium mb-1">Sin torneos todavía</p>
      <p className="text-white/25 text-xs mb-6">Crea tu primer torneo y empieza a competir</p>
      <Link
        href="/tournaments/new"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
          bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 active:scale-[0.97]
          transition-all duration-150"
      >
        + Crear torneo
      </Link>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TournamentsPage() {
  const result = await getTournaments()
  const tournaments = 'data' in result ? result.data : []

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="font-orbitron text-xl sm:text-2xl font-bold text-white tracking-wide">
            Mis Torneos
          </h1>
          <p className="text-white/30 text-xs sm:text-sm mt-1">
            {tournaments.length > 0
              ? `${tournaments.length} torneo${tournaments.length !== 1 ? 's' : ''}`
              : 'Gestiona tus competencias'}
          </p>
        </div>
        <Link
          href="/tournaments/new"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white
            bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 active:scale-[0.97]
            transition-all duration-150 shadow-lg shadow-neon-cyan/10"
        >
          + <span className="hidden sm:inline">Nuevo </span>Torneo
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.length === 0 ? (
          <EmptyState />
        ) : (
          tournaments.map((t) => <TournamentCard key={t.id} tournament={t} />)
        )}
      </div>
    </div>
  )
}
