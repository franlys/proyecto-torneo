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

async function run() {
  console.log('Fetching all tournaments...');
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, name, status, total_live_viewers');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Tournaments:', JSON.stringify(data, null, 2));
  }
}

run();
