const fs = require('fs');
const https = require('https');

// Read env
const envContent = fs.readFileSync('c:/Users/elmae/Proyecto-torneos/.env.local', 'utf8');
const apiKeyMatch = envContent.match(/CLASH_ROYALE_API_KEY=(.+)/);
const proxyMatch = envContent.match(/CLASH_ROYALE_PROXY=(.+)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim().replace(/\s+/g,'') : '';
const proxyUrl = proxyMatch ? proxyMatch[1].trim() : '';

if (!apiKey) { console.error('No API key'); process.exit(1); }

const tag = '#2GYRCGCY';
const encodedTag = encodeURIComponent(tag);
const url = `https://api.clashroyale.com/v1/tournaments/${encodedTag}`;

console.log('Fetching tournament:', tag);
console.log('URL:', url);
console.log('Using proxy:', proxyUrl ? 'YES' : 'NO');

let agent;
if (proxyUrl) {
  const { HttpsProxyAgent } = require('https-proxy-agent');
  agent = new HttpsProxyAgent(proxyUrl);
}

const options = {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Accept': 'application/json',
  },
  ...(agent ? { agent } : {})
};

const req = https.request(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('\nHTTP Status:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      console.log('\n--- TOURNAMENT INFO ---');
      console.log('Name:', parsed.name);
      console.log('Status:', parsed.status);
      console.log('Type:', parsed.type);
      console.log('Max Players:', parsed.maxPlayers);
      console.log('Current Players:', parsed.currentPlayers);
      console.log('Duration Seconds:', parsed.durationSeconds);
      console.log('Prep Time Seconds:', parsed.prepTimeSeconds);
      
      const members = parsed.membersList || [];
      console.log('\n--- MEMBERS LIST (' + members.length + ' total) ---');
      members.forEach((m, i) => {
        console.log(`[${i+1}] Rank:${m.rank} | Name:${m.name} | Tag:${m.tag} | Score:${m.score}`);
      });
      
      if (members.length === 0) {
        console.log('⚠️  NO MEMBERS IN LIST - Raw response keys:', Object.keys(parsed));
        console.log('Full raw data:', JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});
req.on('error', err => console.error('Request error:', err.message));
req.end();
