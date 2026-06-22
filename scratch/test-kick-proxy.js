const fetch = require('node-fetch');

async function testHackmap(url) {
  try {
    const start = Date.now();
    const response = await fetch(url);
    console.log(`URL: ${url}`);
    console.log(`Status:`, response.status, 'Time:', Date.now() - start, 'ms');
    const text = await response.text();
    console.log(`Snippet:`, text.substring(0, 500));
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

async function run() {
  await testHackmap('https://kickapi.hackmap.win/channels/lacobraaa');
  await testHackmap('https://kickapi.hackmap.win/api/v1/channels/lacobraaa');
}

run();
