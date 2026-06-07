// M1 load-level smoke for 炮炮虫. Run via puppeteer-core + system Chrome.
// NOTE: bare `import 'puppeteer-core'` only resolves when this file is copied into
// the dir where puppeteer-core is installed (e.g. /tmp/bw-pup). See memory
// boom-worms-smoke-test-setup. Exit non-zero on any failure.
import puppeteer from 'puppeteer-core';

const URL = 'http://localhost:8850/games/boom-worms/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const errors = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--no-proxy-server', '--proxy-bypass-list=*'],
});
const page = await browser.newPage();
const isFavicon = (u) => u.endsWith('/favicon.ico');
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  // Resource-load failures (e.g. the favicon 404) surface here WITHOUT a URL and are
  // network noise, not JS errors — they're judged by the response/requestfailed
  // handlers below (which can see the URL and ignore the favicon).
  if (t.startsWith('Failed to load resource')) return;
  errors.push('console: ' + t);
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => {
  if (!isFavicon(r.url())) errors.push('requestfailed: ' + r.url());
});
page.on('response', (r) => {
  if (r.status() === 404 && !isFavicon(r.url())) errors.push('http404: ' + r.url());
});

await page.goto(URL, { waitUntil: 'networkidle2' });

// 1) Open level select from the menu
await page.click('#btn-solo');
await page.waitForSelector('#overlay-levelselect.show', { timeout: 3000 });

// 2) 15 nodes, fresh save (v2 key) → node 1 = next, 2..15 = locked
const states = await page.$$eval('#levelselect-track .ls-node', (ns) =>
  ns.map((n) => n.classList.contains('cleared') ? 'c'
    : n.classList.contains('next') ? 'n'
    : n.classList.contains('locked') ? 'l' : '?'));
const nodeCount = states.length;
const freshOk = states[0] === 'n' && states.slice(1).every((s) => s === 'l');
await page.screenshot({ path: '/tmp/bw-m1-select.png' });

// 3) Click the next node (level 1) → game starts, overlay hides
await page.click('#levelselect-track .ls-node.next');
await page.waitForFunction(
  () => !document.getElementById('overlay-levelselect').classList.contains('show'),
  { timeout: 3000 });
// terrain should now exist (game running)
const inPlay = await page.evaluate(() => {
  const c = document.getElementById('game');
  return !!(c && c.width > 0);
});
await page.screenshot({ path: '/tmp/bw-m1-play.png' });

await browser.close();

console.log(`nodes=${nodeCount} fresh-unlock=${freshOk} in-play=${inPlay} errors=${errors.length}`);
if (errors.length) console.log(errors.join('\n'));
if (nodeCount !== 15 || !freshOk || !inPlay || errors.length) {
  console.log('M1 SMOKE FAIL');
  process.exit(1);
}
console.log('M1 SMOKE PASS');
