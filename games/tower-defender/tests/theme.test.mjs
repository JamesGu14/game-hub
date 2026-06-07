// tests/theme.test.mjs — [P5] 主题 helpers 烟雾 + 不污染：stub ctx 调 panel/button/title/seal/statChip
// 不抛，且 shadowBlur/globalAlpha 用后复位（save/restore 契约）。helpers 多为绘制，逻辑轻。
// 运行：node games/tower-defender/tests/theme.test.mjs
import assert from 'node:assert';
import { PAL, FONT, roundRect, panel, button, title, seal, statChip, backdrop, vignette } from '../src/ui/theme.js';

// —— 带 save/restore 栈的假 ctx：属性走内部 state，故能真实验证“用后复位” ——
function makeStubCtx() {
  const state = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1,
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    textAlign: '', textBaseline: '', lineJoin: '', lineCap: '',
  };
  const stack = [];
  const ctx = {
    save() { stack.push({ ...state }); },
    restore() { const s = stack.pop(); if (s) Object.assign(state, s); },
    beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {}, closePath() {}, rect() {},
    fill() {}, stroke() {}, clip() {}, fillRect() {}, strokeRect() {}, setLineDash() {},
    fillText() {}, strokeText() {},
    measureText(t) { return { width: (t ? String(t).length : 0) * 8 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    _depth() { return stack.length; },
  };
  for (const k of Object.keys(state)) {
    Object.defineProperty(ctx, k, { get() { return state[k]; }, set(v) { state[k] = v; }, enumerable: true });
  }
  return ctx;
}

// 1) PAL / FONT 形状
{
  for (const k of ['woodA', 'parch', 'gold', 'goldBright', 'jade', 'seal', 'ink', 'cream']) {
    assert.equal(typeof PAL[k], 'string', `PAL.${k} 应为色串`);
  }
  assert.ok(FONT.head(40).includes('40px'), 'FONT.head 含 px');
  assert.ok(/KaiTi|Kaiti/.test(FONT.head(20)), 'FONT.head 含楷体栈');
  assert.ok(FONT.body(14).includes('14px'), 'FONT.body 含 px');
}

// 2) roundRect 不抛（含极端 r 收敛）
{
  const ctx = makeStubCtx();
  assert.doesNotThrow(() => roundRect(ctx, 10, 10, 100, 40, 8));
  assert.doesNotThrow(() => roundRect(ctx, 0, 0, 4, 4, 999), 'r 超尺寸应收敛不抛');
}

// 3) panel / button / title / seal / statChip 不抛 + save/restore 平衡 + shadow/alpha 复位
{
  const ctx = makeStubCtx();
  const calls = [
    () => panel(ctx, 20, 20, 300, 120, { variant: 'wood' }),
    () => panel(ctx, 20, 20, 300, 120, { variant: 'parch', glow: true }),
    () => panel(ctx, 20, 20, 300, 120, { variant: 'ink' }),
    () => button(ctx, { x: 0, y: 0, w: 120, h: 40 }, { label: '升级', sub: '💰120', variant: 'gold' }),
    () => button(ctx, { x: 0, y: 0, w: 120, h: 40 }, { label: '拆除', variant: 'danger', disabled: true }),
    () => button(ctx, { x: 0, y: 0, w: 120, h: 40 }, { label: '下一关', variant: 'jade', hover: true }),
    () => title(ctx, '成都保卫战', 400, 60, 44),
    () => seal(ctx, 100, 100, 40, '胜'),
    () => seal(ctx, 100, 100, 30, '封', { shape: 'square', color: PAL.sealDim }),
    () => statChip(ctx, 0, 0, 110, 30, '❤', '20/20', PAL.warn),
    () => backdrop(ctx, 1280, 800),
    () => vignette(ctx, 1280, 800),
  ];
  for (const fn of calls) {
    assert.doesNotThrow(fn, fn.toString());
    assert.equal(ctx._depth(), 0, 'save/restore 必须平衡（栈归零）');
    assert.equal(ctx.shadowBlur, 0, 'shadowBlur 用后必复位');
    assert.equal(ctx.globalAlpha, 1, 'globalAlpha 用后必复位');
    assert.equal(ctx.shadowColor, '', 'shadowColor 用后必复位');
  }
}

console.log('ok theme');
