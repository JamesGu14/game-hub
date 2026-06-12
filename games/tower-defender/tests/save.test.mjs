// tests/save.test.mjs — 注入式存档往返 / 损坏回退 / 通关合入 / [C1] 版本迁移 / resume 版本防护
// 运行：node games/tower-defender/tests/save.test.mjs
import assert from 'node:assert';
import {
  defaultSave, loadSave, writeSave, applyClear, CURRENT_VERSION,
  _applyMigrations, resumeSnapshot, writeResume, loadResume, RESUME_VERSION,
} from '../src/core/save.js';

function fakeStore() {
  return { m: {}, getItem(k) { return Object.prototype.hasOwnProperty.call(this.m, k) ? this.m[k] : null; }, setItem(k, v) { this.m[k] = v; } };
}

// 空 storage → 默认
{
  const s = fakeStore();
  assert.deepEqual(loadSave(s), defaultSave(), '空 storage → 默认');
}

// 往返一致
{
  const s = fakeStore();
  const save = defaultSave(); save.unlockedLevel = 3; save.stars = { 1: 3, 2: 2 };
  writeSave(s, save);
  assert.deepEqual(loadSave(s), {
    version: 1, unlockedLevel: 3, stars: { 1: 3, 2: 2 }, settings: { muted: false, speed: 1 },
  }, '写入→读取一致');
}

// 损坏 JSON → 默认
{
  const bad = { getItem() { return '{not json'; }, setItem() {} };
  assert.deepEqual(loadSave(bad), defaultSave(), '坏 JSON → 默认');
}

// 非法 speed → 1
{
  const s = fakeStore();
  s.m['save_td_v1'] = JSON.stringify({ settings: { speed: 9 } });
  assert.equal(loadSave(s).settings.speed, 1, '非法 speed → 1');
}

// applyClear：取更高星 + 解锁推进
{
  let g = defaultSave();
  g = applyClear(g, 1, 2);
  assert.equal(g.stars[1], 2, '记录 2 星');
  assert.equal(g.unlockedLevel, 2, '解锁第 2 关');
  g = applyClear(g, 1, 1);
  assert.equal(g.stars[1], 2, '不覆盖更高星');
}

// —— [C1] 版本迁移框架 ——

// loadSave 永远盖回当前版本号(读到旧/缺版本都升)
{
  const s = fakeStore();
  s.m['save_td_v1'] = JSON.stringify({ unlockedLevel: 5, stars: { 1: 3 } });  // 缺 version 的旧档
  const out = loadSave(s);
  assert.equal(out.version, CURRENT_VERSION, '缺 version 旧档 → 盖回当前版本');
  assert.equal(out.unlockedLevel, 5, '迁移保留 unlockedLevel(不归零)');
  assert.equal(out.stars[1], 3, '迁移保留 stars');
}

// 未来版本号(用户开过新版又回退旧版)→ 不崩、按已知字段防御读取
{
  const s = fakeStore();
  s.m['save_td_v1'] = JSON.stringify({ version: 99, unlockedLevel: 7, stars: { 2: 2 }, settings: { speed: 2 } });
  const out = loadSave(s);
  assert.equal(out.unlockedLevel, 7, '未来版本仍读已知字段');
  assert.equal(out.settings.speed, 2, '未来版本 settings 防御读取');
}

// _applyMigrations:按序执行迁移链(注入假链证明非死代码)
{
  const fake = {
    1: (d) => ({ ...d, n: (d.n || 0) + 1, version: 2 }),    // v1→v2: n+1
    2: (d) => ({ ...d, n: d.n + 10, version: 3 }),          // v2→v3: n+10
  };
  const r = _applyMigrations({ version: 1, n: 0 }, fake, 3);
  assert.equal(r.n, 11, '迁移链按序:+1 再 +10');
  assert.equal(r.version, 3, '迁移链推进到目标版本');

  // 缺 version 视作最老(0),从头跑
  const fake0 = { 0: (d) => ({ ...d, hit: true, version: 1 }) };
  assert.equal(_applyMigrations({}, fake0, 1).hit, true, '缺 version → 从 v0 起迁移');

  // 链中断(缺某步)→ 停在该版本,不抛
  assert.doesNotThrow(() => _applyMigrations({ version: 1 }, {}, 3), '无对应迁移 → passthrough 不抛');
}

// —— [C1] resume 快照版本防护 ——
{
  const s = fakeStore();
  const fakeState = {
    level: { id: 4 }, waveIndex: 2, gold: 120, castleHp: 18, phase: 'prep', prepTimer: 12,
    towers: [{ generalId: 'huang', slot: { x: 3, y: 5 }, level: 2, mode: 'first' }],
  };
  const snap = resumeSnapshot(fakeState);
  assert.equal(snap.version, RESUME_VERSION, '快照带版本号');
  writeResume(s, snap);
  const back = loadResume(s);
  assert.equal(back.levelId, 4, '同版本快照正常读回');

  // 版本不匹配(老格式/无版本)→ 丢弃 null(从本波备战起点重放,无损)
  s.m['save_td_resume_v1'] = JSON.stringify({ levelId: 4, waveIndex: 2 });  // 无 version
  assert.equal(loadResume(s), null, '无 version 快照 → 丢弃');
  s.m['save_td_resume_v1'] = JSON.stringify({ version: 999, levelId: 4 });
  assert.equal(loadResume(s), null, '版本不匹配快照 → 丢弃');
}

console.log('ok save');
