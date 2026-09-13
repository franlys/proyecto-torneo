'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkKickTournamentEligibility } from '@/lib/services/kick-eligibility'

export interface TournamentKickStatus {
  hasKickRestriction: boolean
  streamerName?: string
  streamerKickUsername?: string
  kickSubsType?: 'direct' | 'all'
  isLoggedIn: boolean
  hasKickConnected: boolean
  userKickUsername?: string
  eligible: boolean
  reason?: string
}

export async function checkTournamentKickEligibilityAction(tournamentId: string): Promise<TournamentKickStatus> {
  try {
    const adminClient = await createAdminClient()

    // 1. Fetch tournament details
    const { data: tournament, error: tourneyErr } = await adminClient
      .from('tournaments')
      .select('kick_broadcaster_id, kick_subs_type')
      .eq('id', tournamentId)
      .maybeSingle()

    if (tourneyErr || !tournament || !tournament.kick_broadcaster_id) {
      return {
        hasKickRestriction: false,
        isLoggedIn: false,
        hasKickConnected: false,
        eligible: true,
      }
    }

    const kickBroadcasterId = tournament.kick_broadcaster_id
    const kickSubsType = (tournament.kick_subs_type as 'direct' | 'all') || 'all'

    // 2. Fetch broadcaster details (try kick_connections first, then kick_streamer_partners)
    let streamerKickUsername = ''
    let streamerName = ''

    const { data: broadcasterConn } = await adminClient
      .from('kick_connections')
      .select('kick_username, user_id, profiles:user_id(username, organization_name)')
      .eq('kick_user_id', kickBroadcasterId)
      .maybeSingle()

    if (broadcasterConn) {
      streamerKickUsername = broadcasterConn.kick_username || ''
      const bp = broadcasterConn.profiles as any
      streamerName = broadcasterConn.kick_username || bp?.organization_name || bp?.username || 'Streamer'
    } else {
      const { data: partner } = await adminClient
        .from('kick_streamer_partners')
        .select('user_id, profiles:user_id(username)')
        .eq('kick_user_id', kickBroadcasterId)
        .maybeSingle()
      if (partner) {
        const pProf = partner.profiles as any
        streamerName = pProf?.username || 'Streamer Partner'
        streamerKickUsername = pProf?.username || ''
      }
    }

    if (!streamerName) streamerName = 'Streamer Partner'
    if (!streamerKickUsername) streamerKickUsername = streamerName

    // 3. Check current user session
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return {
        hasKickRestriction: true,
        streamerName,
        streamerKickUsername,
        kickSubsType,
        isLoggedIn: false,
        hasKickConnected: false,
        eligible: false,
        reason: 'not_logged_in',
      }
    }

    // 4. Check user's Kick connection
    const { data: userConn } = await adminClient
      .from('kick_connections')
      .select('kick_user_id, kick_username')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!userConn || !userConn.kick_user_id) {
      return {
        hasKickRestriction: true,
        streamerName,
        streamerKickUsername,
        kickSubsType,
        isLoggedIn: true,
        hasKickConnected: false,
        eligible: false,
        reason: 'kick_not_connected',
      }
    }

    // 5. Evaluate eligibility against kick_subscribers
    const eligibility = await checkKickTournamentEligibility(adminClient, {
      userId: user.id,
      broadcasterKickUserId: kickBroadcasterId,
      subsType: kickSubsType,
    })

    return {
      hasKickRestriction: true,
      streamerName,
      streamerKickUsername,
      kickSubsType,
      isLoggedIn: true,
      hasKickConnected: true,
      userKickUsername: userConn.kick_username || undefined,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
    }
  } catch (err: any) {
    console.error('Error in checkTournamentKickEligibilityAction:', err)
    return {
      hasKickRestriction: false,
      isLoggedIn: false,
      hasKickConnected: false,
      eligible: true,
      reason: err.message,
    }
  }
}
