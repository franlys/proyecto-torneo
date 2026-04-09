export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { LeaderboardClient } from './LeaderboardClient'
import { recalculateStandings } from '@/lib/actions/submissions'

export default async function PublicLeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const normalizedSlug = slug.trim().toLowerCase()
  const supabase = await createClient()

  // Fetch the tournament
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('*, leaderboard_themes(*)')
    .eq('slug', normalizedSlug)
    .single()

  if (tErr || !tournament) notFound()

  // Fetch ALL teams with their participants (for the Participants tab)
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, avatar_url, stream_url, participants(id, team_id, display_name, is_captain, stream_url, total_kills)')
    .eq('tournament_id', tournament.id)
    .order('created_at', { ascending: true })

  // AUTO-SYNC: Recalculate standings on every page load to ensure data is always fresh
  // We use the admin client to bypass RLS for this system background task
  if (tournament?.id) {
    const adminSupabase = await createAdminClient()
    await recalculateStandings(adminSupabase, tournament.id)
  }

  // Fetch all approved submissions with their evidence files and team info
  const { data: submissions } = await supabase
    .from('submissions')
    .select('*, teams(name, avatar_url), evidence_files(*)')
    .eq('tournament_id', tournament.id)
    .eq('status', 'approved')
    .order('submitted_at', { ascending: false })

  // Fetch real standings (if any approved submissions exist)
  const { data: standings } = await supabase
    .from('team_standings')
    .select('*')
    .eq('tournament_id', tournament.id)

  // Build a map of standings by team_id for quick lookup
  const standingsMap = new Map((standings || []).map((s: any) => [s.team_id, s]))

  // Format standings — build from allTeams so every team is always shown
  // Sort: first by actual rank if exists, then by creation order
  const formattedStandings = (allTeams || []).map((t: any, idx: number) => {
    const s = standingsMap.get(t.id)
    const teamStreams: { name: string; url: string }[] = []
    if (t.stream_url) {
      teamStreams.push({ name: 'Equipo', url: t.stream_url })
    }
    if (t.participants) {
      t.participants.forEach((p: any) => {
        if (p.stream_url) {
          teamStreams.push({ name: p.display_name, url: p.stream_url })
        }
      })
    }

    return {
      teamId: t.id,
      teamName: t.name,
      avatarUrl: t.avatar_url,
      streamUrl: t.stream_url,
      streams: teamStreams,
      totalPoints: s ? Number(s.total_points) : 0,
      totalKills: s ? (s.total_kills ?? 0) : 0,
      killRate: s ? Number(s.kill_rate) : 0,
      potTopCount: s ? (s.pot_top_count ?? 0) : 0,
      vipScore: s ? Number(s.vip_score) : 0,
      rank: s ? s.rank : (idx + 1),
      previousRank: s ? s.previous_rank : (idx + 1),
    }
  }).sort((a, b) => {
    // Sort by points desc, then by kills desc, then by registration order
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills
    return a.rank - b.rank
  })

  // Format teams for the participants tab
  const formattedTeams = (allTeams || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    avatarUrl: t.avatar_url,
    streamUrl: t.stream_url,
    participants: (t.participants || []).map((p: any) => ({
      id: p.id,
      displayName: p.display_name,
      isCaptain: p.is_captain,
      streamUrl: p.stream_url,
    })),
  }))

  const theme = Array.isArray(tournament.leaderboard_themes)
    ? tournament.leaderboard_themes[0]
    : tournament.leaderboard_themes

  // Fetch matches and approved submissions
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('match_number', { ascending: true })

  const formattedMatches = (matches || []).map((m: any) => ({
    id: m.id,
    tournamentId: m.tournament_id,
    name: m.name || `Match ${m.match_number}`,
    matchNumber: m.match_number,
    mapName: m.map_name,
    isCompleted: m.is_completed,
    isWarmup: m.is_warmup,
    roundNumber: m.round_number || 1,
    createdAt: m.created_at
  }))

  const { data: rawSubmissions } = await supabase
    .from('submissions')
    .select(`
      *,
      teams(name, avatar_url),
      evidence_files(*)
    `)
    .eq('tournament_id', tournament.id)
    .eq('status', 'approved')

  const submissions = (rawSubmissions || []).map((s: any) => ({
    id: s.id,
    tournamentId: s.tournament_id,
    matchId: s.match_id,
    teamId: s.team_id,
    submittedBy: s.submitted_by,
    killCount: s.kill_count,
    playerKills: s.player_kills,
    rank: s.rank,
    potTop: s.pot_top,
    status: s.status,
    rejectionReason: s.rejection_reason,
    submittedAt: s.submitted_at,
    teams: s.teams,
    evidenceFiles: (s.evidence_files || []).map((ev: any) => ({
      storagePath: ev.storage_path,
      mimeType: ev.mime_type
    }))
  }))

  // Fetch scoring rule
  const { data: rawScoringRule } = await supabase
    .from('scoring_rules')
    .select('*')
    .eq('tournament_id', tournament.id)
    .single()

  const scoringRule = rawScoringRule ? {
    id: rawScoringRule.id,
    tournamentId: rawScoringRule.tournament_id,
    killPoints: rawScoringRule.kill_points,
    placementPoints: rawScoringRule.placement_points
  } : undefined

  // Flatten and map participants for LeaderboardClient
  const allParticipants = allTeams?.flatMap(t => 
    (t.participants || []).map((p: any) => ({
      id: p.id,
      tournamentId: tournament.id,
      teamId: p.team_id,
      displayName: p.display_name,
      isCaptain: p.is_captain,
      streamUrl: p.stream_url,
      totalKills: p.total_kills || 0
    }))
  ) || []

  return (
    <main className="min-h-screen bg-transparent text-white font-inter">
      <LeaderboardClient 
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        tournamentLogoUrl={tournament.logo_url}
        description={tournament.description}
        format={tournament.format}
        status={tournament.status}
        killRateEnabled={tournament.kill_rate_enabled}
        potTopEnabled={tournament.pot_top_enabled}
        vipEnabled={tournament.vip_enabled}
        initialStandings={formattedStandings}
        teams={formattedTeams}
        theme={theme}
        matches={formattedMatches}
        submissions={submissions || []}
        rulesText={tournament.rules_text}
        scoringRule={scoringRule}
        participants={allParticipants}
      />
    </main>
  )
}
