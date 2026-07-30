import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPayPalOrder } from '@/lib/paypal'

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

    const { planId } = await req.json()
    const plan = PLANS[planId as keyof typeof PLANS]

    if (!plan) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }

    // 1. Create order in PayPal using our existing integration
    const order = await createPayPalOrder(plan.amount, 'USD')

    return NextResponse.json({ id: order.id })
  } catch (err: any) {
    console.error('PayPal create-subscription API error:', err)
    return NextResponse.json({ error: err.message || 'Error al crear orden de suscripción' }, { status: 500 })
  }
}
