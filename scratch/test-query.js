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

async function checkQuery() {
  const tournamentId = '99aa6551-d52c-4c46-b545-3e514fab2d17';
  
  const { data: teams, error } = await supabase
    .from('teams')
    .select('stream_url, participants(stream_url)')
    .eq('tournament_id', tournamentId);

  if (error) {
    console.error("Query Error:", error);
    return;
  }

  console.log("Query Result:");
  console.log(JSON.stringify(teams, null, 2));
}

checkQuery();
