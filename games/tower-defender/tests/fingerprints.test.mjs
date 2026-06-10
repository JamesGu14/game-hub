// tests/fingerprints.test.mjs — 验收标准 §10.1/§10.2:50 关几何指纹两两不同 + 逐关营数=现状承诺
// 运行:node games/tower-defender/tests/fingerprints.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { samplePathCells } from '../src/data/boardVariants.js';

// 指纹 = 序列化(paths)+序列化(slots)(spec §10.1;直接字符串比对,无哈希碰撞)
const fps = new Map();
for (const lv of LEVELS) {
  const fp = JSON.stringify(lv.paths) + '|' + JSON.stringify(lv.slots);
  assert.ok(!fps.has(fp), `L${lv.id} 与 L${fps.get(fp)} 指纹相同(撞图)`);
  fps.set(fp, lv.id);
}
assert.equal(fps.size, 50, '50 关指纹两两不同');

// 逐关营数与现状完全一致(营数承诺的直接回归证明;cities/cityAssign 是间接证明)
const EXPECT = [
  3, 2, 2, 2, 2, 3, 3, 3, 3, 3,   // ch1
  4, 3, 3, 3, 3, 4, 4, 4, 4, 4,   // ch2
  5, 4, 4, 4, 4, 5, 5, 5, 5, 5,   // ch3
  6, 5, 5, 5, 5, 6, 6, 6, 6, 6,   // ch4
  8, 6, 6, 6, 6, 8, 8, 8, 8, 8,   // ch5
];
assert.deepEqual(LEVELS.map((l) => l.camps.length), EXPECT, '逐关营数=现状');

// 每关挂上地形展开产物(本切换起 levels 必带)
for (const lv of LEVELS) {
  assert.ok(Array.isArray(lv.terrain), `L${lv.id} 有 terrain`);
  assert.ok(Array.isArray(lv.terrainAt) && lv.terrainAt.length === lv.rows, `L${lv.id} 有 terrainAt`);
}

// 回归锚点:过滤采样必须与 verify 同源(顶点采样曾误删这 3 关压在线段中段的教学区)
const zoneTypes = (id) => new Set(LEVELS[id - 1].terrain.map((z) => z.type));
assert.ok(zoneTypes(23).has('shallow'), 'L23 保留 shallow(c 路线段中段盖区)');
assert.ok(zoneTypes(44).has('firegully'), 'L44 保留 firegully(镜像后活跃路线段中段盖区)');
assert.ok(zoneTypes(45).has('firegully'), 'L45 保留 firegully(镜像后活跃路线段中段盖区)');

// 全量:每个动态地形区必须盖≥1活跃路径格(与 verify ③ 同义;测 resolveBoard 过滤后无漏删/误留)
for (const lv of LEVELS) {
  const pc = samplePathCells(lv.paths);
  for (const z of lv.terrain) {
    if (!['shallow', 'rockfall', 'firegully'].includes(z.type)) continue;
    assert.ok(
      z.cells.some((c) => pc.has(`${c.x},${c.y}`)),
      `L${lv.id} ${z.type} 区须盖≥1活跃路径格(resolveBoard 过滤同源)`,
    );
  }
}

console.log('ok fingerprints');
