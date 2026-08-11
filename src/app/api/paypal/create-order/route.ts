import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPayPalOrder } from '@/lib/paypal'
import { calculatePayPalGrossAmount } from '@/lib/services/paypal-fee'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { amount, isGross } = await req.json()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
    }

    // Si ya es un monto bruto, usarlo directamente; si es neto, calcular con la comisión de pasarela
    const { grossAmount, fee, netAmount } = isGross 
      ? { grossAmount: parsedAmount, fee: 0, netAmount: parsedAmount }
      : calculatePayPalGrossAmount(parsedAmount)

    // 1. Create order in PayPal with gross amount
    const order = await createPayPalOrder(grossAmount, 'USD')

    return NextResponse.json({ id: order.id, grossAmount, fee, netAmount })
  } catch (err: any) {
    console.error('PayPal create-order API error:', err)
    return NextResponse.json({ error: err.message || 'Error al crear orden de PayPal' }, { status: 500 })
  }
}
