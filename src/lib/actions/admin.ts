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
