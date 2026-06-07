// tests/pauseMenu.test.mjs — [P5] 暂停菜单命中：各按钮 → 对应 id；面板外空白 → null。
// 运行：node games/tower-defender/tests/pauseMenu.test.mjs
import assert from 'node:assert';
import { pauseLayout, hitPause } from '../src/ui/pauseMenu.js';

const view = { w: 1280, h: 800, scale: 1, ox: 0, oy: 0 };

// 每个按钮中心 → 对应 id
for (const b of pauseLayout(view)) {
  assert.equal(hitPause(view, b.x + b.w / 2, b.y + b.h / 2), b.id, `点 ${b.id} → ${b.id}`);
}

// 五个预期 id 都在（[P6] 加静音项）
const ids = pauseLayout(view).map((b) => b.id);
for (const id of ['resume', 'restart', 'select', 'mute', 'hub']) {
  assert.ok(ids.includes(id), `应含按钮 ${id}`);
}

// 面板外空白 → null（左上角 / 顶部）
assert.equal(hitPause(view, 4, 4), null, '左上空白 → null');
assert.equal(hitPause(view, view.w / 2, 10), null, '顶部空白 → null');

console.log('ok pauseMenu');
