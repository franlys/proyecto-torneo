const fetch = require('node-fetch');

async function testProxy(name, url) {
  try {
    const start = Date.now();
    const response = await fetch(url, { timeout: 8000 });
    console.log(`[${name}] Status:`, response.status, 'Time:', Date.now() - start, 'ms');
    const text = await response.text();
    console.log(`[${name}] Snippet:`, text.substring(0, 300));
  } catch (err) {
    console.error(`[${name}] Error:`, err.message);
  }
}

async function run() {
  const target = 'https://kick.com/api/v1/channels/lacobraaa';
  await testProxy('CorsEuOrg', `https://cors.eu.org/${target}`);
  await testProxy('AllOriginsRaw', `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`);
}

run();
