'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
      .select('*, tickets(payment_status)')
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
       .select('id, ticket_number, payment_status')
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
  receiptUrl: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Debes iniciar sesión para comprar boletos.' }
     
    // Obtener detalles del comprador desde profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, email, phone')
      .eq('id', user.id)
      .single()
       
    const buyerName = profile?.username || user.user_metadata?.username || 'Usuario Kronix'
    const buyerEmail = profile?.email || user.email || ''
    const buyerPhone = profile?.phone || user.user_metadata?.phone || ''
     
    if (!buyerEmail) {
      return { error: 'Tu cuenta de usuario debe tener un correo electrónico asociado.' }
    }

    // 1. Validar estado del sorteo
    const { data: raffle } = await supabase
      .from('raffles')
      .select('status, title')
      .eq('id', raffleId)
      .single()
       
    if (!raffle || raffle.status !== 'active') {
      return { error: 'El sorteo no está activo o ya finalizó.' }
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
      receipt_url: receiptUrl
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
  count: number
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

    if (ticketNumbers.length < count) {
      return { error: 'No quedan suficientes boletos disponibles en este sorteo para asignar la cantidad solicitada.' }
    }

    // Generar email placeholder si no se proporciona uno
    let finalEmail = buyerEmail?.trim()
    if (!finalEmail) {
      const sanitizedName = buyerName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
      const sanitizedPhone = (buyerPhone || '').replace(/\D/g, '')
      const randSuffix = Math.random().toString(36).substring(2, 6)
      finalEmail = `${sanitizedName}${sanitizedPhone ? `.${sanitizedPhone}` : ''}.${randSuffix}@manual.kronix.do`
    }

    // Buscar el id del usuario de forma robusta para asociarle el user_id (así le aparecerán en "Mis Boletos")
    let targetUserId = null

    // 1. Intentar buscar en boletos ya existentes con este correo
    const { data: existingUserTicket } = await adminSupabase
      .from('tickets')
      .select('user_id')
      .eq('buyer_email', finalEmail)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (existingUserTicket?.user_id) {
      targetUserId = existingUserTicket.user_id
    }

    // 2. Si falla, intentar buscar en perfiles públicos
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

    // 3. Si sigue fallando, buscar en el listado de usuarios de autenticación
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

    // 4. Si el usuario no existe en la plataforma, CREARLO automáticamente para que tenga cuenta y perfil
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

        // Asegurar que el perfil público se actualice con el email e username (nickname) correctos
        await adminSupabase
          .from('profiles')
          .update({ 
            email: finalEmail, 
            username: buyerName, 
            role: 'USER' 
          })
          .eq('id', targetUserId)
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
      receipt_url: 'manual_assignment'
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
