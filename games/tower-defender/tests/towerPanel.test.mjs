// tests/towerPanel.test.mjs — [C6] 点将面板:layout/hit 同源(升级/拆除/目标命中·面板空白消费·外部 null)
//   + draw 多分支(招牌技解锁/锁定/无招牌技新将/满级/买不起)stub ctx 不抛 + save/restore 平衡 + cycleTowerMode 循环。
// 运行：node games/tower-defender/tests/towerPanel.test.mjs
import assert from 'node:assert';
import { towerPanelLayout, hitTowerPanel, drawTowerPanel, cycleTowerMode } from '../src/ui/towerPanel.js';

const view = { w: 1280, h: 800, ox: 100, oy: 60, scale: 1 };
const mkTower = (o = {}) => ({ generalId: 'huang', px: 400, py: 360, level: 1, mode: 'first', rangeBonus: 0, ...o });

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

// layout：3 按钮(upgrade/sell/mode) + 上界避 HUD + 不溢出屏幕
{
  const L = towerPanelLayout(view, mkTower());
  assert.equal(L.buttons.map((b) => b.id).join(','), 'upgrade,sell,mode', '三按钮顺序');
  assert.ok(L.x >= 8 && L.x + L.w <= view.w - 8, 'x 不溢出');
  assert.ok(L.y >= 56, 'y 在 TOP_GUARD 之下(避木匾 HUD)');
}

// hit：每按钮中心命中自身 id；面板内空白 → 'panel'(消费防穿透建塔)；面板外 → null
{
  const t = mkTower();
  const L = towerPanelLayout(view, t);
  for (const b of L.buttons) {
    assert.equal(hitTowerPanel(view, t, b.x + b.w / 2, b.y + b.h / 2), b.id, `命中 ${b.id}`);
  }
  assert.equal(hitTowerPanel(view, t, L.x + 4, L.y + 4), 'panel', '面板内空白 → panel');
  assert.equal(hitTowerPanel(view, t, L.x + L.w + 30, L.y), null, '面板外 → null');
}

// draw：五分支 stub ctx 不抛 + save/restore 平衡
//  ①L1 招牌技锁定(五虎黄忠 signature 存在) ②L3 解锁招牌技 ③L5 满级(升级钮 disabled)
//  ④新6将廖化 signature:null → 招牌技行隐藏 ⑤买不起(gold<升级价 → 升级钮 disabled)
const CASES = [
  ['L1 招牌技锁定', mkTower({ level: 1 }), { gold: 9999 }],
  ['L3 招牌技解锁', mkTower({ level: 3 }), { gold: 9999 }],
  ['L5 满级', mkTower({ level: 5 }), { gold: 9999 }],
  ['新将无招牌技', mkTower({ generalId: 'liao', level: 2 }), { gold: 9999 }],
  ['买不起', mkTower({ level: 1 }), { gold: 0 }],
];
for (const [name, tower, state] of CASES) {
  const { ctx, depth, neg } = mkCtx();
  drawTowerPanel(ctx, view, state, tower);
  assert.equal(depth(), 0, `${name} save/restore 平衡`);
  assert.equal(neg(), 0, `${name} 无多余 restore`);
}

// cycleTowerMode：first→last→strongest→weakest→first 闭环
{
  const t = mkTower({ mode: 'first' });
  const seq = [];
  for (let i = 0; i < 5; i++) { cycleTowerMode(t); seq.push(t.mode); }
  assert.deepEqual(seq, ['last', 'strongest', 'weakest', 'first', 'last'], '目标模式四态闭环');
}

console.log('ok towerPanel');
