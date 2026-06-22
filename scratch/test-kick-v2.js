const fetch = require('node-fetch');
async function test() {
  try {
    const response = await fetch('https://kick.com/api/v2/channels/westcol', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    console.log('Status v2:', response.status);
    const text = await response.text();
    console.log('Body snippet:', text.substring(0, 500));
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
