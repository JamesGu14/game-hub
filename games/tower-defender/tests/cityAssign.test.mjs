// tests/cityAssign.test.mjs — 城名注入：每营有名/关内唯一/章内唯一且恰好用完整池/贴题岛/模板无污染
// 运行：node games/tower-defender/tests/cityAssign.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { CITY_POOLS } from '../src/data/cities.js';
import { BASE_BOARDS as TEMPLATES } from '../src/data/baseBoards.js';

// 1) 每关每营都有 cityName 且关内唯一
for (const lv of LEVELS) {
  for (const cp of lv.camps) assert.ok(typeof cp.cityName === 'string' && cp.cityName.length >= 2, `L${lv.id} camp ${cp.id} 有城名`);
  const names = lv.camps.map((c) => c.cityName);
  assert.equal(new Set(names).size, names.length, `L${lv.id} 关内城名唯一`);
}
// 2) 章内唯一 + 恰好用完整池（不多不少、确定性的强断言）
for (const ch of [1, 2, 3, 4, 5]) {
  const names = LEVELS.filter((l) => l.chapter === ch).flatMap((l) => l.camps.map((c) => c.cityName));
  assert.equal(new Set(names).size, names.length, `章${ch} 章内城名唯一`);
  assert.deepEqual([...names].sort(), [...CITY_POOLS[ch]].sort(), `章${ch} 恰好用完整池`);
}
// 3) 样板关贴题岛抽查（L1 首营序、L50 末营=长安）
assert.deepEqual(LEVELS[0].camps.map((c) => c.cityName), ['宛城', '叶县', '堵阳'], 'L1 贴题岛');
const L50 = LEVELS[49];
assert.equal(L50.camps[L50.camps.length - 1].cityName, '长安', 'L50 末营=长安');
// 4) TEMPLATES 单例不被污染（注入必须建新对象）
for (const t of Object.values(TEMPLATES)) for (const cp of t.camps) assert.equal(cp.cityName, undefined, '模板 camps 无 cityName 污染');
console.log('ok cityAssign');
