const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('c:/Users/elmae/Proyecto-torneos/.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const tId = '99aa6551-d52c-4c46-b545-3e514fab2d17';
  
  // 1. Get tournament info
  const { data: tourney } = await supabase.from('tournaments').select('*').eq('id', tId).single();
  console.log('Tournament:', {
    id: tourney.id,
    name: tourney.name,
    status: tourney.status,
    discipline: tourney.discipline,
    total_live_viewers: tourney.total_live_viewers
  });

  // 2. Get teams and participants
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, stream_url, participants(id, display_name, stream_url)')
    .eq('tournament_id', tId);

  console.log('Teams & Participants:');
  console.log(JSON.stringify(teams, null, 2));
}

check();
