const fetch = require('node-fetch');

async function getYTViewers(youtubeUser) {
  try {
    const url = `https://www.youtube.com/${youtubeUser.startsWith('@') ? youtubeUser : '@' + youtubeUser}/live`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    const html = await response.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});/);
    if (match) {
      const data = JSON.parse(match[1]);
      const viewCountRenderer = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer?.viewCount?.videoViewCountRenderer;
      if (viewCountRenderer && viewCountRenderer.isLive) {
        return parseInt(viewCountRenderer.originalViewCount || '0', 10);
      }
    }
    return 0;
  } catch (err) {
    console.error('Error in getYTViewers:', err.message);
    return 0;
  }
}

async function run() {
  const count = await getYTViewers('LofiGirl');
  console.log('LofiGirl live viewers:', count);
}
run();
