import { getHallOfFame } from '@/lib/actions/tournaments'
import { HallOfFameCard } from '@/components/leaderboard/HallOfFameCard'
import Link from 'next/link'

export default async function HallOfFamePage() {
  const result = await getHallOfFame()
  const tournaments = 'data' in result ? result.data : []

  return (
    <div className="min-h-screen bg-dark-bg text-white font-sans selection:bg-gold selection:text-black pb-24">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-purple/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16 sm:py-24">
        {/* Header */}
        <header className="mb-20 text-center">
          <nav className="flex justify-center mb-8">
             <Link 
               href="/" 
               className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-gold transition-colors"
             >
               Volver al Inicio
             </Link>
          </nav>
          
          <h1 className="font-orbitron font-black text-4xl sm:text-6xl md:text-7xl text-white uppercase tracking-tighter leading-none mb-6">
             Hall of <span className="text-gold shadow-gold/20 shadow-lg">Fame</span>
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-lg text-white/40 leading-relaxed font-medium uppercase tracking-tight">
             Celebrando la grandeza de los mejores equipos y jugadores que han dejado su huella en la historia de la arena.
          </p>
          <div className="w-24 h-1 bg-gold mx-auto mt-10 rounded-full shadow-[0_0_10px_rgba(255,215,0,0.5)]" />
        </header>

        {/* Gallery */}
        {tournaments.length === 0 ? (
          <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.02]">
             <div className="text-6xl mb-6 opacity-20">🏅</div>
             <p className="font-orbitron font-black text-xl text-white/20 uppercase tracking-widest">
                La historia aún se está escribiendo
             </p>
             <p className="text-xs text-white/10 mt-2">
                Los torneos finalizados aparecerán aquí para la eternidad.
             </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tournaments.map((t) => (
              <HallOfFameCard key={t.id} tournament={t} />
            ))}
          </div>
        )}

        {/* Footer info */}
        <footer className="mt-32 pt-16 border-t border-white/5 text-center">
           <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mb-4">
              © 2026 XVI COUP · Arena de Campeones
           </p>
           <div className="flex justify-center gap-6">
              <div className="w-1.5 h-1.5 rounded-full bg-gold" />
              <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan" />
              <div className="w-1.5 h-1.5 rounded-full bg-neon-purple" />
           </div>
        </footer>
      </div>
    </div>
  )
}
