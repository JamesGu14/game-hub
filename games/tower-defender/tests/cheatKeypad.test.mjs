// tests/cheatKeypad.test.mjs — [作弊] 数字键盘 layout/hit:各键命中正确 token、模态吞空白、键不重叠
// 运行:node games/tower-defender/tests/cheatKeypad.test.mjs
import assert from 'node:assert';
import { cheatKeypadLayout, hitCheatKeypad } from '../src/ui/cheatKeypad.js';

const view = { w: 1280, h: 800 };
const L = cheatKeypadLayout(view);
const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];

// 面板水平居中
assert.ok(Math.abs((L.panel.x + L.panel.w / 2) - view.w / 2) < 1, '面板水平居中');

// keys 数组长度恰好 12
assert.equal(L.keys.length, 12, 'keys 长度为 12');

// 各数字键中心命中返回对应字符
for (const k of L.keys) {
  const expected = k.key;  // '0'..'9' | 'cancel' | 'back'
  assert.equal(hitCheatKeypad(view, ...center(k)), expected, `键 ${expected} 中心命中`);
}

// 确定键中心 → 'ok'
assert.equal(hitCheatKeypad(view, ...center(L.ok)), 'ok', '确定键中心 → ok');

// 面板内空白(标题区)→ 'panel'(模态吞点击)
assert.equal(hitCheatKeypad(view, L.panel.x + 6, L.panel.y + 6), 'panel', '面板内空白吞点击');

// 面板外 → null
assert.equal(hitCheatKeypad(view, 4, 4), null, '面板外返回 null');

// 同行相邻键不重叠(抽查行0: key=1,2,3)
const noOverlap = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
const row0 = L.keys.filter((k) => ['1', '2', '3'].includes(k.key));
assert.equal(row0.length, 3, '行0有3个键');
assert.ok(noOverlap(row0[0], row0[1]), '行0 key1 与 key2 不重叠');
assert.ok(noOverlap(row0[1], row0[2]), '行0 key2 与 key3 不重叠');

// 同列相邻键不重叠(抽查列1: key=2,5,8,0)
const col1 = L.keys.filter((k) => ['2', '5', '8', '0'].includes(k.key));
assert.equal(col1.length, 4, '列1有4个键');
assert.ok(noOverlap(col1[0], col1[1]), '列1 key2 与 key5 不重叠');
assert.ok(noOverlap(col1[1], col1[2]), '列1 key5 与 key8 不重叠');
assert.ok(noOverlap(col1[2], col1[3]), '列1 key8 与 key0 不重叠');

// cancel(✕) 在第4行左、back(⌫)在第4行右,0在中
const kCancel = L.keys.find((k) => k.key === 'cancel');
const kBack   = L.keys.find((k) => k.key === 'back');
const k0      = L.keys.find((k) => k.key === '0');
assert.ok(kCancel && kBack && k0, '特殊键存在');
assert.ok(kCancel.x < k0.x, 'cancel 在 0 左侧');
assert.ok(k0.x < kBack.x, '0 在 back 左侧');

console.log('ok cheatKeypad');
