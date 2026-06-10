// tests/resultPanel.test.mjs — 结算面板：胜(含解锁提示)/末关/败 三分支 stub ctx 不抛 + save/restore 平衡 + draw/hit 同源
// 运行：node games/tower-defender/tests/resultPanel.test.mjs
import assert from 'node:assert';
import { drawResult, resultButtons, hitResult } from '../src/ui/resultPanel.js';

const view = { w: 1280, h: 800 };
const TOTAL = 50;

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

// 三分支各画一次：胜+解锁提示（[spec §4] unlockNotice 路径）/ 末关胜（无 next）/ 败
const CASES = [
  [{ phase: 'won', stars: 3, level: { id: 10 } }, { unlockNotice: '⚔️ 新武将来援:赵云、张飞!' }],
  [{ phase: 'won', stars: 1, level: { id: 50 } }, {}],
  [{ phase: 'lost', stars: 0, level: { id: 3 } }, {}],
];
for (const [st, opts] of CASES) {
  const { ctx, depth, neg } = mkCtx();
  drawResult(ctx, view, st, TOTAL, opts);
  assert.equal(depth(), 0, `${st.phase}(L${st.level.id}) save/restore 平衡`);
  assert.equal(neg(), 0, `${st.phase}(L${st.level.id}) 无多余 restore`);
}

// 兼容：不传 opts（老签名调用）不抛
{
  const { ctx } = mkCtx();
  drawResult(ctx, view, { phase: 'won', stars: 2, level: { id: 5 } }, TOTAL);
}

// draw/hit 同源：每个布局按钮的左上内缩点必命中自身 id；按钮组外命中 null
{
  const st = { phase: 'won', stars: 2, level: { id: 10 } };
  const btns = resultButtons(view, st, TOTAL);
  assert.equal(btns.map((b) => b.id).join(','), 'next,retry,select', '非末关胜 → 三按钮');
  for (const b of btns) assert.equal(hitResult(view, st, TOTAL, b.x + 2, b.y + 2), b.id, `命中 ${b.id}`);
  assert.equal(hitResult(view, st, TOTAL, 5, 5), null, '组外 null');
  const last = { phase: 'won', stars: 1, level: { id: 50 } };
  assert.equal(resultButtons(view, last, TOTAL).map((b) => b.id).join(','), 'retry,select', '末关无 next');
}

console.log('ok resultPanel');
