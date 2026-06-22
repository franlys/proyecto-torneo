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

async function run() {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const tournamentId = '2baf60dd-02fc-4ce0-9a3e-7ec451ced8b4';
  
  console.log('Starting manual recalculateStandings for:', tournamentId);
  
  // We can't import typescript action files directly in pure Node without ts-node,
  // but we can replicate the recalculateStandings participant kills update logic here,
  // OR we can just write it in JS and run it!
  
  // 1. Fetch all approved submissions
  const { data: subs, error: sErr } = await supabase
    .from('submissions')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('status', 'approved');
    
  if (sErr) {
    console.error('Error fetching submissions:', sErr);
    return;
  }
  
  console.log(`Found ${subs.length} approved submissions.`);
  
  // 2. Aggregate kills per participant
  const playerKillsMap = {};
  for (const s of subs) {
    if (s.player_kills && typeof s.player_kills === 'object') {
      Object.entries(s.player_kills).forEach(([pId, kills]) => {
        playerKillsMap[pId] = (playerKillsMap[pId] || 0) + Number(kills);
      });
    }
  }
  
  const playerUpdates = Object.entries(playerKillsMap).map(([id, total_kills]) => ({
    id,
    total_kills
  }));
  
  console.log('Player updates to apply:', playerUpdates);
  
  if (playerUpdates.length > 0) {
    console.log(`Updating total_kills for ${playerUpdates.length} participants...`);
    const updatePromises = playerUpdates.map(async (update) => {
      const { error: pErr } = await supabase
        .from('participants')
        .update({ total_kills: update.total_kills })
        .eq('id', update.id);
      if (pErr) {
        console.error(`Failed to update participant ${update.id}:`, pErr.message);
      }
    });
    await Promise.all(updatePromises);
    console.log('Kills updated successfully in database!');
  } else {
    console.log('No player updates needed.');
  }
}

run();
