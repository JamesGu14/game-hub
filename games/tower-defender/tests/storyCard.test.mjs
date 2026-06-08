// tests/storyCard.test.mjs — 故事卡 layout/hit 自洽 + stub ctx 不抛 + save/restore 平衡
// 运行：node games/tower-defender/tests/storyCard.test.mjs
import assert from 'node:assert';
import { storyCardLayout, hitStoryCard, drawStoryCard } from '../src/ui/storyCard.js';

const view = { w: 1280, h: 800 };

// 无续玩：单「继续」钮
{
  const L = storyCardLayout(view, false);
  assert.equal(L.buttons.length, 1, '无续玩 → 1 钮');
  assert.equal(L.buttons[0].id, 'continue');
  const b = L.buttons[0];
  assert.equal(hitStoryCard(view, false, b.x + 2, b.y + 2), 'continue', '命中继续');
  assert.equal(hitStoryCard(view, false, 1, 1), null, '空白 → null');
}

// 有续玩：续上次 + 重头 两钮
{
  const L = storyCardLayout(view, true);
  assert.equal(L.buttons.length, 2, '有续玩 → 2 钮');
  const ids = L.buttons.map((b) => b.id).sort();
  assert.deepEqual(ids, ['restart', 'resume'], '续上次/重头');
  const resume = L.buttons.find((b) => b.id === 'resume');
  assert.equal(hitStoryCard(view, true, resume.x + 2, resume.y + 2), 'resume', '命中续上次');
}

// stub ctx：draw 不抛 + save/restore 平衡
{
  let depth = 0, maxNeg = 0;
  const ctx = new Proxy({
    save() { depth++; }, restore() { depth--; if (depth < 0) maxNeg++; },
    measureText(t) { return { width: (t ? String(t).length : 0) * 8 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, closePath() {},
    fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {}, clip() {},
    setTransform() {}, ellipse() {}, rect() {}, setLineDash() {},
  }, { get(t, p) { return p in t ? t[p] : () => {}; }, set() { return true; } });

  const level = { id: 21, chapter: 3, name: '赤壁之战', faction: 'wu',
    story: { hook: '借东风一把火，烧退曹操八十万大军！', year: '公元208年', place: '长江·赤壁', sides: '孙刘联军 vs 曹操', result: '曹操大败，三分天下', idiom: '火烧赤壁', portrait: null } };
  drawStoryCard(ctx, view, level, false);
  drawStoryCard(ctx, view, level, true);
  assert.equal(depth, 0, 'save/restore 平衡');
  assert.equal(maxNeg, 0, '无多余 restore');
}

console.log('ok storyCard');
