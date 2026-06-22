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
  
  // Get all participants stream urls
  const { data: participants } = await supabase
    .from('participants')
    .select('id, display_name, stream_url')
    .eq('tournament_id', tId);

  console.log('Participants Stream URLs:');
  console.log(JSON.stringify(participants, null, 2));
}

check();
