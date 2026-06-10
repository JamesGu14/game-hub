// tests/boardVariants.test.mjs — 变体引擎纯函数性质 + (后续任务起)基板全组合 verify
// 运行:node games/tower-defender/tests/boardVariants.test.mjs
import assert from 'node:assert';
import { mirrorBoard, variantFor, pathSubsetFor, expandTerrain } from '../src/data/boardVariants.js';
import { verifyLevel } from '../tools/verify-levels.mjs';
import { genWaves } from '../src/data/waveGen.js';

// —— 合成 fixture(24×14,2 营,带 terrain cells+rects,3 套将位)——
const FIX = {
  id: 'fix', chapter: 1, cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [{ id: 'a', c: 1, r: 2 }, { id: 'b', c: 22, r: 11 }],
  paths: {
    a: [{ x: 1, y: 2 }, { x: 1, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 9 }, { x: 4, y: 9 }, { x: 4, y: 11 }, { x: 11, y: 11 }, { x: 11, y: 7 }],
    b: [{ x: 22, y: 11 }, { x: 22, y: 8 }, { x: 15, y: 8 }, { x: 15, y: 4 }, { x: 19, y: 4 }, { x: 19, y: 2 }, { x: 12, y: 2 }, { x: 12, y: 6 }],
  },
  slotsVariants: [
    [{ x: 6, y: 10 }, { x: 17, y: 3 }],
    [{ x: 10, y: 9 }, { x: 13, y: 4 }],
    [{ x: 3, y: 4 }, { x: 17, y: 7 }],
  ],
  terrain: [
    { type: 'plateau', cells: [{ x: 6, y: 10 }] },
    { type: 'river', rects: [{ x: 0, y: 0, w: 3, h: 1 }], cells: [{ x: 5, y: 0 }] },
  ],
};

// 1) 双镜恒等:mirror(mirror(b,'h'),'h') 与原板深等
{
  const hh = mirrorBoard(mirrorBoard(FIX, 'h'), 'h');
  assert.deepEqual(hh, FIX, 'h∘h = id');
  const vv = mirrorBoard(mirrorBoard(FIX, 'v'), 'v');
  assert.deepEqual(vv, FIX, 'v∘v = id');
  const hvhv = mirrorBoard(mirrorBoard(FIX, 'hv'), 'hv');
  assert.deepEqual(hvhv, FIX, 'hv∘hv = id');
}
// 2) mode='none' 返回深等副本且不是同一引用(防原板被改)
{
  const n = mirrorBoard(FIX, 'none');
  assert.deepEqual(n, FIX, 'none 深等');
  assert.notEqual(n, FIX, 'none 仍是副本');
  assert.notEqual(n.paths.a, FIX.paths.a, 'paths 数组也是副本');
}
// 3) castle 2×2 居中不动(h/v/hv 三向)
for (const m of ['h', 'v', 'hv']) {
  assert.deepEqual(mirrorBoard(FIX, m).castle, FIX.castle, `castle 不动 (${m})`);
}
// 4) 坐标变换正确:h 镜像下 camp a (1,2)→(22,2);v 下 (1,2)→(1,11)
assert.deepEqual(mirrorBoard(FIX, 'h').camps[0], { id: 'a', c: 22, r: 2 }, 'camp h 镜像');
assert.deepEqual(mirrorBoard(FIX, 'v').camps[0], { id: 'a', c: 1, r: 11 }, 'camp v 镜像');
// 5) terrain cells 与 rects 同步翻转:h 下 cell(5,0)→(18,0);rect{0,0,3,1}→{21,0,3,1}
{
  const h = mirrorBoard(FIX, 'h');
  assert.deepEqual(h.terrain[1].cells, [{ x: 18, y: 0 }], 'terrain cell h 翻转');
  assert.deepEqual(h.terrain[1].rects, [{ x: 21, y: 0, w: 3, h: 1 }], 'terrain rect h 翻转');
}
// 6) slotsVariants 逐套翻转,套数不变
{
  const h = mirrorBoard(FIX, 'h');
  assert.equal(h.slotsVariants.length, 3, '3 套保持');
  assert.deepEqual(h.slotsVariants[0][0], { x: 17, y: 10 }, 'slot(6,10) h→(17,10)');
}
// 7) 路径翻转后首点仍=camp、末点仍是成都格
{
  const h = mirrorBoard(FIX, 'h');
  assert.deepEqual(h.paths.a[0], { x: h.camps[0].c, y: h.camps[0].r }, '镜像后 path[0]=camp');
  const end = h.paths.a[h.paths.a.length - 1];
  const cs = h.castle;
  assert.ok(end.x >= cs.c && end.x < cs.c + cs.w && end.y >= cs.r && end.y < cs.r + cs.h, '镜像后末点∈成都');
}

// —— variantFor:公式确定性 ——
// boardId = k<5 ? chNA : chNB;mirror = [none,h,v,hv][k%4];slotsIdx = (ch+k)%3
assert.deepEqual(variantFor(1, 0), { boardId: 'ch1A', mirror: 'none', slotsIdx: 1 }, 'ch1 k0');
assert.deepEqual(variantFor(1, 4), { boardId: 'ch1A', mirror: 'none', slotsIdx: 2 }, 'ch1 k4');
assert.deepEqual(variantFor(1, 9), { boardId: 'ch1B', mirror: 'h', slotsIdx: 1 }, 'ch1 k9');
assert.deepEqual(variantFor(5, 9), { boardId: 'ch5B', mirror: 'h', slotsIdx: 2 }, 'ch5 k9 (=L50)');
// 章内 10 关:同板内 (mirror,slotsIdx) 两两不同(撞图防线之一)
for (let ch = 1; ch <= 5; ch++) {
  for (const half of [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]]) {
    const seen = new Set();
    for (const k of half) {
      const v = variantFor(ch, k);
      const key = `${v.mirror}|${v.slotsIdx}`;
      assert.ok(!seen.has(key), `ch${ch} 半区 ${half[0] < 5 ? 'A' : 'B'} (mirror,slotsIdx) 撞车 @k=${k}`);
      seen.add(key);
    }
  }
}

// —— pathSubsetFor:窗口轮换 ——
// k=0 与 k>=5 → null(全路);k=1..4 → 起点 (k-1)%n 的连续 m 条(环上)
const IDS3 = ['a', 'b', 'c'];
assert.equal(pathSubsetFor(1, 0, IDS3), null, 'k0 全路');
assert.equal(pathSubsetFor(1, 7, IDS3), null, '后半全路');
assert.deepEqual(pathSubsetFor(1, 1, IDS3), ['a', 'b'], 'ch1 k1');
assert.deepEqual(pathSubsetFor(1, 2, IDS3), ['b', 'c'], 'ch1 k2');
assert.deepEqual(pathSubsetFor(1, 3, IDS3), ['c', 'a'], 'ch1 k3 环绕');
assert.deepEqual(pathSubsetFor(1, 4, IDS3), ['a', 'b'], 'ch1 k4(=k1,靠 mirror/slots 区分)');
const IDS8 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
assert.deepEqual(pathSubsetFor(5, 1, IDS8), ['a', 'b', 'c', 'd', 'e', 'f'], 'ch5 k1 取6');
assert.deepEqual(pathSubsetFor(5, 4, IDS8), ['d', 'e', 'f', 'g', 'h', 'a'], 'ch5 k4 环绕');
// 子集大小=现状营数承诺:ch1..5 前半 = 2/3/4/5/6
for (const [ch, m] of [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]) {
  assert.equal(pathSubsetFor(ch, 2, IDS8).length, m, `ch${ch} 子集大小 ${m}`);
}

// —— expandTerrain:rects 展开∪cells,烘 terrainAt ——
{
  const { terrain, terrainAt } = expandTerrain(FIX);
  const river = terrain.find((t) => t.type === 'river');
  // rect{0,0,3,1}→(0,0)(1,0)(2,0) ∪ cell(5,0) = 4 格
  assert.equal(river.cells.length, 4, 'rect 展开+cells 并集');
  assert.ok(river.cellSet.has('5,0') && river.cellSet.has('2,0'), 'cellSet 烘焙');
  assert.equal(terrainAt[0][1], 'river', 'terrainAt[r][c] 查表');
  assert.equal(terrainAt[10][6], 'plateau', 'plateau 落表');
  assert.equal(terrainAt[5][5], null, '空地 null');
  assert.ok(!('rects' in river) || river.rects === undefined, '展开产物不再带 rects');
}

// —— verify 地形规则(① slots 不落水/山 ② 路/营/城不穿水/山 ③ 动态地形必盖路 ④ plateau 不含路且含将位)——
function fixLevel(terrain, slotsOverride) {
  const b = { ...FIX, terrain };
  const { terrain: tz, terrainAt } = expandTerrain(b);
  const lv = {
    id: 'T_fix', faction: 'wei', scale: 1, startGold: 300, castleHp: 20,
    cols: b.cols, rows: b.rows, castle: b.castle, camps: b.camps, paths: b.paths,
    slots: slotsOverride || [
      { x: 6, y: 10 }, { x: 17, y: 3 }, { x: 10, y: 9 }, { x: 13, y: 4 }, { x: 3, y: 4 },
      { x: 17, y: 7 }, { x: 6, y: 6 }, { x: 20, y: 9 }, { x: 9, y: 9 }, { x: 14, y: 4 },
      { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 9, y: 10 }, { x: 14, y: 3 },
    ],   // = 老 twoCamp 的 14 槽(已知全覆盖 a/b 两路)
    terrain: tz, terrainAt,
    waves: genWaves({ camps: b.camps, paths: b.paths }, { waveCount: 2, difficulty: 0, enemyTiers: ['footman'], boss: { id: 'huaxiong', name: '华雄', hpMult: 1 } }, 1),
  };
  return verifyLevel(lv);
}
// 无 terrain → 老行为不变(回归)
assert.equal(fixLevel([]).errors.length, 0, '无 terrain 零 errors');
// ① 将位落山 → error
assert.ok(fixLevel([{ type: 'mountain', cells: [{ x: 6, y: 10 }] }]).errors.some((e) => e.includes('将位') && e.includes('mountain')), '①槽位落山报错');
// ② 路穿河 → error(path a 经过 (5,5))
assert.ok(fixLevel([{ type: 'river', cells: [{ x: 5, y: 5 }] }]).errors.some((e) => e.includes('river')), '②路穿河报错');
// ② castle 被山压 → error
assert.ok(fixLevel([{ type: 'mountain', cells: [{ x: 11, y: 6 }] }]).errors.some((e) => e.includes('成都')), '②城被山压报错');
// ③ 火谷不盖路 → error;盖路 → ok
assert.ok(fixLevel([{ type: 'firegully', cells: [{ x: 20, y: 0 }] }]).errors.some((e) => e.includes('firegully')), '③火谷悬空报错');
assert.equal(fixLevel([{ type: 'firegully', cells: [{ x: 5, y: 5 }] }]).errors.length, 0, '③火谷盖路通过');
// ④ plateau 含路径格 → error;不含将位 → error;含将位(6,10) → ok
assert.ok(fixLevel([{ type: 'plateau', cells: [{ x: 5, y: 5 }] }]).errors.some((e) => e.includes('plateau')), '④plateau 压路报错');
assert.ok(fixLevel([{ type: 'plateau', cells: [{ x: 20, y: 0 }] }]).errors.some((e) => e.includes('plateau')), '④plateau 无将位报错');
assert.equal(fixLevel([{ type: 'plateau', cells: [{ x: 6, y: 10 }] }]).errors.length, 0, '④plateau 含将位通过');

console.log('ok boardVariants');
