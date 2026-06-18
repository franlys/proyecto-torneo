'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function signIn(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | never> {
  const parsed = authSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: 'Email o contraseña inválidos' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    // Supabase returns this specific error when email confirmation is required but pending
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return { error: 'UNVERIFIED_EMAIL' }
    }
    return { error: error.message }
  }

  // Extra safety: block even if Supabase didn't reject the sign-in
  if (data.user && !data.user.email_confirmed_at) {
    await supabase.auth.signOut()
    return { error: 'UNVERIFIED_EMAIL' }
  }

  redirect('/tournaments')
}

export async function signUp(
  _prevState: { error?: string; success?: string } | null,
  formData: FormData
): Promise<{ error: string } | { success: string }> {
  const parsed = authSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: 'Email o contraseña inválidos' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })
  if (error) return { error: error.message }
  return { success: 'Revisa tu email para confirmar tu cuenta' }
}

export async function resendVerificationEmail(
  email: string
): Promise<{ success: string } | { error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })
  if (error) return { error: error.message }
  return { success: 'Correo de verificación reenviado. Revisa tu bandeja de entrada.' }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
