import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugTournament(slug: string) {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!tournament) {
    console.log("No tournament found with slug:", slug)
    return
  }

  console.log("Tournament Found:", { id: tournament.id, name: tournament.name, slug: tournament.slug })

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, created_at')
    .eq('tournament_id', tournament.id)

  console.log("Teams Found:", teams?.map(t => ({ id: t.id, name: t.name, created: t.created_at })))

  const { data: standings } = await supabase
    .from('team_standings')
    .select('team_id, total_points')
    .eq('tournament_id', tournament.id)

  console.log("Standings Found:", standings?.map(s => ({ teamId: s.team_id, pts: s.total_points })))
}

// Get slug from environment or hardcode if known from context (xvi-coup-3ugdmn)
debugTournament('xvi-coup-3ugdmn')
