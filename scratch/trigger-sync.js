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

async function triggerSync() {
  const tournamentId = '99aa6551-d52c-4c46-b545-3e514fab2d17';
  
  // Import recalculateStandings from submissions.ts
  // Wait, submissions.ts exports recalculateStandings. We can import it by running a node script that uses next/babel or ts-node,
  // or we can just fetch the local API route since the server is running or we can use node-fetch to call the API endpoint!
  // Wait, let's fetch the local route or the production route!
  // The production URL is: https://proyecto-torneo.vercel.app/api/sync-standings?tournamentId=99aa6551-d52c-4c46-b545-3e514fab2d17
  
  try {
    const fetch = require('node-fetch');
    const response = await fetch(`https://proyecto-torneo.vercel.app/api/sync-standings?tournamentId=${tournamentId}`);
    const data = await response.json();
    console.log("Sync Response:", data);
  } catch (err) {
    console.error("Error triggering sync:", err);
  }
}

triggerSync();
