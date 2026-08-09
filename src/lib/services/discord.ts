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
