'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/actions/auth-helpers'
import { revalidatePath } from 'next/cache'
import {
  getKickStreamerPartners,
  getActiveKickPartnersForTournaments,
  authorizeKickPartner,
  updateKickPartnerFlags,
  revokeKickPartner,
  ActivePartnerOption,
} from '@/lib/services/kick-partners'
import { KickStreamerPartner } from '@/types'

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message
  }
  return fallback
}

export async function authorizePartnerAction(targetUserId: string): Promise<{ success?: boolean; partner?: KickStreamerPartner; error?: string }> {
  if (!(await isSuperAdmin())) {
    return { error: 'No autorizado. Se requieren permisos de Super Admin' }
  }

  try {
    const supabase = await createAdminClient()
    const partner = await authorizeKickPartner(supabase, targetUserId)
    revalidatePath('/admin/kick-partners')
    return { success: true, partner }
  } catch (err: unknown) {
    return { error: getErrorMessage(err, 'Error al autorizar partner') }
  }
}

export async function updatePartnerFlagsAction(
  partnerId: string,
  integrationEnabled: boolean,
  subscriberTournamentsEnabled: boolean
): Promise<{ success?: boolean; partner?: KickStreamerPartner; error?: string }> {
  if (!(await isSuperAdmin())) {
    return { error: 'No autorizado. Se requieren permisos de Super Admin' }
  }

  try {
    const supabase = await createAdminClient()
    const partner = await updateKickPartnerFlags(supabase, partnerId, {
      integrationEnabled,
      subscriberTournamentsEnabled,
    })
    revalidatePath('/admin/kick-partners')
    return { success: true, partner }
  } catch (err: unknown) {
    return { error: getErrorMessage(err, 'Error al actualizar flags del partner') }
  }
}

export async function revokePartnerAction(partnerId: string): Promise<{ success?: boolean; partner?: KickStreamerPartner; error?: string }> {
  if (!(await isSuperAdmin())) {
    return { error: 'No autorizado. Se requieren permisos de Super Admin' }
  }

  try {
    const supabase = await createAdminClient()
    const partner = await revokeKickPartner(supabase, partnerId)
    revalidatePath('/admin/kick-partners')
    return { success: true, partner }
  } catch (err: unknown) {
    return { error: getErrorMessage(err, 'Error al revocar partner') }
  }
}

export async function getPartnersListAction(): Promise<{ partners?: KickStreamerPartner[]; error?: string }> {
  if (!(await isSuperAdmin())) {
    return { error: 'No autorizado. Se requieren permisos de Super Admin' }
  }

  try {
    const supabase = await createAdminClient()
    const partners = await getKickStreamerPartners(supabase)
    return { partners }
  } catch (err: unknown) {
    return { error: getErrorMessage(err, 'Error al obtener la lista de partners') }
  }
}

export async function getActivePartnersForTournamentAction(): Promise<ActivePartnerOption[]> {
  try {
    const supabase = await createClient()
    return await getActiveKickPartnersForTournaments(supabase)
  } catch (err: unknown) {
    console.error('Error in getActivePartnersForTournamentAction:', err)
    return []
  }
}
