'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const signUpSchema = z.object({
  username: z.string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(30, 'El nombre de usuario no puede exceder los 30 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guión bajo (_)'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
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

  const redirectTo = formData.get('redirectTo') as string | null

  if (redirectTo && redirectTo.startsWith('/')) {
    redirect(redirectTo)
  } else {
    redirect('/tournaments')
  }
}

export async function signUp(
  _prevState: { error?: string; success?: string } | null,
  formData: FormData
): Promise<{ error: string } | { success: string }> {
  const parsed = signUpSchema.safeParse({
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const supabase = await createClient()

  // Verify username uniqueness manually before signup to give immediate feedback
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', parsed.data.username)
    .maybeSingle()

  if (existingProfile) {
    return { error: 'El nombre de usuario ya está en uso' }
  }

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      data: {
        username: parsed.data.username,
      },
    },
  })
  if (error) return { error: error.message }
  return { success: 'Revisa tu email (incluyendo la carpeta de SPAM) para confirmar tu cuenta.' }
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
  return { success: 'Correo de verificación reenviado. Por favor revisa también tu carpeta de SPAM o correo no deseado.' }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function requestPasswordReset(
  _prevState: { error?: string; success?: string } | null,
  formData: FormData
): Promise<{ error: string } | { success: string }> {
  const email = formData.get('email') as string
  if (!email || !email.includes('@')) {
    return { error: 'Por favor, ingresa un email válido.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  })

  if (error) return { error: error.message }
  return { success: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña. Revisa también tu carpeta de SPAM.' }
}

export async function updatePassword(
  _prevState: { error?: string; success?: string } | null,
  formData: FormData
): Promise<{ error: string } | { success: string }> {
  const password = formData.get('password') as string
  if (!password || password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }
  return { success: 'Contraseña actualizada correctamente. Redirigiendo...' }
}

export async function verifyInvitationOtp(
  tokenHash: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'invite',
  })

  if (error) return { error: error.message }
  return { success: true }
}
