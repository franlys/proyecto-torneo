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
      console.error('[Discord Service] Error al enviar embed:', errText)
      return { error: errText }
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
  try {
    const response = await fetch(`${DISCORD_API_URL}/guilds/${guildId}/channels`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name,
        type: 4, // GUILD_CATEGORY
      }),
    })
    if (!response.ok) {
      const errText = await response.text()
      console.error('[Discord Service] Error al crear categoría:', errText)
      return { error: errText }
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
  try {
    // Definir permission overwrites
    // 1. Bloquear acceso a @everyone (guildId es el id del rol de everyone en Discord)
    const permissionOverwrites: any[] = [
      {
        id: guildId,
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

    const response = await fetch(`${DISCORD_API_URL}/guilds/${guildId}/channels`, {
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
      console.error('[Discord Service] Error al crear canal de voz privado:', errText)
      return { error: errText }
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
      console.error('[Discord Service] Error al eliminar canal:', errText)
      return { error: errText }
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
  try {
    const response = await fetch(`${DISCORD_API_URL}/guilds/${guildId}/channels`, {
      method: 'GET',
      headers: getHeaders(),
    })
    if (!response.ok) {
      const errText = await response.text()
      console.error('[Discord Service] Error al obtener canales del servidor:', errText)
      return { error: errText }
    }
    return { success: true, data: await response.json() }
  } catch (err: any) {
    console.error('[Discord Service] Error de red al obtener canales:', err)
    return { error: err.message || err }
  }
}
