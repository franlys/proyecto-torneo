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

        <div className="bg-[#0d0d0f] border border-white/5 rounded-3xl p-6 sm:p-8">
          <RankingList initialPlayers={players} />
        </div>
      </main>
    </div>
  )
}
