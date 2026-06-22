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
  
  // Get a participant
  const { data: participants, error: pErr } = await supabase
    .from('participants')
    .select('id, display_name, total_kills')
    .limit(1);

  if (pErr || !participants || participants.length === 0) {
    console.error('No participants found:', pErr);
    return;
  }

  const p = participants[0];
  console.log('Testing upsert for participant:', p);

  const { data, error } = await supabase
    .from('participants')
    .upsert([{ id: p.id, total_kills: (p.total_kills || 0) + 1 }]);

  if (error) {
    console.error('Upsert failed with error:', error);
  } else {
    console.log('Upsert succeeded! Returned data:', data);
  }
}

check();
