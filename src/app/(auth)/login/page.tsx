'use client'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { signIn, resendVerificationEmail } from '@/lib/actions/auth'
import { useState, useRef } from 'react'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
    >
      {pending ? 'Entrando...' : 'Entrar'}
    </button>
  )
}

export default function LoginPage() {
  const [state, action] = useFormState(signIn, null)
  const [resendMsg, setResendMsg] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  const isUnverified = state?.error === 'UNVERIFIED_EMAIL'

  async function handleResend() {
    const email = emailRef.current?.value
    if (!email) return
    setResending(true)
    const result = await resendVerificationEmail(email)
    setResending(false)
    if ('success' in result) setResendMsg(result.success)
    else setResendMsg(result.error)
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

      {/* Unverified email wall */}
      {isUnverified ? (
        <div className="bg-white/5 backdrop-blur-sm border border-yellow-500/30 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✉️</span>
          </div>
          <h2 className="text-white font-semibold text-xl mb-2">Verifica tu correo</h2>
          <p className="text-white/60 text-sm mb-1">
            Tu cuenta aún no ha sido verificada. Revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación que te enviamos.
          </p>
          <p className="text-white/40 text-xs mb-6">
            Si no recibiste el correo, ingresa tu email abajo y reenvíalo.
          </p>

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <input
              ref={emailRef}
              type="email"
              placeholder="tu@email.com"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 text-sm"
            />
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-black bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 transition-all"
            >
              {resending ? 'Reenviando...' : 'Reenviar correo de verificación'}
            </button>
          </div>

          {resendMsg && (
            <p className="mt-4 text-xs text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/20 rounded-lg px-3 py-2">
              {resendMsg}
            </p>
          )}

          <Link href="/login" className="inline-block mt-6 text-white/40 text-xs hover:text-white transition-colors">
            ← Volver al login
          </Link>
        </div>
      ) : (
        /* Normal login card */
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 relative">
          <h2 className="text-white font-semibold text-xl mb-6">Iniciar sesión</h2>

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

            <div>
              <label htmlFor="password" className="block text-sm text-white/60 mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {state?.error && state.error !== 'UNVERIFIED_EMAIL' && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <SubmitButton />
          </form>

          <p className="text-center text-white/40 text-sm mt-6">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="text-neon-cyan hover:underline">
              Regístrate
            </Link>
          </p>

          {/* Sello Discreto */}
          <div className="mt-8 pt-4 border-t border-white/5 text-center flex flex-col items-center justify-center opacity-40 select-none">
             <span className="text-[8px] font-orbitron uppercase tracking-widest text-white/70">Powered by</span>
             <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest text-white mt-0.5">GonzalezLabs</span>
          </div>
        </div>
      )}
    </div>
  )
}
