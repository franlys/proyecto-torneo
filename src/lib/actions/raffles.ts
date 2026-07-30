'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendRefundRequestedEmail, sendRefundProcessedEmail } from '@/lib/email'

export async function isSystemAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN'
}

export async function getRaffles() {
  try {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
      .from('raffles')
      .select('*, tickets(payment_status, is_bonus)')
      .order('created_at', { ascending: false })
    if (error) return { error: error.message }
    return { data: data || [] }
  } catch (err: any) {
    return { error: err.message || 'Error desconocido' }
  }
}

export async function getRaffle(id: string) {
  try {
     const supabase = await createAdminClient()
     const { data: raffle, error: rErr } = await supabase
       .from('raffles')
       .select('*')
       .eq('id', id)
       .single()
     if (rErr || !raffle) return { error: 'Sorteo no encontrado' }
     
     // Obtener boletos ocupados de este sorteo (solo datos necesarios para el grid público)
     const { data: tickets, error: tErr } = await supabase
       .from('tickets')
       .select('id, ticket_number, payment_status, is_bonus')
       .eq('raffle_id', id)
       
     if (tErr) return { error: tErr.message }
 
     return { 
       data: raffle, 
       tickets: tickets || [] 
     }
  } catch (err: any) {
    return { error: err.message || 'Error desconocido' }
  }
}

export async function getRaffleForAdmin(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    if (!(await isSystemAdmin(user.id))) return { error: 'Sin permisos de administrador' }

    const adminSupabase = await createAdminClient()
    const { data: raffle, error: rErr } = await adminSupabase
      .from('raffles')
      .select('*')
      .eq('id', id)
      .single()
    if (rErr || !raffle) return { error: 'Sorteo no encontrado' }

    // Obtener todos los campos de los boletos para el administrador (con datos del comprador y comprobantes)
    const { data: tickets, error: tErr } = await adminSupabase
      .from('tickets')
      .select('id, ticket_number, payment_status, buyer_name, buyer_email, buyer_phone, receipt_url')
      .eq('raffle_id', id)

    if (tErr) return { error: tErr.message }

    return { 
      data: raffle, 
      tickets: tickets || [] 
    }
  } catch (err: any) {
    return { error: err.message || 'Error desconocido' }
  }
}

export async function createRaffleAction(data: {
  title: string
  description: string
  drawDate: string
  ticketPrice: number
  currency?: string
  totalTickets?: number
  prizeImage?: string
  paymentBankName: string
  paymentAccountHolder: string
  paymentBankId: string
  paymentDetails?: string
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }
    
    if (!(await isSystemAdmin(user.id))) return { error: 'Sin permisos de administrador' }
    
    const adminSupabase = await createAdminClient()
    const { data: newRaffle, error } = await adminSupabase
      .from('raffles')
      .insert({
        title: data.title,
        description: data.description,
        draw_date: new Date(data.drawDate).toISOString(),
        ticket_price: data.ticketPrice,
        currency: data.currency || 'RD$',
        total_tickets: data.totalTickets || 1000,
        status: 'active',
        prize_image: data.prizeImage || null,
        payment_bank_name: data.paymentBankName,
        payment_account_holder: data.paymentAccountHolder,
        payment_bank_id: data.paymentBankId,
        payment_details: data.paymentDetails || null
      })
      .select()
      .single()
       
    if (error) return { error: error.message }
     
    revalidatePath('/raffles')
    revalidatePath('/admin/raffles')
    return { data: newRaffle }
  } catch (err: any) {
    return { error: err.message || 'Error al crear el sorteo' }
  }
}

export async function updateRaffleAction(
  id: string,
  data: Partial<{
    title: string
    description: string
    drawDate: string
    ticketPrice: number
    currency: string
    totalTickets: number
    prizeImage: string
    paymentBankName: string
    paymentAccountHolder: string
    paymentBankId: string
    paymentDetails: string
  }>
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }
    
    if (!(await isSystemAdmin(user.id))) return { error: 'Sin permisos de administrador' }
    
    const adminSupabase = await createAdminClient()
    
    const updatePayload: Record<string, any> = {}
    if (data.title !== undefined) updatePayload.title = data.title
    if (data.description !== undefined) updatePayload.description = data.description
    if (data.drawDate !== undefined) updatePayload.draw_date = new Date(data.drawDate).toISOString()
    if (data.ticketPrice !== undefined) updatePayload.ticket_price = data.ticketPrice
    if (data.currency !== undefined) updatePayload.currency = data.currency
    if (data.totalTickets !== undefined) updatePayload.total_tickets = data.totalTickets
    if (data.prizeImage !== undefined) updatePayload.prize_image = data.prizeImage || null
    if (data.paymentBankName !== undefined) updatePayload.payment_bank_name = data.paymentBankName
    if (data.paymentAccountHolder !== undefined) updatePayload.payment_account_holder = data.paymentAccountHolder
    if (data.paymentBankId !== undefined) updatePayload.payment_bank_id = data.paymentBankId
    if (data.paymentDetails !== undefined) updatePayload.payment_details = data.paymentDetails || null

    const { data: updatedRaffle, error } = await adminSupabase
      .from('raffles')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()
       
    if (error) return { error: error.message }
     
    revalidatePath(`/raffles/${id}`)
    revalidatePath(`/admin/raffles/${id}`)
    revalidatePath('/raffles')
    return { data: updatedRaffle }
  } catch (err: any) {
    return { error: err.message || 'Error al actualizar el sorteo' }
  }
}

export async function deleteRaffleAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }
    
    if (!(await isSystemAdmin(user.id))) return { error: 'Sin permisos de administrador' }
    
    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase
      .from('raffles')
      .delete()
      .eq('id', id)
       
    if (error) return { error: error.message }
     
    revalidatePath('/raffles')
    revalidatePath('/admin/raffles')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al eliminar el sorteo' }
  }
}

export async function buyTicketAction(
  raffleId: string,
  ticketNumbers: string[],
  receiptUrl: string,
  promoCode?: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Debes iniciar sesión para comprar boletos.' }
     
    // Obtener detalles del comprador desde profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', user.id)
      .single()
       
    const buyerName = profile?.username || user.user_metadata?.username || 'Usuario Kronix'
    const buyerEmail = profile?.email || user.email || ''
    const buyerPhone = user.user_metadata?.phone || ''
     
    if (!buyerEmail) {
      return { error: 'Tu cuenta de usuario debe tener un correo electrónico asociado.' }
    }

    // 1. Validar estado del sorteo
    const { data: raffle } = await supabase
      .from('raffles')
      .select('status, title, ticket_price')
      .eq('id', raffleId)
      .single()
       
    if (!raffle || raffle.status !== 'active') {
      return { error: 'El sorteo no está activo o ya finalizó.' }
    }

    // Validar código promocional si se proporciona
    let promoSellerId = null
    let discountAmountPerTicket = 0
    let validatedCode = null

    if (promoCode) {
      const cleanCode = promoCode.trim().toUpperCase()
      const { data: pcDetails } = await supabase
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
     
    // 2. Validar disponibilidad de los números
    const { data: existing } = await supabase
      .from('tickets')
      .select('ticket_number')
      .eq('raffle_id', raffleId)
      .in('ticket_number', ticketNumbers)
       
    if (existing && existing.length > 0) {
      const numbers = existing.map(t => t.ticket_number).join(', ')
      return { error: `Los siguientes boletos ya han sido reservados: ${numbers}` }
    }
     
    // 3. Insertar boletos
    const adminSupabase = await createAdminClient()
    const ticketsToInsert = ticketNumbers.map(num => ({
      raffle_id: raffleId,
      user_id: user.id,
      ticket_number: num,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      payment_status: 'pending_verification',
      receipt_url: receiptUrl,
      seller_id: promoSellerId,
      promo_code: validatedCode,
      discount_amount: discountAmountPerTicket
    }))
     
    const { error: insErr } = await adminSupabase
      .from('tickets')
      .insert(ticketsToInsert)
       
    if (insErr) return { error: insErr.message }
     
    // 4. Enviar correo de confirmación de reserva
    try {
      const { sendTicketPendingEmail } = await import('@/lib/services/email')
      await sendTicketPendingEmail({
        email: buyerEmail,
        buyerName,
        raffleName: raffle.title,
        ticketNumbers,
      })
    } catch (mailErr) {
      console.error('Error al enviar correo de reserva de boleto:', mailErr)
    }

    // 5. Enviar correo de notificación al administrador
    try {
      const { sendAdminTicketNotificationEmail } = await import('@/lib/services/email')
      await sendAdminTicketNotificationEmail({
        buyerName,
        buyerEmail,
        buyerPhone,
        raffleName: raffle.title,
        ticketNumbers,
        receiptUrl,
      })
    } catch (adminMailErr) {
      console.error('Error al enviar correo de notificación al administrador:', adminMailErr)
    }
     
    revalidatePath(`/raffles/${raffleId}`)
    revalidatePath('/raffles/my-tickets')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al procesar la compra' }
  }
}

export async function verifyTicketAction(
  raffleId: string,
  buyerEmail: string,
  receiptUrl: string,
  action: 'verify' | 'reject'
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }
    
    if (!(await isSystemAdmin(user.id))) return { error: 'Sin permisos de administrador' }
     
    const adminSupabase = await createAdminClient()
     
    // Buscar boletos pendientes con este correo y recibo
    const { data: pendingTickets } = await adminSupabase
      .from('tickets')
      .select('id, ticket_number, buyer_name')
      .eq('raffle_id', raffleId)
      .eq('buyer_email', buyerEmail)
      .eq('receipt_url', receiptUrl)
      .eq('payment_status', 'pending_verification')
       
    if (!pendingTickets || pendingTickets.length === 0) {
      return { error: 'No se encontraron boletos pendientes de verificar.' }
    }
     
    const ticketNumbers = pendingTickets.map(t => t.ticket_number)
    const buyerName = pendingTickets[0].buyer_name
     
    if (action === 'verify') {
      const { error } = await adminSupabase
        .from('tickets')
        .update({ payment_status: 'verified' })
        .in('id', pendingTickets.map(t => t.id))
         
      if (error) return { error: error.message }
       
      // Enviar correo de confirmación definitiva
      try {
        const { data: raffle } = await adminSupabase.from('raffles').select('title').eq('id', raffleId).single()
        const { sendTicketConfirmedEmail } = await import('@/lib/services/email')
        await sendTicketConfirmedEmail({
          email: buyerEmail,
          buyerName,
          raffleName: raffle?.title || 'Sorteo Kronix',
          ticketNumbers,
        })
      } catch (mailErr) {
        console.error('Error al enviar correo de confirmación de boleto:', mailErr)
      }
    } else {
      // Eliminar boletos para liberar los números
      const { error } = await adminSupabase
        .from('tickets')
        .delete()
        .in('id', pendingTickets.map(t => t.id))
         
      if (error) return { error: error.message }
    }
     
    revalidatePath(`/raffles/${raffleId}`)
    revalidatePath(`/admin/raffles/${raffleId}`)
    revalidatePath('/raffles/my-tickets')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al verificar boletos' }
  }
}

export async function drawRaffleAction(
  raffleId: string,
  winningTicketNumber: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }
    
    if (!(await isSystemAdmin(user.id))) return { error: 'Sin permisos de administrador' }
     
    const adminSupabase = await createAdminClient()
     
    // 1. Obtener boleto ganador
    const { data: winningTicket, error: tErr } = await adminSupabase
      .from('tickets')
      .select('id, buyer_name, buyer_email, buyer_phone')
      .eq('raffle_id', raffleId)
      .eq('ticket_number', winningTicketNumber)
      .eq('payment_status', 'verified')
      .single()
       
    if (tErr || !winningTicket) {
      return { error: 'El boleto ganador no es válido o no está verificado.' }
    }
     
    // 2. Finalizar sorteo
    const { data: raffle, error: rErr } = await adminSupabase
      .from('raffles')
      .update({
        status: 'finished',
        winner_ticket_id: winningTicket.id,
        winner_name: winningTicket.buyer_name,
        finished_at: new Date().toISOString()
      })
      .eq('id', raffleId)
      .select()
      .single()
       
    if (rErr) return { error: rErr.message }
     
    // 3. Enviar correo al ganador
    try {
      const { sendRaffleWinnerEmail } = await import('@/lib/services/email')
      await sendRaffleWinnerEmail({
        email: winningTicket.buyer_email,
        winnerName: winningTicket.buyer_name,
        raffleName: raffle.title,
        ticketNumber: winningTicketNumber,
      })
    } catch (mailErr) {
      console.error('Error al enviar correo del ganador del sorteo:', mailErr)
    }
     
    revalidatePath(`/raffles/${raffleId}`)
    revalidatePath(`/admin/raffles/${raffleId}`)
    revalidatePath('/raffles')
    revalidatePath('/raffles/my-tickets')
    return { success: true, winner: winningTicket.buyer_name }
  } catch (err: any) {
    return { error: err.message || 'Error al realizar el sorteo en vivo' }
  }
}

export async function getMyTickets() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const { data, error } = await supabase
      .from('tickets')
      .select('*, raffle:raffles(title, prize_image, draw_date, status, winner_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: data || [] }
  } catch (err: any) {
    return { error: err.message || 'Error desconocido' }
  }
}

export async function announceRaffleToAllUsersAction(
  raffleId: string,
  type: 'new' | 'live' = 'new'
): Promise<{ success: boolean } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const isSystemAdminUser = await isSystemAdmin(user.id)
    if (!isSystemAdminUser) return { error: 'Sin permisos de administrador' }

    const { data: raffle, error: fetchErr } = await supabase
      .from('raffles')
      .select('id, title')
      .eq('id', raffleId)
      .single()

    if (fetchErr || !raffle) return { error: 'Sorteo no encontrado' }

    const adminSupabase = await createAdminClient()
    const { data: authData, error: authErr } = await adminSupabase.auth.admin.listUsers({
      perPage: 1000
    })

    if (authErr) return { error: authErr.message }

    const emails = authData?.users
      ?.map((u: any) => u.email?.trim())
      .filter((email: any) => email && email.includes('@')) || []

    if (emails.length === 0) {
      return { error: 'No hay usuarios con correo registrado en la plataforma.' }
    }

    const { sendRaffleAnnouncementEmail } = await import('@/lib/services/email')
    const emailRes = await sendRaffleAnnouncementEmail({
      emails,
      raffleName: raffle.title,
      raffleId: raffle.id,
      prizeName: raffle.title,
      type,
    })

    if (!emailRes.success) {
      return { error: emailRes.error || 'Error al enviar los correos.' }
    }

    // Registrar en Supabase que ya se anuncio
    try {
      await supabase
        .from('raffles')
        .update({ announced_at: new Date().toISOString() } as any)
        .eq('id', raffleId)
    } catch (dbErr) {
      console.warn('announced_at column not available, skipping DB update', dbErr)
    }

    revalidatePath('/raffles')
    revalidatePath(`/admin/raffles/${raffleId}`)

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error desconocido' }
  }
}

export async function assignTicketsManuallyAction(
  raffleId: string,
  buyerName: string,
  buyerEmail: string,
  buyerPhone: string,
  count: number,
  sellerId?: string,
  isBonus?: boolean
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    if (!(await isSystemAdmin(user.id))) return { error: 'Sin permisos de administrador' }

    const adminSupabase = await createAdminClient()

    // 1. Validar sorteo
    const { data: raffle } = await adminSupabase
      .from('raffles')
      .select('status, title, total_tickets')
      .eq('id', raffleId)
      .single()

    if (!raffle) return { error: 'Sorteo no encontrado.' }

    // 2. Obtener boletos existentes para generar números libres
    const { data: existingTickets } = await adminSupabase
      .from('tickets')
      .select('ticket_number')
      .eq('raffle_id', raffleId)

    const occupiedNumbers = new Set(existingTickets?.map(t => t.ticket_number) || [])
    const ticketNumbers: string[] = []

    if (isBonus) {
      // Generar números de regalo secuenciales con prefijo 'E' (Ej: E001, E002...)
      let numSequence = 1
      while (ticketNumbers.length < count) {
        const formatted = `E${numSequence.toString().padStart(3, '0')}`
        if (!occupiedNumbers.has(formatted) && !ticketNumbers.includes(formatted)) {
          ticketNumbers.push(formatted)
        }
        numSequence++
      }
    } else {
      while (ticketNumbers.length < count) {
        const randomVal = Math.floor(Math.random() * raffle.total_tickets)
        const formatted = randomVal.toString().padStart(4, '0')
        if (!occupiedNumbers.has(formatted) && !ticketNumbers.includes(formatted)) {
          ticketNumbers.push(formatted)
        }
        if (occupiedNumbers.size + ticketNumbers.length >= raffle.total_tickets) {
          break
        }
      }
    }

    if (ticketNumbers.length < count) {
      return { error: 'No quedan suficientes boletos disponibles en este sorteo para asignar la cantidad solicitada.' }
    }

    // Buscar el id del usuario de forma robusta para asociarle el user_id (así le aparecerán en "Mis Boletos")
    let targetUserId = null
    let finalEmail = buyerEmail?.trim()

    // 1. Si no hay email, buscar primero por número de celular en tickets anteriores para reutilizar la cuenta
    if (!finalEmail && buyerPhone) {
      const sanitizedPhoneSearch = buyerPhone.replace(/\D/g, '')
      const { data: ticketMatch } = await adminSupabase
        .from('tickets')
        .select('user_id, buyer_email')
        .or(`buyer_phone.eq.${buyerPhone},buyer_phone.eq.${sanitizedPhoneSearch}`)
        .not('user_id', 'is', null)
        .limit(1)
        .maybeSingle()
      
      if (ticketMatch?.user_id) {
        targetUserId = ticketMatch.user_id
        finalEmail = ticketMatch.buyer_email || undefined
      }
    }

    // 2. Generar email placeholder si no se proporciona uno y no se encontró por teléfono
    if (!finalEmail) {
      const sanitizedName = buyerName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
      const sanitizedPhone = (buyerPhone || '').replace(/\D/g, '')
      const randSuffix = Math.random().toString(36).substring(2, 6)
      finalEmail = `${sanitizedName}${sanitizedPhone ? `.${sanitizedPhone}` : ''}.${randSuffix}@manual.kronix.do`
    }

    // 3. Intentar buscar por email en perfiles públicos
    if (!targetUserId) {
      const { data: targetProfile } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('email', finalEmail)
        .maybeSingle()
      if (targetProfile?.id) {
        targetUserId = targetProfile.id
      }
    }

    // 4. Si sigue fallando, buscar en el listado de usuarios de autenticación por email
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

    // 5. Si el usuario no existe en la plataforma, CREARLO automáticamente
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

      if (createErr) {
        return { error: `Error al registrar usuario nuevo: ${createErr.message}` }
      }

      if (authRes?.user) {
        targetUserId = authRes.user.id
      }
    }

    // 6. Asegurar SIEMPRE que el perfil público exista y esté actualizado para evitar errores de clave foránea
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

      const { error: upsertErr } = await adminSupabase
        .from('profiles')
        .upsert({ 
          id: targetUserId,
          email: finalEmail, 
          username: finalUsername, 
          role: 'USER' 
        })
      if (upsertErr) {
        return { error: `Error al registrar perfil público: ${upsertErr.message}` }
      }
    }

    // 5. Insertar boletos como verified
    const ticketsToInsert = ticketNumbers.map(num => ({
      raffle_id: raffleId,
      user_id: targetUserId,
      ticket_number: num,
      buyer_name: buyerName,
      buyer_email: finalEmail,
      buyer_phone: buyerPhone || '',
      payment_status: 'verified',
      receipt_url: isBonus ? 'bonus_gift' : 'manual_assignment',
      seller_id: sellerId || null,
      is_bonus: !!isBonus
    }))

    const { error: insErr } = await adminSupabase
      .from('tickets')
      .insert(ticketsToInsert)

    if (insErr) return { error: insErr.message }

    // 6. Enviar correo de confirmación de boletos asignados (solo a correos reales)
    if (!finalEmail.endsWith('@manual.kronix.do')) {
      try {
        const { sendTicketConfirmedEmail } = await import('@/lib/services/email')
        await sendTicketConfirmedEmail({
          email: finalEmail,
          buyerName,
          raffleName: raffle.title,
          ticketNumbers,
        })
      } catch (mailErr) {
        console.error('Error al enviar correo de confirmación:', mailErr)
      }
    }

    revalidatePath(`/raffles/${raffleId}`)
    revalidatePath(`/admin/raffles/${raffleId}`)
    revalidatePath('/raffles/my-tickets')

    return { success: true, ticketNumbers }
  } catch (err: any) {
    return { error: err.message || 'Error al asignar boletos' }
  }
}

export async function assignSellerBonusTicketsAction(
  raffleId: string,
  sellerId: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    if (!(await isSystemAdmin(user.id))) return { error: 'Sin permisos de administrador' }

    const adminSupabase = await createAdminClient()

    // 1. Obtener perfil del vendedor para tener su nombre y correo
    const { data: sellerProfile } = await adminSupabase
      .from('profiles')
      .select('username, email')
      .eq('id', sellerId)
      .single()

    if (!sellerProfile) return { error: 'Vendedor no encontrado.' }

    // 2. Contar boletos vendidos por este vendedor (excluyendo regalos)
    const { data: soldTickets, error: soldErr } = await adminSupabase
      .from('tickets')
      .select('id')
      .eq('raffle_id', raffleId)
      .eq('seller_id', sellerId)
      .eq('payment_status', 'verified')
      .eq('is_bonus', false)

    if (soldErr) return { error: soldErr.message }
    const soldCount = soldTickets?.length || 0

    // 3. Calcular boletos de regalo correspondientes
    const earnedBonusCount = Math.floor(soldCount / 10)

    // 4. Contar boletos de regalo ya entregados a este vendedor
    const { data: alreadyAssignedBonus, error: bonusErr } = await adminSupabase
      .from('tickets')
      .select('id')
      .eq('raffle_id', raffleId)
      .eq('seller_id', sellerId)
      .eq('payment_status', 'verified')
      .eq('is_bonus', true)

    if (bonusErr) return { error: bonusErr.message }
    const assignedCount = alreadyAssignedBonus?.length || 0

    // 5. Calcular cuántos boletos faltan por entregar
    const pendingToAssign = earnedBonusCount - assignedCount

    if (pendingToAssign <= 0) {
      return { error: 'Este vendedor no tiene boletos de regalo acumulados pendientes por entregar (1 regalo por cada 10 vendidos).' }
    }

    // 6. Ejecutar asignación manual de boletos usando la lógica existente
    const res = await assignTicketsManuallyAction(
      raffleId,
      sellerProfile.username || 'Vendedor',
      sellerProfile.email || '',
      '',
      pendingToAssign,
      sellerId,
      true
    )

    return res
  } catch (err: any) {
    return { error: err.message || 'Error al asignar boletos de regalo' }
  }
}

export async function getPromoCodesAction(raffleId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    if (!(await isSystemAdmin(user.id))) return { error: 'Sin permisos de administrador' }

    const adminSupabase = await createAdminClient()
    const { data, error } = await adminSupabase
      .from('raffle_promo_codes')
      .select('*, profiles(username, email)')
      .eq('raffle_id', raffleId)
      .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: data || [] }
  } catch (err: any) {
    return { error: err.message || 'Error al obtener códigos de promoción' }
  }
}

export async function createPromoCodeAction(
  raffleId: string,
  code: string,
  discountPercent: number,
  sellerId?: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    if (!(await isSystemAdmin(user.id))) return { error: 'Sin permisos de administrador' }

    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) return { error: 'El código no puede estar vacío.' }

    const adminSupabase = await createAdminClient()

    // Verificar si el código ya existe
    const { data: existing } = await adminSupabase
      .from('raffle_promo_codes')
      .select('id')
      .eq('code', cleanCode)
      .maybeSingle()

    if (existing) {
      return { error: 'Este código de promoción ya existe. Por favor utiliza uno diferente.' }
    }

    const { error } = await adminSupabase
      .from('raffle_promo_codes')
      .insert({
        raffle_id: raffleId,
        code: cleanCode,
        discount_percent: discountPercent,
        seller_id: sellerId || null
      })

    if (error) return { error: error.message }

    revalidatePath(`/admin/raffles/${raffleId}`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al crear código de promoción' }
  }
}

export async function deletePromoCodeAction(raffleId: string, promoCodeId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    if (!(await isSystemAdmin(user.id))) return { error: 'Sin permisos de administrador' }

    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase
      .from('raffle_promo_codes')
      .delete()
      .eq('id', promoCodeId)

    if (error) return { error: error.message }

    revalidatePath(`/admin/raffles/${raffleId}`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al eliminar código de promoción' }
  }
}

export async function validatePromoCodeAction(code: string, raffleId: string) {
  try {
    const supabase = await createClient()
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) return { error: 'Código vacío' }

    const { data, error } = await supabase
      .from('raffle_promo_codes')
      .select('*')
      .eq('code', cleanCode)
      .eq('raffle_id', raffleId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) return { error: error.message }
    if (!data) return { error: 'Código de descuento no válido o no aplica a este sorteo.' }

    return { 
      valid: true, 
      discountPercent: data.discount_percent,
      sellerId: data.seller_id,
      code: data.code
    }
  } catch (err: any) {
    return { error: err.message || 'Error al validar el código' }
  }
}

async function generateUniqueUsername(baseName: string, adminSupabase: any): Promise<string> {
  let cleanName = baseName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "")
    .substring(0, 15)

  if (!cleanName) {
    cleanName = "user"
  }

  let username = cleanName
  let isUnique = false
  let attempts = 0

  while (!isUnique && attempts < 10) {
    const { data } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (!data) {
      isUnique = true
    } else {
      const randomSuffix = Math.floor(100 + Math.random() * 900)
      username = `${cleanName}_${randomSuffix}`
      attempts++
    }
  }

  return username
}

export async function buyTicketPublicAction(
  raffleId: string,
  buyerName: string,
  buyerPhone: string,
  buyerEmail: string | undefined,
  ticketNumbers: string[],
  receiptUrl: string,
  promoCode?: string
) {
  try {
    const adminSupabase = await createAdminClient()

    // 1. Validar estado del sorteo
    const { data: raffle } = await adminSupabase
      .from('raffles')
      .select('status, title, ticket_price')
      .eq('id', raffleId)
      .single()
       
    if (!raffle || raffle.status !== 'active') {
      return { error: 'El sorteo no está activo o ya finalizó.' }
    }

    // 2. Validar disponibilidad de los números
    const { data: existing } = await adminSupabase
      .from('tickets')
      .select('ticket_number')
      .eq('raffle_id', raffleId)
      .in('ticket_number', ticketNumbers)
       
    if (existing && existing.length > 0) {
      const numbers = existing.map(t => t.ticket_number).join(', ')
      return { error: `Los siguientes boletos ya han sido reservados: ${numbers}` }
    }

    // Validar código promocional si se proporciona
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

    // Generar email placeholder si no se proporciona uno
    let finalEmail = buyerEmail?.trim()
    if (!finalEmail) {
      const sanitizedName = buyerName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
      const sanitizedPhone = (buyerPhone || '').replace(/\D/g, '')
      const randSuffix = Math.random().toString(36).substring(2, 6)
      finalEmail = `${sanitizedName}${sanitizedPhone ? `.${sanitizedPhone}` : ''}.${randSuffix}@manual.kronix.do`
    }

    // Buscar o crear usuario de forma robusta
    let targetUserId = null

    // 1. Buscar por email en perfiles
    const { data: targetProfile } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('email', finalEmail)
      .maybeSingle()

    if (targetProfile?.id) {
      targetUserId = targetProfile.id
    }

    // 2. Buscar por teléfono en tickets anteriores
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

    // 3. Buscar en listado de usuarios de autenticación por email (para evitar errores de duplicidad)
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

    // 4. Crear usuario si no existe
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

      if (createErr) {
        return { error: `Error al registrar perfil: ${createErr.message}` }
      }

      if (authRes?.user) {
        targetUserId = authRes.user.id
      }
    }

    // 5. Asegurar SIEMPRE que el perfil público exista y esté actualizado para evitar errores de clave foránea
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

      const { error: upsertErr } = await adminSupabase
        .from('profiles')
        .upsert({ 
          id: targetUserId,
          email: finalEmail, 
          username: finalUsername, 
          role: 'USER' 
        })
      if (upsertErr) {
        return { error: `Error al registrar perfil público: ${upsertErr.message}` }
      }
    }

    // 5. Insertar boletos
    const ticketsToInsert = ticketNumbers.map(num => ({
      raffle_id: raffleId,
      user_id: targetUserId,
      ticket_number: num,
      buyer_name: buyerName,
      buyer_email: finalEmail,
      buyer_phone: buyerPhone || '',
      payment_status: 'pending_verification',
      receipt_url: receiptUrl,
      seller_id: promoSellerId,
      promo_code: validatedCode,
      discount_amount: discountAmountPerTicket
    }))

    const { error: insErr } = await adminSupabase
      .from('tickets')
      .insert(ticketsToInsert)

    if (insErr) return { error: insErr.message }

    // 6. Enviar correos
    try {
      const { sendTicketPendingEmail } = await import('@/lib/services/email')
      await sendTicketPendingEmail({
        email: finalEmail,
        buyerName,
        raffleName: raffle.title,
        ticketNumbers,
      })
    } catch (mailErr) {
      console.error('Error al enviar correo:', mailErr)
    }

    revalidatePath(`/raffles/${raffleId}`)
    revalidatePath(`/admin/raffles/${raffleId}`)
    revalidatePath('/raffles/my-tickets')

    return { success: true, ticketNumbers }
  } catch (err: any) {
    return { error: err.message || 'Error al procesar la inscripción' }
  }
}

export async function findMyTicketsPublicAction(buyerName: string, buyerPhone: string) {
  try {
    const adminSupabase = await createAdminClient()
    const cleanPhone = buyerPhone.replace(/\D/g, '')
    const cleanName = buyerName.trim()

    if (!cleanName) return { error: 'El nombre es obligatorio.' }
    if (!cleanPhone) return { error: 'El teléfono es obligatorio.' }

    // Buscar boletos que coincidan con el nombre y teléfono
    const { data: tickets, error } = await adminSupabase
      .from('tickets')
      .select('*, raffles(title, draw_date, prize_image, status, currency, ticket_price)')
      .or(`buyer_phone.eq.${buyerPhone},buyer_phone.eq.${cleanPhone},buyer_phone.ilike.%${cleanPhone}%`)
      .ilike('buyer_name', `%${cleanName}%`)
      .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: tickets || [] }
  } catch (err: any) {
    return { error: err.message || 'Error al buscar boletos' }
  }
}

export async function requestRaffleRefundAction(input: {
  raffleId: string
  buyerName: string
  buyerPhone: string
  reason: string
  quantity?: number
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const adminSupabase = await createAdminClient()

    // 1. Fetch raffle to get ticket price
    const { data: raffle } = await adminSupabase
      .from('raffles')
      .select('ticket_price, name')
      .eq('id', input.raffleId)
      .single()

    const ticketPrice = parseFloat(raffle?.ticket_price || '0')

    // 2. Query tickets for this user
    const cleanPhone = input.buyerPhone.replace(/\D/g, '')
    let query = adminSupabase
      .from('tickets')
      .select('*')
      .eq('raffle_id', input.raffleId)

    const isDummyPhone = cleanPhone === '0000000000'

    if (user) {
      if (isDummyPhone) {
        query = query.eq('user_id', user.id)
      } else {
        query = query.or(`user_id.eq.${user.id},buyer_phone.eq.${input.buyerPhone},buyer_phone.eq.${cleanPhone}`)
      }
    } else {
      if (isDummyPhone) {
        query = query.eq('buyer_phone', 'IMPOSSIBLE_PHONE_MATCH_TRIGGER')
      } else {
        query = query.or(`buyer_phone.eq.${input.buyerPhone},buyer_phone.eq.${cleanPhone}`)
      }
    }

    const { data: tickets } = await query

    if (!tickets || tickets.length === 0) {
      return { error: 'No se encontraron boletos válidos con estos datos para reembolsar.' }
    }

    // Check if there's already a pending request to prevent spam
    let pendingQuery = adminSupabase
      .from('raffle_refund_requests')
      .select('id')
      .eq('raffle_id', input.raffleId)
      .eq('status', 'pending')

    if (user) {
      pendingQuery = pendingQuery.ilike('reason', `%[USER_ID:${user.id}]%`)
    } else {
      pendingQuery = pendingQuery.eq('buyer_phone', input.buyerPhone)
    }

    const { data: existingRequests } = await pendingQuery
    if (existingRequests && existingRequests.length > 0) {
      return { error: 'Ya tienes una solicitud de devolución pendiente para este sorteo.' }
    }

    const targetQuantity = input.quantity && input.quantity > 0 ? input.quantity : tickets.length
    if (targetQuantity > tickets.length) {
      return { error: `Solo tienes ${tickets.length} boletos disponibles. No puedes devolver ${targetQuantity}.` }
    }

    const ticketsToProcess = tickets.slice(0, targetQuantity)

    let allAutomatedAndRecent = true
    let requiresManualReview = false
    const now = new Date().getTime()
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000
    
    let kcoinsAmount = 0
    const paypalCaptures = new Map<string, number>() // captureId -> total amount to refund
    const ticketsToDelete: string[] = []

    for (const t of ticketsToProcess) {
      const ticketTime = new Date(t.created_at).getTime()
      const isRecent = (now - ticketTime) <= FORTY_EIGHT_HOURS
      const isKcoins = t.receipt_url === 'kcoin_payment'
      const isPayPal = t.receipt_url === 'paypal_direct' || t.receipt_url?.startsWith('paypal_direct:')

      if (!isRecent || (!isKcoins && !isPayPal)) {
        allAutomatedAndRecent = false
        requiresManualReview = true
        break
      }

      ticketsToDelete.push(t.id)

      if (isKcoins) {
        const discount = t.discount_amount || 0
        kcoinsAmount += Math.max(0, ticketPrice - discount)
      } else if (isPayPal) {
        const captureId = t.receipt_url.split(':')[1]
        if (captureId) {
          const discount = t.discount_amount || 0
          const amount = Math.max(0, ticketPrice - discount)
          paypalCaptures.set(captureId, (paypalCaptures.get(captureId) || 0) + amount)
        } else {
          allAutomatedAndRecent = false
          requiresManualReview = true
          break
        }
      }
    }
    const buyerEmailForNotification = user?.email || (ticketsToProcess.length > 0 ? ticketsToProcess[0].buyer_email : null)

    if (allAutomatedAndRecent && !requiresManualReview && ticketsToProcess && ticketsToProcess.length > 0) {
      // Automated refund possible!
      let refundFailed = false
      let failReason = ''

      // 1. Process PayPal Refunds
      if (paypalCaptures.size > 0) {
        try {
          const { refundPayPalPayment } = await import('@/lib/paypal')
          for (const [captureId, amount] of Array.from(paypalCaptures.entries())) {
            await refundPayPalPayment(captureId, amount)
          }
        } catch (err: any) {
          console.error("PayPal auto-refund error:", err)
          refundFailed = true
          failReason = 'Fallo en pasarela de pago.'
        }
      }

      // 2. Process K-Coins Refund
      if (kcoinsAmount > 0 && user && !refundFailed) {
        try {
          const { data: profile } = await adminSupabase.from('profiles').select('balance').eq('id', user.id).single()
          if (profile) {
            const newBalance = parseFloat(profile.balance || '0') + kcoinsAmount
            await adminSupabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)
            
            // Log transaction
            await adminSupabase.from('coin_transactions').insert({
              user_id: user.id,
              amount: kcoinsAmount,
              type: 'refund',
              reference_id: input.raffleId
            })
          } else {
            refundFailed = true
            failReason = 'Perfil no encontrado.'
          }
        } catch (err: any) {
          refundFailed = true
          failReason = 'Error reembolsando K-Coins.'
        }
      }

      if (!refundFailed) {
        // Delete tickets
        await adminSupabase.from('tickets').delete().in('id', ticketsToDelete)
        
        if (buyerEmailForNotification) {
          await sendRefundRequestedEmail(buyerEmailForNotification, {
            raffleName: raffle?.name || 'Sorteo Kronix',
            ticketsCount: ticketsToDelete.length,
            reason: input.reason
          })
          await sendRefundProcessedEmail(buyerEmailForNotification, {
            raffleName: raffle?.name || 'Sorteo Kronix',
            ticketsCount: ticketsToDelete.length,
            status: 'aprobada'
          })
        }

        revalidatePath(`/raffles/${input.raffleId}`)
        return { success: true, autoRefunded: true, message: 'Reembolso procesado automáticamente. Los cupos han sido liberados y el dinero fue devuelto a tu método de pago.' }
      } else {
        // If it failed, fallback to manual request but append the error reason
        input.reason = `(FALLO AUTO-REFUND: ${failReason}) ` + input.reason
      }
    }

    // Fallback: Create manual refund request
    let finalReason = user ? `[USER_ID:${user.id}]\n${input.reason}` : input.reason
    if (input.quantity && input.quantity > 0) {
      finalReason += `\n[CANTIDAD:${input.quantity}]`
    }

    const { error } = await supabase
      .from('raffle_refund_requests')
      .insert({
        raffle_id: input.raffleId,
        buyer_name: input.buyerName,
        buyer_phone: input.buyerPhone,
        reason: finalReason,
        status: 'pending'
      })

    if (error) return { error: error.message }
    
    if (buyerEmailForNotification) {
      await sendRefundRequestedEmail(buyerEmailForNotification, {
        raffleName: raffle?.name || 'Sorteo Kronix',
        ticketsCount: ticketsToProcess.length,
        reason: input.reason
      })
    }

    return { success: true, message: 'Su solicitud ha sido enviada a revisión manual porque requiere inspección por parte de un administrador.' }
  } catch (err: any) {
    return { error: err.message || 'Error al enviar la solicitud' }
  }
}

export async function getRaffleRefundRequestsAction(raffleId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await isSystemAdmin(user.id))) return { error: 'No autorizado' }

    const adminSupabase = await createAdminClient()
    const { data, error } = await adminSupabase
      .from('raffle_refund_requests')
      .select('*')
      .eq('raffle_id', raffleId)
      .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: data || [] }
  } catch (err: any) {
    return { error: err.message || 'Error al obtener las solicitudes' }
  }
}

export async function resolveRaffleRefundRequestAction(input: {
  requestId: string
  status: 'resolved' | 'rejected'
  deleteTickets: boolean
  raffleId: string
  buyerPhone: string
  ticketIds?: string[]
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await isSystemAdmin(user.id))) return { error: 'No autorizado' }

    const adminSupabase = await createAdminClient()
    
    // Actualizar estado de la solicitud
    const { error: updateError, data: updatedRequest } = await adminSupabase
      .from('raffle_refund_requests')
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq('id', input.requestId)
      .select()
      .single()

    if (updateError) return { error: updateError.message }

    // Intentar buscar el email del comprador para notificarle
    let buyerEmailForNotification = null;
    let ticketsCount = input.ticketIds?.length || 0;

    if (input.ticketIds && input.ticketIds.length > 0) {
      const { data: ticketsInfo } = await adminSupabase
        .from('tickets')
        .select('buyer_email')
        .in('id', input.ticketIds)
        .limit(1)
        .single()
      if (ticketsInfo?.buyer_email) buyerEmailForNotification = ticketsInfo.buyer_email;
    } else {
      // Si no hay ticketIds (rechazo sin borrar o fallback), tratamos de buscar por telefono/user_id
      const cleanPhone = input.buyerPhone.replace(/\D/g, '')
      const { data: ticketsInfo } = await adminSupabase
        .from('tickets')
        .select('buyer_email')
        .eq('raffle_id', input.raffleId)
        .or(`buyer_phone.eq.${input.buyerPhone},buyer_phone.eq.${cleanPhone}`)
        .limit(1)
        .single()
      if (ticketsInfo?.buyer_email) buyerEmailForNotification = ticketsInfo.buyer_email;
    }

    // Si es resuelta (aprobada) y se solicita borrar boletos, los eliminamos de la BD
    if (input.status === 'resolved' && input.deleteTickets) {
      if (input.ticketIds && input.ticketIds.length > 0) {
        const { error: deleteError } = await adminSupabase
          .from('tickets')
          .delete()
          .in('id', input.ticketIds)
          
        if (deleteError) return { error: deleteError.message }
      } else {
        const cleanPhone = input.buyerPhone.replace(/\D/g, '')
        const { error: deleteError } = await adminSupabase
          .from('tickets')
          .delete()
          .eq('raffle_id', input.raffleId)
          .or(`buyer_phone.eq.${input.buyerPhone},buyer_phone.eq.${cleanPhone}`)

        if (deleteError) return { error: deleteError.message }
      }
    }

    if (buyerEmailForNotification) {
      const { data: raffle } = await adminSupabase.from('raffles').select('name').eq('id', input.raffleId).single()
      import('@/lib/email').then(({ sendRefundProcessedEmail }) => {
        sendRefundProcessedEmail(buyerEmailForNotification!, {
          raffleName: raffle?.name || 'Sorteo Kronix',
          ticketsCount: ticketsCount || 1, // Fallback to 1 if unknown
          status: input.status === 'resolved' ? 'aprobada' : 'rechazada'
        })
      }).catch(e => console.error("Error loading email module", e))
    }

    revalidatePath(`/admin/raffles/${input.raffleId}`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al procesar la solicitud' }
  }
}

export async function buyTicketWithKCoinsAction(
  raffleId: string,
  ticketNumbers: string[],
  promoCode?: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Debes iniciar sesión para comprar boletos.' }

    const adminSupabase = await createAdminClient()

    // 1. Get profile details including balance
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('username, email, balance')
      .eq('id', user.id)
      .single()

    if (!profile) return { error: 'Perfil no encontrado.' }

    const buyerName = profile.username || 'Usuario Kronix'
    const buyerEmail = profile.email || user.email || ''
    const buyerPhone = user.user_metadata?.phone || ''

    const balance = parseFloat(profile.balance || '0.00')

    // 2. Validate raffle status
    const { data: raffle } = await adminSupabase
      .from('raffles')
      .select('status, title, ticket_price')
      .eq('id', raffleId)
      .single()

    if (!raffle || raffle.status !== 'active') {
      return { error: 'El sorteo no está activo o ya finalizó.' }
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

    // 4. Validate availability of numbers
    const { data: existing } = await adminSupabase
      .from('tickets')
      .select('ticket_number')
      .eq('raffle_id', raffleId)
      .in('ticket_number', ticketNumbers)

    if (existing && existing.length > 0) {
      const numbers = existing.map(t => t.ticket_number).join(', ')
      return { error: `Los siguientes boletos ya han sido reservados: ${numbers}` }
    }

    // 5. Calculate cost and check balance
    const pricePerTicket = Math.max(0, parseFloat(raffle.ticket_price) - discountAmountPerTicket)
    const totalCost = parseFloat((pricePerTicket * ticketNumbers.length).toFixed(2))

    if (balance < totalCost) {
      return { error: `Saldo insuficiente. El costo es de ${totalCost.toFixed(2)} K-Coins y tu saldo es de ${balance.toFixed(2)} K-Coins.` }
    }

    // 6. Perform purchase inside transaction (simulate via consecutive queries)
    const newBalance = parseFloat((balance - totalCost).toFixed(2))

    // Deduct balance
    const { error: balErr } = await adminSupabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', user.id)

    if (balErr) return { error: `Error al descontar saldo: ${balErr.message}` }

    // Insert verified tickets
    const ticketsToInsert = ticketNumbers.map(num => ({
      raffle_id: raffleId,
      user_id: user.id,
      ticket_number: num,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      payment_status: 'verified',
      receipt_url: 'kcoin_payment',
      seller_id: promoSellerId,
      promo_code: validatedCode,
      discount_amount: discountAmountPerTicket
    }))

    const { error: insErr } = await adminSupabase
      .from('tickets')
      .insert(ticketsToInsert)

    if (insErr) {
      // Rollback balance on error
      await adminSupabase.from('profiles').update({ balance }).eq('id', user.id)
      return { error: `Error al crear boletos: ${insErr.message}` }
    }

    // Insert coin transaction
    let txType = 'raffle_ticket'
    try {
      const { error: txErr } = await adminSupabase
        .from('coin_transactions')
        .insert({
          user_id: user.id,
          amount: -totalCost,
          type: txType,
          reference_id: raffleId
        })

      if (txErr) {
        // Fallback to bet_placed if raffle_ticket constraint fails
        const { error: fallbackErr } = await adminSupabase
          .from('coin_transactions')
          .insert({
            user_id: user.id,
            amount: -totalCost,
            type: 'bet_placed',
            reference_id: raffleId
          })
        if (fallbackErr) {
          console.error('Error inserting fallback coin transaction:', fallbackErr.message)
        }
      }
    } catch (err) {
      console.error('Coin transaction insert error, trying fallback:', err)
      await adminSupabase
        .from('coin_transactions')
        .insert({
          user_id: user.id,
          amount: -totalCost,
          type: 'bet_placed',
          reference_id: raffleId
        })
    }

    // 7. Send confirmation email
    try {
      const { sendTicketConfirmedEmail } = await import('@/lib/services/email')
      await sendTicketConfirmedEmail({
        email: buyerEmail,
        buyerName,
        raffleName: raffle.title,
        ticketNumbers,
      })
    } catch (mailErr) {
      console.error('Error al enviar correo de confirmación de boletos:', mailErr)
    }

    revalidatePath(`/raffles/${raffleId}`)
    revalidatePath('/raffles/my-tickets')
    return { success: true, ticketNumbers, newBalance }
  } catch (err: any) {
    return { error: err.message || 'Error al procesar la compra con K-Coins' }
  }
}

