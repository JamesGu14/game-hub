// tools/smoke-shots.mjs — 每章 1 关进局截图(板型+地形 spec §7 冒烟)。
// 运行环境(host 侧,沙箱挡 localhost,见记忆 boom-worms-smoke-test-setup):
//   1) npm install --prefix /tmp/bw-pup puppeteer-core
//   2) cp 本文件到 /tmp/bw-pup/(ESM 裸 import 只在该目录内解析)
//   3) 单次 Bash(禁代理):python3 -m http.server 8850 --directory <repo根> & sleep 1.5; node /tmp/bw-pup/smoke-shots.mjs; kill %1
// 关号可由环境变量 SHOT_LEVELS 覆盖(逗号分隔),默认每章 1 关(k=1..5 区间生成关,看变体)。
import puppeteer from 'puppeteer-core';

const URL = 'http://localhost:8850/games/tower-defender/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT_LEVELS = (process.env.SHOT_LEVELS || '2,13,24,35,46').split(',').map(Number);
const OUT_PREFIX = process.env.OUT_PREFIX || '/tmp/td';
const errors = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--no-proxy-server', '--proxy-bypass-list=*'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const isFavicon = (u) => u.endsWith('/favicon.ico');
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (t.startsWith('Failed to load resource')) return;   // 资源 404 由 response 钩子按 URL 判
  errors.push('console: ' + t);
});
page.on('requestfailed', (r) => { if (!isFavicon(r.url())) errors.push('requestfailed: ' + r.url()); });
page.on('response', (r) => { if (r.status() === 404 && !isFavicon(r.url())) errors.push('http404: ' + r.url()); });

await page.goto(URL, { waitUntil: 'networkidle2' });

for (const id of SHOT_LEVELS) {
  await page.evaluate((n) => window.__td.loadLevel(n - 1), id);
  await new Promise((r) => setTimeout(r, 700));   // 等渲染帧+建筑贴图
  const out = `${OUT_PREFIX}-L${id}.png`;
  await page.screenshot({ path: out });
  console.log(`shot L${id} → ${out}`);
}
await browser.close();
if (errors.length) { console.error('❌ 页面错误:\n' + errors.join('\n')); process.exit(1); }
console.log(`ok smoke-shots(${SHOT_LEVELS.length} 关截图,无 JS 错误)`);
