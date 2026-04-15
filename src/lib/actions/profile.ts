'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const updateProfileSchema = z.object({
  username: z.string().min(2, 'Mínimo 2 caracteres').max(30, 'Máximo 30 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guión bajo').nullable().optional(),
})

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const raw = formData.get('username')
  const parsed = updateProfileSchema.safeParse({
    username: raw === '' ? null : raw,
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { error } = await supabase
    .from('profiles')
    .update({ username: parsed.data.username, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}
