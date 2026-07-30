import { HttpsProxyAgent } from 'https-proxy-agent'

export interface RiotAccount {
  puuid: string
  gameName: string
  tagLine: string
}

export interface LolSummoner {
  id: string
  accountId: string
  puuid: string
  name: string
  profileIconId: number
  revisionDate: number
  summonerLevel: number
}

async function fetchRiotApi(url: string, apiKey: string): Promise<any> {
  const options: RequestInit = {
    method: 'GET',
    headers: {
      'X-Riot-Token': apiKey,
      'Accept': 'application/json'
    }
  }

  // Use proxy if configured (similar to Clash Royale)
  const proxyUrl = process.env.CLASH_ROYALE_PROXY
  if (proxyUrl) {
    const agent = new HttpsProxyAgent(proxyUrl)
    // Node-fetch / Next.js fetch supports custom agents
    ;(options as any).agent = agent
  }

  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Riot API Error (status ${res.status}): ${text}`)
  }

  return await res.json()
}

/**
 * Gets a Riot Account by Riot ID (gameName + tagLine)
 */
export async function getRiotAccountByRiotId(gameName: string, tagLine: string): Promise<RiotAccount> {
  const apiKey = process.env.RIOT_LOL_API_KEY
  if (!apiKey) {
    throw new Error('RIOT_LOL_API_KEY no configurado en el servidor.')
  }

  const encodedName = encodeURIComponent(gameName.trim())
  const encodedTag = encodeURIComponent(tagLine.trim())

  // Default to americas routing for accounts
  const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedName}/${encodedTag}`
  return await fetchRiotApi(url, apiKey)
}

/**
 * Gets a League of Legends summoner profile by PUUID
 */
export async function getLolSummonerByPuuid(puuid: string, region: string = 'la1'): Promise<LolSummoner> {
  const apiKey = process.env.RIOT_LOL_API_KEY
  if (!apiKey) {
    throw new Error('RIOT_LOL_API_KEY no configurado en el servidor.')
  }

  const url = `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`
  return await fetchRiotApi(url, apiKey)
}
