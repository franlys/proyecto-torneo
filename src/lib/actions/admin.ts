'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from './auth-helpers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const changeRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'STREAMER', 'USER']),
})

export async function changeUserRole(formData: FormData) {
  const admin = await isAdmin()
  if (!admin) return { error: 'No autorizado' }

  const parsed = changeRoleSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  })
  if (!parsed.success) return { error: 'Datos inválidos' }

  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function createMissingProfile(formData: FormData) {
  const admin = await isAdmin()
  if (!admin) return { error: 'No autorizado' }

  const userId = formData.get('userId')
  if (!userId || typeof userId !== 'string') return { error: 'ID inválido' }

  const supabase = await createAdminClient()

  // Verificar que el usuario existe en auth
  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  if (!authUser.user) return { error: 'Usuario no encontrado' }

  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { error } = await supabase.from('profiles').insert({
    id: userId,
    username: null,
    role: (count ?? 0) === 0 ? 'ADMIN' : 'STREAMER',
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return { success: true }
}
