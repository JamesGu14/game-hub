// smoke-ch1.mjs — host-side puppeteer-core + 系统 Chrome 冒烟（参照 boom-worms/tests/smoke-m1.mjs）。
// 运行前提见 MEMORY「BOOM WORMS smoke-test setup」：copy 到装有 puppeteer-core 的目录、系统 Chrome 路径。
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8872;
const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.env.HUB_ROOT || '../../..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const errors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror:' + e.message));
  await page.goto(`http://localhost:${PORT}/games/bomb-zombie/index.html`, { waitUntil: 'networkidle2' });
  await page.click('#btn-start');
  // 选第1关
  await page.waitForSelector('#ls-track .ls-node:not(.locked)');
  await page.click('#ls-track .ls-node:not(.locked)');
  await new Promise((r) => setTimeout(r, 6000));   // 跑6秒战斗
  const ok = await page.evaluate(() => !!document.getElementById('game'));
  if (!ok) errors.push('canvas missing');
  if (errors.length) { console.error('❌ 冒烟失败:\n' + errors.join('\n')); process.exitCode = 1; }
  else console.log('✅ 第1章冒烟通过：页面无报错、战斗运行');
} finally { await browser.close(); srv.kill(); }
