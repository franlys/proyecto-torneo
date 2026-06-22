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

async function syncStreams() {
  const tournamentId = '99aa6551-d52c-4c46-b545-3e514fab2d17';
  
  // 1. Get all teams with their participants
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, stream_url, participants(id, stream_url)')
    .eq('tournament_id', tournamentId);

  if (error) {
    console.error("Error fetching teams:", error);
    return;
  }

  for (const t of teams) {
    // If team has a stream URL and participant stream URL is null, sync it
    if (t.stream_url) {
      for (const p of t.participants) {
        if (!p.stream_url) {
          console.log(`Syncing Participant ${p.id} stream URL to match Team ${t.id} -> ${t.stream_url}`);
          await supabase
            .from('participants')
            .update({ stream_url: t.stream_url })
            .eq('id', p.id);
        }
      }
    } else {
      // If team stream URL is null but participant has one, sync team stream URL to match participant
      const pWithStream = t.participants.find(p => p.stream_url);
      if (pWithStream) {
        console.log(`Syncing Team ${t.id} stream URL to match Participant ${pWithStream.id} -> ${pWithStream.stream_url}`);
        await supabase
          .from('teams')
          .update({ stream_url: pWithStream.stream_url })
          .eq('id', t.id);
      }
    }
  }

  console.log("Sync complete!");
}

syncStreams();
