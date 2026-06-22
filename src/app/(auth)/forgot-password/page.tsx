'use client'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { requestPasswordReset } from '@/lib/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
    >
      {pending ? 'Enviando...' : 'Recuperar Contraseña'}
    </button>
  )
}

export default function ForgotPasswordPage() {
  const [state, action] = useFormState(requestPasswordReset, null)

  const isSuccess = state != null && 'success' in state
  const isError   = state != null && 'error' in state

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
        <h2 className="text-white font-semibold text-xl mb-2">Recuperar contraseña</h2>
        <p className="text-white/60 text-sm mb-6">
          Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
        </p>

        {isSuccess ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-neon-cyan/20 border border-neon-cyan mx-auto flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(0,245,255,0.2)]">
              <span className="text-neon-cyan text-3xl">✓</span>
            </div>
            <p className="text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/20 rounded-lg px-3 py-2 text-sm">
              {state.success}
            </p>
            <Link href="/login" className="inline-block mt-6 text-white/40 text-xs hover:text-white transition-colors">
              ← Volver al login
            </Link>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-white/60 mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
                placeholder="tu@email.com"
              />
            </div>

            {isError && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <SubmitButton />
          </form>
        )}

        {!isSuccess && (
          <div className="text-center mt-6">
            <Link href="/login" className="text-white/40 text-xs hover:text-white transition-colors">
              ← Volver al login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
