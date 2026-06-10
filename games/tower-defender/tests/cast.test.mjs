// tests/cast.test.mjs — 角色注册表完整性(演绎段1):覆盖面/阵营/立绘引用/音色数据
// 运行:node games/tower-defender/tests/cast.test.mjs
// 音色名/rate/pitch 数值来源:演绎 spec §4 音色分配表(docs/superpowers/specs/2026-06-11-tower-defender-story-performance-design.md)
import assert from 'node:assert';
import { CAST } from '../src/data/cast.js';
import { GENERALS } from '../src/data/generals.js';
import { BOSSES, LIEUTENANTS } from '../src/data/bosses.js';

// 1) 我方 12 将全覆盖:side=shu、portrait 走 generalSprite(gen 字段)、名字与 GENERALS 一致
for (const id of Object.keys(GENERALS)) {
  const c = CAST[id];
  assert.ok(c, `CAST 缺我方将 ${id}`);
  assert.equal(c.side, 'shu', `${id} side=shu`);
  assert.equal(c.name, GENERALS[id].name, `${id} 名字一致`);
  assert.equal(c.portrait && c.portrait.gen, id, `${id} portrait.gen=${id}(三阶经 generalSprite 回退)`);
  assert.ok(c.voice && typeof c.voice.name === 'string' && c.voice.name.startsWith('zh-CN-'), `${id} 有音色`);
}

// 2) 敌将全覆盖(BOSSES + LIEUTENANTS):side=enemy、portrait.img=boss_<id>、共用云健
for (const id of [...Object.keys(BOSSES), ...Object.keys(LIEUTENANTS)]) {
  const c = CAST[id];
  assert.ok(c, `CAST 缺敌将 ${id}`);
  assert.equal(c.side, 'enemy', `${id} side=enemy`);
  assert.equal(c.portrait && c.portrait.img, 'boss_' + id, `${id} portrait.img`);
  assert.equal(c.voice.name, 'zh-CN-YunjianNeural', `${id} 敌将共用云健`);
  assert.equal(c.voice.pitch, '-8%', `${id} 低沉威压调参`);
}

// 3) 特殊角色:刘备(全拼 id)/旁白/众将
assert.equal(CAST.liubei.name, '刘备');
assert.equal(CAST.liubei.side, 'shu');
assert.deepEqual(CAST.liubei.portrait, { img: 'gen_liubei' }, '刘备立绘走独立 img');
assert.equal(CAST.liubei.voice.name, 'zh-CN-YunyangNeural');
assert.equal(CAST.narrator.portrait, null, '旁白无头像');
assert.equal(CAST.narrator.voice.name, 'zh-CN-XiaoxiaoNeural');
assert.equal(CAST.narrator.voice.rate, '-8%');
assert.equal(CAST.zhongjiang.name, '众将');
assert.equal(CAST.zhongjiang.side, 'shu');
assert.equal(CAST.zhongjiang.portrait, null, '众将齐声句无立绘');

// 4) 音色分配(spec §4 表):老将云健 rate-12%、黄月英晓伊、年轻我方云希
for (const id of ['huang', 'zhou', 'zhuge']) {
  assert.equal(CAST[id].voice.name, 'zh-CN-YunjianNeural', `${id} 老将云健`);
  assert.equal(CAST[id].voice.rate, '-12%', `${id} 苍劲 rate`);
}
assert.equal(CAST.yueying.voice.name, 'zh-CN-XiaoyiNeural');
for (const id of ['liao', 'guanping', 'zhangbao', 'madai', 'zhao', 'ma', 'guan', 'zhang']) {
  assert.equal(CAST[id].voice.name, 'zh-CN-YunxiNeural', `${id} 年轻我方云希`);
}

// 总数防御:bosses/generals 将来扩充时,程序化循环若漏同步立即报错
const expectedCount = Object.keys(GENERALS).length + Object.keys(BOSSES).length + Object.keys(LIEUTENANTS).length + 3;
assert.equal(Object.keys(CAST).length, expectedCount, 'CAST 总条数 = 12将+全敌将+3特殊');

console.log('ok cast');
