'use client'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { signIn, resendVerificationEmail } from '@/lib/actions/auth'
import { useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
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
            <input type="hidden" name="redirectTo" value={redirectTo || ''} />
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
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="block text-sm text-white/60">
                  Contraseña
                </label>
                <Link href="/forgot-password" className="text-xs text-neon-cyan hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
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

          {/* Social Logins Divider */}
          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <span className="relative bg-[#0d0f15] px-4 text-[10px] text-white/30 font-bold uppercase tracking-widest">
              o continuar con
            </span>
          </div>

          {/* Social Logins Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Google */}
            <button
              onClick={() => {
                const supabase = createClient()
                const redirectToUrl = `${window.location.origin}/auth/callback${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`
                supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: redirectToUrl }
                })
              }}
              className="flex items-center justify-center py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl transition-all"
              title="Iniciar sesión con Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
            </button>

            {/* Discord */}
            <button
              onClick={() => {
                const supabase = createClient()
                const redirectToUrl = `${window.location.origin}/auth/callback${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`
                supabase.auth.signInWithOAuth({
                  provider: 'discord',
                  options: { redirectTo: redirectToUrl }
                })
              }}
              className="flex items-center justify-center py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl transition-all"
              title="Iniciar sesión con Discord"
            >
              <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.8,6.83,77.19,77.19,0,0,0,49.5,0,105.15,105.15,0,0,0,19.06,8.07C-3.41,41.74-.83,74.7,12,96.26a105.74,105.74,0,0,0,32.11-16.2c3-1.15,5.78-2.54,8.37-4.13a72.58,72.58,0,0,1-13.14-9.27c1-.75,2-1.53,3-2.34a75.21,75.21,0,0,0,70,0c1,.81,2,1.59,3,2.34a72.58,72.58,0,0,1-13.14,9.27c2.59,1.59,5.37,3,8.37,4.13A105.74,105.74,0,0,0,114.7,96.26C127.53,74.7,130.11,41.74,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
              </svg>
            </button>

            {/* Facebook */}
            <button
              onClick={() => {
                const supabase = createClient()
                const redirectToUrl = `${window.location.origin}/auth/callback${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`
                supabase.auth.signInWithOAuth({
                  provider: 'facebook',
                  options: { redirectTo: redirectToUrl }
                })
              }}
              className="flex items-center justify-center py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl transition-all"
              title="Iniciar sesión con Facebook"
            >
              <svg className="w-5 h-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </button>
          </div>

          <p className="text-center text-white/40 text-sm mt-6">
            ¿No tienes cuenta?{' '}
            <Link
              href={redirectTo ? `/register?redirectTo=${encodeURIComponent(redirectTo)}` : '/register'}
              className="text-neon-cyan hover:underline"
            >
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-white/40 font-semibold uppercase tracking-wider text-xs">Cargando formulario...</div>}>
      <LoginForm />
    </Suspense>
  )
}
