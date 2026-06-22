const fetch = require('node-fetch');
const fs = require('fs');

async function testYTLive(username) {
  try {
    const url = `https://www.youtube.com/${username}/live`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    const html = await response.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});/);
    if (match) {
      const jsonStr = match[1];
      fs.writeFileSync('scratch/yt_data.json', jsonStr, 'utf8');
      console.log('Saved ytInitialData to scratch/yt_data.json');
    } else {
      console.log('ytInitialData not found');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

testYTLive('@LofiGirl');
