'use client'

import { Orbitron } from 'next/font/google'
import Link from 'next/link'
import { Crown, Zap, Star, Shield, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react'

const orbitron = Orbitron({ subsets: ['latin'] })

const PLANS = [
  { 
    id: '1_month', 
    title: '1 Mes', 
    amount: 5, 
    duration: '30 días', 
    badge: '',
    popular: false
  },
  { 
    id: '3_months', 
    title: '3 Meses', 
    amount: 13, 
    duration: '90 días', 
    badge: 'Popular',
    popular: true
  },
  { 
    id: '1_year', 
    title: '1 Año', 
    amount: 50, 
    duration: '365 días', 
    badge: 'Mejor Valor',
    popular: false
  }
]

const BENEFITS = [
  { icon: <Crown className="w-4 h-4 text-yellow-400" />, text: 'Insignia VIP exclusiva en tu perfil y líderboards.' },
  { icon: <Zap className="w-4 h-4 text-blue-400" />, text: '0% de comisión por retiro de K-Coins.' },
  { icon: <Star className="w-4 h-4 text-purple-400" />, text: 'Acceso anticipado a torneos oficiales Kronix.' },
  { icon: <Shield className="w-4 h-4 text-emerald-400" />, text: 'Soporte prioritario y atención VIP 24/7.' },
  { icon: <Shield className="w-4 h-4 text-cyan-400" />, text: 'Hasta 5 colaboradores de Staff (Free incluye máx. 2).' },
  { icon: <Crown className="w-4 h-4 text-yellow-500" />, text: 'Personalización avanzada de patrocinadores en torneos.' }
]

export function MembershipSection({ user, profile }: { user: any, profile: any }) {
  const userRole = profile?.role || 'USER'
  const isVip = profile?.subscriptionStatus === 'ACTIVE' || profile?.subscription_status === 'ACTIVE'
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN'

  return (
    <section className="py-24 md:py-32 px-4 sm:px-8 relative overflow-hidden bg-[#07080c] border-t border-white/5">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-radial from-blue-900/10 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-16 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Acceso Streamer VIP
          </div>
          <h2 className={`${orbitron.className} text-3xl sm:text-5xl font-black uppercase text-white tracking-widest leading-none`}>
            Membresía <span className="text-[#009cde]">VIP Kronix</span>
          </h2>
          <p className="text-white/50 text-sm sm:text-base leading-relaxed">
            Sube de nivel tu canal y tus torneos. Obtén beneficios exclusivos, destaca en la plataforma y desbloquea herramientas avanzadas de organización.
          </p>
        </div>

        {/* Conditional Layouts based on user state */}
        {!user ? (
          /* Logged out: Show plans with sign in redirect */
          <div className="space-y-12">
            <div className="grid md:grid-cols-3 gap-8">
              {PLANS.map((plan) => (
                <div 
                  key={plan.id}
                  className={`relative rounded-3xl p-[1px] transition-all duration-300 bg-white/10 hover:bg-white/20 hover:-translate-y-1.5 flex flex-col`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 inset-x-0 flex justify-center z-10">
                      <span className="bg-[#009cde] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  <div className="bg-[#0d0f15]/90 h-full rounded-3xl p-8 flex flex-col backdrop-blur-xl">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-bold text-white uppercase tracking-widest font-orbitron">{plan.title}</h3>
                      <div className="mt-4 flex items-center justify-center gap-1">
                        <span className="text-2xl font-bold text-white/50">$</span>
                        <span className="text-5xl font-black text-white">{plan.amount}</span>
                        <span className="text-sm text-white/50 self-end mb-1">USD</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4 my-4">
                      {BENEFITS.map((b, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">{b.icon}</div>
                          <span className="text-xs text-white/70 leading-relaxed text-left">{b.text}</span>
                        </div>
                      ))}
                    </div>

                    <Link
                      href="/login?redirect=/subscription"
                      className="mt-8 w-full py-4 bg-white hover:bg-neon-cyan hover:shadow-[0_0_20px_rgba(0,156,222,0.4)] text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all text-center"
                    >
                      Elegir Plan
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : isAdmin ? (
          /* Admin VIP Account: Show dashboard banner */
          <div className="max-w-2xl mx-auto bg-[#0d0f15] border border-yellow-500/20 rounded-3xl p-8 text-center space-y-6 shadow-[0_0_50px_rgba(234,179,8,0.08)]">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full mx-auto flex items-center justify-center border border-yellow-500/30">
              <Crown className="w-8 h-8 text-yellow-400 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white font-orbitron uppercase tracking-widest">¡Administrador VIP Activo!</h3>
              <p className="text-sm text-white/60 max-w-md mx-auto">
                Tu cuenta de administración posee acceso completo e ilimitado de por vida a todas las ventajas VIP de Kronix.
              </p>
            </div>
            <div className="border-t border-white/5 pt-6">
              <Link 
                href="/tournaments"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#009cde] hover:bg-[#007fb5] text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors"
              >
                Ir a Gestión de Torneos <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : userRole === 'USER' ? (
          /* Regular User: Show Streamer application section */
          <div className="max-w-2xl mx-auto bg-[#0d0f15] border border-white/5 rounded-3xl p-8 sm:p-12 text-center space-y-8 shadow-xl">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full mx-auto flex items-center justify-center border border-yellow-500/30">
              <Crown className="w-8 h-8 text-yellow-400" />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white font-orbitron uppercase tracking-widest">Membresía VIP para Streamers</h3>
              <p className="text-sm text-white/60 leading-relaxed max-w-lg mx-auto">
                Los beneficios del pase VIP (como ampliar colaboradores, personalización de patrocinadores y reportes) están diseñados exclusivamente para **Streamers y Organizadores** de torneos.
              </p>
            </div>
            <div className="border-t border-white/5 pt-6">
              <p className="text-xs text-yellow-500/80 font-bold uppercase tracking-wider mb-4">¿Te gustaría organizar torneos y eventos?</p>
              <a 
                href="/support"
                className="inline-block px-8 py-4 bg-[#009cde] hover:bg-[#007fb5] text-white font-bold rounded-xl uppercase tracking-widest text-xs transition-colors text-center"
              >
                Solicitar Rol de Streamer
              </a>
            </div>
          </div>
        ) : isVip ? (
          /* Streamer with Active VIP: Show active details link */
          <div className="max-w-2xl mx-auto bg-[#0d0f15] border border-green-500/20 rounded-3xl p-8 text-center space-y-6 shadow-[0_0_50px_rgba(16,185,129,0.08)]">
            <div className="w-16 h-16 bg-green-500/10 rounded-full mx-auto flex items-center justify-center border border-green-500/30">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white font-orbitron uppercase tracking-widest">¡Eres Streamer VIP Premium!</h3>
              <p className="text-sm text-white/60 max-w-md mx-auto">
                Tienes acceso activo a todas las herramientas avanzadas. Disfruta de un límite de hasta 5 colaboradores y personalización de marcas.
              </p>
            </div>
            <div className="border-t border-white/5 pt-6">
              <Link 
                href="/subscription"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-neon-cyan text-black rounded-xl font-bold uppercase tracking-widest text-xs transition-all"
              >
                Ver Detalles de Suscripción <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* Streamer (Free): Show plans cards grid with redirect to checkout */
          <div className="space-y-12">
            <div className="grid md:grid-cols-3 gap-8">
              {PLANS.map((plan) => (
                <div 
                  key={plan.id}
                  className={`relative rounded-3xl p-[1px] transition-all duration-300 bg-white/10 hover:bg-white/20 hover:-translate-y-1.5 flex flex-col`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 inset-x-0 flex justify-center z-10">
                      <span className="bg-[#009cde] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  <div className="bg-[#0d0f15]/90 h-full rounded-3xl p-8 flex flex-col backdrop-blur-xl">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-bold text-white uppercase tracking-widest font-orbitron">{plan.title}</h3>
                      <div className="mt-4 flex items-center justify-center gap-1">
                        <span className="text-2xl font-bold text-white/50">$</span>
                        <span className="text-5xl font-black text-white">{plan.amount}</span>
                        <span className="text-sm text-white/50 self-end mb-1">USD</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4 my-4">
                      {BENEFITS.map((b, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">{b.icon}</div>
                          <span className="text-xs text-white/70 leading-relaxed text-left">{b.text}</span>
                        </div>
                      ))}
                    </div>

                    <Link
                      href="/subscription"
                      className="mt-8 w-full py-4 bg-[#009cde] hover:bg-[#007fb5] text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all text-center block shadow-[0_0_20px_rgba(0,156,222,0.2)]"
                    >
                      Elegir Plan
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
