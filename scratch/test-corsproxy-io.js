const fetch = require('node-fetch');

async function testCorsProxy() {
  try {
    const target = 'https://kick.com/api/v1/channels/lacobraaa';
    const response = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(target)}`);
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Body:', text.substring(0, 500));
  } catch (err) {
    console.error('Error:', err);
  }
}

testCorsProxy();
