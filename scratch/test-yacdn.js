const fetch = require('node-fetch');

async function testYacdn() {
  try {
    const target = 'https://kick.com/api/v1/channels/lacobraaa';
    const url = `https://yacdn.org/proxy/${target}`;
    console.log('Fetching:', url);
    const start = Date.now();
    const response = await fetch(url);
    console.log('Status:', response.status, 'Time:', Date.now() - start, 'ms');
    const text = await response.text();
    console.log('Snippet:', text.substring(0, 500));
  } catch (err) {
    console.error('Error:', err);
  }
}

testYacdn();
