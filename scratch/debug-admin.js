const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Read env to get service role key
const envContent = fs.readFileSync('c:/Users/elmae/Proyecto-torneos/.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const serviceMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const anonMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : 'https://otssvwinchttedisfqtr.supabase.co';
const serviceKey = serviceMatch ? serviceMatch[1].trim() : null;
const anonKey = anonMatch ? anonMatch[1].trim() : null;

console.log('URL:', supabaseUrl);
console.log('Service key found:', !!serviceKey);
console.log('Anon key found:', !!anonKey);

const supabase = createClient(supabaseUrl, serviceKey || anonKey);

async function run() {
  // First get ALL clash royale tournaments
  console.log('\n=== ALL CLASH ROYALE TOURNAMENTS ===');
  const { data: allTourneys, error: allErr } = await supabase
    .from('tournaments')
    .select('id, name, slug, status, discipline, clash_royale_tag')
    .eq('discipline', 'clash_royale');
  
  if (allErr) console.error('Error:', allErr);
  else console.log(JSON.stringify(allTourneys, null, 2));

  if (!allTourneys || allTourneys.length === 0) return;

  for (const t of allTourneys) {
    console.log(`\n=== TOURNAMENT: ${t.name} (${t.id}) STATUS: ${t.status} ===`);
    
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name')
      .eq('tournament_id', t.id);
    console.log('Teams:', JSON.stringify(teams));

    const { data: standings } = await supabase
      .from('team_standings')
      .select('team_id, rank, total_points, pot_top_count')
      .eq('tournament_id', t.id)
      .order('rank');
    console.log('Standings:', JSON.stringify(standings));
  }
}

run().catch(console.error);
