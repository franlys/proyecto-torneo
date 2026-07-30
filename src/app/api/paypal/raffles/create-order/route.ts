import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createPayPalOrder } from '@/lib/paypal'
import { getUsdToDopRate } from '@/lib/services/exchange-rate'

export async function POST(req: Request) {
  try {
    const { raffleId, ticketCount, promoCode } = await req.json()
    const parsedCount = parseInt(ticketCount, 10)

    if (!raffleId || isNaN(parsedCount) || parsedCount <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const adminSupabase = await createAdminClient()

    // 1. Fetch raffle details
    const { data: raffle, error: raffleErr } = await adminSupabase
      .from('raffles')
      .select('status, ticket_price')
      .eq('id', raffleId)
      .single()

    if (raffleErr || !raffle) {
      return NextResponse.json({ error: 'Sorteo no encontrado' }, { status: 404 })
    }

    if (raffle.status !== 'active') {
      return NextResponse.json({ error: 'El sorteo no está activo' }, { status: 400 })
    }

    // 2. Validate discount/promo code
    let discountAmountPerTicket = 0
    if (promoCode) {
      const cleanCode = promoCode.trim().toUpperCase()
      const { data: pcDetails } = await adminSupabase
        .from('raffle_promo_codes')
        .select('discount_percent, is_active')
        .eq('code', cleanCode)
        .eq('raffle_id', raffleId)
        .eq('is_active', true)
        .maybeSingle()

      if (pcDetails && pcDetails.discount_percent > 0) {
        discountAmountPerTicket = (parseFloat(raffle.ticket_price) * pcDetails.discount_percent) / 100
      }
    }

    // 3. Compute total DOP amount
    const pricePerTicket = Math.max(0, parseFloat(raffle.ticket_price) - discountAmountPerTicket)
    const totalDopAmount = pricePerTicket * parsedCount

    // 4. Convert DOP amount to USD
    const rate = await getUsdToDopRate()
    const totalUsdAmount = parseFloat((totalDopAmount / rate).toFixed(2))

    if (totalUsdAmount <= 0.05) {
      return NextResponse.json({ error: 'Monto de compra demasiado bajo para procesar con PayPal' }, { status: 400 })
    }

    // 5. Create order in PayPal
    const order = await createPayPalOrder(totalUsdAmount, 'USD')

    return NextResponse.json({ id: order.id, amountUSD: totalUsdAmount, rateUsed: rate })
  } catch (err: any) {
    console.error('PayPal create-order API error for raffle:', err)
    return NextResponse.json({ error: err.message || 'Error al crear la orden de PayPal' }, { status: 500 })
  }
}
