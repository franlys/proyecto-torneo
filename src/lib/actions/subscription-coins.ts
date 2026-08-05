'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsdToDopRate } from '@/lib/services/exchange-rate'
import { revalidatePath } from 'next/cache'

const PLANS_PRICING: Record<string, { amount: number; days: number; name: string }> = {
  '1_month': { amount: 5, days: 30, name: '1 Mes' },
  '3_months': { amount: 13, days: 90, name: '3 Meses' },
  '1_year': { amount: 50, days: 365, name: '1 Año' }
}

export async function buySubscriptionWithCoins(planId: string): Promise<{ success: boolean; expiry?: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'No autenticado' }

    const plan = PLANS_PRICING[planId]
    if (!plan) return { error: 'Plan no válido' }

    // Fetch user profile balance
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('balance, subscription_status')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return { error: 'No se pudo obtener la billetera del usuario' }
    }

    // Get current rate to convert USD to K-Coins
    const rate = await getUsdToDopRate()
    const kCoinsPrice = parseFloat((plan.amount * rate).toFixed(2))
    const currentBalance = parseFloat(profile.balance || '0.00')

    if (currentBalance < kCoinsPrice) {
      return { error: `Saldo insuficiente. El plan cuesta ${kCoinsPrice.toLocaleString('es-DO')} K-Coins y tienes ${currentBalance.toLocaleString('es-DO')} K-Coins.` }
    }

    // Calculate expiry date
    const now = new Date()
    const expiryDate = new Date(now.getTime() + plan.days * 24 * 60 * 60 * 1000)
    const expiryIso = expiryDate.toISOString()

    // Deduct balance and update subscription status
    const newBalance = parseFloat((currentBalance - kCoinsPrice).toFixed(2))

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        balance: newBalance,
        subscription_status: 'ACTIVE',
        subscription_expiry: expiryIso
      })
      .eq('id', user.id)

    if (updateErr) return { error: updateErr.message }

    // Log the transaction
    const { error: logErr } = await supabase
      .from('coin_transactions')
      .insert({
        user_id: user.id,
        amount: -kCoinsPrice,
        type: 'vip_purchase',
        reference_id: planId
      })

    if (logErr) {
      console.error('Error logging coin transaction for VIP purchase:', logErr.message)
    }

    revalidatePath('/subscription')
    revalidatePath('/profile')

    return { success: true, expiry: expiryIso }
  } catch (err: any) {
    return { error: err.message || 'Error al procesar el pago con K-Coins' }
  }
}
