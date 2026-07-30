import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createPayPalOrder } from '@/lib/paypal'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { amount } = await req.json()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
    }

    // 1. Create order in PayPal
    const order = await createPayPalOrder(parsedAmount, 'USD')



    return NextResponse.json({ id: order.id })
  } catch (err: any) {
    console.error('PayPal create-order API error:', err)
    return NextResponse.json({ error: err.message || 'Error al crear orden de PayPal' }, { status: 500 })
  }
}
