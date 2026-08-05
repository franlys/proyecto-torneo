import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { capturePayPalPayment } from '@/lib/paypal'
import { getUsdToDopRate } from '@/lib/services/exchange-rate'
import { sendTransactionReceiptEmail } from '@/lib/services/email'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { orderID } = await req.json()
    if (!orderID) {
      return NextResponse.json({ error: 'Falta orderID' }, { status: 400 })
    }

    const adminSupabase = await createAdminClient()

    // 1. Check if this transaction has already been registered
    const { data: existingDeposit } = await adminSupabase
      .from('deposits')
      .select('id')
      .eq('gateway_tx_id', orderID)
      .maybeSingle()

    if (existingDeposit) {
      return NextResponse.json({ error: 'Este pago de PayPal ya fue procesado e ingresado previamente.' }, { status: 400 })
    }

    // 2. Capture order in PayPal
    const captureData = await capturePayPalPayment(orderID)

    if (captureData.status !== 'COMPLETED') {
      return NextResponse.json({ error: `La orden de PayPal no fue completada. Estado: ${captureData.status}` }, { status: 400 })
    }

    // 3. Extract captured amount from captureData
    const captureAmountVal = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value
    const depositAmount = parseFloat(captureAmountVal || '0')
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return NextResponse.json({ error: 'El monto capturado de PayPal no es válido.' }, { status: 400 })
    }

    const rate = await getUsdToDopRate()
    const dopAmount = parseFloat((depositAmount * rate).toFixed(2)) // Converted amount in DOP (K-Coins)

    // 4. Insert COMPLETED deposit directly in database
    const { data: deposit, error: insertDepositErr } = await adminSupabase
      .from('deposits')
      .insert({
        user_id: user.id,
        amount: depositAmount,
        currency: 'USD',
        gateway: 'paypal',
        gateway_tx_id: orderID,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertDepositErr || !deposit) {
      throw new Error(`Error inserting completed deposit: ${insertDepositErr?.message || 'Unknown error'}`)
    }

    // Fetch user's current profile balance
    const { data: profile, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('balance, username')
      .eq('id', user.id)
      .single()

    if (profileErr) {
      throw new Error(`Error fetching profile: ${profileErr.message}`)
    }

    const currentBalance = parseFloat(profile.balance || '0.00')
    const newBalance = currentBalance + dopAmount

    // Update profile balance
    const { error: updateProfileErr } = await adminSupabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', user.id)

    if (updateProfileErr) {
      throw new Error(`Error updating profile balance: ${updateProfileErr.message}`)
    }

    // Record coin transaction
    const { error: txError } = await adminSupabase
      .from('coin_transactions')
      .insert({
        user_id: user.id,
        amount: dopAmount,
        type: 'deposit',
        reference_id: deposit.id
      })

    if (txError) {
      console.error('Error inserting coin transaction:', txError.message)
    }

    if (user.email) {
      // Send both legacy recharge email and the new detailed transaction receipt
      import('@/lib/email').then(({ sendWalletRechargeEmail }) => {
        sendWalletRechargeEmail(user.email!, dopAmount)
      }).catch(e => console.error("Error sending recharge email:", e))

      sendTransactionReceiptEmail({
        email: user.email,
        username: profile.username || 'Usuario',
        amount: dopAmount,
        type: 'deposit',
        referenceId: deposit.id,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: `Recarga de fondos exitosa mediante PayPal de $${(dopAmount / rate).toFixed(2)} USD`
      }).catch(err => {
        console.error('Error sending deposit receipt email:', err)
      })
    }

    return NextResponse.json({ success: true, balance: newBalance, dopAmount, rate })
  } catch (err: any) {
    console.error('PayPal capture-order API error:', err)
    return NextResponse.json({ error: err.message || 'Error al procesar el pago de PayPal' }, { status: 500 })
  }
}
