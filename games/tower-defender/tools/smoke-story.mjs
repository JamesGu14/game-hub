// tools/smoke-story.mjs — [演绎段1] 故事演绎冒烟(spec §8.4):L1 两幕完整走→开战/跳过/续玩/重看/
// L2 生成关模板可见/骑乘立绘(关羽/赵云/马超)裁切目检截图。零 JS 错误为过线。
// 运行(host 侧,沙箱挡 localhost,同 smoke-shots.mjs):
//   1) npm install --prefix /tmp/bw-pup puppeteer-core(已装可跳过)
//   2) cp 本文件到 /tmp/bw-pup/(ESM 裸 import 只在该目录内解析)
//   3) 单次 Bash(禁代理):cd <repo根> && python3 -m http.server 8851 --directory . & sleep 1.5; node /tmp/bw-pup/smoke-story.mjs; kill %1
import puppeteer from 'puppeteer-core';

const URL = 'http://localhost:8851/games/tower-defender/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.env.OUT_PREFIX || '/tmp/td-story';
const errors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--no-proxy-server', '--proxy-bypass-list=*'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() === 404 && !r.url().endsWith('/favicon.ico') && !r.url().includes('/assets/voice/')) errors.push('http404: ' + r.url()); });
await page.goto(URL, { waitUntil: 'networkidle2' });
// QA:解锁全部关卡(写 localStorage save,reload 让游戏重读)
await page.evaluate(() => {
  localStorage.setItem('save_td_v1', JSON.stringify({ version: 1, unlockedLevel: 50, stars: {}, settings: { muted: false, speed: 1 } }));
});
await page.reload({ waitUntil: 'networkidle2' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { await page.screenshot({ path: `${OUT}-${name}.png` }); console.log(`shot → ${OUT}-${name}.png`); };
const clickBtn = async (id) => {
  const b = await page.evaluate((bid) => {
    const L = window.__td.storyLayout();
    return ((L && L.buttons) || []).find((x) => x.id === bid) || null;
  }, id);
  if (!b) throw new Error('幕1 按钮缺失: ' + id);
  await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
};

// ① L1 两幕完整走 → 开战
await page.evaluate(() => window.__td.showStory(0));
await sleep(400); await shot('L1-act1');
await clickBtn('continue'); await sleep(600); await shot('L1-act2-typing');        // 幕2 打字中
let guard = 0;
while ((await page.evaluate(() => window.__td.screen)) === 'story' && guard++ < 40) {   // 点击①全显/②下一句直至 done→开战
  await page.mouse.click(640, 500); await sleep(120);
}
if ((await page.evaluate(() => window.__td.screen)) !== 'playing') errors.push('两幕走完未进战斗');
await shot('L1-battle');

// ①b 语音接线断言(段2):重进 L1 幕1 → 旁白 src;进幕2 → 句1;next → 句2 变化;跳过 → stopVoice
await page.evaluate(() => { window.__td.toSelect(); window.__td.showStory(0); });
await sleep(600);   // 等 registry fetch + playVoice
const vNarr = await page.evaluate(() => window.__td.voiceSrc());
if (!vNarr || !vNarr.includes('assets/voice/')) errors.push('幕1 旁白语音未接: ' + vNarr);
await clickBtn('continue'); await sleep(200);
const v1 = await page.evaluate(() => window.__td.voiceSrc());
await page.mouse.click(640, 500); await sleep(120);   // reveal(语音不换)
await page.mouse.click(640, 500); await sleep(200);   // next → 句2
const v2 = await page.evaluate(() => window.__td.voiceSrc());
if (!v1 || !v2 || v1 === v2) errors.push(`幕2 切句语音未变化: ${v1} → ${v2}`);
const skipB = await page.evaluate(() => window.__td.storyLayout().skip);
await page.mouse.click(skipB.x + skipB.w / 2, skipB.y + skipB.h / 2); await sleep(200);
const vAfterSkip = await page.evaluate(() => window.__td.voiceSrc());
if (vAfterSkip !== null) errors.push('跳过后未 stopVoice: ' + vAfterSkip);

// ② 跳过路径(L2 生成关:模板文案+点将名单可见)
await page.evaluate(() => { window.__td.toSelect(); window.__td.showStory(1); });
await sleep(300); await shot('L2-act1');
await clickBtn('continue'); await sleep(2500); await shot('L2-act2-template');     // 模板句已显出
const skip = await page.evaluate(() => window.__td.storyLayout().skip);
await page.mouse.click(skip.x + skip.w / 2, skip.y + skip.h / 2); await sleep(300);
if ((await page.evaluate(() => window.__td.screen)) !== 'playing') errors.push('跳过未进战斗');

// ③ 续玩路径:造快照 → 重进 L1 幕1 应有 续上次/重头 → 续上次直接恢复(跳过演绎)
await page.evaluate(() => { window.__td.loadLevel(0); window.__td.state.waveIndex = 3; window.__td.persistResume(); window.__td.toSelect(); window.__td.showStory(0); });
await sleep(300);
const ids = await page.evaluate(() => window.__td.storyLayout().buttons.map((b) => b.id).sort());
if (JSON.stringify(ids) !== JSON.stringify(['restart', 'resume'])) errors.push('续玩双钮缺失: ' + ids);
await shot('L1-act1-resume');
await clickBtn('resume'); await sleep(400);
const rw = await page.evaluate(() => ({ screen: window.__td.screen, wave: window.__td.state.waveIndex }));
if (rw.screen !== 'playing' || rw.wave !== 3) errors.push('续上次未恢复到波3: ' + JSON.stringify(rw));

// ④ 重看故事:回对局不重置(金币/波次原样)
const before = await page.evaluate(() => ({ gold: window.__td.state.gold, wave: window.__td.state.waveIndex }));
await page.evaluate(() => window.__td.reviewStory()); await sleep(300); await shot('L1-review-act1');
await clickBtn('continue'); await sleep(300);
const skip2 = await page.evaluate(() => window.__td.storyLayout().skip);
await page.mouse.click(skip2.x + skip2.w / 2, skip2.y + skip2.h / 2); await sleep(300);
const after = await page.evaluate(() => ({ screen: window.__td.screen, gold: window.__td.state.gold, wave: window.__td.state.waveIndex, paused: window.__td.state.paused }));
if (after.screen !== 'playing' || after.wave !== before.wave) errors.push('重看未回对局原样: ' + JSON.stringify({ before, after }));

// ⑤ 骑乘立绘裁切目检:注入测试剧本(关羽/赵云/马超 三阶骑乘图 180×220 顶对齐)
await page.evaluate(() => { window.__td.toSelect(); window.__td.showStory(0); });
await page.evaluate(() => { const st = window.__td.storyState; st.content = { narration: 'x', script: [
  { who: 'guan', text: '关羽立绘裁切目检' }, { who: 'zhao', text: '赵云立绘裁切目检' }, { who: 'ma', text: '马超立绘裁切目检' },
] }; });
await clickBtn('continue'); await sleep(2200); await shot('crop-guan');
await page.mouse.click(640, 500); await sleep(100); await page.mouse.click(640, 500); await sleep(2200); await shot('crop-zhao');
await page.mouse.click(640, 500); await sleep(100); await page.mouse.click(640, 500); await sleep(2200); await shot('crop-ma');

await browser.close();
if (errors.length) { console.error('❌ 冒烟失败:\n' + errors.join('\n')); process.exit(1); }
console.log('ok smoke-story(两幕/跳过/续玩/重看/裁切目检 全过,无 JS 错误)');
