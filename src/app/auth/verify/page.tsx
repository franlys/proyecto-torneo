'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { verifyInvitationOtp } from '@/lib/actions/auth'
import { Shield, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react'

function VerifyInvitationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenHash = searchParams.get('token_hash')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleConfirm = async () => {
    if (!tokenHash) return
    setLoading(true)
    setError(null)

    try {
      const res = await verifyInvitationOtp(tokenHash)
      if ('error' in res) {
        setError(res.error)
      } else {
        setSuccess(true)
        // Redirigir al formulario de cambiar contraseña tras 1.5s
        setTimeout(() => {
          router.push('/reset-password')
        }, 1500)
      }
    } catch (err) {
      setError('Ocurrió un error inesperado al verificar la invitación.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="font-orbitron text-2xl font-bold tracking-widest text-neon-cyan uppercase">
          Tournament
        </h1>
        <p className="font-orbitron text-xs tracking-[0.3em] text-white/40 uppercase mt-1">
          Leaderboard Platform
        </p>
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 relative">
        {!tokenHash ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-white font-semibold text-xl">Enlace Inválido</h2>
            <p className="text-white/60 text-sm">
              El enlace de confirmación no contiene un token válido. Por favor, solicita una nueva invitación de staff.
            </p>
          </div>
        ) : success ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center mx-auto text-neon-cyan animate-pulse">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-neon-cyan font-semibold text-xl">¡Verificado con Éxito!</h2>
            <p className="text-white/60 text-sm">
              Tu invitación ha sido aceptada. Redirigiéndote para configurar tu contraseña...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center mx-auto mb-4 text-neon-purple">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-white font-semibold text-xl">Confirmar Invitación</h2>
              <p className="text-white/60 text-sm mt-1">
                Estás a un paso de unirte al equipo de staff de Kronix E-sports.
              </p>
            </div>

            <p className="text-white/40 text-xs text-center leading-relaxed">
              Al hacer clic en el botón, confirmaremos tu correo y te redirigiremos para que puedas ingresar tu nueva contraseña de acceso.
            </p>

            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 text-center">
                {error === 'Email link is invalid or has expired' 
                  ? 'El enlace de invitación ha expirado o ya fue utilizado.' 
                  : error}
              </p>
            )}

            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Confirmando...' : (
                <>
                  Confirmar y Continuar <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VerifyInvitationPage() {
  return (
    <Suspense fallback={
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center text-white/60">
        Cargando verificación...
      </div>
    }>
      <VerifyInvitationContent />
    </Suspense>
  )
}
