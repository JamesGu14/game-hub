// tests/entityRenderer.test.mjs — [P6] sprite 双路径：有图 drawImage / 无图回退色块；信息层始终画；不抛。
// 注入 stub ctx（记 draw 调用 + save/restore 栈）+ 直接写 assets.images 控制有/无图。
// 运行：node games/tower-defender/tests/entityRenderer.test.mjs
import assert from 'node:assert';
import { drawTower, drawEnemy } from '../src/render/entityRenderer.js';
import { assets } from '../src/core/assets.js';

// —— 带 save/restore 栈 + 调用计数的假 ctx ——
function makeStubCtx() {
  const calls = { drawImage: 0, fillRect: 0, fillText: 0, arc: 0, ellipse: 0, fill: 0, stroke: 0 };
  const texts = [];
  const imgs = [];
  const state = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1,
    globalCompositeOperation: 'source-over', shadowColor: '', shadowBlur: 0,
    textAlign: '', textBaseline: '', lineJoin: '', lineCap: '',
  };
  const stack = [];
  const ctx = {
    save() { stack.push({ ...state }); }, restore() { const s = stack.pop(); if (s) Object.assign(state, s); },
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, rect() {}, clip() {}, setLineDash() {},
    translate() {}, rotate() {}, scale() {},
    arc() { calls.arc++; }, ellipse() { calls.ellipse++; },
    fill() { calls.fill++; }, stroke() { calls.stroke++; },
    fillRect() { calls.fillRect++; }, strokeRect() {},
    fillText(t) { calls.fillText++; texts.push(String(t)); }, strokeText(t) { texts.push(String(t)); },
    drawImage(img) { calls.drawImage++; imgs.push(img); },
    measureText(t) { return { width: (t ? String(t).length : 0) * 8 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    _depth() { return stack.length; }, _calls: calls, _texts: texts, _imgs: imgs,
  };
  for (const k of Object.keys(state)) Object.defineProperty(ctx, k, { get() { return state[k]; }, set(v) { state[k] = v; }, enumerable: true });
  return ctx;
}

const fakeImg = { width: 96, height: 128 };
const setImages = (m) => { assets.images = m; };
const tower = (o = {}) => ({ id: 1, generalId: 'huang', px: 100, py: 100, level: 2, mode: 'first', slot: { x: 2, y: 3 }, signatureCd: 0, stunnedUntil: 0, ...o });
const enemy = (o = {}) => ({ id: 2, type: 'footman', px: 50, py: 60, hp: 30, maxHp: 60, color: '#c0392b', flying: false, isBoss: false, statuses: {}, ...o });

function assertClean(ctx, label) {
  assert.equal(ctx._depth(), 0, `${label}: save/restore 平衡`);
  assert.equal(ctx.globalAlpha, 1, `${label}: globalAlpha 复位`);
  assert.equal(ctx.globalCompositeOperation, 'source-over', `${label}: composite 复位`);
}

// —— 塔：有图 → drawImage + 信息层仍画 ——
{
  setImages({ gen_huang: fakeImg });
  const ctx = makeStubCtx();
  assert.doesNotThrow(() => drawTower(ctx, tower(), 1.0), '塔有图不抛');
  assert.ok(ctx._calls.drawImage >= 1, '塔有图应 drawImage');
  assert.ok(ctx._texts.some((t) => /^Lv\.\d/.test(t)), '有图在头顶画等级 Lv.N');
  assert.ok(ctx._calls.fillText >= 1, '有图也画目标模式角标(fillText)');
  assertClean(ctx, '塔有图');
}

// —— 塔：无图 → 回退色块（fillRect + 将名首字），不 drawImage ——
{
  setImages({});
  const ctx = makeStubCtx();
  assert.doesNotThrow(() => drawTower(ctx, tower(), 1.0), '塔无图不抛');
  assert.equal(ctx._calls.drawImage, 0, '塔无图不 drawImage');
  assert.ok(ctx._calls.fillRect >= 1, '无图走色块(fillRect)');
  assert.ok(ctx._calls.fillText >= 1, '无图画将名首字+模式角标');
  assertClean(ctx, '塔无图');
}

// —— 塔：出手补间（lastFireAt+aim）→ 提亮重绘，composite/alpha 用后复位 ——
{
  setImages({ gen_huang: fakeImg });
  const ctx = makeStubCtx();
  assert.doesNotThrow(() => drawTower(ctx, tower({ lastFireAt: 1.0, aimX: 200, aimY: 100 }), 1.0), '出手补间不抛');
  assert.ok(ctx._calls.drawImage >= 2, '出手时叠加提亮重绘(≥2 drawImage)');
  assertClean(ctx, '塔出手');
}

// —— 塔：关羽 L5 出手 → 用专属挥刀帧(attackFrameId 选 atk1)而非 idle 立绘 ——
{
  const idleImg = { width: 90, height: 110 }, atk1Img = { width: 96, height: 112 };
  setImages({ gen_guan_5: idleImg, gen_guan_5_atk1: atk1Img });
  const ctx = makeStubCtx();
  drawTower(ctx, tower({ generalId: 'guan', level: 5, lastFireAt: 1.0, aimX: 200, aimY: 100 }), 1.0);  // k=0 → 引刀帧
  assert.ok(ctx._imgs.includes(atk1Img), '关羽L5出手画攻击帧 atk1');
  assert.ok(!ctx._imgs.includes(idleImg), '出手期间不画 idle 立绘');
  assertClean(ctx, '关羽L5出手帧');
}

// —— 塔：关羽 L5 未出手 → 用 idle 立绘(攻击帧不介入) ——
{
  const idleImg = { width: 90, height: 110 }, atk1Img = { width: 96, height: 112 };
  setImages({ gen_guan_5: idleImg, gen_guan_5_atk1: atk1Img });
  const ctx = makeStubCtx();
  drawTower(ctx, tower({ generalId: 'guan', level: 5 }), 5.0);  // 无 lastFireAt
  assert.ok(ctx._imgs.includes(idleImg), '未出手画 idle');
  assert.ok(!ctx._imgs.includes(atk1Img), '未出手不画攻击帧');
  assertClean(ctx, '关羽L5待机');
}

// —— 塔：被震慑（无图）→ 灰罩 + ✋，不抛 ——
{
  setImages({});
  const ctx = makeStubCtx();
  assert.doesNotThrow(() => drawTower(ctx, tower({ stunnedUntil: 99 }), 1.0), '塔震慑不抛');
  assertClean(ctx, '塔震慑');
}

// —— 敌：有图 → drawImage + 血条始终画 ——
{
  setImages({ enemy_footman: fakeImg });
  const ctx = makeStubCtx();
  assert.doesNotThrow(() => drawEnemy(ctx, enemy(), 1.0), '敌有图不抛');
  assert.ok(ctx._calls.drawImage >= 1, '敌有图应 drawImage');
  assert.ok(ctx._calls.fillRect >= 1, '血条始终画(fillRect)');
  assertClean(ctx, '敌有图');
}

// —— 敌：无图 → 回退圆(arc)，不 drawImage，血条仍画 ——
{
  setImages({});
  const ctx = makeStubCtx();
  assert.doesNotThrow(() => drawEnemy(ctx, enemy(), 1.0), '敌无图不抛');
  assert.equal(ctx._calls.drawImage, 0, '敌无图不 drawImage');
  assert.ok(ctx._calls.arc >= 1, '无图走圆(arc)');
  assert.ok(ctx._calls.fillRect >= 1, '血条 fillRect');
  assertClean(ctx, '敌无图');
}

// —— BOSS：有 boss 图 → drawImage + 名始终画 ——
{
  setImages({ boss_mulu: fakeImg });
  const ctx = makeStubCtx();
  assert.doesNotThrow(() => drawEnemy(ctx, enemy({ isBoss: true, type: 'boss', bossId: 'mulu', name: '木鹿大王', hp: 500, maxHp: 800 }), 1.0), 'boss 有图不抛');
  assert.ok(ctx._calls.drawImage >= 1, 'boss 有图 drawImage');
  assert.ok(ctx._calls.fillText >= 1, 'boss 名始终画');
  assertClean(ctx, 'boss 有图');
}

// —— BOSS：无图（如东吴甘宁，v2 美术）→ 回退色块，零错 ——
{
  setImages({});
  const ctx = makeStubCtx();
  assert.doesNotThrow(() => drawEnemy(ctx, enemy({ isBoss: true, type: 'boss', bossId: 'ganning', name: '甘宁', hp: 500, maxHp: 800 }), 1.0), '无 boss 图回退不抛');
  assert.equal(ctx._calls.drawImage, 0, '无 boss 图回退');
  assert.ok(ctx._calls.arc >= 1, '回退走圆');
  assertClean(ctx, 'boss 无图回退');
}

// —— 敌：受击闪白 + 状态染色（slow/burn/stun）+ 飞兵抬升 → 不抛，状态复位 ——
{
  setImages({ enemy_footman: fakeImg });
  const ctx = makeStubCtx();
  const e = enemy({ lastHitAt: 1.0, flying: true, statuses: { slow: { until: 99 }, burn: [{ until: 99 }], stun: { until: 99 } } });
  assert.doesNotThrow(() => drawEnemy(ctx, e, 1.0), '闪白+状态不抛');
  assert.ok(ctx._calls.drawImage >= 2, '受击叠加提亮重绘');
  assertClean(ctx, '敌闪白+状态');
}

// —— 治疗方士（无图）→ 光环 + 白十字，不抛 ——
{
  setImages({});
  const ctx = makeStubCtx();
  assert.doesNotThrow(() => drawEnemy(ctx, enemy({ type: 'shaman', heal: { range: 1.5, perSec: 8 } }), 1.0), '方士不抛');
  assertClean(ctx, '方士');
}

setImages({});   // 还原
console.log('ok entityRenderer');
