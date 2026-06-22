const fetch = require('node-fetch');

async function testAllOriginsOnce(i) {
  try {
    const target = 'https://kick.com/api/v1/channels/lacobraaa';
    const start = Date.now();
    const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`);
    const duration = Date.now() - start;
    if (response.status === 200) {
      const json = await response.json();
      if (json.contents) {
        const data = JSON.parse(json.contents);
        console.log(`[Try ${i}] SUCCESS: status=200, time=${duration}ms, live=${data.livestream !== null}`);
        return true;
      }
    }
    console.log(`[Try ${i}] FAILED: status=${response.status}, time=${duration}ms`);
    return false;
  } catch (err) {
    console.log(`[Try ${i}] ERROR: ${err.message}`);
    return false;
  }
}

async function run() {
  console.log('Testing AllOrigins reliability...');
  let successCount = 0;
  for (let i = 1; i <= 5; i++) {
    const success = await testAllOriginsOnce(i);
    if (success) successCount++;
    // wait 1s between tries
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`Summary: ${successCount}/5 succeeded`);
}

run();
