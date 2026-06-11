import { createClient } from '@/lib/supabase/server'
import { Orbitron } from 'next/font/google'
import Link from 'next/link'
import { getProfile } from '@/lib/actions/auth-helpers'
import { MembershipSection } from './MembershipSection'
import { getAdBanners } from '@/lib/actions/federation'
import { AdPlacement } from '@/components/federation/AdPlacement'
import { Navbar } from '@/components/navigation/Navbar'
import { HomeTracker } from '@/components/analytics/HomeTracker'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await getProfile() : null

  // Fetch ads
  const adsRes = await getAdBanners()
  const ads = adsRes && 'data' in adsRes ? adsRes.data : []

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-neon-cyan/30">
      <HomeTracker path="/" />
      
      {/* Dynamic Hamburger Navigation */}
      <Navbar user={user} profile={profile} />

      {/* Hero Section */}
      <section className="relative pt-44 pb-16 px-6 sm:px-8 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-neon-cyan/5 blur-[120px] rounded-full -z-10 animate-pulse" />
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-neon-purple/5 blur-[100px] rounded-full -z-10" />
        
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8">
             <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
             <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Tecnología de Clasificación Oficial FDDE</span>
          </div>
          
          <h1 className={`${orbitron.className} text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.95] mb-8`}>
            EL PORTAL DE LOS<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple">E-SPORTS DOMINICANOS</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-white/40 text-base md:text-lg mb-10 leading-relaxed">
            La herramienta definitiva de clasificación nacional. Consulta estadísticas de atletas, descubre torneos avalados por la Federación y visualiza los rankings de la República Dominicana.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
             <Link href="/rankings" className="w-full sm:w-auto px-8 py-4 bg-neon-cyan text-black text-xs font-black uppercase tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(0,245,255,0.4)] hover:scale-[1.02] transition-all">
                Consultar Rankings Nacionales
             </Link>
             <Link href="/copas" className="w-full sm:w-auto px-8 py-4 bg-[#121219] border border-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/5 transition-all">
                Ver Copas Oficiales
             </Link>
          </div>
        </div>
      </section>

      {/* Publicidad Destacada (Sponsorship Slot) */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 mb-20">
        <AdPlacement banners={ads} slotName="home_hero_banner" />
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 sm:px-8 bg-[#0d0d0f] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className={`${orbitron.className} text-2xl font-black uppercase tracking-tight text-white`}>
              Infraestructura para la Federación
            </h3>
            <p className="text-white/40 text-xs uppercase tracking-wider mt-2">Tecnología de punta para la máxima transparencia competitiva.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                <div className="w-12 h-12 bg-neon-cyan/20 text-neon-cyan rounded-2xl flex items-center justify-center mb-6">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" /></svg>
                </div>
                <h3 className={`${orbitron.className} text-lg font-bold mb-3`}>Estadísticas Reales (Big Data)</h3>
                <p className="text-white/40 text-xs leading-relaxed">Registro preciso de kills, win rate y clasificaciones para que la FDDE tome decisiones de selección nacional con data en mano.</p>
             </div>

             <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 bg-neon-purple/20 text-neon-purple rounded-2xl flex items-center justify-center mb-6">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                 </div>
                 <h3 className={`${orbitron.className} text-lg font-bold mb-3`}>Verificación por IA</h3>
                 <p className="text-white/40 text-xs leading-relaxed">Evidencias visuales de partidas auditadas con visión por computadora para erradicar el fraude y garantizar el fair-play.</p>
             </div>

             <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-2xl flex items-center justify-center mb-6">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <h3 className={`${orbitron.className} text-lg font-bold mb-3`}>Monetización B2B</h3>
                <p className="text-white/40 text-xs leading-relaxed">Espacios publicitarios integrados nativamente para dar un retorno directo e inmediato a los patrocinadores del circuito nacional.</p>
             </div>
          </div>
        </div>
      </section>

      {/* Membership / CTA Section */}
      <div id="membresias">
        <MembershipSection user={user} profile={profile} />
      </div>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-white/5 text-center flex flex-col items-center gap-2">
         <div className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">
            © 2026 KRONIX · FDDE NATIONAL PLATFORM
         </div>
         <div className="flex items-center gap-1.5 opacity-30">
            <span className="text-[9px] font-orbitron uppercase tracking-widest text-white/60">Powered by</span>
            <span className="text-[10px] font-orbitron font-black uppercase tracking-widest text-neon-cyan">GonzalezLabs</span>
         </div>
      </footer>
    </div>
  )
}
