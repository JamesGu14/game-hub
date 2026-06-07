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
await sleep(1000);                 // cross bossX -> boss intro (freeze + camera pan)
await page.keyboard.up('ArrowRight');
await sleep(6500);                 // wait out the ~3.6s reveal, then laser melts the boss
await page.keyboard.up('z');

const cleared = await page.evaluate(() => ({ state: window.__game?.state }));

// reload -> the save must persist (real localStorage in Chrome)
await page.reload({ waitUntil: 'networkidle0' });
const save = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('jungle-warrior-save')); } catch { return null; } });
// M4: jump straight to the final level + its multi-phase boss, verify it engages in-browser.
const l5 = await page.evaluate(() => {
  const g = window.__game;
  g.startLevel(4); g._startPlaying();
  g.player.weapon = 'laser';
  g.player.x = g.level.bossX - 60;
  return { lvl: g.level.id, bossType: g.level.bossType };
});
await page.keyboard.down('ArrowRight'); await sleep(1000); await page.keyboard.up('ArrowRight');
await sleep(1400); // capture the boss-reveal hold
await page.screenshot({ path: 'tests/_smoke_intro.png' });
await page.keyboard.down('z'); await sleep(7000); await page.keyboard.up('z');
const l5boss = await page.evaluate(() => {
  const g = window.__game;
  return {
    lvl: g.level?.id, bossType: g.boss?.typeId, bossSpawned: !!g.boss,
    bossHurt: g.boss ? g.boss.hp < g.boss.maxHp : false,
    phases: g.boss ? g.boss.cfg.phases.length : 0,
  };
});
await page.screenshot({ path: 'tests/_smoke.png' });
await browser.close();

if (errors.length) { console.error('SMOKE FAIL — page errors:\n' + errors.join('\n')); process.exit(1); }
const l1ok = cleared.state === 'clear' && save?.perLevel?.['1']?.cleared === true && (save?.unlockedMax || 0) >= 2;
const l5ok = l5.lvl === 'L5' && l5boss.bossType === 'gomera' && l5boss.bossSpawned && l5boss.bossHurt && l5boss.phases === 3;
if (!(l1ok && l5ok)) {
  console.error('SMOKE FAIL', { l1ok, l5ok, cleared, unlockedMax: save?.unlockedMax, l5, l5boss }); process.exit(1);
}
console.log(`SMOKE PASS — L1 cleared+persisted (unlockedMax=${save.unlockedMax}); L5 boss=${l5boss.bossType} (${l5boss.phases} phases) engaged hp<max`);
