'use client'

import { useState, useEffect } from 'react'
import { Crown, CheckCircle2, Zap, Shield, Loader2, Star, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface SubscriptionClientProps {
  initialStatus: string
  initialExpiry: string | null
  role?: string
}

const PLANS = [
  { id: '1_month', title: '1 Mes', amount: 5, duration: '30 días', badge: '' },
  { id: '3_months', title: '3 Meses', amount: 13, duration: '90 días', badge: 'Popúlar' },
  { id: '1_year', title: '1 Año', amount: 50, duration: '365 días', badge: 'Mejor Valor' }
]

const BENEFITS = [
  { icon: <Crown className="w-4 h-4 text-yellow-400" />, text: 'Insignia VIP exclusiva en tu perfil y líderboards.' },
  { icon: <Zap className="w-4 h-4 text-blue-400" />, text: '0% de comisión por retiro de K-Coins.' },
  { icon: <Star className="w-4 h-4 text-purple-400" />, text: 'Acceso anticipado a torneos oficiales Kronix.' },
  { icon: <Shield className="w-4 h-4 text-emerald-400" />, text: 'Soporte prioritario y atención VIP 24/7.' },
  { icon: <Shield className="w-4 h-4 text-neon-cyan" />, text: 'Hasta 5 colaboradores de Staff para tus torneos (Plan Free incluye máx. 2).' },
  { icon: <Crown className="w-4 h-4 text-gold" />, text: 'Personalización avanzada de patrocinadores en la ficha del torneo.' }
]

export default function SubscriptionClient({ initialStatus, initialExpiry, role }: SubscriptionClientProps) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [expiry, setExpiry] = useState(initialExpiry)
  
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [showPaypalModal, setShowPaypalModal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paypalRendered, setPaypalRendered] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  useEffect(() => {
    if (showPaypalModal || showSuccessModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showPaypalModal, showSuccessModal])

  const activePlanDetails = PLANS.find(p => p.id === selectedPlan)

  const initPayPalButton = () => {
    if (!(window as any).paypal) {
      setTimeout(initPayPalButton, 500)
      return
    }

    const container = document.getElementById('paypal-subscription-container')
    if (container) container.innerHTML = ''
    setPaypalRendered(false)

    ;(window as any).paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'pay',
        height: 48,
        tagline: false,
        borderRadius: 12
      },
      createOrder: async () => {
        try {
          const res = await fetch('/api/paypal/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: selectedPlan })
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Error creando orden')
          return data.id
        } catch (error: any) {
          toast.error(error.message)
          throw error
        }
      },
      onApprove: async (data: any) => {
        setIsProcessing(true)
        try {
          const res = await fetch('/api/paypal/capture-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderID: data.orderID, planId: selectedPlan })
          })
          const result = await res.json()
          if (!res.ok) throw new Error(result.error || 'Error al capturar')
          
          setStatus('ACTIVE')
          setExpiry(result.expiry)
          setShowPaypalModal(false)
          setShowSuccessModal(true)
          router.refresh()
        } catch (error: any) {
          toast.error(error.message)
        } finally {
          setIsProcessing(false)
        }
      },
      onError: () => {
        toast.error('Ocurrió un error con el pago de PayPal.')
      }
    }).render('#paypal-subscription-container').then(() => {
      setPaypalRendered(true)
    })
  }

  useEffect(() => {
    if (showPaypalModal && selectedPlan && !isProcessing) {
      initPayPalButton()
    }
  }, [showPaypalModal, selectedPlan, isProcessing])

  // Load PayPal SDK if not present
  useEffect(() => {
    if (!document.getElementById('paypal-sdk')) {
      const script = document.createElement('script')
      script.id = 'paypal-sdk'
      script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=USD`
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN'

  return (
    <div className="space-y-8">
      {/* Current Status Banner */}
      {isAdmin ? (
        <div className="p-6 rounded-2xl border bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-yellow-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-yellow-500/20 text-yellow-400">
              <Crown className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 font-orbitron uppercase tracking-wider">
                Estado Actual: <span className="text-yellow-400 font-black">Administrador (VIP Gratis)</span>
              </h2>
              <p className="text-sm text-white/50 mt-1">
                Tu cuenta de administración cuenta con privilegios VIP ilimitados y gratuitos de por vida.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className={`p-6 rounded-2xl border ${status === 'ACTIVE' ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-yellow-500/20' : 'bg-dark-card border-white/5'} flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${status === 'ACTIVE' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-white/50'}`}>
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Estado Actual: {status === 'ACTIVE' ? <span className="text-yellow-400">VIP Activo</span> : <span className="text-white/50">Cuenta Free</span>}
              </h2>
              {status === 'ACTIVE' && expiry && (
                <p className="text-sm text-white/60 flex items-center gap-1 mt-1">
                  <Calendar className="w-3 h-3" />
                  Válido hasta: <span className="text-white font-mono">{new Date(expiry).toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isAdmin ? (
        <div className="bg-dark-card border border-yellow-500/20 rounded-3xl p-8 max-w-2xl mx-auto text-center space-y-6 shadow-[0_0_50px_rgba(234,179,8,0.08)]">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full mx-auto flex items-center justify-center border border-yellow-500/30">
            <Crown className="w-8 h-8 text-yellow-400 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white font-orbitron uppercase tracking-widest">¡Tu cuenta es VIP Premium!</h2>
            <p className="text-sm text-white/60 max-w-md mx-auto">
              Como administrador de Kronix, disfrutas de acceso completo e ilimitado a todos los privilegios premium de la plataforma.
            </p>
          </div>
          
          <div className="border-t border-white/5 pt-6 text-left max-w-md mx-auto space-y-4">
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-2">Privilegios Activos en tu Cuenta:</p>
            {BENEFITS.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-shrink-0 text-emerald-400 bg-emerald-500/10 p-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs text-white/80 leading-relaxed font-semibold">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div 
              key={plan.id}
              className={`relative rounded-3xl p-[1px] transition-all duration-300 ${selectedPlan === plan.id ? 'bg-gradient-to-b from-[#009cde] to-blue-900 shadow-[0_0_30px_rgba(0,156,222,0.3)] transform -translate-y-2' : 'bg-white/10 hover:bg-white/20 hover:-translate-y-1'}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.badge && (
                <div className="absolute -top-3 inset-x-0 flex justify-center z-10">
                  <span className="bg-[#009cde] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                    {plan.badge}
                  </span>
                </div>
              )}
              <div className="bg-[#0d0f15] h-full rounded-3xl p-6 flex flex-col cursor-pointer">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-white uppercase tracking-widest font-orbitron">{plan.title}</h3>
                  <div className="mt-4 flex items-center justify-center gap-1">
                    <span className="text-2xl font-bold text-white/50">$</span>
                    <span className="text-5xl font-black text-white">{plan.amount}</span>
                    <span className="text-sm text-white/50 self-end mb-1">USD</span>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  {BENEFITS.map((b, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5">{b.icon}</div>
                      <span className="text-xs text-white/70 leading-relaxed">{b.text}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedPlan(plan.id)
                    setShowPaypalModal(true)
                  }}
                  className={`mt-8 w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all ${
                    selectedPlan === plan.id 
                      ? 'bg-[#009cde] hover:bg-[#007fb5] text-white shadow-[0_0_20px_rgba(0,156,222,0.4)]' 
                      : 'bg-white/5 hover:bg-white/10 text-white/80'
                  }`}
                >
                  Elegir Pase
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PayPal Modal Overlay ── */}
      {showPaypalModal && activePlanDetails && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
          style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.88)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPaypalModal(false) }}
        >
          <div className="relative w-full max-w-sm sm:max-w-2xl bg-gradient-to-br from-[#0d0f15] to-[#080a0e] rounded-3xl border border-white/10 shadow-[0_0_80px_rgba(0,156,222,0.15)] overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-gradient-to-r from-[#003087] via-[#009cde] to-[#012169] h-[3px] flex-shrink-0" />

            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[#009cde]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.067 8.478c.492.315.844.825.966 1.41.372 1.86-.878 3.667-2.783 4.09-.208.045-.42.066-.634.066H16.3l-.515 2.65a.5.5 0 0 1-.49.406h-1.73a.5.5 0 0 1-.49-.594l1.7-8.714h3.37c.702 0 1.365.24 1.922.686ZM5.555 6.374l-.994 5.11-.61 3.124H3.8a.5.5 0 0 0-.49.594l.247 1.27H1.61a.5.5 0 0 1-.49-.406L-.016 9.59a.5.5 0 0 1 .49-.594H2.89l.617-3.17a.5.5 0 0 1 .49-.406h1.558c.23 0 .43.158.49.406Z"/>
                </svg>
                <div>
                  <p className="text-sm font-bold text-white font-orbitron uppercase tracking-widest leading-none">Pago Seguro</p>
                  <p className="text-[10px] text-white/30 mt-0.5">Powered by PayPal</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaypalModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body — separate scrolling per column on desktop */}
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
              <div className="sm:w-64 sm:flex-shrink-0 p-6 sm:border-r border-b sm:border-b-0 border-white/[0.06] space-y-5 bg-white/[0.01] overflow-y-auto">
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-3">Resumen del Pase VIP</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs text-white/50">{activePlanDetails.title}</span>
                      <span className="text-xs font-bold text-white whitespace-nowrap">${activePlanDetails.amount.toFixed(2)} USD</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest">Duración</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-orbitron font-black text-[#009cde] text-2xl">{activePlanDetails.duration}</span>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4 space-y-2">
                  {[
                    { icon: '🔒', text: 'Cifrado SSL 256-bit' },
                    { icon: '🛡️', text: 'Protección al comprador' },
                    { icon: '✅', text: 'Pago verificado PayPal' },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-2">
                      <span className="text-xs">{icon}</span>
                      <span className="text-[10px] text-white/30">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 p-6 space-y-5 flex flex-col justify-start bg-white relative overflow-y-auto">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest text-center font-bold">Elige tu método de pago</p>

                {isProcessing ? (
                  <div className="py-10 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#009cde] mx-auto" />
                    <p className="text-xs text-gray-600 font-medium">Activando tu pase VIP, por favor espera...</p>
                  </div>
                ) : (
                  <div>
                    <style dangerouslySetInnerHTML={{__html: `
                      #paypal-subscription-container .paypal-buttons-context-iframe {
                        border-radius: 12px;
                        overflow: hidden;
                      }
                      #paypal-subscription-container iframe {
                        border-radius: 12px;
                      }
                      .paypal-subscription-wrapper {
                        background: white !important;
                        border-radius: 12px;
                        overflow: hidden;
                      }
                    `}} />
                    {!paypalRendered && (
                      <div className="space-y-3">
                        <div className="h-[48px] rounded-xl bg-[#FFC439]/20 animate-pulse" />
                        <div className="h-[48px] rounded-xl bg-gray-100 animate-pulse" />
                      </div>
                    )}
                    <div
                      id="paypal-subscription-container"
                      className={`paypal-subscription-wrapper w-full transition-opacity duration-300 ${paypalRendered ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}
                    />
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 pt-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                  <span className="text-[10px] text-gray-400 font-medium">Procesado de forma segura por PayPal</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Modal ── */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.88)' }}>
          <div className="bg-dark-card border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-[0_0_80px_rgba(0,156,222,0.2)]">
            <div className="w-20 h-20 bg-yellow-500/10 rounded-full mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.2)]">
              <Crown className="w-10 h-10 text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold text-white font-orbitron uppercase tracking-widest mt-4">¡Bienvenido al club VIP!</h2>
            <p className="text-sm text-white/60">Tu pase ha sido activado correctamente. Disfruta de todos tus nuevos beneficios.</p>
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="mt-4 w-full py-3 bg-[#009cde] text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-[#007fb5] transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
