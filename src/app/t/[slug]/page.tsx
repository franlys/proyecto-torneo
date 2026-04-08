export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeaderboardClient } from './LeaderboardClient'

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
    .select('id, name, avatar_url, stream_url, participants(id, display_name, is_captain, stream_url)')
    .eq('tournament_id', tournament.id)
    .order('created_at', { ascending: true })

  // Backfill standings for any team that doesn't have a row yet
  if (allTeams && allTeams.length > 0) {
    const { data: existingStandings } = await supabase
      .from('team_standings')
      .select('team_id')
      .eq('tournament_id', tournament.id)

    const existingIds = new Set((existingStandings || []).map((s: any) => s.team_id))
    const missingTeams = allTeams.filter((t: any) => !existingIds.has(t.id))

    if (missingTeams.length > 0) {
      await supabase.from('team_standings').upsert(
        missingTeams.map((t: any, i: number) => ({
          tournament_id: tournament.id,
          team_id: t.id,
          total_points: 0,
          total_kills: 0,
          kill_rate: 0,
          pot_top_count: 0,
          vip_score: 0,
          rank: 99 + i,
          previous_rank: 99 + i,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'tournament_id,team_id' }
      )
    }
  }

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

  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      *,
      teams(name, avatar_url),
      evidence_files(*)
    `)
    .eq('tournament_id', tournament.id)
    .eq('status', 'approved')

  return (
    <main className="min-h-screen bg-dark-bg text-white font-inter">
      <LeaderboardClient 
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        description={tournament.description}
        format={tournament.format}
        status={tournament.status}
        killRateEnabled={tournament.kill_rate_enabled}
        potTopEnabled={tournament.pot_top_enabled}
        vipEnabled={tournament.vip_enabled}
        initialStandings={formattedStandings}
        teams={formattedTeams}
        theme={theme}
        matches={matches || []}
        submissions={submissions || []}
        rulesText={tournament.rules_text}
      />
    </main>
  )
}
