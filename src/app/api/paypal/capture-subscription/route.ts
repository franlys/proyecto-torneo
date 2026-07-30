import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { capturePayPalPayment } from '@/lib/paypal'

const PLANS = {
  '1_month': { amount: 5.00, duration: 30 },
  '3_months': { amount: 13.00, duration: 90 },
  '1_year': { amount: 50.00, duration: 365 }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { orderID, planId } = await req.json()
    const plan = PLANS[planId as keyof typeof PLANS]

    if (!orderID || !plan) {
      return NextResponse.json({ error: 'Faltan parámetros o plan inválido' }, { status: 400 })
    }

    // 1. Capture order in PayPal
    const capture = await capturePayPalPayment(orderID)
    if (capture.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'El pago no se completó' }, { status: 400 })
    }

    // 2. Perform DB Updates using Admin Client
    const adminSupabase = await createAdminClient()

    // Retrieve current profile to check if already active and get current expiry
    const { data: profile, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('subscription_status, subscription_expiry')
      .eq('id', user.id)
      .single()
      
    if (profileErr) throw profileErr

    // Calculate new expiry date
    let newExpiry = new Date()
    // If they already have an active subscription with time left, add to it
    if (profile.subscription_status === 'ACTIVE' && profile.subscription_expiry) {
      const currentExpiry = new Date(profile.subscription_expiry)
      if (currentExpiry > newExpiry) {
        newExpiry = currentExpiry
      }
    }
    // Add plan duration in days
    newExpiry.setDate(newExpiry.getDate() + plan.duration)

    // Update profile
    const { error: updateErr } = await adminSupabase
      .from('profiles')
      .update({ 
        subscription_status: 'ACTIVE',
        subscription_expiry: newExpiry.toISOString() 
      })
      .eq('id', user.id)

    if (updateErr) throw updateErr

    // Log the purchase
    const { error: insertErr } = await adminSupabase
      .from('subscription_purchases')
      .insert({
        user_id: user.id,
        plan_duration: plan.duration,
        amount_paid: plan.amount,
        paypal_order_id: orderID
      })

    // It's okay if insertErr fails slightly (logging issue), the user got the subscription
    if (insertErr) {
      console.error('Failed to log subscription purchase:', insertErr)
    }

    return NextResponse.json({ success: true, expiry: newExpiry.toISOString() })
  } catch (err: any) {
    console.error('PayPal capture-subscription API error:', err)
    return NextResponse.json({ error: err.message || 'Error al procesar el pago' }, { status: 500 })
  }
}
