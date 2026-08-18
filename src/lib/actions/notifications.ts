'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface AppNotification {
  id: string
  user_id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

/**
 * Gets the latest 30 notifications for the authenticated user
 */
export async function getMyNotificationsAction(): Promise<{ success: boolean; data?: AppNotification[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'No autenticado' }
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener notificaciones' }
  }
}

/**
 * Marks a notification as read
 */
export async function markNotificationReadAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'No autenticado' }
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/kronix')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar notificación' }
  }
}

/**
 * Marks all user's notifications as read
 */
export async function markAllNotificationsReadAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'No autenticado' }
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/kronix')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al marcar todas las notificaciones' }
  }
}
