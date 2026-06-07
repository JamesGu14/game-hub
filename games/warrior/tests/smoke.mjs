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

async function holdKey(key, ms) { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); }

// title -> select -> pick the first (unlocked) level -> ready
await page.click('#btn-start');
await sleep(250);
await page.click('#select-grid .level-card');
await sleep(250);
await holdKey('x', 60);            // ready -> playing

// run & gun, then fast-forward to the boss arena + laser (verify boss wiring in-browser)
await page.keyboard.down('ArrowRight');
await page.keyboard.down('z');
await sleep(2000);
await page.keyboard.up('ArrowRight');
await page.evaluate(() => {
  const g = window.__game;
  if (g && g.player && g.level && g.level.bossX != null) { g.player.weapon = 'laser'; g.player.x = g.level.bossX - 60; }
});
await page.keyboard.down('ArrowRight');
await sleep(600);
await page.keyboard.up('ArrowRight');
await sleep(4500);
await page.keyboard.up('z');

const cleared = await page.evaluate(() => ({ state: window.__game?.state }));

// reload -> the save must persist (real localStorage in Chrome)
await page.reload({ waitUntil: 'networkidle0' });
const save = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('jungle-warrior-save')); } catch { return null; } });
await page.click('#btn-start'); await sleep(250); // show the select grid (L1 should now have ⭐)
await page.screenshot({ path: 'tests/_smoke.png' });
await browser.close();

if (errors.length) { console.error('SMOKE FAIL — page errors:\n' + errors.join('\n')); process.exit(1); }
const l1cleared = save?.perLevel?.['1']?.cleared === true;
const l2unlocked = (save?.unlockedMax || 0) >= 2;
if (!(cleared.state === 'clear' && l1cleared && l2unlocked)) {
  console.error('SMOKE FAIL', { state: cleared.state, l1cleared, l2unlocked, save }); process.exit(1);
}
console.log(`SMOKE PASS — L1 cleared (⭐${save.perLevel['1'].bestStars}), persisted after reload (unlockedMax=${save.unlockedMax})`);
