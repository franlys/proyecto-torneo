'use server'

import { createAdminClient } from '@/lib/supabase/server'

/**
 * Upload evidence file server-side so the browser never calls Supabase Storage directly.
 * Browser → Vercel (Server Action) → Supabase Storage
 * Avoids DNS resolution failures on mobile carrier networks.
 */
export async function uploadEvidence(
  formData: FormData
): Promise<{ path: string } | { error: string }> {
  const file = formData.get('file') as File | null
  const filePath = formData.get('filePath') as string | null

  if (!file || !filePath) {
    return { error: 'Archivo o ruta no proporcionados' }
  }

  if (file.size > 52_428_800) {
    return { error: 'El archivo supera el límite de 50 MB' }
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Tipo de archivo no permitido' }
  }

  const supabase = await createAdminClient()

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { data, error } = await supabase.storage
    .from('evidences')
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) return { error: error.message }

  return { path: data.path }
}
