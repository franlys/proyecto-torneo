'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isAdmin } from './auth-helpers'

export async function requestSubscription(evidenceUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('subscription_requests')
    .insert({
      user_id: user.id,
      evidence_url: evidenceUrl,
      status: 'PENDING'
    })

  if (error) return { error: error.message }
  
  // Also set profile status to PENDING
  await supabase.from('profiles').update({ subscription_status: 'PENDING' }).eq('id', user.id)

  revalidatePath('/dashboard')
  return { success: true }
}

export async function approveSubscription(requestId: string, userId: string) {
  if (!(await isAdmin())) return { error: 'Sin permisos de administrador' }

  const supabase = await createAdminClient()
  
  // 1. Approve the request
  const { error: reqErr } = await supabase
    .from('subscription_requests')
    .update({ status: 'APPROVED' })
    .eq('id', requestId)

  if (reqErr) return { error: reqErr.message }

  // 2. Set profile as ACTIVE
  const { error: profErr } = await supabase
    .from('profiles')
    .update({ 
      subscription_status: 'ACTIVE',
      subscription_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    })
    .eq('id', userId)

  if (profErr) return { error: profErr.message }

  revalidatePath('/admin/subscriptions')
  return { success: true }
}

export async function rejectSubscription(requestId: string, userId: string, notes: string) {
  if (!(await isAdmin())) return { error: 'Sin permisos de administrador' }

  const supabase = await createAdminClient()

  await supabase
    .from('subscription_requests')
    .update({ status: 'REJECTED', admin_notes: notes })
    .eq('id', requestId)

  await supabase.from('profiles').update({ subscription_status: 'NONE' }).eq('id', userId)

  revalidatePath('/admin/subscriptions')
  return { success: true }
}

export async function activateSubscription(userId: string) {
  if (!(await isAdmin())) return { error: 'Sin permisos de administrador' }

  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'ACTIVE',
      subscription_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  return { success: true }
}

export async function approveDirectly(userId: string) {
  if (!(await isAdmin())) return { error: 'Sin permisos de administrador' }

  const supabase = await createAdminClient()

  // Find the most recent PENDING request for this user
  const { data: req } = await supabase
    .from('subscription_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (req) {
    await supabase.from('subscription_requests').update({ status: 'APPROVED' }).eq('id', req.id)
  }

  await supabase.from('profiles').update({
    subscription_status: 'ACTIVE',
    subscription_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }).eq('id', userId)

  revalidatePath('/admin/users')
  revalidatePath('/admin/subscriptions')
  return { success: true }
}

export async function deactivateSubscription(userId: string) {
  if (!(await isAdmin())) return { error: 'Sin permisos de administrador' }

  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: 'EXPIRED', subscription_expiry: null })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/subscriptions')
  revalidatePath('/admin/users')
  return { success: true }
}
