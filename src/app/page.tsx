import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Orbitron } from 'next/font/google'
import Link from 'next/link'
import { getProfile } from '@/lib/actions/auth-helpers'
import { MembershipSection } from './MembershipSection'
import { getAdBanners } from '@/lib/actions/federation'
import { AdPlacement } from '@/components/federation/AdPlacement'
import { Navbar } from '@/components/navigation/Navbar'
import { HomeTracker } from '@/components/analytics/HomeTracker'
import { getLandingSettings } from '@/lib/actions/landing-settings'
import { getOptimizedImageUrl } from '@/lib/utils'
import { WelcomeVideoModal } from '@/components/ui/WelcomeVideoModal'
import { TournamentCard } from '@/components/ui/TournamentCard'

const orbitron = Orbitron({ subsets: ['latin'] })

const DISCIPLINE_LABELS: Record<string, string> = {
  warzone: 'CoD: Warzone 🪂',
  clash_royale: 'Clash Royale 👑',
  fortnite: 'Fortnite ⛏️',
  free_fire: 'Free Fire 🔥',
  call_of_duty_mobile: 'CoD Mobile 🔫',
  street_fighter_6: 'Street Fighter 6 👊',
  super_smash_bros_ultimate: 'Super Smash Bros Ultimate 💥',
  league_of_legends: 'League of Legends 🏆',
  valorant: 'Valorant 🎯',
}

export default async function Home() {
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await getProfile() : null

  // Fetch ads, landing settings, real active tournament statistics, and recent public tournaments safely
  let ads: any[] = []
  let settings: any = {
    hero_title: 'EL PORTAL DE LOS E-SPORTS DOMINICANOS',
    hero_subtitle: 'La herramienta definitiva de clasificación nacional.',
    statistics_ticker_text: '',
    primary_color: '#00F5FF',
    secondary_color: '#BD00FF',
    ambient_video_url: ''
  }
  let activeTournaments: any[] = []
  let recentPublicTournaments: any[] = []

  try {
    const [adsRes, settingsRes, activeTournamentsRes, recentPublicTournamentsRes] = await Promise.all([
      getAdBanners().catch(err => ({ error: err.message })),
      getLandingSettings().catch(err => null),
      adminSupabase.from('tournaments').select('total_live_viewers, status, is_private').neq('status', 'draft'),
      adminSupabase.from('tournaments')
        .select('*, teams(id), creator:profiles!creator_id(username, organization_name, role), collaborator:profiles!collaborator_id(username, organization_name)')
        .neq('status', 'draft')
        .neq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(3)
    ])

    if (adsRes && 'data' in adsRes && Array.isArray(adsRes.data)) {
      ads = adsRes.data
    }
    if (settingsRes) {
      settings = settingsRes
    }
    if (activeTournamentsRes && activeTournamentsRes.data) {
      activeTournaments = activeTournamentsRes.data
    }
    if (recentPublicTournamentsRes && recentPublicTournamentsRes.data) {
      recentPublicTournaments = recentPublicTournamentsRes.data
    }
  } catch (err) {
    console.error('Error loading landing page data:', err)
  }
  
  const publicActiveTournaments = activeTournaments?.filter((t: any) => !t.is_private) || []
  const activeCount = publicActiveTournaments.filter((t: any) => t.status === 'active' || t.status === 'pending').length || 0
  const totalViewers = publicActiveTournaments.reduce((acc: number, curr: any) => acc + (curr.total_live_viewers || 0), 0) || 0
  const dynamicLiveTickerText = activeCount > 0
    ? `● ${activeCount} Torneo${activeCount === 1 ? '' : 's'} Activo${activeCount === 1 ? '' : 's'} ahora · 👥 ${totalViewers.toLocaleString('es-ES')} Espectadores`
    : `● No hay torneos activos en este momento · 👥 ${totalViewers.toLocaleString('es-ES')} Espectadores`


  const primaryColor = settings.primary_color || '#00F5FF'
  const secondaryColor = settings.secondary_color || '#BD00FF'

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-neon-cyan/30 relative overflow-x-hidden">
      <HomeTracker path="/" />
      <WelcomeVideoModal />
      
      {/* Ambient Video or Image Background if enabled */}
      {settings.ambient_video_url && (
        (() => {
          const isVideo = settings.ambient_video_url.toLowerCase().match(/\.(mp4|webm|ogg)$/) || settings.ambient_video_url.includes('/video/');
          return isVideo ? (
            <video 
              src={settings.ambient_video_url} 
              autoPlay loop muted playsInline 
              className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none -z-20"
            />
          ) : (
            <img 
              src={settings.ambient_video_url} 
              alt="Fondo ambiental"
              className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none -z-20"
            />
          );
        })()
      )}
      
      {/* Dynamic Hamburger Navigation */}
      <Navbar user={user} profile={profile} />

      {/* Hero Section */}
      <section className="relative pt-44 pb-12 px-6 sm:px-8 overflow-hidden">
        {/* Background Gradients */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] blur-[120px] rounded-full -z-10 opacity-30 animate-pulse" 
          style={{ backgroundColor: `${primaryColor}20` }}
        />
        <div 
          className="absolute -top-40 -left-40 w-[600px] h-[600px] blur-[100px] rounded-full -z-10 opacity-20" 
          style={{ backgroundColor: `${secondaryColor}10` }}
        />

        {/* HUD Tactical Corner Decorations */}
        <div className="absolute top-24 left-8 w-6 h-6 border-t-2 border-l-2 border-white/5 pointer-events-none" />
        <div className="absolute top-24 right-8 w-6 h-6 border-t-2 border-r-2 border-white/5 pointer-events-none" />
        <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-white/5 pointer-events-none" />
        <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-white/5 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto text-center">
          {dynamicLiveTickerText && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 select-none">
               <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-red-500" />
               <span className="text-[9px] font-black uppercase tracking-widest text-white/70">
                 {dynamicLiveTickerText}
               </span>
            </div>
          )}
          
           {(() => {
             const title = settings?.hero_title || 'EL PORTAL DE LOS E-SPORTS DOMINICANOS';
             const words = title.split(' ');
             const mainPart = words.slice(0, -2).join(' ');
             const gradientPart = words.slice(-2).join(' ');
             return (
               <h1 className={`${orbitron.className} text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.95] mb-8`}>
                 {mainPart}<br/>
                 <span 
                   className="text-transparent bg-clip-text"
                   style={{ backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }}
                 >
                   {gradientPart}
                 </span>
               </h1>
             );
           })()}
          
          <p className="max-w-2xl mx-auto text-white/40 text-base md:text-lg mb-8 leading-relaxed">
            {settings?.hero_subtitle || 'La herramienta definitiva de clasificación nacional. Consulta estadísticas de atletas, descubre torneos avalados por la Federación y visualiza los rankings de la República Dominicana.'}
          </p>

          {/* Live Stats Pills */}
          {(activeCount > 0 || totalViewers > 0) && (
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              {activeCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-neon-cyan/5 border border-neon-cyan/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neon-cyan">
                    {activeCount} Torneo{activeCount === 1 ? '' : 's'} Activo{activeCount === 1 ? '' : 's'}
                  </span>
                </div>
              )}
              {totalViewers > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                    👥 {totalViewers.toLocaleString('es-ES')} Espectadores
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
             <Link 
               href="/rankings" 
               className="w-full sm:w-auto px-8 py-4 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all"
               style={{ backgroundColor: primaryColor, boxShadow: `0 0 20px ${primaryColor}40` }}
             >
                Consultar Rankings Nacionales
             </Link>
             <Link href="/copas" className="w-full sm:w-auto px-8 py-4 bg-[#121219] border border-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/5 transition-all">
                Ver Copas Oficiales
             </Link>
             <Link href="/torneos" className="w-full sm:w-auto px-8 py-4 bg-transparent border border-neon-cyan/20 hover:border-neon-cyan/50 text-neon-cyan text-xs font-black uppercase tracking-widest rounded-xl hover:bg-neon-cyan/5 transition-all shadow-[0_0_15px_rgba(0,245,255,0.05)] hover:shadow-[0_0_25px_rgba(0,245,255,0.15)]">
                Ver Torneos Públicos
             </Link>
          </div>
        </div>
      </section>

      {/* Infinite Statistics Ticker */}
      {settings.statistics_ticker_text && (
        <div className="w-full bg-[#121219]/40 border-y border-white/5 py-4 overflow-hidden relative mb-16 z-10">
          <div className="animate-marquee flex gap-16 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            <span>{settings.statistics_ticker_text}</span>
            <span>{settings.statistics_ticker_text}</span>
            <span>{settings.statistics_ticker_text}</span>
            <span>{settings.statistics_ticker_text}</span>
          </div>
        </div>
      )}

      {/* Publicidad Destacada (Sponsorship Slot) */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 mb-20 space-y-6">
        <AdPlacement banners={ads} slotName="home_top_banner" hidePlaceholder />
        <AdPlacement banners={ads} slotName="home_hero_banner" />
      </section>

      {/* Featured Community Tournaments */}
      {recentPublicTournaments && recentPublicTournaments.length > 0 && (
        <section className="py-16 px-6 sm:px-8 max-w-7xl mx-auto mb-16 relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-10 border-b border-white/5 pb-6">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: primaryColor }}>Copas de la Comunidad</span>
              <h2 className={`${orbitron.className} text-xl sm:text-3xl font-black uppercase tracking-tight text-white mt-1`}>
                Torneos en Inscripción y Curso
              </h2>
            </div>
            <Link 
              href="/torneos" 
              className="text-xs font-bold text-white/50 hover:text-white uppercase tracking-wider transition-colors flex items-center gap-1.5 shrink-0"
            >
              Ver todos los torneos <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentPublicTournaments.map((t) => (
              <TournamentCard
                key={t.id}
                t={t}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                DISCIPLINE_LABELS={DISCIPLINE_LABELS}
              />
            ))}
          </div>
        </section>
      )}

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
                <p className="text-white/40 text-xs leading-relaxed">Registro preciso de kills, win rate y clasificaciones para la toma de decisiones de selección nacional con data en mano.</p>
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

      {/* Footer Ad Placement */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 mb-12">
        <AdPlacement banners={ads} slotName="home_footer_banner" hidePlaceholder />
      </section>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-white/5 text-center flex flex-col items-center gap-2">
         <div className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">
            © 2026 KRONIX · NATIONAL PLATFORM
         </div>
         <div className="flex items-center gap-1.5 opacity-30">
            <span className="text-[9px] font-orbitron uppercase tracking-widest text-white/60">Powered by</span>
            <span className="text-[10px] font-orbitron font-black uppercase tracking-widest text-neon-cyan">GonzalezLabs</span>
         </div>
      </footer>
    </div>
  )
}
