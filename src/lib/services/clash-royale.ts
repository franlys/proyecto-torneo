import { createAdminClient } from '@/lib/supabase/server'
import https from 'https'
import { HttpsProxyAgent } from 'https-proxy-agent'

export interface ClashRoyaleMember {
  tag: string
  name: string
  score: number
  rank: number
  clan?: {
    tag: string
    name: string
  }
}

export interface ClashRoyaleTournamentResponse {
  tag: string
  name: string
  status: string
  type: string
  creatorTag: string
  maxPlayers: number
  currentPlayers: number
  levelCap: number
  prepTimeSeconds: number
  durationSeconds: number
  createdTime: string
  membersList: ClashRoyaleMember[]
}

function fetchWithProxy(url: string, apiKey: string, proxyUrl?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      }
    }

    if (proxyUrl) {
      console.log(`[CLASH ROYALE SERVICE] Routing request via proxy: ${proxyUrl.replace(/:[^:@]+@/, ':****@')}`)
      options.agent = new HttpsProxyAgent(proxyUrl)
    }

    const req = https.request(url, options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error('Respuesta de API inválida (no es JSON)'))
          }
        } else {
          reject(new Error(`API Error status ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.end()
  })
}

export async function fetchClashRoyaleTournament(tag: string): Promise<ClashRoyaleTournamentResponse> {
  const apiKey = (process.env.CLASH_ROYALE_API_KEY || '').replace(/\s+/g, '')
  if (!apiKey) {
    throw new Error('CLASH_ROYALE_API_KEY no configurado en el servidor.')
  }

  // Ensure tag starts with '#' and remove whitespaces
  const trimmedTag = tag.trim().replace(/\s+/g, '')
  const formattedTag = trimmedTag.startsWith('#') ? trimmedTag : `#${trimmedTag}`
  const encodedTag = encodeURIComponent(formattedTag)
  const url = `https://api.clashroyale.com/v1/tournaments/${encodedTag}`

  const proxyUrl = process.env.CLASH_ROYALE_PROXY

  return fetchWithProxy(url, apiKey, proxyUrl)
}

export async function syncClashRoyaleTournamentData(
  supabase: any,
  tournamentId: string,
  tag: string
) {
  console.log(`[CLASH ROYALE SYNC] Starting sync for Tournament ${tournamentId} with tag ${tag}`)
  
  const data = await fetchClashRoyaleTournament(tag)
  const members = data.membersList || []

  if (members.length === 0) {
    console.log('[CLASH ROYALE SYNC] No members found in tournament')
    return { success: true, count: 0 }
  }

  // Fetch existing teams and participants
  const { data: existingTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)

  const { data: existingParticipants } = await supabase
    .from('participants')
    .select('*')
    .eq('tournament_id', tournamentId)

  const participantsByContact = new Map(
    existingParticipants?.filter((p: any) => p.contact_id).map((p: any) => [p.contact_id, p]) || []
  )
  const participantsByName = new Map(
    existingParticipants?.map((p: any) => [p.display_name.toLowerCase(), p]) || []
  )

  const standingRows: any[] = []

  for (const member of members) {
    let participant = participantsByContact.get(member.tag)
    if (!participant) {
      participant = participantsByName.get(member.name.toLowerCase())
    }

    let teamId = participant?.team_id

    if (!participant || !teamId) {
      // Create team
      const { data: newTeam, error: teamErr } = await supabase
        .from('teams')
        .insert({
          tournament_id: tournamentId,
          name: member.name,
        })
        .select()
        .single()

      if (teamErr) {
        console.error('[CLASH ROYALE SYNC] Error creating team:', teamErr)
        continue
      }

      // Create participant
      const { data: newParticipant, error: partErr } = await supabase
        .from('participants')
        .insert({
          tournament_id: tournamentId,
          team_id: newTeam.id,
          display_name: member.name,
          contact_id: member.tag,
          is_captain: true,
        })
        .select()
        .single()

      if (partErr) {
        console.error('[CLASH ROYALE SYNC] Error creating participant:', partErr)
        continue
      }

      teamId = newTeam.id
      // Add to maps
      participantsByContact.set(member.tag, newParticipant)
      participantsByName.set(member.name.toLowerCase(), newParticipant)
    } else {
      // If participant exists but does not have the contact_id set to tag, update it
      if (!participant.contact_id) {
        await supabase
          .from('participants')
          .update({ contact_id: member.tag })
          .eq('id', participant.id)
      }
    }

    // Prepare standing row
    standingRows.push({
      tournament_id: tournamentId,
      team_id: teamId,
      total_points: member.score,
      total_kills: 0,
      kill_rate: 0,
      pot_top_count: 0,
      vip_score: 0,
      rank: member.rank,
      previous_rank: member.rank,
      updated_at: new Date().toISOString()
    })
  }

  // Upsert to team_standings
  if (standingRows.length > 0) {
    console.log(`[CLASH ROYALE SYNC] Upserting ${standingRows.length} rows to team_standings`)
    const { error: upsertErr } = await supabase
      .from('team_standings')
      .upsert(standingRows, { onConflict: 'tournament_id,team_id' })
      
    if (upsertErr) {
      console.error('[CLASH ROYALE SYNC] Standing upsert error:', upsertErr)
      throw upsertErr
    }
  }

  return { success: true, count: standingRows.length }
}
