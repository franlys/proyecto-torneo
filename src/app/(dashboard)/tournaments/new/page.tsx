import { TournamentForm } from '@/components/dashboard/TournamentForm'
import Link from 'next/link'

export default function NewTournamentPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60
            transition-colors duration-150 mb-4"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Mis Torneos
        </Link>
        <h1 className="font-orbitron text-2xl font-bold text-white tracking-wide">
          Nuevo Torneo
        </h1>
        <p className="text-white/30 text-sm mt-1">Configura tu competencia desde cero</p>
      </div>

      {/* Form */}
      <div className="bg-dark-card border border-white/5 rounded-2xl p-8">
        <TournamentForm />
      </div>
    </div>
  )
}
