'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function requestWalletRefundAction(depositId: string, reason: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Debes iniciar sesión.' }

    const adminSupabase = await createAdminClient()

    // 1. Fetch deposit
    const { data: deposit } = await adminSupabase
      .from('deposits')
      .select('*')
      .eq('id', depositId)
      .eq('user_id', user.id)
      .single()

    if (!deposit) return { error: 'Depósito no encontrado.' }
    if (deposit.status !== 'completed') return { error: 'Este depósito no está completado.' }

    // Check if within 48 hours
    const now = new Date().getTime()
    const depositTime = new Date(deposit.completed_at).getTime()
    if (now - depositTime > 48 * 60 * 60 * 1000) {
      return { error: 'El tiempo límite para devoluciones automáticas (48h) ha expirado.' }
    }

    // 2. Fetch current balance
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single()

    const currentBalance = parseFloat(profile?.balance || '0')
    
    // We can fetch the exact kcoins from coin_transactions
    const { data: tx } = await adminSupabase
      .from('coin_transactions')
      .select('amount')
      .eq('reference_id', deposit.id)
      .eq('type', 'deposit')
      .single()

    const refundKCoins = parseFloat(tx?.amount || '0')

    if (currentBalance < refundKCoins) {
      return { error: `No tienes suficientes K-Coins (${refundKCoins}) para reembolsar este depósito.` }
    }

    // 3. Process PayPal Refund
    const captureIdMatch = deposit.gateway_tx_id.split(':')
    const captureId = captureIdMatch.length > 1 ? captureIdMatch[1] : deposit.gateway_tx_id

    try {
      const { refundPayPalPayment } = await import('@/lib/paypal')
      await refundPayPalPayment(captureId, deposit.amount)
    } catch (e: any) {
      console.error('PayPal refund error:', e)
      return { error: 'Error procesando el reembolso en PayPal: ' + e.message }
    }

    // 4. Update Database
    // Deduct balance
    await adminSupabase
      .from('profiles')
      .update({ balance: currentBalance - refundKCoins })
      .eq('id', user.id)

    // Mark deposit as refunded
    await adminSupabase
      .from('deposits')
      .update({ status: 'refunded' })
      .eq('id', deposit.id)

    // Log transaction
    await adminSupabase
      .from('coin_transactions')
      .insert({
        user_id: user.id,
        amount: -refundKCoins,
        type: 'refund',
        reference_id: deposit.id
      })

    // Send email
    if (user.email) {
      const { sendRefundProcessedEmail } = await import('@/lib/email')
      await sendRefundProcessedEmail(user.email, {
        raffleName: 'Recarga de Billetera (K-Coins)',
        ticketsCount: refundKCoins,
        status: 'aprobada'
      })
    }

    revalidatePath('/wallet')
    return { success: true, message: 'Reembolso procesado. Tu dinero regresará a tu cuenta de PayPal en unos días.' }

  } catch (err: any) {
    return { error: 'Error interno: ' + err.message }
  }
}
