const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/yt_data.json', 'utf8'));

try {
  const primaryInfo = data.contents.twoColumnWatchNextResults.results.results.contents[0].videoPrimaryInfoRenderer;
  const viewCountRenderer = primaryInfo.viewCount.videoViewCountRenderer;
  console.log('viewCountRenderer:', JSON.stringify(viewCountRenderer, null, 2));
} catch (err) {
  console.error('Error navigating path:', err.message);
}
