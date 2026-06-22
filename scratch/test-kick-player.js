const fetch = require('node-fetch');

async function testPlayer() {
  try {
    const target = 'https://player.kick.com/lacobraaa';
    console.log('Fetching:', target);
    const start = Date.now();
    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    console.log('Status:', response.status, 'Time:', Date.now() - start, 'ms');
    const text = await response.text();
    console.log('Body snippet:', text.substring(0, 800));
  } catch (err) {
    console.error('Error:', err);
  }
}

testPlayer();
