'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile, isAdmin } from './auth-helpers'
import { revalidatePath } from 'next/cache'

/**
 * Opens a new support ticket.
 */
export async function createTicket(
  subject: string,
  message: string
): Promise<{ success: boolean; ticketId?: string } | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  if (subject.trim().length === 0 || message.trim().length === 0) {
    return { error: 'El asunto y el mensaje no pueden estar vacíos' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      streamer_id: profile.id,
      subject: subject.trim(),
      message: message.trim(),
      status: 'open',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Automatically insert the initial message as the first post in the thread
  if (data?.id) {
    await supabase.from('support_ticket_messages').insert({
      ticket_id: data.id,
      sender_id: profile.id,
      message: message.trim(),
    })
  }

  revalidatePath('/tournaments/support')
  return { success: true, ticketId: data?.id }
}

/**
 * Gets tickets. Streamers see their own; admin and staff see all.
 */
export async function getTickets(): Promise<any[] | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const admin = await isAdmin()
  const supabase = await createClient()

  let query = supabase
    .from('support_tickets')
    .select(`
      id,
      subject,
      message,
      status,
      created_at,
      updated_at,
      streamer:profiles!support_tickets_streamer_id_fkey(username, organization_name, email)
    `)
    .order('updated_at', { ascending: false })

  if (!admin) {
    query = query.eq('streamer_id', profile.id)
  }

  const { data, error } = await query

  if (error) return { error: error.message }
  return data || []
}

/**
 * Gets details of a single ticket including the conversation thread.
 */
export async function getTicketDetails(
  ticketId: string
): Promise<{ ticket: any; messages: any[] } | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const admin = await isAdmin()
  const supabase = await createClient()

  // 1. Fetch the ticket
  const { data: ticket, error: ticketErr } = await supabase
    .from('support_tickets')
    .select(`
      id,
      streamer_id,
      subject,
      message,
      status,
      created_at,
      updated_at,
      streamer:profiles!support_tickets_streamer_id_fkey(username, organization_name, email)
    `)
    .eq('id', ticketId)
    .single()

  if (ticketErr || !ticket) return { error: 'Ticket no encontrado' }

  // Check auth: only the owning streamer or admin/staff can access
  if (!admin && ticket.streamer_id !== profile.id) {
    return { error: 'No autorizado' }
  }

  // 2. Fetch the conversation messages
  const { data: messages, error: msgErr } = await supabase
    .from('support_ticket_messages')
    .select(`
      id,
      message,
      created_at,
      sender_id,
      sender:profiles(username, role, avatar_url)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (msgErr) return { error: msgErr.message }

  return {
    ticket,
    messages: messages || [],
  }
}

/**
 * Adds a reply message to the ticket conversation.
 */
export async function replyToTicket(
  ticketId: string,
  message: string
): Promise<{ success: boolean } | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  if (message.trim().length === 0) return { error: 'El mensaje no puede estar vacío' }

  const supabase = await createClient()

  // Verify access to ticket
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('streamer_id')
    .eq('id', ticketId)
    .single()

  if (!ticket) return { error: 'Ticket no encontrado' }

  const admin = await isAdmin()
  if (!admin && ticket.streamer_id !== profile.id) {
    return { error: 'No autorizado' }
  }

  // Insert message
  const { error: msgErr } = await supabase.from('support_ticket_messages').insert({
    ticket_id: ticketId,
    sender_id: profile.id,
    message: message.trim(),
  })

  if (msgErr) return { error: msgErr.message }

  // Update ticket updated_at time and status if replied by admin
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (admin) {
    updates.status = 'in_progress' // Set status to in_progress when staff replies
  } else {
    updates.status = 'open' // Set back to open when streamer responds
  }

  await supabase
    .from('support_tickets')
    .update(updates)
    .eq('id', ticketId)

  revalidatePath(`/tournaments/support`)
  revalidatePath(`/admin/tickets`)
  return { success: true }
}

/**
 * Resolves or changes status of a ticket.
 */
export async function updateTicketStatus(
  ticketId: string,
  status: 'open' | 'in_progress' | 'resolved'
): Promise<{ success: boolean } | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const admin = await isAdmin()
  const supabase = await createClient()

  // Streamers can close their own tickets, admins/staff can update any ticket
  if (!admin) {
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('streamer_id')
      .eq('id', ticketId)
      .single()

    if (!ticket || ticket.streamer_id !== profile.id) {
      return { error: 'No autorizado' }
    }
  }

  const { error } = await supabase
    .from('support_tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  if (error) return { error: error.message }

  revalidatePath(`/tournaments/support`)
  revalidatePath(`/admin/tickets`)
  return { success: true }
}
