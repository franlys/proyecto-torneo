import { createClient } from '@/lib/supabase/server'
import { Orbitron } from 'next/font/google'
import { getProfile } from '@/lib/actions/auth-helpers'
import { getNationalRankings } from '@/lib/actions/federation'
import { RankingList } from '@/components/federation/RankingList'
import { Navbar } from '@/components/navigation/Navbar'
import { HomeTracker } from '@/components/analytics/HomeTracker'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function RankingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await getProfile() : null

  // Fetch rankings
  const rankingsRes = await getNationalRankings()
  const players = rankingsRes && 'data' in rankingsRes ? rankingsRes.data : []

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-neon-cyan/30 pb-20">
      <HomeTracker path="/rankings" />
      <Navbar user={user} profile={profile} />

      <main className="max-w-7xl mx-auto px-6 sm:px-8 pt-32 space-y-12">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-neon-cyan">Base de datos de Alto Rendimiento</span>
          <h1 className={`${orbitron.className} text-3xl sm:text-5xl font-black uppercase tracking-tighter text-white mt-2`}>
            Rankings Oficiales RD
          </h1>
          <p className="text-white/40 text-xs sm:text-sm max-w-xl mt-1.5 leading-relaxed">
            Buscador y clasificaciones oficiales de la Federación Dominicana de Deportes Electrónicos.
          </p>
        </div>

        <div className="bg-[#0d0d0f] border border-white/5 rounded-3xl p-12 text-center max-w-2xl mx-auto space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center mx-auto animate-pulse">
            <span className="text-2xl">⚡</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-white font-orbitron font-black text-lg sm:text-xl uppercase tracking-wider">Próxima Actualización</h2>
            <p className="text-white/40 text-xs sm:text-sm leading-relaxed">
              El módulo de Rankings Nacionales de la Federación Dominicana de Deportes Electrónicos (FDDE) está en desarrollo. Muy pronto podrás consultar aquí las posiciones oficiales de los mejores competidores de República Dominicana.
            </p>
          </div>
          <div className="pt-4 border-t border-white/5">
             <span className="text-[9px] font-orbitron uppercase tracking-widest text-white/30">GonzalezLabs Platform</span>
          </div>
        </div>
      </main>
    </div>
  )
}
