'use server'

import { createClient } from '@/lib/supabase/server'

export async function getDiscordChannelsAction(guildId: string): Promise<{ success: true; data: any[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const { getGuildChannels } = await import('@/lib/services/discord')
    const res = await getGuildChannels(guildId)
    if ('error' in res) {
      return { error: res.error }
    }
    // Filtrar solo canales de texto (type = 0) para anuncios
    const textChannels = (res.data || []).filter((c: any) => c.type === 0)
    return { success: true, data: textChannels }
  } catch (err: any) {
    return { error: err.message || err }
  }
}
