const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse env file
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
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase credentials in .env.local');
    return;
  }
  const supabase = createClient(url, key);
  
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('*, teams(name), matches(name, match_number)')
    .order('submitted_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('Error fetching submissions:', error);
    return;
  }
  
  console.log('LATEST SUBMISSIONS IN DATABASE:');
  console.log(JSON.stringify(submissions, null, 2));
}

check();
