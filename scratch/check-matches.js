const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

async function check() {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select('id, name, status, format, discipline')
    .order('created_at', { ascending: false })
    .limit(5);

  if (tErr) {
    console.error('Error fetching tournaments:', tErr);
    return;
  }
  
  console.log('LATEST TOURNAMENTS:');
  console.log(tournaments);

  for (const t of tournaments) {
    const { data: matches, error: mErr } = await supabase
      .from('matches')
      .select('id, name, match_number, is_active, is_completed, parent_match_id, round_number')
      .eq('tournament_id', t.id);

    if (mErr) {
      console.error(`Error fetching matches for ${t.name}:`, mErr);
      continue;
    }

    console.log(`\nMATCHES FOR: ${t.name} (ID: ${t.id})`);
    console.log(matches);
  }
}

check();
