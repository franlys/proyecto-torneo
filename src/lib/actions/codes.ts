'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isAdmin } from './auth-helpers'

async function canManageCodes(tournamentId: string): Promise<boolean> {
  if (await isAdmin()) return true

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .eq('creator_id', user.id)
    .single()

  return !!data
}

/**
 * Creates a unique streamer code for a tournament.
 */
export async function generateStreamerCode(tournamentId: string, streamerName: string, customCode?: string) {
  if (!(await canManageCodes(tournamentId))) return { error: 'Sin permisos para gestionar este torneo' }

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

  revalidatePath(`/tournaments/${tournamentId}/codes`)
  return { data }
}

export async function toggleStreamerCode(codeId: string, isActive: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = await isAdmin()

  // Verify the code belongs to a tournament this user can manage
  const { data: code } = await supabase
    .from('streamer_codes')
    .select('tournament_id')
    .eq('id', codeId)
    .single()

  if (!code) return { error: 'Código no encontrado' }
  if (!admin && !(await canManageCodes(code.tournament_id))) return { error: 'Sin permisos' }

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
