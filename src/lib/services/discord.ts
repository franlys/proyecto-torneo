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
 * Obtiene todos los roles de un servidor de Discord.
 */
export async function getGuildRoles(guildId: string): Promise<{ success: true; data: any[] } | { error: string }> {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  try {
    const response = await fetch(`${DISCORD_API_URL}/guilds/${cleanGuildId}/roles`, {
      method: 'GET',
      headers: getHeaders(),
    })
    if (!response.ok) {
      const errText = await response.text()
      return { error: errText }
    }
    const data = await response.json()
    return { success: true, data }
  } catch (err: any) {
    return { error: err.message || err }
  }
}

/**
 * Crea un rol en el servidor de Discord.
 */
export async function createGuildRole(
  guildId: string,
  name: string,
  color: number = 0,
  hoist: boolean = false
): Promise<{ success: true; id: string; role: any } | { error: string }> {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  try {
    const response = await fetch(`${DISCORD_API_URL}/guilds/${cleanGuildId}/roles`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name,
        color,
        hoist,
        mentionable: true,
      }),
    })
    if (!response.ok) {
      const errText = await response.text()
      return { error: errText }
    }
    const data = await response.json()
    return { success: true, id: data.id, role: data }
  } catch (err: any) {
    return { error: err.message || err }
  }
}

/**
 * Obtiene o crea el rol de un equipo específico en Discord.
 */
export async function createOrGetTeamRole(guildId: string, teamName: string): Promise<{ success: true; roleId: string } | { error: string }> {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  const roleName = `⚔️ ${teamName}`.trim()

  const rolesRes = await getGuildRoles(cleanGuildId)
  if ('success' in rolesRes && rolesRes.success && Array.isArray(rolesRes.data)) {
    const existing = rolesRes.data.find(
      (r: any) => r.name.toLowerCase() === roleName.toLowerCase() || r.name.toLowerCase() === teamName.toLowerCase()
    )
    if (existing) {
      return { success: true, roleId: existing.id }
    }
  }

  // Generate a vivid color for the team role
  const teamColors = [0x00f5ff, 0xa855f7, 0xef4444, 0xf59e0b, 0x10b981, 0x3b82f6]
  const randomColor = teamColors[Math.floor(Math.random() * teamColors.length)]

  const createRes = await createGuildRole(cleanGuildId, roleName, randomColor, false)
  if ('success' in createRes && createRes.success && createRes.id) {
    return { success: true, roleId: createRes.id }
  }
  return { error: 'error' in createRes ? createRes.error : 'No se pudo crear el rol' }
}

/**
 * Obtiene o crea el rol especial de Staff / Streamer de Kronix con acceso a todos los canales.
 */
export async function createOrGetStaffRole(guildId: string): Promise<{ success: true; roleId: string } | { error: string }> {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  const staffRoleName = `🛡️ Staff Kronix`

  const rolesRes = await getGuildRoles(cleanGuildId)
  if ('success' in rolesRes && rolesRes.success && Array.isArray(rolesRes.data)) {
    const existing = rolesRes.data.find((r: any) => r.name.toLowerCase().includes('staff') || r.name.toLowerCase().includes('admin'))
    if (existing) {
      return { success: true, roleId: existing.id }
    }
  }

  const createRes = await createGuildRole(cleanGuildId, staffRoleName, 0xffd700, true)
  if ('success' in createRes && createRes.success && createRes.id) {
    return { success: true, roleId: createRes.id }
  }
  return { error: 'error' in createRes ? createRes.error : 'No se pudo crear rol de staff' }
}

/**
 * Asigna un rol de Discord a un miembro del servidor.
 */
export async function assignDiscordRoleToMember(
  guildId: string,
  discordUserId: string,
  roleId: string
): Promise<{ success: true } | { error: string }> {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  try {
    const response = await fetch(`${DISCORD_API_URL}/guilds/${cleanGuildId}/members/${discordUserId}/roles/${roleId}`, {
      method: 'PUT',
      headers: getHeaders(),
    })
    if (!response.ok) {
      const errText = await response.text()
      console.warn(`[Discord Service] Error asignando rol ${roleId} a usuario ${discordUserId}:`, errText)
      return { error: errText }
    }
    return { success: true }
  } catch (err: any) {
    return { error: err.message || err }
  }
}

/**
 * Crea un canal de voz privado dentro de una categoría, restringiendo acceso con roles.
 */
export async function createPrivateVoiceChannel(
  guildId: string,
  name: string,
  parentId: string,
  teamDiscordIds: string[] = [],
  userLimit: number = 0,
  teamRoleId?: string | null,
  staffRoleId?: string | null
) {
  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  try {
    const body: any = {
      name,
      type: 2, // GUILD_VOICE
      parent_id: parentId,
    }

    if (userLimit > 0) {
      body.user_limit = userLimit
    }

    const permissionOverwrites: any[] = [
      // 1. Bloquear acceso para @everyone (oculto)
      {
        id: cleanGuildId,
        type: 0, // ROLE
        allow: '0',
        deny: '1024', // VIEW_CHANNEL (1<<10)
      },
    ]

    // 2. Permitir acceso al Rol del Equipo (Ver, Conectar y Hablar)
    if (teamRoleId) {
      permissionOverwrites.push({
        id: teamRoleId,
        type: 0, // ROLE
        allow: '1049600', // VIEW_CHANNEL (1024) + CONNECT (1048576) + SPEAK (2097152)
        deny: '0',
      })
    }

    // 3. Permitir acceso al Rol de Staff / Streamer
    if (staffRoleId) {
      permissionOverwrites.push({
        id: staffRoleId,
        type: 0, // ROLE
        allow: '1049600',
        deny: '0',
      })
    }

    // 4. Permitir miembros directos que hayan vinculado su Discord
    if (teamDiscordIds && teamDiscordIds.length > 0) {
      teamDiscordIds.forEach((discordUserId) => {
        if (discordUserId) {
          permissionOverwrites.push({
            id: discordUserId,
            type: 1, // MEMBER
            allow: '1049600',
            deny: '0',
          })
        }
      })
    }

    body.permission_overwrites = permissionOverwrites

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
      console.error('[Discord Service] Error al crear canal de voz privado:', errMsg)
      return { error: errMsg }
    }
    const data = await response.json()
    return { success: true, id: data.id }
  } catch (err: any) {
    console.error('[Discord Service] Error de red al crear canal de voz:', err)
    return { error: err.message || err }
  }
}

/**
 * Crea un canal de texto para el equipo dentro de una categoría, restringido por roles.
 */
export async function createPrivateTextChannel(
  guildId: string,
  name: string,
  parentId: string,
  teamDiscordIds: string[] = [],
  teamRoleId?: string | null,
  staffRoleId?: string | null
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
      name: `chat-${sanitizedName || 'equipo'}`,
      type: 0, // GUILD_TEXT
      parent_id: parentId,
    }

    const permissionOverwrites: any[] = [
      // 1. Bloquear acceso para @everyone
      {
        id: cleanGuildId,
        type: 0, // ROLE
        allow: '0',
        deny: '1024', // VIEW_CHANNEL
      },
    ]

    // 2. Permitir acceso al Rol del Equipo
    if (teamRoleId) {
      permissionOverwrites.push({
        id: teamRoleId,
        type: 0, // ROLE
        allow: '68608', // VIEW_CHANNEL (1024) + SEND_MESSAGES (2048) + READ_MESSAGE_HISTORY (65536)
        deny: '0',
      })
    }

    // 3. Permitir acceso al Rol de Staff
    if (staffRoleId) {
      permissionOverwrites.push({
        id: staffRoleId,
        type: 0, // ROLE
        allow: '68608',
        deny: '0',
      })
    }

    // 4. Permitir miembros directos
    if (teamDiscordIds && teamDiscordIds.length > 0) {
      teamDiscordIds.forEach((discordUserId) => {
        if (discordUserId) {
          permissionOverwrites.push({
            id: discordUserId,
            type: 1, // MEMBER
            allow: '68608',
            deny: '0',
          })
        }
      })
    }

    body.permission_overwrites = permissionOverwrites

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
      console.error('[Discord Service] Error al crear canal de texto de equipo:', errMsg)
      return { error: errMsg }
    }
    const data = await response.json()
    return { success: true, id: data.id }
  } catch (err: any) {
    console.error('[Discord Service] Error de red al crear canal de texto de equipo:', err)
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

