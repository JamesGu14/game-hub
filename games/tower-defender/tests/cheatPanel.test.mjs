// tests/cheatPanel.test.mjs — [作弊] 面板 layout/hit:各按钮命中各自 action、模态吞空白、按钮不重叠
// 运行:node games/tower-defender/tests/cheatPanel.test.mjs
import assert from 'node:assert';
import { cheatPanelLayout, hitCheatPanel } from '../src/ui/cheatPanel.js';

const view = { w: 1280, h: 800 };
const L = cheatPanelLayout(view);
const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];

// 面板水平居中
assert.ok(Math.abs((L.panel.x + L.panel.w / 2) - view.w / 2) < 1, '面板水平居中');

// 各按钮中心 → 对应 action
assert.equal(hitCheatPanel(view, ...center(L.levelsToggle)), 'levels-toggle', '解锁关卡(单按钮切换)');
assert.equal(hitCheatPanel(view, ...center(L.goldSet)), 'gold-set', '设置金币');
assert.equal(hitCheatPanel(view, ...center(L.goldReset)), 'gold-reset', '金币还原');
assert.equal(hitCheatPanel(view, ...center(L.generalsToggle)), 'generals-toggle', '解锁武将');
assert.equal(hitCheatPanel(view, ...center(L.progressReset)), 'progress-reset', '重置真实进度');
assert.equal(hitCheatPanel(view, ...center(L.close)), 'close', '关闭');

// 面板内空白(标题区左上角)→ 'panel'(模态,不穿透)
assert.equal(hitCheatPanel(view, L.panel.x + 6, L.panel.y + 6), 'panel', '面板内空白吞点击');
// 面板外 → null
assert.equal(hitCheatPanel(view, 4, 4), null, '面板外返回 null');

// 关卡行单按钮:与武将行右按钮同列对齐(x 对齐)
assert.ok(Math.abs(L.levelsToggle.x - L.generalsToggle.x) < 1, '关卡切换按钮与武将按钮右对齐');
// 金币行两按钮不重叠
const noOverlap = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
assert.ok(noOverlap(L.goldSet, L.goldReset), '行1两按钮不重叠');

// [Minor] 行2中间区域(generalsToggle左侧标签区)→ 'panel'(模态吞点击,不穿透选关)
assert.equal(hitCheatPanel(view, L.panel.x + 24 + 10, L.rowY(2) + 29), 'panel', '行2左半区吞点击');

console.log('ok cheatPanel');
