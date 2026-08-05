'use client'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { signUp } from '@/lib/actions/auth'
import { z } from 'zod'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const registerSchema = z
  .object({
    username: z.string()
      .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
      .max(30, 'El nombre de usuario no puede exceder los 30 caracteres')
      .regex(/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guión bajo (_)'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
    >
      {pending ? 'Creando cuenta...' : 'Crear cuenta'}
    </button>
  )
}

function RegisterForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const [state, action] = useFormState(signUp, null)
  const [clientError, setClientError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const result = registerSchema.safeParse({
      username: (form.elements.namedItem('username') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      password: (form.elements.namedItem('password') as HTMLInputElement).value,
      confirmPassword: (form.elements.namedItem('confirmPassword') as HTMLInputElement).value,
    })
    if (!result.success) {
      e.preventDefault()
      setClientError(result.error.errors[0].message)
    } else {
      setClientError(null)
    }
  }

  if (state && 'success' in state) {
    return (
      <div>
        <div className="text-center mb-8">
          <h1 className="font-orbitron text-2xl font-bold tracking-widest text-neon-cyan uppercase">
            Tournament
          </h1>
          <p className="font-orbitron text-xs tracking-[0.3em] text-white/40 uppercase mt-1">
            Leaderboard Platform
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-full bg-neon-cyan/20 border border-neon-cyan/40 flex items-center justify-center mx-auto mb-2 shadow-[0_0_15px_rgba(0,245,255,0.2)]">
            <span className="text-neon-cyan text-xl font-bold">✓</span>
          </div>
          <h2 className="text-white font-orbitron font-bold text-xl uppercase tracking-wider">¡Revisa tu email!</h2>
          <p className="text-white/80 text-sm leading-relaxed">{state.success}</p>
          
          <div className="p-3.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-xl text-xs text-left space-y-1">
            <span className="font-bold block uppercase tracking-wider text-[10px]">⚠️ Nota Importante:</span>
            <p className="leading-relaxed">
              El correo de confirmación puede tardar un par de minutos. Si no lo encuentras en tu bandeja de entrada principal, <strong>revisa obligatoriamente tu carpeta de Correo no deseado (SPAM)</strong>, Correo secundario o la pestaña de Promociones.
            </p>
          </div>

          <Link
            href={redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login'}
            className="inline-block mt-4 text-neon-cyan text-sm hover:underline font-orbitron font-semibold uppercase tracking-wider"
          >
            Volver al login
          </Link>
        </div>
      </div>
    )
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

      {/* Card */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 relative">
        <h2 className="text-white font-semibold text-xl mb-6">Crear cuenta</h2>

        <form action={action} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm text-white/60 mb-1.5">
              Nombre de Usuario (Nickname)
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
              placeholder="tu_nickname"
            />
          </div>

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
              autoComplete="new-password"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm text-white/60 mb-1.5">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
              placeholder="Repite tu contraseña"
            />
          </div>

          {(clientError ?? (state && 'error' in state && state.error)) && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {clientError ?? (state && 'error' in state ? state.error : '')}
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
            title="Crear cuenta con Google"
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
            title="Crear cuenta con Discord"
          >
            <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.078.078 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
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
            title="Crear cuenta con Facebook"
          >
            <svg className="w-5 h-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </button>
        </div>

        <p className="text-center text-white/40 text-sm mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link
            href={redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login'}
            className="text-neon-cyan hover:underline"
          >
            Inicia sesión
          </Link>
        </p>

        {/* Sello Discreto */}
        <div className="mt-8 pt-4 border-t border-white/5 text-center flex flex-col items-center justify-center opacity-40 select-none">
           <span className="text-[8px] font-orbitron uppercase tracking-widest text-white/70">Powered by</span>
           <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest text-white mt-0.5">GonzalezLabs</span>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-white/40 font-semibold uppercase tracking-wider text-xs">Cargando formulario...</div>}>
      <RegisterForm />
    </Suspense>
  )
}
