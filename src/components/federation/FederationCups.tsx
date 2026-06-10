import type { SanctionedCup, GameDiscipline } from '@/lib/actions/federation'
import { Orbitron } from 'next/font/google'
import Link from 'next/link'

const orbitron = Orbitron({ subsets: ['latin'] })

interface FederationCupsProps {
  cups: SanctionedCup[]
}

const gameBadges: Record<GameDiscipline, string> = {
  clash_royale: '👑 Clash Royale',
  street_fighter_6: '🥊 Street Fighter 6',
  super_smash_bros_ultimate: '💥 Smash Bros',
  free_fire: '🔥 Free Fire',
  fortnite: '⛏️ Fortnite',
  call_of_duty_mobile: '🔫 CoD Mobile'
}

export function FederationCups({ cups }: FederationCupsProps) {
  const activeCups = cups.filter(c => c.status === 'active')
  const upcomingCups = cups.filter(c => c.status === 'upcoming')
  const finishedCups = cups.filter(c => c.status === 'finished')

  return (
    <div className="space-y-12">
      {/* ── Copas Activas / En Curso ── */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h3 className={`${orbitron.className} text-lg font-black uppercase tracking-widest text-white`}>
            Copas en Curso
          </h3>
        </div>

        {activeCups.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white/[0.01] border border-white/5 text-center text-white/30 text-xs">
            No hay copas oficiales en curso en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeCups.map((cup) => (
              <CupCard key={cup.id} cup={cup} />
            ))}
          </div>
        )}
      </div>

      {/* ── Próximas Copas ── */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-neon-cyan" />
          <h3 className={`${orbitron.className} text-lg font-black uppercase tracking-widest text-white`}>
            Próximos Torneos Oficiales
          </h3>
        </div>

        {upcomingCups.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white/[0.01] border border-white/5 text-center text-white/30 text-xs">
            Próximas fechas publicitándose pronto.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingCups.map((cup) => (
              <CupCard key={cup.id} cup={cup} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CupCard({ cup }: { cup: SanctionedCup }) {
  const statusColors = {
    upcoming: 'bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan',
    active: 'bg-red-500/10 border-red-500/20 text-red-500',
    finished: 'bg-white/10 border-white/10 text-white/40'
  }

  const statusLabels = {
    upcoming: 'Inscripciones abiertas',
    active: 'En vivo',
    finished: 'Finalizado'
  }

  return (
    <div className="group rounded-3xl border border-white/5 bg-[#121219]/60 hover:border-white/10 hover:bg-[#151522] transition-all p-6 flex flex-col justify-between h-64 relative overflow-hidden">
      {/* Background Graphic */}
      <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/5 to-transparent pointer-events-none" />

      <div>
        {/* Category & Status */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
            {gameBadges[cup.discipline]}
          </span>
          <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${statusColors[cup.status]}`}>
            {statusLabels[cup.status]}
          </span>
        </div>

        {/* Title */}
        <h4 className={`${orbitron.className} text-lg font-black uppercase tracking-tight text-white group-hover:text-neon-cyan transition-colors line-clamp-2`}>
          {cup.name}
        </h4>
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mt-1">
          Nivel: {cup.level} · {cup.organizer}
        </p>
      </div>

      {/* Info & Action */}
      <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-4">
        <div>
          <span className="text-[9px] text-white/30 uppercase font-black block">Bolsa de Premios</span>
          <span className="text-sm font-black text-gold">{cup.prizePool || 'Medallas & Puntos'}</span>
        </div>

        {cup.registrationUrl ? (
          <Link
            href={cup.registrationUrl}
            target="_blank"
            className="px-4 py-2.5 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-neon-cyan hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Registrarse
          </Link>
        ) : cup.tournamentId ? (
          <Link
            href={`/t/${cup.tournamentId}`}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 text-xs font-black uppercase tracking-widest transition-all"
          >
            Ver Fixture
          </Link>
        ) : (
          <span className="text-[9px] text-white/20 uppercase font-black">Pronto</span>
        )}
      </div>
    </div>
  )
}
