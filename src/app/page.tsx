import { createClient } from '@/lib/supabase/server'
import { Orbitron } from 'next/font/google'
import Link from 'next/link'
import { getProfile } from '@/lib/actions/auth-helpers'
import { MembershipSection } from './MembershipSection'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await getProfile() : null

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-neon-cyan/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/5 z-50 px-8 flex items-center justify-between">
        <div className={`${orbitron.className} text-2xl font-black tracking-tighter uppercase`}>
           ARENA<span className="text-neon-cyan">LABS</span>
        </div>
        
        <div className="flex items-center gap-6">
          <Link href="/hall-of-fame" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all">Hall of Fame</Link>
          {user ? (
            <Link href="/tournaments" className="bg-white text-black px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest hover:bg-neon-cyan transition-all">Dashboard</Link>
          ) : (
            <Link href="/login" className="bg-white text-black px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest hover:bg-neon-cyan transition-all">Acceso Streamer</Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 px-8 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-neon-cyan/10 blur-[120px] rounded-full -z-10" />
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-neon-purple/10 blur-[100px] rounded-full -z-10" />
        
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8">
             <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-widest text-white/60">The Pro Gaming Ecosystem</span>
          </div>
          
          <h1 className={`${orbitron.className} text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9] mb-8`}>
            Gestiona. Compite.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple">Monetiza.</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-white/40 text-lg md:text-xl mb-12">
            La plataforma definitiva para streamers que buscan llevar sus torneos de Warzone y shooters al siguiente nivel con gestión profesional y apuestas integradas.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
             <Link href="/login" className="px-8 py-4 bg-white text-black text-sm font-black uppercase tracking-widest rounded-xl hover:bg-neon-cyan hover:scale-105 transition-all">
                Empezar como Streamer
             </Link>
             <a href="https://arenacrypto.app" target="_blank" className="px-8 py-4 bg-white/5 border border-white/10 text-white text-sm font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all">
                Ver ArenaCrypto Betting
             </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-8 bg-[#0d0d0f]">
         <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5">
               <div className="w-12 h-12 bg-neon-cyan/20 text-neon-cyan rounded-2xl flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               </div>
               <h3 className={`${orbitron.className} text-xl font-bold mb-4`}>Gestión Professional</h3>
               <p className="text-white/40 text-sm leading-relaxed">Puntuaciones en tiempo real, validación de evidencias por IA y leaderboards dinámicos personalizables.</p>
            </div>

            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5">
                <div className="w-12 h-12 bg-neon-purple/20 text-neon-purple rounded-2xl flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </div>
               <h3 className={`${orbitron.className} text-xl font-bold mb-4`}>Bridge de Apuestas</h3>
               <p className="text-white/40 text-sm leading-relaxed">Conexión exclusiva con ArenaCrypto. Permite que tu comunidad apueste por ti o por los mejores de tu torneo.</p>
            </div>

            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5">
               <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-2xl flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
               </div>
               <h3 className={`${orbitron.className} text-xl font-bold mb-4`}>Monetización Segura</h3>
               <p className="text-white/40 text-sm leading-relaxed">Controla las inscripciones y premios desde tu panel administrativo. Transparencia total para tus participantes.</p>
            </div>
         </div>
      </section>

      {/* Membership / CTA Section */}
      <MembershipSection user={user} profile={profile} />

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-white/5 text-center">
         <div className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">
            © 2026 ARENA LABS x ARENACRYPTO
         </div>
      </footer>
    </div>
  )
}
