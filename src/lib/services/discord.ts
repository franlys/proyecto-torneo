const DISCORD_API_URL = 'https://discord.com/api/v10'

function getHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) {
    console.warn('[Discord Service] DISCORD_BOT_TOKEN no configurada')
  }
  return {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Extrae el Guild ID (ID de servidor) de un ID puro o de una URL de canal de Discord (ej: https://discord.com/channels/123456/7890).
 */
export function extractDiscordGuildId(input?: string | null): string | null {
  if (!input) return null
  const trimmed = input.trim()
  // Si ya es un snowflake numérico directo (17-21 dígitos)
  if (/^\d{17,21}$/.test(trimmed)) return trimmed
  // Si es una URL de Discord /channels/{guild_id}/...
  const match = trimmed.match(/discord(?:app)?\.com\/channels\/(\d{17,21})/i)
  if (match) return match[1]
  return null
}

/**
 * Resuelve el ID de un Servidor de Discord a partir de:
 * 1. Un ID numérico directo (snowflake de 17-21 dígitos)
 * 2. Una URL de canal (https://discord.com/channels/GUILD_ID/CHANNEL_ID)
 * 3. Un enlace de invitación (https://discord.gg/CODE o https://discord.com/invite/CODE)
 */
export async function resolveDiscordGuildId(input?: string | null): Promise<string | null> {
  if (!input) return null
  const directId = extractDiscordGuildId(input)
  if (directId) return directId

  const trimmed = input.trim()
  const inviteMatch = trimmed.match(/(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)([a-zA-Z0-9-]+)/i)
  const inviteCode = inviteMatch ? inviteMatch[1] : (/^[a-zA-Z0-9-]{5,16}$/.test(trimmed) ? trimmed : null)

  if (inviteCode) {
    try {
      const response = await fetch(`${DISCORD_API_URL}/invites/${inviteCode}`)
      if (response.ok) {
        const data = await response.json()
        if (data?.guild?.id) {
          console.log(`[Discord Service] ID de Servidor resuelto desde invitación (${inviteCode}): ${data.guild.id} (${data.guild.name})`)
          return data.guild.id
        }
      }
    } catch (err) {
      console.warn('[Discord Service] Error al resolver invitación de Discord:', err)
    }
  }

  return null
}

/**
 * Obtiene el Client ID del Bot a partir de su Token o de variables de entorno.
 */
export function getDiscordClientId(): string | null {
  if (process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID) {
    return process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || null
  }
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) return null
  try {
    const base64Part = token.split('.')[0]
    const decoded = Buffer.from(base64Part, 'base64').toString('utf8')
    if (/^\d{17,21}$/.test(decoded)) {
      return decoded
    }
  } catch (err) {
    console.warn('[Discord Service] Error decodificando Client ID del token:', err)
  }
  return null
}

/**
 * Genera el enlace oficial de invitación del Bot con permisos de Administrador pre-configurados.
 */
export function getDiscordBotInviteUrl(guildId?: string | null): string {
  const clientId = getDiscordClientId() || '1403398939794079865'
  const cleanGuild = guildId ? extractDiscordGuildId(guildId) : null
  const guildParam = cleanGuild ? `&guild_id=${cleanGuild}` : ''
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands${guildParam}`
}

/**
 * Verifica si el Bot está presente en el servidor de Discord especificado.
 */
export async function checkBotInGuild(guildId: string): Promise<{ inGuild: boolean; guildName?: string; error?: string }> {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  try {
    const response = await fetch(`${DISCORD_API_URL}/guilds/${cleanGuildId}`, {
      method: 'GET',
      headers: getHeaders(),
    })
    if (response.ok) {
      const data = await response.json()
      return { inGuild: true, guildName: data.name }
    }
    return { inGuild: false }
  } catch (err: any) {
    return { inGuild: false, error: err.message || err }
  }
}

function parseDiscordError(status: number, errJson: any, errText: string): string {
  if (errJson?.code === 10004 || status === 404) {
    return 'Servidor de Discord no encontrado (Unknown Guild). Asegúrate de invitar al bot de Kronix a tu servidor primero.'
  }
  if (errJson?.code === 50013 || status === 403) {
    return 'Permisos insuficientes (Missing Permissions). El bot necesita el permiso "Gestionar Canales" y "Gestionar Roles" en tu servidor de Discord.'
  }
  if (errJson?.code === 50001) {
    return 'Acceso denegado (Missing Access). El bot no tiene acceso a este servidor de Discord.'
  }
  if (status === 401) {
    return 'Error de autorización: DISCORD_BOT_TOKEN no configurado o inválido.'
  }
  return errJson?.message || errText || 'Error desconocido de la API de Discord'
}

/**
 * Envía un mensaje embebido a un canal específico.
 */
export async function sendDiscordEmbed(channelId: string, embed: any) {
  try {
    const response = await fetch(`${DISCORD_API_URL}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ embeds: [embed] }),
    })
    if (!response.ok) {
      const errText = await response.text()
      let errJson: any = null
      try { errJson = JSON.parse(errText) } catch {}
      const errMsg = parseDiscordError(response.status, errJson, errText)
      console.error('[Discord Service] Error al enviar embed:', errMsg)
      return { error: errMsg }
    }
    return { success: true, data: await response.json() }
  } catch (err: any) {
    console.error('[Discord Service] Error de red al enviar embed:', err)
    return { error: err.message || err }
  }
}

/**
 * Crea una categoría en el servidor de Discord.
 */
export async function createDiscordCategory(guildId: string, name: string) {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  try {
    const response = await fetch(`${DISCORD_API_URL}/guilds/${cleanGuildId}/channels`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name,
        type: 4, // GUILD_CATEGORY
      }),
    })
    if (!response.ok) {
      const errText = await response.text()
      let errJson: any = null
      try { errJson = JSON.parse(errText) } catch {}
      const errMsg = parseDiscordError(response.status, errJson, errText)
      console.error('[Discord Service] Error al crear categoría:', errMsg)
      return { error: errMsg }
    }
    const data = await response.json()
    return { success: true, id: data.id }
  } catch (err: any) {
    console.error('[Discord Service] Error de red al crear categoría:', err)
    return { error: err.message || err }
  }
}

/**
 * Crea un canal de voz privado dentro de una categoría, restringiendo acceso y permitiendo bypass.
 * @param guildId ID del servidor de Discord
 * @param name Nombre del canal de voz
 * @param parentId ID de la categoría padre
 * @param teamDiscordIds Array de IDs de Discord de los miembros del equipo que pueden entrar
 */
export async function createPrivateVoiceChannel(
  guildId: string,
  name: string,
  parentId: string,
  teamDiscordIds: string[]
) {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  try {
    // Definir permission overwrites
    // 1. Bloquear acceso a @everyone (cleanGuildId es el id del rol de everyone en Discord)
    const permissionOverwrites: any[] = [
      {
        id: cleanGuildId,
        type: 0, // ROLE
        allow: '0',
        deny: '1048576', // Denegar CONNECT (1 << 20)
      },
    ]

    // 2. Permitir acceso a los miembros del equipo
    teamDiscordIds.forEach((discordUserId) => {
      if (discordUserId) {
        permissionOverwrites.push({
          id: discordUserId,
          type: 1, // MEMBER
          allow: '1049600', // Permitir VIEW_CHANNEL (1<<10) + CONNECT (1<<20)
          deny: '0',
        })
      }
    })

    const response = await fetch(`${DISCORD_API_URL}/guilds/${cleanGuildId}/channels`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name,
        type: 2, // GUILD_VOICE
        parent_id: parentId,
        permission_overwrites: permissionOverwrites,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      let errJson: any = null
      try { errJson = JSON.parse(errText) } catch {}
      const errMsg = parseDiscordError(response.status, errJson, errText)
      console.error('[Discord Service] Error al crear canal de voz privado:', errMsg)
      return { error: errMsg }
    }
    const data = await response.json()
    return { success: true, id: data.id }
  } catch (err: any) {
    console.error('[Discord Service] Error de red al crear canal de voz privado:', err)
    return { error: err.message || err }
  }
}

/**
 * Crea un canal de texto privado dentro de una categoría, para avisos del bot y chat del equipo.
 */
export async function createPrivateTextChannel(
  guildId: string,
  name: string,
  parentId: string,
  teamDiscordIds: string[]
) {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  const sanitizedName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  try {
    const permissionOverwrites: any[] = [
      {
        id: cleanGuildId,
        type: 0, // ROLE @everyone
        allow: '0',
        deny: '1024', // Denegar VIEW_CHANNEL (1<<10)
      },
    ]

    teamDiscordIds.forEach((discordUserId) => {
      if (discordUserId) {
        permissionOverwrites.push({
          id: discordUserId,
          type: 1, // MEMBER
          allow: '68608', // VIEW_CHANNEL (1024) + SEND_MESSAGES (2048) + READ_MESSAGE_HISTORY (65536)
          deny: '0',
        })
      }
    })

    const response = await fetch(`${DISCORD_API_URL}/guilds/${cleanGuildId}/channels`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name: `chat-${sanitizedName || 'equipo'}`,
        type: 0, // GUILD_TEXT
        parent_id: parentId,
        permission_overwrites: permissionOverwrites,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      let errJson: any = null
      try { errJson = JSON.parse(errText) } catch {}
      const errMsg = parseDiscordError(response.status, errJson, errText)
      console.error('[Discord Service] Error al crear canal de texto privado:', errMsg)
      return { error: errMsg }
    }
    const data = await response.json()
    return { success: true, id: data.id }
  } catch (err: any) {
    console.error('[Discord Service] Error de red al crear canal de texto privado:', err)
    return { error: err.message || err }
  }
}

/**
 * Crea un canal de texto estándar (accesible para los participantes o dentro de una categoría).
 */
export async function createGuildTextChannel(
  guildId: string,
  name: string,
  parentId?: string,
  topic?: string
) {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  const sanitizedName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  try {
    const body: any = {
      name: sanitizedName,
      type: 0, // GUILD_TEXT
    }
    if (parentId) body.parent_id = parentId
    if (topic) body.topic = topic

    const response = await fetch(`${DISCORD_API_URL}/guilds/${cleanGuildId}/channels`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text()
      let errJson: any = null
      try { errJson = JSON.parse(errText) } catch {}
      const errMsg = parseDiscordError(response.status, errJson, errText)
      console.error('[Discord Service] Error al crear canal de texto estándar:', errMsg)
      return { error: errMsg }
    }
    const data = await response.json()
    return { success: true, id: data.id }
  } catch (err: any) {
    console.error('[Discord Service] Error de red al crear canal de texto estándar:', err)
    return { error: err.message || err }
  }
}

/**
 * Elimina un canal o categoría por ID.
 */
export async function deleteDiscordChannel(channelId: string) {
  try {
    const response = await fetch(`${DISCORD_API_URL}/channels/${channelId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    if (!response.ok) {
      const errText = await response.text()
      let errJson: any = null
      try { errJson = JSON.parse(errText) } catch {}
      const errMsg = parseDiscordError(response.status, errJson, errText)
      console.error('[Discord Service] Error al eliminar canal:', errMsg)
      return { error: errMsg }
    }
    return { success: true }
  } catch (err: any) {
    console.error('[Discord Service] Error de red al eliminar canal:', err)
    return { error: err.message || err }
  }
}

/**
 * Obtiene todos los canales de un servidor de Discord.
 */
export async function getGuildChannels(guildId: string) {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  try {
    const response = await fetch(`${DISCORD_API_URL}/guilds/${cleanGuildId}/channels`, {
      method: 'GET',
      headers: getHeaders(),
    })
    if (!response.ok) {
      const errText = await response.text()
      let errJson: any = null
      try { errJson = JSON.parse(errText) } catch {}
      const errMsg = parseDiscordError(response.status, errJson, errText)
      console.error('[Discord Service] Error al obtener canales del servidor:', errMsg)
      return { error: errMsg }
    }
    return { success: true, data: await response.json() }
  } catch (err: any) {
    console.error('[Discord Service] Error de red al obtener canales:', err)
    return { error: err.message || err }
  }
}

/**
 * Otorga permisos individuales a un usuario de Discord en un canal de voz o texto existente.
 */
export async function grantDiscordChannelAccess(
  channelId: string,
  discordUserId: string,
  type: 'voice' | 'text'
) {
  try {
    const allowBits = type === 'voice' ? '1049600' : '68608'
    const response = await fetch(`${DISCORD_API_URL}/channels/${channelId}/permissions/${discordUserId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        allow: allowBits,
        deny: '0',
        type: 1, // 1 = MEMBER
      }),
    })
    if (!response.ok) {
      const errText = await response.text()
      console.warn(`[Discord Service] Error otorgando permisos a usuario ${discordUserId} en canal ${channelId}:`, errText)
      return { error: errText }
    }
    return { success: true }
  } catch (err: any) {
    return { error: err.message || err }
  }
}

