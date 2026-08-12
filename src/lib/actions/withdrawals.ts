'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUsdToDopRate } from '@/lib/services/exchange-rate'
import { sendPayPalPayout } from '@/lib/paypal'
import { revalidatePath } from 'next/cache'
import { sendTransactionReceiptEmail, sendAdminWithdrawalAlertEmail, sendWithdrawalCompletedUserEmail } from '@/lib/services/email'

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

    // Enviar alerta inmediata por correo al Administrador
    try {
      const { data: admins } = await adminSupabase.from('profiles').select('email').eq('role', 'admin')
      const adminEmailList = (admins || []).map((a: any) => a.email).filter(Boolean)

      sendAdminWithdrawalAlertEmail({
        adminEmails: adminEmailList,
        username: profile.username || 'Usuario',
        userEmail: user.email || '',
        amountCoins: parsedAmount,
        amountUsd: usdAmount,
        paypalEmail: paypalEmail.trim(),
        withdrawalId: withdrawal.id,
      }).catch(e => console.error('Error sending admin withdrawal email:', e))
    } catch (e) {
      console.error('Error fetching admin emails:', e)
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

      // Send email receipt to user
      const targetUserEmail = user.email || paypalEmail.trim()
      if (targetUserEmail) {
        await sendWithdrawalCompletedUserEmail({
          userEmail: targetUserEmail,
          username: profile.username || 'Competidor',
          amountCoins: parsedAmount,
          amountUsd: usdAmount,
          paypalEmail: paypalEmail.trim(),
          withdrawalId: withdrawal.id,
        }).catch(err => {
          console.error('Error sending withdrawal completed email:', err)
        })
      }

      revalidatePath('/wallet')
      return { success: true, newBalance: temporaryBalance }

    } catch (payoutErr: any) {
      console.warn('PayPal Automated Payout failed, keeping as pending for admin processing:', payoutErr)
      const errorMsg = payoutErr.message || 'Error en la API de PayPal'

      // Registrar la transacción de descuento para mantener los K-Coins reservados
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
          await adminSupabase.from('coin_transactions').insert({
            user_id: user.id,
            amount: -parsedAmount,
            type: 'bet_placed',
            reference_id: withdrawal.id
          })
        }
      } catch (err) {
        await adminSupabase.from('coin_transactions').insert({
          user_id: user.id,
          amount: -parsedAmount,
          type: 'bet_placed',
          reference_id: withdrawal.id
        })
      }

      // Dejar la solicitud en estado 'pending' para envío manual por el administrador
      await adminSupabase
        .from('withdrawals')
        .update({
          status: 'pending',
          error_message: 'Pendiente de envío manual por el administrador'
        })
        .eq('id', withdrawal.id)

      if (user.email) {
        await sendTransactionReceiptEmail({
          email: user.email,
          username: profile.username || 'Usuario',
          amount: -parsedAmount,
          type: 'withdrawal',
          referenceId: withdrawal.id,
          balanceBefore: currentBalance,
          balanceAfter: temporaryBalance,
          description: `Solicitud de retiro de $${usdAmount} USD recibida. En proceso de envío a ${paypalEmail}.`
        }).catch(err => console.error('Receipt error:', err))
      }

      revalidatePath('/wallet')
      return { 
        success: true, 
        newBalance: temporaryBalance,
        error: undefined
      }
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Ocurrió un error inesperado al procesar el retiro.' }
  }
}

export async function approveWithdrawalAction(withdrawalId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { isAdmin } = await import('@/lib/actions/auth-helpers')
    if (!(await isAdmin())) return { error: 'Permisos insuficientes' }

    const adminSupabase = await createAdminClient()

    const { data: withdrawal, error: fetchErr } = await adminSupabase
      .from('withdrawals')
      .select('*, profiles:user_id(username, email)')
      .eq('id', withdrawalId)
      .single()

    if (fetchErr || !withdrawal) return { error: 'Retiro no encontrado' }
    if (withdrawal.status === 'completed') return { error: 'El retiro ya fue completado' }

    // Actualizar estado a completado
    await adminSupabase
      .from('withdrawals')
      .update({
        status: 'completed',
        error_message: null
      })
      .eq('id', withdrawalId)

    // Notificar al usuario por email de retiro completado
    const recipientEmail = withdrawal.profiles?.email || withdrawal.paypal_email
    if (recipientEmail) {
      sendWithdrawalCompletedUserEmail({
        userEmail: recipientEmail,
        username: withdrawal.profiles?.username || 'Competidor',
        amountCoins: Number(withdrawal.amount),
        amountUsd: Number(withdrawal.usd_amount),
        paypalEmail: withdrawal.paypal_email,
        withdrawalId: withdrawal.id,
      }).catch(err => {
        console.error('Error sending withdrawal completed email to user:', err)
      })
    }

    revalidatePath('/admin/finance')
    revalidatePath('/wallet')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al aprobar el retiro' }
  }
}

export async function rejectWithdrawalAction(withdrawalId: string, reason?: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const adminSupabase = await createAdminClient()
    const { isAdmin } = await import('@/lib/actions/auth-helpers')
    if (!(await isAdmin())) return { error: 'Permisos insuficientes' }

    const { data: withdrawal, error: fetchErr } = await adminSupabase
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single()

    if (fetchErr || !withdrawal) return { error: 'Retiro no encontrado' }
    if (withdrawal.status === 'completed') return { error: 'No se puede rechazar un retiro ya completado' }

    // 1. Reembolsar saldo de K-Coins al usuario
    const { data: profile } = await adminSupabase.from('profiles').select('balance').eq('id', withdrawal.user_id).single()
    const currentBal = Number(profile?.balance || 0)
    const refundAmount = Number(withdrawal.amount)
    const newBal = currentBal + refundAmount

    await adminSupabase.from('profiles').update({ balance: newBal }).eq('id', withdrawal.user_id)

    // 2. Registrar transacción de reembolso
    await adminSupabase.from('coin_transactions').insert({
      user_id: withdrawal.user_id,
      amount: refundAmount,
      type: 'deposit',
      reference_id: withdrawal.id
    })

    // 3. Marcar retiro como fallido/rechazado
    await adminSupabase
      .from('withdrawals')
      .update({
        status: 'failed',
        error_message: reason || 'Retiro rechazado por el administrador. Fondos reembolsados a tu billetera.'
      })
      .eq('id', withdrawalId)

    revalidatePath('/admin/finance')
    revalidatePath('/wallet')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al rechazar el retiro' }
  }
}
