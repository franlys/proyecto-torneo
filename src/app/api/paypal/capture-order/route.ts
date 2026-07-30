import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { capturePayPalPayment } from '@/lib/paypal'
import { getUsdToDopRate } from '@/lib/services/exchange-rate'

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

    // Find the pending deposit record first
    const { data: deposit, error: findError } = await adminSupabase
      .from('deposits')
      .select('*')
      .eq('gateway_tx_id', orderID)
      .maybeSingle()

    if (findError || !deposit) {
      return NextResponse.json({ error: 'Depósito no registrado en el sistema' }, { status: 404 })
    }

    if (deposit.status === 'completed') {
      return NextResponse.json({ success: true, message: 'El depósito ya fue completado previamente' })
    }

    // 1. Capture order in PayPal
    const captureData = await capturePayPalPayment(orderID)

    if (captureData.status !== 'COMPLETED') {
      // Mark deposit as failed in db
      await adminSupabase
        .from('deposits')
        .update({ status: 'failed' })
        .eq('gateway_tx_id', orderID)

      return NextResponse.json({ error: `La orden de PayPal no fue completada. Estado: ${captureData.status}` }, { status: 400 })
    }

    // 2. Perform wallet recharge inside transaction
    const depositAmount = parseFloat(deposit.amount) // Amount in USD
    const rate = await getUsdToDopRate()
    const dopAmount = parseFloat((depositAmount * rate).toFixed(2)) // Converted amount in DOP (K-Coins)

    // Update deposit status
    const { error: updateDepositErr } = await adminSupabase
      .from('deposits')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('gateway_tx_id', orderID)

    if (updateDepositErr) {
      throw new Error(`Error updating deposit: ${updateDepositErr.message}`)
    }

    // Fetch user's current profile balance
    const { data: profile, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('balance')
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
      // We don't rollback since balance was updated, but we log the audit error
    }

    return NextResponse.json({ success: true, balance: newBalance, dopAmount, rate })
  } catch (err: any) {
    console.error('PayPal capture-order API error:', err)
    return NextResponse.json({ error: err.message || 'Error al procesar el pago de PayPal' }, { status: 500 })
  }
}
