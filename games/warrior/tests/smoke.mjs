// Host-side browser smoke for 丛林勇士 M1. Requires a static server at :8000 and a
// system Chrome. Run from games/warrior/:
//   (repo root) python3 -m http.server 8000   &
//   CHROME=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
//     node tests/smoke.mjs
// Exits non-zero on failure. Skips gracefully if puppeteer-core/Chrome are absent.

import { setTimeout as sleep } from 'node:timers/promises';

let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; }
catch { console.log('SKIP: puppeteer-core not installed'); process.exit(0); }

const CHROME = process.env.CHROME
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL || 'http://localhost:8000/games/warrior/index.html';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--no-proxy-server'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  // Ignore universal browser noise (no favicon served) — only real JS errors matter.
  if (/favicon\.ico/.test(t) || /Failed to load resource/.test(t)) return;
  errors.push(t);
});

await page.setViewport({ width: 900, height: 600 });
await page.goto(URL, { waitUntil: 'networkidle0' });

// title -> start
await page.click('#btn-start');
await sleep(200);

// drive the game: press X to start playing, then hold Right + Z to advance & shoot
async function holdKey(key, ms) {
  await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key);
}
await holdKey('x', 60);            // ready -> playing
await page.keyboard.down('ArrowRight');
await page.keyboard.down('z');
await sleep(2500);                 // run & gun for a bit
await page.keyboard.up('z');
await page.keyboard.up('ArrowRight');

const state = await page.evaluate(() => ({
  state: window.__game?.state,
  x: window.__game?.player?.x ?? 0,
  score: window.__game?.score ?? 0,
}));

await page.screenshot({ path: 'tests/_smoke.png' });
await browser.close();

if (errors.length) { console.error('SMOKE FAIL — page errors:\n' + errors.join('\n')); process.exit(1); }
if (!['playing', 'clear'].includes(state.state)) {
  console.error('SMOKE FAIL — unexpected state', state); process.exit(1);
}
console.log(`SMOKE PASS — state=${state.state} x=${Math.round(state.x)} score=${state.score} (see tests/_smoke.png)`);
