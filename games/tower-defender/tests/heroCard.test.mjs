// tests/heroCard.test.mjs — 英雄卡浮窗：stub ctx draw 不抛 + save/restore 平衡（12 将 + 无 anchor + 未知 id）
// 运行：node games/tower-defender/tests/heroCard.test.mjs
import assert from 'node:assert';
import { drawHeroCard } from '../src/ui/heroCard.js';
import { GENERALS } from '../src/data/generals.js';

const view = { w: 1280, h: 800 };

function mkCtx() {
  let depth = 0, neg = 0;
  const ctx = new Proxy({
    save() { depth++; }, restore() { depth--; if (depth < 0) neg++; },
    measureText(t) { return { width: (t ? String(t).length : 0) * 7 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, closePath() {},
    fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {}, clip() {},
    setTransform() {}, ellipse() {}, rect() {}, setLineDash() {}, drawImage() {},
  }, { get(t, p) { return p in t ? t[p] : () => {}; }, set() { return true; } });
  return { ctx, depth: () => depth, neg: () => neg };
}

// 十二将各画一次（含无招牌技新将的升级文案分支）：不抛 + save/restore 平衡
for (const id of Object.keys(GENERALS)) {
  const { ctx, depth, neg } = mkCtx();
  drawHeroCard(ctx, view, id, { id, x: 100, y: 730, w: 74, h: 70 });
  assert.equal(depth(), 0, `${id} save/restore 平衡`);
  assert.equal(neg(), 0, `${id} 无多余 restore`);
}

// 无 anchor（居中兜底）+ 未知 id（静默返回）不抛
{
  const { ctx, depth } = mkCtx();
  drawHeroCard(ctx, view, 'huang', null);
  drawHeroCard(ctx, view, 'nobody', null);
  assert.equal(depth(), 0, '无 anchor / 未知 id 后仍平衡');
}

console.log('ok heroCard');
