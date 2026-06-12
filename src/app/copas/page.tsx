import { createClient } from '@/lib/supabase/server'
import { Orbitron } from 'next/font/google'
import { getProfile } from '@/lib/actions/auth-helpers'
import { getSanctionedCups } from '@/lib/actions/federation'
import { FederationCups } from '@/components/federation/FederationCups'
import { Navbar } from '@/components/navigation/Navbar'
import { HomeTracker } from '@/components/analytics/HomeTracker'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function CopasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await getProfile() : null

  // Fetch cups
  const cupsRes = await getSanctionedCups()
  const cups = cupsRes && 'data' in cupsRes ? cupsRes.data : []

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-neon-cyan/30 pb-20">
      <HomeTracker path="/copas" />
      <Navbar user={user} profile={profile} />

      <main className="max-w-7xl mx-auto px-6 sm:px-8 pt-32 space-y-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-neon-purple">Calendario Federado</span>
            <h1 className={`${orbitron.className} text-3xl sm:text-5xl font-black uppercase tracking-tighter text-white mt-2`}>
              Copas & Ligas Nacionales
            </h1>
            <p className="text-white/40 text-xs sm:text-sm max-w-xl mt-1.5 leading-relaxed">
              Circuitos competitivos oficiales avalados por la Federación Dominicana de Deportes Electrónicos.
            </p>
          </div>
          
          <div className="text-[9px] font-black uppercase tracking-widest bg-[#121219] border border-white/5 px-4 py-3 rounded-xl text-white/50 shrink-0">
            Clasificaciones oficiales a mundiales de la <span className="text-gold">IESF 🏆</span>
          </div>
        </div>

        <div className="bg-[#0d0d0f] border border-white/5 rounded-3xl p-12 text-center max-w-2xl mx-auto space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center mx-auto animate-pulse">
            <span className="text-2xl">🏆</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-white font-orbitron font-black text-lg sm:text-xl uppercase tracking-wider">Próxima Actualización</h2>
            <p className="text-white/40 text-xs sm:text-sm leading-relaxed">
              El calendario de Copas y Ligas Nacionales Federadas oficiales está siendo coordinado por la Federación Dominicana de Deportes Electrónicos (FDDE). Pronto se habilitarán las inscripciones aquí.
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
