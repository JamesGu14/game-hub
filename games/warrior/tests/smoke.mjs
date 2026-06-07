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
// run & gun a bit (verifies normal play)
await page.keyboard.down('ArrowRight');
await page.keyboard.down('z');
await sleep(2500);
await page.keyboard.up('ArrowRight');

// Fast-forward to the boss arena with a strong weapon — we're verifying the boss
// WIRING + render in-browser, not the player's stamina across 8 screens.
await page.evaluate(() => {
  const g = window.__game;
  if (g && g.player && g.level && g.level.bossX != null) {
    g.player.weapon = 'laser';
    g.player.x = g.level.bossX - 60;
  }
});
await page.keyboard.down('ArrowRight');
await sleep(600);                  // cross bossX -> spawn the boss
await page.keyboard.up('ArrowRight');
await sleep(4500);                 // laser the boss
await page.keyboard.up('z');

const state = await page.evaluate(() => {
  const g = window.__game;
  return {
    state: g?.state,
    x: Math.round(g?.player?.x ?? 0),
    score: g?.score ?? 0,
    bossSpawned: !!g?.boss,
    bossHurt: g?.boss ? g.boss.hp < g.boss.maxHp : false,
    bossHp: g?.boss ? g.boss.hp : null,
  };
});

await page.screenshot({ path: 'tests/_smoke.png' });
await browser.close();

if (errors.length) { console.error('SMOKE FAIL — page errors:\n' + errors.join('\n')); process.exit(1); }
const ok = state.state === 'clear' || (state.bossSpawned && state.bossHurt);
if (!ok) { console.error('SMOKE FAIL — boss not engaged', state); process.exit(1); }
console.log(`SMOKE PASS — state=${state.state} bossSpawned=${state.bossSpawned} bossHp=${state.bossHp} score=${state.score} (see tests/_smoke.png)`);
