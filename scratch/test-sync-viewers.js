const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

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

async function fetchKickViewersWithRetry(username, retries = 4) {
  const target = `https://kick.com/api/v1/channels/${username.toLowerCase()}`;
  const url = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[KICK SYNC] Fetching ${username} via AllOrigins (Attempt ${i + 1})...`);
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      
      if (response.status === 200) {
        const json = await response.json();
        if (json.contents) {
          if (json.contents.startsWith('<!DOCTYPE html>') || json.contents.includes('<html')) {
            console.log(`[KICK SYNC] Attempt ${i + 1} blocked by Cloudflare (HTML received).`);
            continue;
          }
          const data = JSON.parse(json.contents);
          const count = data?.livestream?.viewer_count || 0;
          console.log(`[KICK SYNC] Successfully fetched viewers for ${username}: ${count}`);
          return count;
        }
      }
    } catch (err) {
      console.warn(`[KICK SYNC] Attempt ${i + 1} failed for ${username}:`, err.message);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.warn(`[KICK SYNC] All attempts failed for ${username}. Returning 0.`);
  return 0;
}

async function fetchYoutubeViewers(youtubeUser) {
  try {
    const formattedUser = youtubeUser.startsWith('@') ? youtubeUser : '@' + youtubeUser;
    const url = `https://www.youtube.com/${formattedUser}/live`;
    console.log(`[YT SYNC] Fetching ${formattedUser} live page...`);
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal
    });
    clearTimeout(id);
    
    const html = await response.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});/);
    if (match) {
      const data = JSON.parse(match[1]);
      const viewCountRenderer = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer?.viewCount?.videoViewCountRenderer;
      if (viewCountRenderer && viewCountRenderer.isLive) {
        const count = parseInt(viewCountRenderer.originalViewCount || '0', 10);
        console.log(`[YT SYNC] Successfully fetched viewers for ${formattedUser}: ${count}`);
        return count;
      }
    }
    console.log(`[YT SYNC] ${formattedUser} is not live.`);
  } catch (err) {
    console.error(`[YT SYNC] Error fetching youtube viewers for ${youtubeUser}:`, err.message);
  }
  return 0;
}

async function testSyncViewers() {
  const tournamentId = '99aa6551-d52c-4c46-b545-3e514fab2d17';
  console.log(`Starting sync test for tournament: ${tournamentId}`);
  
  // 1. Fetch all teams and participants stream URLs for this tournament
  const { data: teams } = await supabase
    .from('teams')
    .select('stream_url, participants(stream_url)')
    .eq('tournament_id', tournamentId);

  if (!teams) {
    console.log("No teams found");
    return;
  }

  const urls = [];
  for (const t of teams) {
    if (t.stream_url) urls.push(t.stream_url);
    if (t.participants) {
      for (const p of t.participants) {
        if (p.stream_url) urls.push(p.stream_url);
      }
    }
  }

  const uniqueUrls = Array.from(new Set(urls.map(u => u.trim()).filter(Boolean)));
  console.log("Unique URLs collected:", uniqueUrls);

  let totalViewers = 0;

  for (const url of uniqueUrls) {
    const twitchUser = url.match(/(?:twitch\.tv\/)([\w\-]+)/)?.[1];
    const kickUser = url.match(/(?:kick\.com\/)([\w\-]+)/)?.[1];
    const youtubeUser = url.match(/(?:youtube\.com\/(?:c\/|channel\/|user\/|@)?|youtu\.be\/)([\w\-]+)/)?.[1];

    let viewers = 0;

    if (twitchUser) {
      try {
        console.log(`[TWITCH SYNC] Fetching ${twitchUser} via GQL...`);
        const response = await fetch('https://gql.twitch.tv/gql', {
          method: 'POST',
          headers: {
            'Client-Id': 'kimne78kx3ncx6brgo9wj607yyq771',
            'Content-Type': 'text/plain',
          },
          body: JSON.stringify([
            {
              operationName: 'StreamRefetchHeartbeat',
              variables: {
                channelName: twitchUser.toLowerCase(),
              },
              extensions: {
                persistedQuery: {
                  version: 1,
                  sha256Hash: '05e6e59aa28aa370e44b942fe2931a72d1746200236a997cfd9006900f684a86',
                },
              },
            },
          ]),
        });
        const data = await response.json();
        viewers = data[0]?.data?.user?.stream?.viewersCount || 0;
        console.log(`[TWITCH SYNC] Successfully fetched viewers for ${twitchUser}: ${viewers}`);
      } catch (err) {
        console.error(`[TWITCH SYNC] Error fetching twitch viewers for ${twitchUser}:`, err.message);
      }
    } else if (kickUser) {
      viewers = await fetchKickViewersWithRetry(kickUser);
    } else if (youtubeUser) {
      viewers = await fetchYoutubeViewers(youtubeUser);
    }

    totalViewers += viewers;
  }

  console.log(`Calculated Total Viewers: ${totalViewers}`);
  
  // Update the tournament in DB
  const { data: updateRes, error: updateErr } = await supabase
    .from('tournaments')
    .update({ total_live_viewers: totalViewers })
    .eq('id', tournamentId)
    .select('id, total_live_viewers');

  if (updateErr) {
    console.error("DB update error:", updateErr.message);
  } else {
    console.log("DB update successful:", updateRes);
  }
}

testSyncViewers();
