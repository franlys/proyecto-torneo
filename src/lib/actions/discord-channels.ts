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

export async function getDiscordBotStatusAction(tournamentId: string): Promise<{
  hasGuild: boolean
  inGuild: boolean
  guildName?: string | null
  guildId?: string | null
  inviteUrl: string
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hasGuild: false, inGuild: false, inviteUrl: '', error: 'No autenticado' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('creator_id, discord_url')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return { hasGuild: false, inGuild: false, inviteUrl: '', error: 'Torneo no encontrado' }

  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('discord_guild_id')
    .eq('id', tournament.creator_id)
    .single()

  const { resolveDiscordGuildId, checkBotInGuild, getDiscordBotInviteUrl } = await import('@/lib/services/discord')

  let guildId = await resolveDiscordGuildId(creatorProfile?.discord_guild_id)
  if (!guildId && tournament.discord_url) {
    guildId = await resolveDiscordGuildId(tournament.discord_url)
    if (guildId && tournament.creator_id) {
      await supabase.from('profiles').update({ discord_guild_id: guildId, discord_connected: true }).eq('id', tournament.creator_id)
    }
  }

  const inviteUrl = getDiscordBotInviteUrl(guildId)

  if (!guildId) {
    return { hasGuild: false, inGuild: false, inviteUrl }
  }

  const check = await checkBotInGuild(guildId)
  return {
    hasGuild: true,
    inGuild: check.inGuild,
    guildName: check.guildName || null,
    guildId,
    inviteUrl,
  }
}
