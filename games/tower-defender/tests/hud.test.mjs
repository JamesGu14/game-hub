// tests/hud.test.mjs — [P5] HUD 右侧铜牌命中：点 ⏸ → 'pause'、点速度 → 'speed'、空白 → null。
// 运行：node games/tower-defender/tests/hud.test.mjs
import assert from 'node:assert';
import { hitHud, hudButtons, HUD_H } from '../src/render/hud.js';

const view = { w: 1280, h: 800, scale: 1, ox: 0, oy: 0 };

assert.ok(HUD_H >= 40, 'HUD_H 应留足图标芯片空间');

const b = hudButtons(view);
const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];

// 点暂停按钮中心 → 'pause'
assert.equal(hitHud(view, ...mid(b.pause)), 'pause', '点 ⏸ → pause');
// 点速度按钮中心 → 'speed'
assert.equal(hitHud(view, ...mid(b.speed)), 'speed', '点速度 → speed');
// 点全屏按钮中心 → 'fs'(最右,⛶)
assert.equal(hitHud(view, ...mid(b.fs)), 'fs', '点 ⛶ → fs');
// 右起 fs > speed > pause,互不重叠且不出界
assert.ok(b.pause.x + b.pause.w < b.speed.x && b.speed.x + b.speed.w < b.fs.x, '三钮不重叠');
assert.ok(b.fs.x + b.fs.w <= view.w, 'fs 不出界');
// 屏幕中央空白 → null
assert.equal(hitHud(view, 640, 400), null, '空白 → null');
// 左上角（HUB 链接区，HUD 左端）→ null（不误触按钮）
assert.equal(hitHud(view, 20, 20), null, '左上 → null');

console.log('ok hud');
