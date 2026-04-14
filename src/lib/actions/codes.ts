'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isAdmin } from './auth-helpers'

/**
 * Creates a unique streamer code for a tournament.
 */
export async function generateStreamerCode(tournamentId: string, streamerName: string, customCode?: string) {
  if (!(await isAdmin())) return { error: 'Sin permisos de administrador' }

  const supabase = await createClient()
  
  // 1. Generate a default code if not provided
  const baseCode = customCode || `${streamerName.toUpperCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const { data, error } = await supabase
    .from('streamer_codes')
    .insert({
      tournament_id: tournamentId,
      streamer_name: streamerName,
      code: baseCode,
      is_active: true
    })
    .select()
    .single()

  if (error) return { error: error.message }
  
  revalidatePath(`/admin/tournaments/${tournamentId}`)
  return { data }
}

export async function toggleStreamerCode(codeId: string, isActive: boolean) {
  if (!(await isAdmin())) return { error: 'Sin permisos de administrador' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('streamer_codes')
    .update({ is_active: isActive })
    .eq('id', codeId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getTournamentCodes(tournamentId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('streamer_codes')
    .select('*')
    .eq('tournament_id', tournamentId)

  if (error) return { error: error.message }
  return { data: data || [] }
}
