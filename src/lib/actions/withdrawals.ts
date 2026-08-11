'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUsdToDopRate } from '@/lib/services/exchange-rate'
import { sendPayPalPayout } from '@/lib/paypal'
import { revalidatePath } from 'next/cache'
import { sendTransactionReceiptEmail } from '@/lib/services/email'

export async function requestWithdrawalAction(
  amount: number,
  paypalEmail: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Debes iniciar sesión para realizar retiros.' }

    const parsedAmount = parseFloat(amount.toFixed(2))
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return { success: false, error: 'El monto ingresado no es válido.' }
    }

    if (!paypalEmail.trim() || !paypalEmail.includes('@')) {
      return { success: false, error: 'Por favor ingresa un correo de PayPal válido.' }
    }

    const adminSupabase = await createAdminClient()

    // 1. Fetch user's current profile balance and version timestamp
    const { data: profile, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('balance, updated_at, username')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return { success: false, error: 'No se pudo obtener el perfil del usuario.' }
    }

    const currentBalance = parseFloat(profile.balance || '0.00')
    const lastUpdatedAt = profile.updated_at

    if (currentBalance < parsedAmount) {
      return { success: false, error: `Saldo insuficiente. Tu saldo es de ${currentBalance.toFixed(2)} K-Coins.` }
    }

    // 2. Calculate USD amount based on live exchange rate
    const rate = await getUsdToDopRate()
    const usdAmount = parseFloat((parsedAmount / rate).toFixed(2))

    if (usdAmount <= 0.01) {
      return { success: false, error: 'El monto a retirar es demasiado bajo para la conversión en USD.' }
    }

    // 3. Deduct balance temporarily using OCC
    const temporaryBalance = parseFloat((currentBalance - parsedAmount).toFixed(2))
    const { data: updateData, error: deductErr } = await adminSupabase
      .from('profiles')
      .update({ 
        balance: temporaryBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .eq('updated_at', lastUpdatedAt)
      .select()

    if (deductErr || !updateData || updateData.length === 0) {
      return { success: false, error: 'Conflicto de transacción concurrente. Por favor, intenta de nuevo.' }
    }

    // 4. Create withdrawal record
    const { data: withdrawal, error: insertError } = await adminSupabase
      .from('withdrawals')
      .insert({
        user_id: user.id,
        amount: parsedAmount,
        usd_amount: usdAmount,
        paypal_email: paypalEmail.trim(),
        status: 'pending'
      })
      .select()
      .single()

    if (insertError || !withdrawal) {
      // Rollback balance on error
      await adminSupabase.from('profiles').update({ balance: currentBalance }).eq('id', user.id)
      return { success: false, error: 'Error al registrar la solicitud de retiro en el sistema.' }
    }

    // 5. Send automated PayPal Payout
    try {
      await sendPayPalPayout(paypalEmail.trim(), usdAmount)

      // Mark withdrawal as completed
      await adminSupabase
        .from('withdrawals')
        .update({ status: 'completed' })
        .eq('id', withdrawal.id)

      // Record coin transaction (with fallback check)
      let txType = 'withdrawal'
      try {
        const { error: txErr } = await adminSupabase
          .from('coin_transactions')
          .insert({
            user_id: user.id,
            amount: -parsedAmount,
            type: txType,
            reference_id: withdrawal.id
          })

        if (txErr) {
          // Fallback to bet_placed if constraint fails
          await adminSupabase
            .from('coin_transactions')
            .insert({
              user_id: user.id,
              amount: -parsedAmount,
              type: 'bet_placed',
              reference_id: withdrawal.id
            })
        }
      } catch (err) {
        await adminSupabase
          .from('coin_transactions')
          .insert({
            user_id: user.id,
            amount: -parsedAmount,
            type: 'bet_placed',
            reference_id: withdrawal.id
          })
      }

      // Send email receipt
      if (user.email) {
        await sendTransactionReceiptEmail({
          email: user.email,
          username: profile.username || 'Usuario',
          amount: -parsedAmount,
          type: 'withdrawal',
          referenceId: withdrawal.id,
          balanceBefore: currentBalance,
          balanceAfter: temporaryBalance,
          description: `Retiro de fondos aprobado y enviado a la cuenta PayPal ${paypalEmail}`
        }).catch(err => {
          console.error('Error sending withdrawal receipt email:', err)
        })
      }

      revalidatePath('/wallet')
      return { success: true, newBalance: temporaryBalance }

    } catch (payoutErr: any) {
      console.error('PayPal Payout processing failed:', payoutErr)
      const errorMsg = payoutErr.message || 'Error en la API de PayPal'

      // Mark withdrawal as failed
      await adminSupabase
        .from('withdrawals')
        .update({
          status: 'failed',
          error_message: errorMsg
        })
        .eq('id', withdrawal.id)

      // Revert balance to original amount
      await adminSupabase
        .from('profiles')
        .update({ balance: currentBalance })
        .eq('id', user.id)

      let userFriendlyDetail = errorMsg
      if (errorMsg.includes('AUTHORIZATION_ERROR')) {
        userFriendlyDetail = 'La función de envíos automáticos (PayPal Payouts) no está activada en tu App de PayPal Live. Actívala en developer.paypal.com en las características de tu App.'
      } else if (errorMsg.includes('INSUFFICIENT_FUNDS')) {
        userFriendlyDetail = 'Fondos insuficientes en el balance de PayPal de la plataforma.'
      }

      return {
        success: false,
        error: `El retiro automático falló. Tu saldo ha sido restablecido de forma segura. Motivo: ${userFriendlyDetail}`
      }
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Ocurrió un error inesperado al procesar el retiro.' }
  }
}
