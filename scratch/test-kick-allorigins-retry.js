const fetch = require('node-fetch');

async function fetchKickViewersWithRetry(username, retries = 4) {
  const target = `https://kick.com/api/v1/channels/${username.toLowerCase()}`;
  const url = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[${username}] Attempt ${i + 1} starting...`);
      const start = Date.now();
      
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000); // 4s timeout
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      
      const duration = Date.now() - start;
      console.log(`[${username}] Attempt ${i + 1} response status:`, response.status, `Time: ${duration}ms`);
      
      if (response.status === 200) {
        const json = await response.json();
        if (json.contents) {
          // AllOrigins sometimes returns HTML error inside the contents string
          if (json.contents.startsWith('<!DOCTYPE html>') || json.contents.includes('<html')) {
            console.log(`[${username}] Attempt ${i + 1} contents contains HTML block. Retrying...`);
            continue;
          }
          const data = JSON.parse(json.contents);
          console.log(`[${username}] Successfully parsed channel JSON!`);
          return data?.livestream?.viewer_count || 0;
        }
      }
    } catch (err) {
      console.log(`[${username}] Attempt ${i + 1} error:`, err.message);
    }
    // Small delay before retrying
    await new Promise(r => setTimeout(r, 800));
  }
  return 0; // fallback to 0 instead of simulating
}

async function run() {
  const count = await fetchKickViewersWithRetry('lacobraaa');
  console.log('Final Result for lacobraaa:', count);
}
run();
