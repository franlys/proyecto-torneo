const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://otssvwinchttedisfqtr.supabase.co';
const supabaseKey = 'sb_publishable_p2fVfPXNLmehYppcTb-2bQ_CLaIvB6G';
const supabase = createClient(supabaseUrl, supabaseKey);

// Tournament ID for FRANLYS tournament
const tournamentId = '57c3c258-c221-4b40-bcbc-e92eb1ac45e4';

async function run() {
  console.log('=== TEAMS ===');
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, avatar_url')
    .eq('tournament_id', tournamentId);
  console.log(JSON.stringify(teams, null, 2));

  console.log('\n=== PARTICIPANTS ===');
  const { data: participants } = await supabase
    .from('participants')
    .select('id, team_id, display_name, contact_id, is_captain')
    .eq('tournament_id', tournamentId);
  console.log(JSON.stringify(participants, null, 2));

  console.log('\n=== TEAM STANDINGS ===');
  const { data: standings } = await supabase
    .from('team_standings')
    .select('team_id, rank, total_points, total_kills, pot_top_count')
    .eq('tournament_id', tournamentId)
    .order('rank');
  console.log(JSON.stringify(standings, null, 2));
}

run().catch(console.error);
