import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { capturePayPalPayment } from '@/lib/paypal'
import { revalidatePath } from 'next/cache'

async function generateUniqueUsername(baseName: string, supabase: any): Promise<string> {
  const clean = baseName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)
  const rand = Math.floor(1000 + Math.random() * 9000)
  const candidate = `${clean}${rand}`
  const { data } = await supabase.from('profiles').select('username').eq('username', candidate).maybeSingle()
  if (!data) return candidate
  return generateUniqueUsername(baseName, supabase)
}

export async function POST(req: Request) {
  try {
    const { orderID, raffleId, buyerName, buyerPhone, buyerEmail, ticketNumbers, promoCode } = await req.json()

    if (!orderID || !raffleId || !buyerName || !buyerPhone || !ticketNumbers || !Array.isArray(ticketNumbers)) {
      return NextResponse.json({ error: 'Datos inválidos o incompletos' }, { status: 400 })
    }

    const adminSupabase = await createAdminClient()

    // 1. Capture order in PayPal
    const captureData = await capturePayPalPayment(orderID)

    if (captureData.status !== 'COMPLETED') {
      return NextResponse.json({ error: `La orden de PayPal no fue completada. Estado: ${captureData.status}` }, { status: 400 })
    }

    // 2. Fetch raffle details
    const { data: raffle } = await adminSupabase
      .from('raffles')
      .select('status, title, ticket_price')
      .eq('id', raffleId)
      .single()

    if (!raffle || raffle.status !== 'active') {
      return NextResponse.json({ error: 'El sorteo no está activo o ya finalizó.' }, { status: 400 })
    }

    // 3. Validate promo code
    let promoSellerId = null
    let discountAmountPerTicket = 0
    let validatedCode = null

    if (promoCode) {
      const cleanCode = promoCode.trim().toUpperCase()
      const { data: pcDetails } = await adminSupabase
        .from('raffle_promo_codes')
        .select('*')
        .eq('code', cleanCode)
        .eq('raffle_id', raffleId)
        .eq('is_active', true)
        .maybeSingle()

      if (pcDetails) {
        promoSellerId = pcDetails.seller_id || null
        validatedCode = pcDetails.code
        if (pcDetails.discount_percent > 0 && raffle.ticket_price) {
          discountAmountPerTicket = (raffle.ticket_price * pcDetails.discount_percent) / 100
        }
      }
    }

    // 4. Generate email placeholder if not provided
    let finalEmail = buyerEmail?.trim()
    if (!finalEmail) {
      const sanitizedName = buyerName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
      const sanitizedPhone = (buyerPhone || '').replace(/\D/g, '')
      const randSuffix = Math.random().toString(36).substring(2, 6)
      finalEmail = `${sanitizedName}${sanitizedPhone ? `.${sanitizedPhone}` : ''}.${randSuffix}@manual.kronix.do`
    }

    // 5. Search or create user
    let targetUserId = null

    // Fetch profile by email
    const { data: targetProfile } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('email', finalEmail)
      .maybeSingle()

    if (targetProfile?.id) {
      targetUserId = targetProfile.id
    }

    if (!targetUserId && buyerPhone) {
      const sanitizedPhoneSearch = buyerPhone.replace(/\D/g, '')
      const { data: ticketMatch } = await adminSupabase
        .from('tickets')
        .select('user_id')
        .or(`buyer_phone.eq.${buyerPhone},buyer_phone.eq.${sanitizedPhoneSearch}`)
        .not('user_id', 'is', null)
        .limit(1)
        .maybeSingle()
      
      if (ticketMatch?.user_id) {
        targetUserId = ticketMatch.user_id
      }
    }

    if (!targetUserId) {
      const { data: authData } = await adminSupabase.auth.admin.listUsers({
        perPage: 1000
      })
      const match = authData?.users?.find(
        (u: any) => u.email?.toLowerCase() === finalEmail.toLowerCase()
      )
      if (match?.id) {
        targetUserId = match.id
      }
    }

    if (!targetUserId) {
      const tempPassword = Math.random().toString(36).substring(2, 10) + 'Kx!'
      const { data: authRes, error: createErr } = await adminSupabase.auth.admin.createUser({
        email: finalEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          username: buyerName,
          phone: buyerPhone
        }
      })

      if (!createErr && authRes?.user) {
        targetUserId = authRes.user.id
      }
    }

    if (targetUserId) {
      const { data: currentProfile } = await adminSupabase
        .from('profiles')
        .select('username')
        .eq('id', targetUserId)
        .maybeSingle()

      let finalUsername = currentProfile?.username
      if (!finalUsername) {
        finalUsername = await generateUniqueUsername(buyerName, adminSupabase)
      }

      await adminSupabase
        .from('profiles')
        .upsert({ 
          id: targetUserId,
          email: finalEmail, 
          username: finalUsername, 
          role: 'USER' 
        })
    }

    // 6. Insert verified tickets
    const ticketsToInsert = ticketNumbers.map(num => ({
      raffle_id: raffleId,
      user_id: targetUserId,
      ticket_number: num,
      buyer_name: buyerName,
      buyer_email: finalEmail,
      buyer_phone: buyerPhone || '',
      payment_status: 'verified',
      receipt_url: 'paypal_direct',
      seller_id: promoSellerId,
      promo_code: validatedCode,
      discount_amount: discountAmountPerTicket
    }))

    const { error: insErr } = await adminSupabase
      .from('tickets')
      .insert(ticketsToInsert)

    if (insErr) {
      return NextResponse.json({ error: `Error al registrar boletos: ${insErr.message}` }, { status: 500 })
    }

    // 7. Send confirmation email
    try {
      const { sendTicketConfirmedEmail } = await import('@/lib/services/email')
      await sendTicketConfirmedEmail({
        email: finalEmail,
        buyerName,
        raffleName: raffle.title,
        ticketNumbers,
      })
    } catch (mailErr) {
      console.error('Error al enviar correo de confirmación directa de PayPal:', mailErr)
    }

    revalidatePath(`/raffles/${raffleId}`)
    revalidatePath('/raffles/my-tickets')

    return NextResponse.json({ success: true, ticketNumbers })
  } catch (err: any) {
    console.error('PayPal capture-order API error for raffle:', err)
    return NextResponse.json({ error: err.message || 'Error al procesar el pago de PayPal' }, { status: 500 })
  }
}
