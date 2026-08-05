'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { pushToAC } from './ac-push'
import { getProfile } from './auth-helpers'
import { revalidatePath } from 'next/cache'
import { getUsdToDopRate } from '@/lib/services/exchange-rate'
import { sendTransactionReceiptEmail } from '@/lib/services/email'

export async function contributeToTeamFeeAction(
  teamId: string,
  amountStr: string
): Promise<{ success: boolean; newStatus?: string } | { error: string }> {
  try {
    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount <= 0) {
      return { error: 'Cantidad inválida.' }
    }

    const profile = await getProfile()
    if (!profile) return { error: 'No autenticado' }

    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    // 1. Fetch team and tournament
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('id, name, registration_status, amount_paid, tournament_id, tournaments(id, name, entry_fee, slug)')
      .eq('id', teamId)
      .single()

    if (teamErr || !team) return { error: 'No se encontró el equipo.' }
    
    const tournament = Array.isArray(team.tournaments) ? team.tournaments[0] : team.tournaments
    if (!tournament) return { error: 'Torneo no encontrado.' }

    if (team.registration_status !== 'approved_to_pay') {
      return { error: 'El equipo no está en estado de recibir pagos actualmente.' }
    }

    const entryFee = Number(tournament.entry_fee) || 0
    const currentPaid = Number(team.amount_paid) || 0
    const rate = await getUsdToDopRate()
    const entryFeeInKCoins = parseFloat((entryFee * rate).toFixed(2))
    const remaining = Math.max(0, entryFeeInKCoins - currentPaid)

    if (remaining <= 0) {
      return { error: 'El equipo ya ha pagado la cuota completa.' }
    }

    const finalAmount = Math.min(amount, remaining)

    // 2. Check user balance and version timestamp
    const { data: userProfile, error: profErr } = await adminSupabase
      .from('profiles')
      .select('balance, updated_at')
      .eq('id', profile.id)
      .single()

    if (profErr || !userProfile) return { error: 'Error al verificar tu balance.' }

    const balance = parseFloat(userProfile.balance || '0.00')
    const lastUpdatedAt = userProfile.updated_at
    if (balance < finalAmount) {
      return { error: `Saldo insuficiente. Necesitas al menos ${finalAmount} K-Coins.` }
    }

    // 3. Deduct from user using OCC
    const newBalance = parseFloat((balance - finalAmount).toFixed(2))
    const { data: updateData, error: balErr } = await adminSupabase
      .from('profiles')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id)
      .eq('updated_at', lastUpdatedAt)
      .select()

    if (balErr || !updateData || updateData.length === 0) {
      return { error: 'Conflicto de transacción concurrente. Por favor, intenta de nuevo.' }
    }

    // 4. Log transaction
    await adminSupabase.from('coin_transactions').insert({
      user_id: profile.id,
      amount: -finalAmount,
      type: 'tournament_entry',
      reference_id: tournament.id
    })

    // Send email receipt
    if ((profile as any).email) {
      await sendTransactionReceiptEmail({
        email: (profile as any).email,
        username: (profile as any).username || 'Usuario',
        amount: -finalAmount,
        type: 'tournament_entry',
        referenceId: tournament.id,
        balanceBefore: balance,
        balanceAfter: newBalance,
        description: `Inscripción de Equipo "${team.name}" (Torneo: ${tournament.name})`
      }).catch(err => {
        console.error('Error sending team fee receipt email:', err)
      })
    }

    // 5. Update team amount_paid
    const newPaid = currentPaid + finalAmount
    let newStatus = team.registration_status

    if (newPaid >= entryFeeInKCoins) {
      newStatus = 'confirmed'
    }

    const { error: updateErr } = await adminSupabase
      .from('teams')
      .update({
        amount_paid: newPaid,
        registration_status: newStatus
      })
      .eq('id', team.id)

    if (updateErr) {
      // Very bad error, we should log this in a robust system but we'll return error for now
      return { error: 'Se cobró de tu billetera pero falló al actualizar el equipo. Contacta soporte.' }
    }

    // Sync to Apuestas Kronix if confirmed
    if (newStatus === 'confirmed') {
      pushToAC('teams', 'upsert', {
        id: team.id,
        tournamentId: team.tournament_id,
        name: team.name,
        registrationStatus: newStatus
      })
    }

    revalidatePath(`/t/${tournament.slug}`)

    return { success: true, newStatus }
  } catch (err: any) {
    console.error('Error in contributeToTeamFeeAction:', err)
    return { error: err.message || 'Error interno al procesar el aporte.' }
  }
}
