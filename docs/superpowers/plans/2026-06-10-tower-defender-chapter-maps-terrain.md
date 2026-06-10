# Tower Defender · 每章主题板型 + 致命地形 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 50 关从"6 张重样图"换成 10 张章主题手写基板 × 镜像 × 将位套的全唯一板型,并落地五章渐进地形机制(高台/河流/浅滩/落石/火谷)+ L50 大雨彩蛋。

**Architecture:** 数据层新增 `baseBoards.js`(10 基板,纯数据)+ `boardVariants.js`(纯函数变体引擎:镜像/将位套/路子集/terrain 展开),`levels.js` 以 `resolveBoard(chapter,k)` 替代 `TEMPLATES[templateId]`;系统层新增 `terrainSystem.js`(段2 动态机制);渲染层在 `board.js` 按固定顺序插地形层。两段交付,各自可玩可验收。

**Tech Stack:** 原生 ES Modules + Canvas 2D(零依赖,自含铁律);测试 = `node tests/*.test.mjs` 纯 assert;门禁 = `bash scripts/test.sh`(45+ 单测 + verify-levels + check-imports + winnable)。

**Spec:** `docs/superpowers/specs/2026-06-10-tower-defender-chapter-maps-terrain-design.md`(方案C,已过 Kimi review)

---

## ⚠️ 前置条件(执行前必读)

1. **工作目录脏文件**:`src/core/audio.js`、`src/main.js`、`tests/audio.test.mjs`、`assets/bgm/` 有未提交的 BGM 改动(与本计划无关)。**开工前先让 James 确认把 BGM 工作单独 commit**(本计划会改 `main.js`,混在一起没法干净提交)。执行者不得把 BGM 文件混进本计划的任何 commit。
2. **工作分支**:在 `develop` 上直接做(该项目惯例,游戏目录自含)。每任务一个或多个小 commit。
3. **子代理成本**:game-hub 项目 James 明确不 care 成本(见项目记忆),派发子代理时 prompt 里写明"成本已获 James 授权"以免 cost-guard 自拦。
4. **运行测试的工作目录**:所有命令在 `games/tower-defender/` 下执行(`node tests/xxx.test.mjs`、`bash scripts/test.sh`)。

## 对 spec 的四处落地修正(已核对代码,执行时按此为准)

| # | spec 原文 | 实际落地 | 原因 |
|---|---|---|---|
| 1 | §7 "cities.test / cityAssign.test 零改动" | **断言逻辑零改动,仅改 import 行**(`TEMPLATES` → `BASE_BOARDS as TEMPLATES`,路径换 baseBoards.js)。campaign.test / waveGen.test 同理 | 这 4 个测试 import 了将被删除的 `boardTemplates.js`,字面零改动不可能 |
| 2 | §3.2 "每板 2-3 套将位" | **每板固定 3 套** | 公式 `slotsIdx=(ch+k)%S` 在 S=2 时章内 k=5 与 k=9 同镜像('h')同将位套 → 后半两关完全同图。S=3 时章内 10 关 (mirror,slotsIdx) 两两不同(已逐对推演) |
| 3 | §4 落石"敌所在格∈区域 cells 即命中" vs §6 表"半径 1.2 格" | **按 §4 格判定**,§6 表删半径行 | §4 是 Kimi review 后的结算语义(commit 27222e4),格判定确定性更强、实现更简 |
| 4 | §3.1 "rects 挖洞" | rects **无挖洞机制**:河流带由多段 rects 拼成,渡口处留缺口列 | schema 保持 `cells ∪ rects` 并集,不加 exclude 字段(YAGNI) |

另两处接口微调:① 样板关不做"显式覆盖四元组"(spec §3.2 提过)——全 50 关统一走 `variantFor` 公式,levels.js 加载期断言公式结果与 campaign 的 `templateId`/`pathSubset` 一致,单一真相源防漂移;② spec 的 `variantFor → {boardId,mirror,slotsIdx,pathSubset}` 四元组拆为 `variantFor(ch,k) → {boardId,mirror,slotsIdx}` + `pathSubsetFor(ch,k,pathIds)` 两个纯函数——子集依赖板的路 id 列表,拆开后 campaign(写 pathSubset 进关骨架)与 resolveBoard(过滤 camps/paths)可共用同一公式,不形成 campaign↔boardVariants 循环依赖。

**测试文件追加约定(全计划适用):** 各 Task 里"追加测试块"给出的 `import` 语句一律放到该测试文件**顶部 import 区**(ESM 不允许中部 import),断言代码块放 `console.log('ok ...')` 之前。

## 文件结构(全量)

```
段1「换图」
  Create  src/data/baseBoards.js          10 基板纯数据(BASE_BOARDS)
  Create  src/data/boardVariants.js       mirrorBoard/variantFor/pathSubsetFor/expandTerrain/resolveBoard
  Create  src/systems/terrainSystem.js    段1 仅静态助手 terrainTypeAt/rangeBonusFor(段2 加 tick)
  Modify  src/data/campaign.js            CHAPTERS.templates→新id;buildSkeleton 补 pathSubset;SAMPLES templateId
  Modify  src/data/levels.js              expand() 用 resolveBoard;CITY_AT 换 BASE_BOARDS
  Modify  src/entities/tower.js           rangeBonus:0 字段
  Modify  src/systems/economySystem.js    tryBuild 落 rangeBonus
  Modify  src/systems/targetingSystem.js  射程 + rangeBonus
  Modify  src/systems/combatSystem.js     射程 + rangeBonus
  Modify  src/systems/combat/attacks.js   射程 + rangeBonus
  Modify  src/main.js                     applyResume 重算 rangeBonus;两处范围圈
  Modify  src/ui/towerPanel.js            面板显示有效射程+高台标记
  Modify  src/render/board.js             静态地形基底层(6 类型)
  Modify  src/data/balance.js             BAL.PLATEAU_RANGE_BONUS
  Modify  tools/verify-levels.mjs         地形规则 ①②③④
  Modify  tools/suggest-slots.mjs         --board 模式+地形排除+种子变体
  Delete  src/data/boardTemplates.js      (切换后同 commit 删)
  Delete  tests/boardTemplates.test.mjs   (由 baseBoards.test 取代)
  Create  tests/boardVariants.test.mjs    纯函数性质+全组合 verify+镜像指纹去重
  Create  tests/baseBoards.test.mjs       基板数据形状校验
  Create  tests/fingerprints.test.mjs     50关指纹两两不同+逐关营数=现状
  Create  tests/plateau.test.mjs          rangeBonus 建塔/续玩/射程链
  Modify  tests/cities.test.mjs           仅 import 行
  Modify  tests/cityAssign.test.mjs       仅 import 行
  Modify  tests/campaign.test.mjs         仅 import 行
  Modify  tests/waveGen.test.mjs          import 行 + fixture 换 ch2B
段2「活地形」
  Modify  src/systems/terrainSystem.js    terrainSystem(state) tick:shallow/firegully/rockfall
  Modify  src/core/gameState.js           state.terrain 运行时(rockfall 计时/disabled 集)
  Modify  src/core/gameLoop.js            step() 接线 terrainSystem
  Modify  src/systems/statusSystem.js     envBurn 并行结算(×火抗)
  Modify  src/entities/enemy.js           envBurn:null 字段
  Modify  src/data/balance.js             SHALLOW_*/FIREGULLY_*/ROCKFALL_* 常量
  Modify  src/data/campaign.js            L50 disableTerrain:['firegully']
  Modify  src/data/levels.js              disableTerrain 透传
  Modify  src/render/board.js             动效层(落石警示/落石/火苗/波纹)+drawWeather 雨
  Modify  src/main.js                     调 drawWeather(实体层之上)
  Create  tests/terrainSystem.test.mjs    三机制确定性+L50 flag
  Create  tools/smoke-shots.mjs           每章截图(puppeteer-core,host 侧跑)
```

镜像变换公式(全计划统一,写死):点 `(x,y) → (cols-1-x, rows-1-y)`(h 只动 x,v 只动 y);rect `{x,y,w,h} → x'=cols-x-w, y'=rows-y-h`;castle `{c:11,r:6,w:2,h:2}` 在 24×14 下 h/v 镜像均不动(24-11-2=11, 14-6-2=6)。

---

# 段1「换图」

验收点:50 关图图不同、章主题肉眼可辨、高台生效、全门禁绿。

## Task 1: boardVariants 纯函数(mirrorBoard / variantFor / pathSubsetFor / expandTerrain)

**Files:**
- Create: `src/data/boardVariants.js`
- Create: `tests/boardVariants.test.mjs`

- [ ] **Step 1: 写失败测试(纯函数性质,用合成 fixture 板,不依赖真实基板)**

创建 `tests/boardVariants.test.mjs`:

```js
// tests/boardVariants.test.mjs — 变体引擎纯函数性质 + (Task 4 起)基板全组合 verify
// 运行:node games/tower-defender/tests/boardVariants.test.mjs
import assert from 'node:assert';
import { mirrorBoard, variantFor, pathSubsetFor, expandTerrain } from '../src/data/boardVariants.js';

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

console.log('ok boardVariants');
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /Users/james/Projects/game-hub/games/tower-defender && node tests/boardVariants.test.mjs
```
预期:`Cannot find module ... boardVariants.js`

- [ ] **Step 3: 实现 `src/data/boardVariants.js`**

```js
// data/boardVariants.js — 板型变体引擎(板型+地形 spec §3.2)。纯函数、零随机、render-free。
// 三维变体:镜像(×4) × 将位套(×3) × 路子集(前半窗口轮换) → 50 关路线或将位全部唯一。
// 铁律:本文件不 import campaign(防环);resolveBoard 是 levels.js 的唯一取板入口。
import { BASE_BOARDS } from './baseBoards.js';

const MIRRORS = ['none', 'h', 'v', 'hv'];
const SLOTS_VARIANTS = 3;                       // 每板固定 3 套(2 套时章内后半 (mirror,slotsIdx) 会撞车,已推演)
const SUBSET_SIZE = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };   // 章内前半营数 = 现状承诺(城名池切片不动的根)

// —— 镜像(返回深拷贝;mode: none|h|v|hv)——
const mx = (x, cols) => cols - 1 - x;
const my = (y, rows) => rows - 1 - y;

export function mirrorBoard(board, mode) {
  const fx = mode === 'h' || mode === 'hv';
  const fy = mode === 'v' || mode === 'hv';
  const { cols, rows } = board;
  const P = (p) => ({ x: fx ? mx(p.x, cols) : p.x, y: fy ? my(p.y, rows) : p.y });
  const out = {
    ...board,
    castle: {
      c: fx ? cols - board.castle.c - board.castle.w : board.castle.c,
      r: fy ? rows - board.castle.r - board.castle.h : board.castle.r,
      w: board.castle.w, h: board.castle.h,
    },
    camps: board.camps.map((cp) => ({ ...cp, c: fx ? mx(cp.c, cols) : cp.c, r: fy ? my(cp.r, rows) : cp.r })),
    paths: Object.fromEntries(Object.entries(board.paths).map(([id, wp]) => [id, wp.map(P)])),
    slotsVariants: board.slotsVariants.map((set) => set.map(P)),
    terrain: (board.terrain || []).map((z) => ({
      ...z,
      ...(z.cells ? { cells: z.cells.map(P) } : {}),
      ...(z.rects ? {
        rects: z.rects.map((r) => ({
          x: fx ? cols - r.x - r.w : r.x, y: fy ? rows - r.y - r.h : r.y, w: r.w, h: r.h,
        })),
      } : {}),
    })),
  };
  return out;
}

// —— 三维变体映射(写死公式,加载期零随机;spec §3.2)——
export function variantFor(chapter, k) {
  return {
    boardId: `ch${chapter}${k < 5 ? 'A' : 'B'}`,
    mirror: MIRRORS[k % 4],
    slotsIdx: (chapter + k) % SLOTS_VARIANTS,
  };
}

// 前半关(k=1..4)取子集:camps 顺序环上起点 (k-1)%n 的连续 m 条;k=0(样板)与后半 = null(全路)。
// 城名分配顺序 = 子集按模板 camps 原序过滤(levels.js 现行为),子集规则确定 ⇒ 城名分配确定。
export function pathSubsetFor(chapter, k, pathIds) {
  if (k === 0 || k >= 5) return null;
  const m = SUBSET_SIZE[chapter], n = pathIds.length;
  const start = (k - 1) % n;
  return Array.from({ length: m }, (_, i) => pathIds[(start + i) % n]);
}

// —— terrain 展开:rects→cells 并集 + terrainAt[r][c] 查表(加载期烘焙;spec §4)——
export function expandTerrain(board) {
  const terrainAt = Array.from({ length: board.rows }, () => Array(board.cols).fill(null));
  const terrain = (board.terrain || []).map((z) => {
    const seen = new Set();
    const cells = [];
    const push = (x, y) => { const key = `${x},${y}`; if (!seen.has(key)) { seen.add(key); cells.push({ x, y }); } };
    for (const c of z.cells || []) push(c.x, c.y);
    for (const r of z.rects || []) {
      for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) push(x, y);
    }
    for (const c of cells) terrainAt[c.y][c.x] = z.type;
    return { type: z.type, cells, cellSet: seen };
  });
  return { terrain, terrainAt };
}

// —— 总装:查板 → 镜像 → 选将位套 → 路子集过滤 → terrain 展开(levels.js 唯一入口)——
export function resolveBoard(chapter, k) {
  const { boardId, mirror, slotsIdx } = variantFor(chapter, k);
  const base = BASE_BOARDS[boardId];
  if (!base) throw new Error(`boardVariants: 未知基板 '${boardId}'`);
  const b = mirrorBoard(base, mirror);
  const allIds = Object.keys(b.paths);
  const subset = pathSubsetFor(chapter, k, allIds) || allIds;
  const paths = {}; for (const id of subset) paths[id] = b.paths[id];
  const camps = b.camps.filter((cp) => subset.includes(cp.id));
  const { terrain, terrainAt } = expandTerrain(b);
  return {
    id: boardId, mirror, slotsIdx,
    cols: b.cols, rows: b.rows, castle: b.castle,
    camps, paths, slots: b.slotsVariants[slotsIdx],
    terrain, terrainAt,
  };
}
```

注意:Task 1 时 `baseBoards.js` 还不存在,先建占位:

```js
// data/baseBoards.js — 10 张章主题手写基板(板型+地形 spec §3.1)。Task 4-8 逐章填充。
// 每板:{ id, chapter, half, cols:24, rows:14, castle:{c:11,r:6,w:2,h:2}, camps, paths, slotsVariants:[×3], terrain }
// terrain type ∈ plateau|river|shallow|mountain|rockfall|firegully;river/mountain=禁建+敌不走(设计期保证,verify 硬校验)。
// 铁律:render-free、纯数据、零随机;渡口/浮桥=路径格,river rects 在该列留缺口(无挖洞机制)。
export const BASE_BOARDS = {};
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node tests/boardVariants.test.mjs
```
预期:`ok boardVariants`

- [ ] **Step 5: Commit**

```bash
git add src/data/boardVariants.js src/data/baseBoards.js tests/boardVariants.test.mjs
git commit -m "feat(tower-defender): boardVariants 变体引擎纯函数(镜像/三维映射/路子集/terrain展开,TDD)"
```

## Task 2: verify-levels 地形规则扩展

**Files:**
- Modify: `tools/verify-levels.mjs`
- Test: 在 `tests/boardVariants.test.mjs` 末尾追加地形规则块(fixture 构造违规关)

verify 新规则(对带 `terrain` 的 level 生效,老 level 无 terrain 自动跳过 → CLI 在切板前保持全绿):
① slots 不落 river/mountain 格;② path 采样格、camps、castle 不与 river/mountain 相交;③ shallow/rockfall/firegully 每个区至少覆盖 1 个路径格;④ plateau 区不含路径格,且每区至少含 1 个将位格。

- [ ] **Step 1: 写失败测试(追加到 tests/boardVariants.test.mjs;两行 import 放文件顶部,其余放 `console.log` 之前)**

```js
import { verifyLevel } from '../tools/verify-levels.mjs';   // ← 文件顶部
import { genWaves } from '../src/data/waveGen.js';          // ← 文件顶部

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
```

- [ ] **Step 2: 跑测试确认失败**(新断言红:verifyLevel 尚无地形规则)

- [ ] **Step 3: 扩展 `tools/verify-levels.mjs`**

在 `verifyLevel` 内、`// —— 无漏怪 ——` 块之前插入(pathCells/castleCells 已在上文算好):

```js
  // —— [板型+地形] terrain 规则(level.terrain 存在才生效;老关无地形自动跳过)——
  if (Array.isArray(level.terrain) && level.terrain.length) {
    const cellKey = (c) => `${c.x},${c.y}`;
    const blocked = new Set();   // river ∪ mountain = 禁建 + 敌不走
    for (const z of level.terrain) {
      if (z.type === 'river' || z.type === 'mountain') for (const c of z.cells) blocked.add(cellKey(c));
    }
    // ① 将位不落水/山
    for (const s of level.slots || []) {
      if (blocked.has(`${s.x},${s.y}`)) errors.push(`L${id}: 将位 (${s.x},${s.y}) 落在 river/mountain 上`);
    }
    // ② 路径采样格 / camps / castle 不与水/山相交(渡口=路径格,设计期已从 river 区抠除)
    for (const k of pathCells) if (blocked.has(k)) errors.push(`L${id}: 蜀道格 (${k}) 穿 river/mountain`);
    for (const cp of level.camps || []) if (blocked.has(`${cp.c},${cp.r}`)) errors.push(`L${id}: 敌营 ${cp.id} 落在 river/mountain 上`);
    for (const k of castleCells) if (blocked.has(k)) errors.push(`L${id}: 成都格 (${k}) 被 river/mountain 覆盖`);
    // ③ 动态地形(shallow/rockfall/firegully)每区至少盖 1 个路径格(防"装饰区"失效)
    for (const z of level.terrain) {
      if (!['shallow', 'rockfall', 'firegully'].includes(z.type)) continue;
      if (!z.cells.some((c) => pathCells.has(cellKey(c)))) errors.push(`L${id}: ${z.type} 区未覆盖任何路径格`);
    }
    // ④ plateau:不含路径格(高台上不走兵) + 每区至少含 1 个将位格(否则机制无感)
    const slotSet = new Set((level.slots || []).map((s) => `${s.x},${s.y}`));
    for (const z of level.terrain) {
      if (z.type !== 'plateau') continue;
      if (z.cells.some((c) => pathCells.has(cellKey(c)))) errors.push(`L${id}: plateau 区压住路径格`);
      if (!z.cells.some((c) => slotSet.has(cellKey(c)))) errors.push(`L${id}: plateau 区不含任何将位格(机制无感)`);
    }
  }
```

- [ ] **Step 4: 跑测试确认通过 + 存量回归**

```bash
node tests/boardVariants.test.mjs && node tools/verify-levels.mjs && node tests/levels-integrity.test.mjs
```
预期:三者全绿(老 LEVELS 无 terrain,规则不触发)。

- [ ] **Step 5: Commit**

```bash
git add tools/verify-levels.mjs tests/boardVariants.test.mjs
git commit -m "feat(tower-defender): verify-levels 地形四规则(水山禁建禁行/动态地形盖路/plateau含将位,向后兼容)"
```

## Task 3: suggest-slots 工具升级(--board 模式 + 地形排除 + 种子变体)

**Files:**
- Modify: `tools/suggest-slots.mjs`

离线作者工具,无单测;由 Task 4-8 实际使用 + verify 门禁兜底。

- [ ] **Step 1: 改造工具**

保留现有 LEVELS 模式(无参数时行为不变),新增 board 模式。`suggest(level)` 函数主体复用,做三处改动:

```js
// 用法新增:node tools/suggest-slots.mjs --board ch1A [--seed 1]
// --board:从 baseBoards.js 取基板,对"全路"布点(子集覆盖由 superset 性质保证);
//          排除 river/mountain 格;plateau 格优先(确保 ④ 规则);--seed 1..3 产出互不相同的套。
import { BASE_BOARDS } from '../src/data/baseBoards.js';
import { expandTerrain } from '../src/data/boardVariants.js';
import { makeRng } from '../src/core/rng.js';
```

`suggest(level, seed = 0)` 内三处:

```js
  // (a) 候选格排除地形禁建(terrainAt 由调用方挂上)
  const ta = level.terrainAt;
  // 在 cands 收集循环的 continue 条件追加:
  //   if (ta && (ta[y]?.[x] === 'river' || ta[y]?.[x] === 'mountain')) continue;

  // (b) 贪心打分:plateau 候选 +0.5 分(等覆盖数时优先上台),种子抖动 ±0.3 分(变体多样性)
  const rng = makeRng(seed * 7919 + 1);
  const jitter = new Map();   // 候选 -> 固定抖动(同一轮内稳定)
  const scoreOf = (c, cnt) => {
    const key = `${c.x},${c.y}`;
    if (!jitter.has(key)) jitter.set(key, (rng() - 0.5) * 0.6);
    const onPlateau = ta && ta[c.y]?.[c.x] === 'plateau' ? 0.5 : 0;
    return cnt + onPlateau + jitter.get(key);
  };
  // 贪心选优时用 scoreOf(c, cnt) 替代裸 cnt(覆盖兜底:score 取整后仍以"能盖到新点"为先,
  //   即 cnt===0 的候选永不入选主循环);冗余位排序同样用 scoreOf。

  // (c) 冗余位补完后,若存在 plateau 区无任何已选 slot:从该区内选一个"贴路程度最高"的候选补入
  if (ta) {
    for (const z of level.terrain || []) {
      if (z.type !== 'plateau') continue;
      if (z.cells.some((c) => slots.some((s) => s.x === c.x && s.y === c.y))) continue;
      const inZone = scored.filter((o) => z.cellSet.has(`${o.c.x},${o.c.y}`));
      if (inZone.length) slots.push(inZone[0].c);
    }
  }
```

CLI 入口改为:

```js
const bIdx = process.argv.indexOf('--board');
if (bIdx > 0) {
  const id = process.argv[bIdx + 1];
  const board = BASE_BOARDS[id];
  if (!board) { console.error(`无基板 ${id};现有: ${Object.keys(BASE_BOARDS).join(',') || '(空)'}`); process.exit(1); }
  const { terrain, terrainAt } = expandTerrain(board);
  const lv = { ...board, paths: board.paths, camps: board.camps, terrain, terrainAt };
  for (const seed of [1, 2, 3]) {
    const { slots, uncovered } = suggest(lv, seed);
    const tag = uncovered ? ` ⚠ ${uncovered} 点无法覆盖` : '';
    console.log(`// ${id} seed${seed}: ${slots.length} 将位${tag}`);
    console.log(`[${slots.map((s) => `{ x: ${s.x}, y: ${s.y} }`).join(', ')}],`);
  }
} else {
  // 原 LEVELS 全量模式不变(suggest(lv) 不带 terrainAt → 行为同旧)
}
```

- [ ] **Step 2: 语法检查 + 旧模式回归**

```bash
node --check tools/suggest-slots.mjs && node tools/suggest-slots.mjs | head -5 && node tools/suggest-slots.mjs --board ch1A; echo "exit=$? (ch1A 未填充时应报'无基板'退出1)"
```

- [ ] **Step 3: Commit**

```bash
git add tools/suggest-slots.mjs
git commit -m "feat(tower-defender): suggest-slots 支持 --board 基板模式(地形排除/plateau优先/3种子变体)"
```

## Task 4: 第1章基板 ch1A/ch1B(平原烽火·plateau)+ baseBoards.test

**Files:**
- Modify: `src/data/baseBoards.js`
- Create: `tests/baseBoards.test.mjs`
- Modify: `tests/boardVariants.test.mjs`(追加"真实基板全组合 verify"块)

每章基板任务(Task 4-8)流程相同:**写板 → suggest-slots 生成 3 套将位 → 全组合测试绿 → commit**。基板是创意几何 + 客观门禁:下面给出的 camps/paths/terrain 是经过坐标推演的起点,若 verify/测试报 leak 或规则违例,按报错微调坐标后重跑(门禁是唯一真理)。

**全章设计约束(适用 Task 4-8):**
- `cols:24, rows:14, castle:{c:11,r:6,w:2,h:2}` 全板统一;camp 格 = path[0];path 末点 ∈ 成都 4 格;每路总长 ≥14 格(verify MIN_PATH_LEN);路径全部轴对齐折线。
- **id 约定**:camp/path id 从 `'a'` 起连续小写字母;`paths` 对象键的插入顺序 = `camps` 数组顺序(子集窗口 `pathSubsetFor` 依赖 `Object.keys(paths)` 的确定性顺序)。
- 营数 = 章最大:ch1=3 / ch2=4 / ch3=5 / ch4=6 / ch5=8;camps 数组顺序即城名分配顺序(贴题岛在样板关靠这个顺序,**ch1A 顺序对应 L1 宛城/叶县/堵阳,ch5B 末位营吃「长安」**——任意顺序均满足现有测试,无需特殊处理,但 A 板 camps 按"主攻方向优先"排个自然顺序)。
- **基板必须打破轴对称**(镜像指纹去重断言会抓):至少一路的拓扑在左右/上下翻转后明显不同。
- terrain 区域用 rects 优先(河/山大块),小补丁用 cells;渡口列在 river rects 间留缺口。
- 每板 3 套 slotsVariants 由工具生成后**写死进数据文件**,禁止运行时生成。

- [ ] **Step 1: 创建 `tests/baseBoards.test.mjs`(迭代现有板,板少时也绿——完整性"恰好10板"断言留 Task 9)**

```js
// tests/baseBoards.test.mjs — 基板数据形状校验(取代旧 boardTemplates.test 的职责,Task 9 删旧)
// 运行:node games/tower-defender/tests/baseBoards.test.mjs
import assert from 'node:assert';
import { BASE_BOARDS } from '../src/data/baseBoards.js';

const CHAPTER_CAMPS = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 8 };
const TERRAIN_TYPES = new Set(['plateau', 'river', 'shallow', 'mountain', 'rockfall', 'firegully']);

for (const [id, b] of Object.entries(BASE_BOARDS)) {
  assert.equal(b.id, id, `${id} id 自洽`);
  assert.ok(/^ch[1-5][AB]$/.test(id), `${id} 命名 chN[A|B]`);
  assert.equal(b.chapter, +id[2], `${id} chapter 字段`);
  assert.equal(b.cols, 24, `${id} cols`);
  assert.equal(b.rows, 14, `${id} rows`);
  assert.deepEqual(b.castle, { c: 11, r: 6, w: 2, h: 2 }, `${id} castle 统一`);
  assert.equal(b.camps.length, CHAPTER_CAMPS[b.chapter], `${id} 营数=章最大`);
  assert.equal(Object.keys(b.paths).length, b.camps.length, `${id} camps↔paths 数一致`);
  for (const cp of b.camps) {
    const wp = b.paths[cp.id];
    assert.ok(wp, `${id} camp ${cp.id} 有同名 path`);
    assert.deepEqual(wp[0], { x: cp.c, y: cp.r }, `${id} path ${cp.id} 首点=camp`);
  }
  assert.equal(b.slotsVariants.length, 3, `${id} 恰 3 套将位`);
  const sigs = b.slotsVariants.map((s) => JSON.stringify([...s].sort((a, c) => a.x - c.x || a.y - c.y)));
  assert.equal(new Set(sigs).size, 3, `${id} 3 套将位两两不同`);
  for (const z of b.terrain || []) {
    assert.ok(TERRAIN_TYPES.has(z.type), `${id} terrain 类型 ${z.type} 合法`);
    assert.ok((z.cells && z.cells.length) || (z.rects && z.rects.length), `${id} terrain 区非空`);
  }
}
console.log(`ok baseBoards (${Object.keys(BASE_BOARDS).length} 板)`);
```

- [ ] **Step 2: 在 `tests/boardVariants.test.mjs` 的 verify 地形块之后追加"真实基板全组合"块(spec §7 入口2;import 放顶部)**

```js
import { BASE_BOARDS } from '../src/data/baseBoards.js';    // ← 文件顶部

// —— 真实基板全组合:每板 × 4 镜像 × 3 将位套 全过 verifyLevel + 镜像指纹去重(防对称基板撞图)——
const fp = (paths, slots) => JSON.stringify(paths) + '|' + JSON.stringify(slots);
for (const [bid, base] of Object.entries(BASE_BOARDS)) {
  const mirrorFps = new Set();
  for (const m of ['none', 'h', 'v', 'hv']) {
    const b = mirrorBoard(base, m);
    const { terrain, terrainAt } = expandTerrain(b);
    mirrorFps.add(fp(b.paths, b.slotsVariants[0]));
    for (let si = 0; si < b.slotsVariants.length; si++) {
      const lv = {
        id: `${bid}/${m}/s${si}`, faction: 'wei', scale: 1, startGold: 300, castleHp: 20,
        cols: b.cols, rows: b.rows, castle: b.castle, camps: b.camps, paths: b.paths,
        slots: b.slotsVariants[si], terrain, terrainAt,
        waves: genWaves({ camps: b.camps, paths: b.paths }, { waveCount: 2, difficulty: 0, enemyTiers: ['footman'], boss: { id: 'huaxiong', name: '华雄', hpMult: 1 } }, 1),
      };
      const r = verifyLevel(lv);
      assert.equal(r.errors.length, 0, `${lv.id} errors: ${r.errors.join('; ')}`);
      assert.equal(r.leaks.length, 0, `${lv.id} leaks: ${JSON.stringify(r.leaks)}`);
    }
  }
  assert.equal(mirrorFps.size, 4, `${bid} 4 镜像指纹两两不同(基板有轴对称,须打破)`);
}
```

- [ ] **Step 3: 跑两个测试**——baseBoards 空板时 `ok baseBoards (0 板)`、boardVariants 全组合块空循环也绿(基线确认)。

- [ ] **Step 4: 写 ch1A/ch1B 进 `BASE_BOARDS`(平原烽火:开阔地 + S 形蜀道 + 高台)**

ch1A(已坐标推演的起点;`slotsVariants` 先放 `[[],[],[]]` 占位,Step 5 填):

```js
  ch1A: {
    id: 'ch1A', chapter: 1, half: 'A', cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
    // 平原烽火:三路 S 形蜀道自西北/东/南会攻成都;两处黄土高台俯瞰要道
    camps: [{ id: 'a', c: 1, r: 1 }, { id: 'b', c: 22, r: 3 }, { id: 'c', c: 4, r: 13 }],
    paths: {
      a: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 8 }, { x: 7, y: 8 }, { x: 7, y: 5 }, { x: 11, y: 5 }, { x: 11, y: 6 }],
      b: [{ x: 22, y: 3 }, { x: 18, y: 3 }, { x: 18, y: 1 }, { x: 14, y: 1 }, { x: 14, y: 4 }, { x: 20, y: 4 }, { x: 20, y: 8 }, { x: 15, y: 8 }, { x: 15, y: 6 }, { x: 12, y: 6 }],
      c: [{ x: 4, y: 13 }, { x: 4, y: 10 }, { x: 9, y: 10 }, { x: 9, y: 12 }, { x: 14, y: 12 }, { x: 14, y: 9 }, { x: 11, y: 9 }, { x: 11, y: 7 }],
    },
    slotsVariants: [[], [], []],   // ← suggest-slots --board ch1A 三套粘贴于此
    terrain: [
      { type: 'plateau', rects: [{ x: 8, y: 6, w: 2, h: 2 }] },     // 城西高台,扼 a/c 会攻口
      { type: 'plateau', rects: [{ x: 16, y: 2, w: 2, h: 2 }] },    // 东北高台,扼 b 路折返段
    ],
  },
```

ch1B 设计要点(同格式自行写出,过门禁即可):三营 N(10,0)/E(23,9)/SW(1,12);路型与 A 板区分——B 板走"外环长绕"(沿边缘大半圈再内折),a 路从北顶横贯东侧南下,b 路沿南缘西行再北折,c 路西缘北上东折;两处 plateau 放 (5,5,2,2) 与 (15,10,2,2) 附近(注意 plateau 不压路:先画路再放台,或放台后让路绕行)。**确认整板无左右/上下对称**。

- [ ] **Step 5: 生成 3 套将位并写死**

```bash
node tools/suggest-slots.mjs --board ch1A
node tools/suggest-slots.mjs --board ch1B
```
把三个 seed 的输出数组分别粘进 `slotsVariants`。若某两套相同(贪心收敛),改该板任一 plateau/路微调后重生成,或手动在冗余位上做 2-3 格差异(保持不落路/水/山)。

- [ ] **Step 6: 跑门禁迭代至绿**

```bash
node tests/baseBoards.test.mjs && node tests/boardVariants.test.mjs
```
常见报错与修法:`leaks`(某段路无将位覆盖)→ 给该段附近补 1 个 slot(三套都要);`plateau 区不含任何将位格` → 把该区 1 格换成最近的 slot 或在区内补 slot;`镜像指纹去重` → 板对称,挪一路一折;`路径过短` → 给该路加一个折返。

- [ ] **Step 7: Commit**

```bash
git add src/data/baseBoards.js tests/baseBoards.test.mjs tests/boardVariants.test.mjs
git commit -m "feat(tower-defender): 第1章基板 ch1A/ch1B(平原烽火S道+双高台,3套将位,全组合verify绿)"
```

## Task 5: 第2章基板 ch2A/ch2B(河流渡口·river)

**Files:**
- Modify: `src/data/baseBoards.js`

流程同 Task 4(测试已就位,加板即被覆盖)。

- [ ] **Step 1: 写 ch2A/ch2B(4 营;横贯河流 + 两渡口)**

ch2A 起点(已推演):河流横贯 y=3..4,渡口两处(x=6..7 与 x=16..17 列留缺口);北岸 2 营必须经渡口南下(卡口集火教学),南岸 2 营平原直进。

```js
  ch2A: {
    id: 'ch2A', chapter: 2, half: 'A', cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
    // 官渡河北:大河横贯北境,两座渡口是唯一通路;南岸双营策应
    camps: [{ id: 'a', c: 2, r: 0 }, { id: 'b', c: 21, r: 0 }, { id: 'c', c: 1, r: 11 }, { id: 'd', c: 22, r: 12 }],
    paths: {
      // a:北岸西营 → 西渡口(x=6..7) → 南岸折线进城西
      a: [{ x: 2, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 9 }, { x: 8, y: 9 }, { x: 8, y: 7 }, { x: 11, y: 7 }],
      // b:北岸东营 → 东渡口(x=16..17) → 南岸折线进城东
      b: [{ x: 21, y: 0 }, { x: 17, y: 0 }, { x: 17, y: 5 }, { x: 21, y: 5 }, { x: 21, y: 9 }, { x: 16, y: 9 }, { x: 16, y: 7 }, { x: 12, y: 7 }],
      // c/d:南岸双营,长绕进城
      c: [{ x: 1, y: 11 }, { x: 1, y: 13 }, { x: 7, y: 13 }, { x: 7, y: 11 }, { x: 10, y: 11 }, { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 11, y: 7 }],
      d: [{ x: 22, y: 12 }, { x: 14, y: 12 }, { x: 14, y: 10 }, { x: 18, y: 10 }, { x: 18, y: 8 }, { x: 13, y: 8 }, { x: 13, y: 7 }, { x: 12, y: 7 }],
    },
    slotsVariants: [[], [], []],
    terrain: [
      // 河 y=3..4:三段 rects,渡口列 x=6..7 / x=16..17 留缺口(rects 无挖洞机制)
      { type: 'river', rects: [{ x: 0, y: 3, w: 6, h: 2 }, { x: 8, y: 3, w: 8, h: 2 }, { x: 18, y: 3, w: 6, h: 2 }] },
      { type: 'plateau', rects: [{ x: 4, y: 6, w: 2, h: 2 }] },   // 西渡口南岸高台(复用 ch1 机制)
    ],
  },
```

注意:a 路 (6,0)→(6,5) 竖穿 y=3..4 的 x=6 列——该列在 river rects 缺口内 ✓;b 路 x=17 列同理 ✓。c 路 (10,8) 不碰河。**plateau (4,6,2,2) 不压路**:a 路经 (3,5)→(3,9) 列 x=3、(8,9)→(8,7) 列 x=8,中间 x=4..5 y=6..7 空 ✓。

ch2B 设计要点:河改为斜折式双段(如 y=8..9 横贯南境、渡口在 x=4..5 与 x=13..14),4 营两南两北,南岸营过渡口北上;校verify。可在东渡口边放一个 plateau。打破对称。

- [ ] **Step 2: 生成将位 + 门禁迭代**

```bash
node tools/suggest-slots.mjs --board ch2A
node tools/suggest-slots.mjs --board ch2B
node tests/baseBoards.test.mjs && node tests/boardVariants.test.mjs
```

- [ ] **Step 3: Commit**

```bash
git add src/data/baseBoards.js
git commit -m "feat(tower-defender): 第2章基板 ch2A/ch2B(横贯河流+双渡口卡口,3套将位,verify绿)"
```

## Task 6: 第3章基板 ch3A/ch3B(赤壁江面·shallow)

**Files:**
- Modify: `src/data/baseBoards.js`

- [ ] **Step 1: 写 ch3A/ch3B(5 营;下半幅长江 + 栈桥 + 浅滩)**

ch3A 设计(给定坐标骨架,verify 微调):
- 长江占 y=10..13 下缘大带,**两条栈桥**走廊 x=5..6、x=18..19 留缺口(同 ch2 多段 rects 法):`{ type:'river', rects: [{x:0,y:10,w:5,h:4},{x:7,y:10,w:11,h:4},{x:20,y:10,w:4,h:4}] }`。
- 5 营:2 营在江南岸(c=3,r=13 与 c=21,r=13,分别走两座栈桥北上),3 营在北岸(西 c=0,r=4 / 北 c=12,r=0 / 东 c=23,r=5)。
- **shallow 浅滩区盖桥头路段**:`{ type:'shallow', rects:[{x:5,y:8,w:2,h:2},{x:18,y:8,w:2,h:2}] }`——桥北出口两格(必须是路径格,③ 规则校验;减速带前堆输出教学)。
- 北岸三路各自 S 形;江面虽宽但江南二营路长天然 ≥14。
- plateau 可放 1 处(北中 (10,2,2,2) 类似),浅滩教学为主不抢戏。

ch3B 设计要点:江改东半幅纵向(x=17..23 竖带,栈桥 y=4..5 与 y=10..11 两横走廊),2 营江东、3 营西/北/南;shallow 盖两桥西出口;打破对称。

- [ ] **Step 2: 生成将位 + 门禁迭代**(命令同 Task 5)

- [ ] **Step 3: Commit**

```bash
git add src/data/baseBoards.js
git commit -m "feat(tower-defender): 第3章基板 ch3A/ch3B(长江栈桥+桥头浅滩,3套将位,verify绿)"
```

## Task 7: 第4章基板 ch4A/ch4B(汉中山道·mountain+rockfall)

**Files:**
- Modify: `src/data/baseBoards.js`

- [ ] **Step 1: 写 ch4A/ch4B(6 营;两侧山壁夹窄路 + 落石区)**

ch4A 设计:
- 山体:西壁 `{x:0,y:5,w:2,h:6}`、东壁 `{x:22,y:4,w:2,h:6}`、北中山块 `{x:9,y:0,w:3,h:2}`、南中山块 `{x:12,y:11,w:3,h:2}`(全 mountain rects;**camps/路全部避开**)。
- 6 营沿四角+两侧中点,路被山壁挤成 2-3 条窄走廊(多营共享走廊段允许——路径可重叠,verify 不禁)。
- **rockfall 区 2 处**,各 3-4 格,精确压在走廊路段上:如 `{ type:'rockfall', cells:[{x:4,y:6},{x:4,y:7},{x:5,y:7}] }`(坐标以实际路径格为准,③ 规则校验)。
- 山壁格不可建 → 将位天然被挤进谷地,suggest-slots 的地形排除起作用。

ch4B 设计要点:山势换成"中央山脊"(竖贯 `{x:10,y:0,w:2,h:4}` 与 `{x:12,y:9,w:2,h:5}` 上下两段),敌流绕脊两侧;rockfall 放脊侧弯道;打破对称。

- [ ] **Step 2: 生成将位 + 门禁迭代**(命令同 Task 5)

- [ ] **Step 3: Commit**

```bash
git add src/data/baseBoards.js
git commit -m "feat(tower-defender): 第4章基板 ch4A/ch4B(山壁窄道+落石区,3套将位,verify绿)"
```

## Task 8: 第5章基板 ch5A/ch5B(北伐渭原·firegully 集大成)

**Files:**
- Modify: `src/data/baseBoards.js`

- [ ] **Step 1: 写 ch5A/ch5B(8 营;渭水 + 火谷 + 高台/浅滩集大成)**

ch5A 设计:
- 渭水细河 y=2..3 北境横贯(渡口 2-3 处留缺口);**火谷**谷地 2 区盖中部主走廊路段(各 4-6 格 cells);plateau 1-2 处;可选 shallow 1 处贴渡口。
- 8 营:北 3(过渡口)、东 2、南 2、西 1;参考老 eightCamp 的营位密度,路网允许共享干道。
- 8 路全部 ≥14 格且全员到城,工作量最大,预留耐心;suggest-slots 对 8 路板产出 25-30 槽属正常。

ch5B 设计(L50 上方谷终关板,k=9 镜像 'h' 上场):
- **上方谷意象**:三面环山的谷地(mountain rects 围 U 形,谷口朝北),**火谷大区铺谷底主路段**(L50 大雨彩蛋将熄灭它);渭水短带+渡口;plateau 守谷口。
- camps 顺序注意:**数组最后一营会拿到「长安」城名**(cityAssign 测试断言),把最后一营放在最威胁位(如谷口正北)叙事最顺。
- 打破对称(U 形谷天然不对称,留意路网别做成左右镜像)。

- [ ] **Step 2: 生成将位 + 门禁迭代**(命令同 Task 5)

- [ ] **Step 3: 全部 10 板就位的完备断言追加**

`tests/baseBoards.test.mjs` 末尾(console.log 之前)追加:

```js
// 10 板完备 + 每章 A/B 配对
assert.deepEqual(
  Object.keys(BASE_BOARDS).sort(),
  ['ch1A', 'ch1B', 'ch2A', 'ch2B', 'ch3A', 'ch3B', 'ch4A', 'ch4B', 'ch5A', 'ch5B'],
  '恰好 10 张基板',
);
// 每章新机制就位(教学承诺):ch2 河/ch3 浅滩/ch4 山+落石/ch5 火谷;ch1 高台
const typesOf = (ch) => new Set(['A', 'B'].flatMap((h) => (BASE_BOARDS[`ch${ch}${h}`].terrain || []).map((z) => z.type)));
assert.ok(typesOf(1).has('plateau'), 'ch1 有高台');
assert.ok(typesOf(2).has('river'), 'ch2 有河');
assert.ok(typesOf(3).has('shallow'), 'ch3 有浅滩');
assert.ok(typesOf(4).has('mountain') && typesOf(4).has('rockfall'), 'ch4 有山+落石');
assert.ok(typesOf(5).has('firegully'), 'ch5 有火谷');
```

- [ ] **Step 4: 跑测试绿后 Commit**

```bash
node tests/baseBoards.test.mjs && node tests/boardVariants.test.mjs
git add src/data/baseBoards.js tests/baseBoards.test.mjs
git commit -m "feat(tower-defender): 第5章基板 ch5A/ch5B(渭原火谷+上方谷U形谷,10基板完备断言)"
```

## Task 9: 切换 campaign/levels 到新基板 + 删旧模板 + 指纹门禁(原子切换)

**Files:**
- Modify: `src/data/campaign.js`
- Modify: `src/data/levels.js`
- Delete: `src/data/boardTemplates.js`、`tests/boardTemplates.test.mjs`
- Create: `tests/fingerprints.test.mjs`
- Modify(import 行): `tests/cities.test.mjs`、`tests/cityAssign.test.mjs`、`tests/campaign.test.mjs`、`tests/waveGen.test.mjs`

这是**一个 commit 的原子切换**:切完即跑全门禁。

- [ ] **Step 1: 先写失败的指纹测试 `tests/fingerprints.test.mjs`(切换前红——老 LEVELS 只有 6 张图)**

```js
// tests/fingerprints.test.mjs — 验收标准 §10.1/§10.2:50 关几何指纹两两不同 + 逐关营数=现状承诺
// 运行:node games/tower-defender/tests/fingerprints.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';

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

// 每关挂上地形展开产物(段1 起 levels 必带;无地形章节也有空数组+全 null 表)
for (const lv of LEVELS) {
  assert.ok(Array.isArray(lv.terrain), `L${lv.id} 有 terrain`);
  assert.ok(Array.isArray(lv.terrainAt) && lv.terrainAt.length === lv.rows, `L${lv.id} 有 terrainAt`);
}
console.log('ok fingerprints');
```

跑 `node tests/fingerprints.test.mjs` → 预期 FAIL(撞图)。

- [ ] **Step 2: 改 `src/data/campaign.js`(三处)**

(a) CHAPTERS 的 templates 字段(5 行,各章一处):

```js
  { id: 1, ..., templates: ['ch1A', 'ch1B'], ... },
  { id: 2, ..., templates: ['ch2A', 'ch2B'], ... },
  { id: 3, ..., templates: ['ch3A', 'ch3B'], ... },
  { id: 4, ..., templates: ['ch4A', 'ch4B'], ... },
  { id: 5, ..., templates: ['ch5A', 'ch5B'], ... },
```

(b) 顶部 import + buildSkeleton 补 pathSubset(单一真相源 = boardVariants 公式):

```js
import { BASE_BOARDS } from './baseBoards.js';
import { pathSubsetFor } from './boardVariants.js';
```

buildSkeleton 内 templateId 行后追加:

```js
  const templateId = C.templates[k < 5 ? 0 : 1];   // 现行不变
  const pathSubset = pathSubsetFor(ch, k, Object.keys(BASE_BOARDS[templateId].paths));   // 前半=子集,后半/样板=null
```

return 对象加 `...(pathSubset ? { pathSubset } : {})`(后半不带键,与现状形状一致)。

(c) SAMPLES 六关 templateId/pathSubset 切新板:

```js
  1:  { ..., templateId: 'ch1A', pathSubset: ['a', 'b', 'c'], ... },
  11: { ..., templateId: 'ch2A', pathSubset: ['a', 'b', 'c', 'd'], ... },
  21: { ..., templateId: 'ch3A', pathSubset: ['a', 'b', 'c', 'd', 'e'], ... },
  31: { ..., templateId: 'ch4A', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f'], ... },
  41: { ..., templateId: 'ch5A', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], ... },
  50: { ..., templateId: 'ch5B', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], ... },
```

(其余字段 boss/story/rampMax 等全部不动。)

- [ ] **Step 3: 重写 `src/data/levels.js` 的取板路径**

```js
// 顶部:删 `import { TEMPLATES } from './boardTemplates.js';`,改:
import { BASE_BOARDS } from './baseBoards.js';
import { variantFor, resolveBoard } from './boardVariants.js';
```

CITY_AT 块(只动一行——derivation 公式保持):

```js
    const tmpl = BASE_BOARDS[c.templateId];
```

expand() 取板与组装(替换原 `const tmpl = TEMPLATES[...]` 至 return 之间的板相关行):

```js
function expand(c) {
  const k = (c.id - 1) % 10;
  // [板型+地形] 公式与 campaign 双源一致性(加载期断言,防漂移)
  const v = variantFor(c.chapter, k);
  if (v.boardId !== c.templateId) throw new Error(`levels: L${c.id} variantFor=${v.boardId} ≠ templateId=${c.templateId}`);
  const board = resolveBoard(c.chapter, k);
  const subsetIds = board.camps.map((cp) => cp.id);
  const declared = c.pathSubset && c.pathSubset.length ? [...c.pathSubset].sort() : Object.keys(BASE_BOARDS[c.templateId].paths).sort();
  if (JSON.stringify([...subsetIds].sort()) !== JSON.stringify(declared)) {
    throw new Error(`levels: L${c.id} 子集不一致 board=[${subsetIds}] campaign=[${declared}]`);
  }
  const cityNames = CITY_POOLS[c.chapter].slice(CITY_AT[c.id], CITY_AT[c.id] + board.camps.length);
  const camps = board.camps.map((cp, i) => ({ ...cp, cityName: cityNames[i] }));
  // …(boss/lieutenants/difficultyParams 段全部不动)…
  const waves = genWaves(
    { camps, paths: board.paths },
    { waveCount: c.waveCount, difficulty: c.difficulty, enemyTiers: c.enemyTiers, boss, lieutenants },
    c.id,
  );
  return {
    id: c.id, name: c.name, chapter: c.chapter, faction: c.faction,
    scale, startGold, castleHp,
    rampMax: c.rampMax,
    cols: board.cols, rows: board.rows, castle: board.castle,
    camps, paths: board.paths, slots: board.slots, waves,
    terrain: board.terrain, terrainAt: board.terrainAt,            // [板型+地形] 展开产物
    ...(c.disableTerrain ? { disableTerrain: c.disableTerrain } : {}),   // 段2 L50 用,先透传
  };
}
```

(genWaves 第一参数原本是 `{...tmpl, camps, paths}`——其内部只读 camps/paths,收窄为 `{camps, paths}` 与 waveGen 注释一致。)

- [ ] **Step 4: 删旧文件 + 修 4 个测试的 import 行**

```bash
git rm src/data/boardTemplates.js tests/boardTemplates.test.mjs
```

四个测试各改一行(断言体不动):

```js
// tests/cities.test.mjs / tests/cityAssign.test.mjs / tests/campaign.test.mjs:
import { BASE_BOARDS as TEMPLATES } from '../src/data/baseBoards.js';
// tests/waveGen.test.mjs:import 同上,另 fixture 行:
const tmpl = TEMPLATES.ch2B;   // 原 TEMPLATES.fourCamp(同为 4 营板)
```

(若 waveGen.test 对 wave 内容有硬编码断言依赖旧几何,按新 ch2B 输出更新期望值——波次结构断言通常只看 count/lane 形状,先跑再说。)

- [ ] **Step 5: 全门禁迭代至绿**

```bash
bash scripts/test.sh
```

预期需要迭代的点(按报错处理,全部有客观判据):
- `cities.test` 池长不匹配 → 说明某板营数或某关子集大小不对,回查 SUBSET_SIZE/基板营数(不许改城名池)。
- `cityAssign` L1 贴题岛失败 → ch1A camps 数组顺序问题(L1 全子集顺序 = camps 顺序,首三名固定吃宛城/叶县/堵阳,无解时调 camps 数组顺序,几何不动)。
- `levels-winnable` 个别关 lost → 该关变体将位套覆盖虽达标但火力密度不足:优先给对应基板该套 slotsVariants 补 1-2 个贴主路槽(重跑 suggest-slots 换 seed 也行),不动 difficulty。
- `fingerprints` 撞图 → 看是哪两关:同章同板 → variantFor 公式实现有 bug(回 Task 1 测试);跨板 → 两基板写重了,改几何。
- L50 单独确认:`node tests/levels-winnable.test.mjs --sample`(含 50)。

- [ ] **Step 6: Commit(原子切换)**

```bash
git add -A games/tower-defender/src/data games/tower-defender/tests
git commit -m "feat(tower-defender): 50关切换至10基板×镜像×将位变体(指纹两两不同+逐关营数承诺,删boardTemplates)"
```

## Task 10: plateau 高台射程加成(建塔/续玩/射程链全打通)

**Files:**
- Create: `tests/plateau.test.mjs`
- Modify: `src/systems/terrainSystem.js`(创建,段1 仅静态助手)、`src/data/balance.js`、`src/entities/tower.js`、`src/systems/economySystem.js`、`src/systems/targetingSystem.js`、`src/systems/combatSystem.js`、`src/systems/combat/attacks.js`、`src/main.js`、`src/ui/towerPanel.js`

- [ ] **Step 1: 写失败测试 `tests/plateau.test.mjs`**

```js
// tests/plateau.test.mjs — 高台:建塔得 rangeBonus / 平地无 / 射程链生效 / 续玩按 slot 重算
// 运行:node games/tower-defender/tests/plateau.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { newGameState } from '../src/core/gameState.js';
import { tryBuild } from '../src/systems/economySystem.js';
import { rangeBonusFor, terrainTypeAt } from '../src/systems/terrainSystem.js';
import { targetingSystem } from '../src/systems/targetingSystem.js';
import { createEnemy } from '../src/entities/enemy.js';
import { GENERALS, towerStats } from '../src/data/generals.js';
import { BAL } from '../src/data/balance.js';

// 找一关带 plateau 且某将位在台上(ch1 必有;按数据动态找,不锚死关号)
const lv = LEVELS.find((l) => l.terrain.some((z) => z.type === 'plateau')
  && l.slots.some((s) => l.terrainAt[s.y][s.x] === 'plateau'));
assert.ok(lv, '存在 plateau 且台上有将位的关(ch1 教学承诺)');
const onSlot = lv.slots.find((s) => lv.terrainAt[s.y][s.x] === 'plateau');
const offSlot = lv.slots.find((s) => lv.terrainAt[s.y][s.x] !== 'plateau');

// 1) 助手:台上 0.5 / 平地 0 / 无 terrainAt 的合成关 0(防御)
assert.equal(rangeBonusFor(lv, onSlot), BAL.PLATEAU_RANGE_BONUS, '台上 bonus');
assert.equal(rangeBonusFor(lv, offSlot), 0, '平地 0');
assert.equal(rangeBonusFor({ }, { x: 0, y: 0 }), 0, '无 terrainAt 防御性 0');
assert.equal(terrainTypeAt(lv, onSlot.x, onSlot.y), 'plateau', 'terrainTypeAt');

// 2) tryBuild 落 rangeBonus
{
  const s = newGameState(lv); s.gold = 99999;
  tryBuild(s, onSlot, 'huang'); tryBuild(s, offSlot, 'zhang');
  assert.equal(s.towers[0].rangeBonus, BAL.PLATEAU_RANGE_BONUS, '建在台上得加成');
  assert.equal(s.towers[1].rangeBonus, 0, '平地无加成');
}

// 3) 射程链:敌在 (基础射程+0.5) 圈边内、基础圈外 → 台上塔锁得到,平地塔锁不到
{
  const s = newGameState(lv); s.gold = 99999; s.phase = 'combat';
  tryBuild(s, onSlot, 'huang');
  const t = s.towers[0];
  const baseR = towerStats(GENERALS.huang, 1).range;
  const e = createEnemy('footman', Object.keys(lv.paths)[0], lv.paths[Object.keys(lv.paths)[0]], 1);
  // 放到台上塔的 (baseR+0.25) 格远处(圈外 0.25,加成后圈内)
  e.px = t.px + (baseR + 0.25) * BAL.CELL; e.py = t.py; e.alive = true;
  s.enemies = [e];
  targetingSystem(s);
  assert.equal(t.target, e, '高台塔凭 +0.5 锁定到基础圈外的敌');
  t.rangeBonus = 0;                       // 摘掉加成 → 锁不到(证明差异来自 bonus)
  targetingSystem(s);
  assert.equal(t.target, null, '无加成锁不到');
}
console.log('ok plateau');
```

- [ ] **Step 2: 跑测试确认失败**(`rangeBonusFor` 不存在)

- [ ] **Step 3: 实现**

(a) `src/data/balance.js` 追加(放 BOSS 段后):

```js
  // —— 板型+地形(spec §6)——
  PLATEAU_RANGE_BONUS: 0.5,   // 高台将位射程 +0.5 格
```

(b) 创建 `src/systems/terrainSystem.js`(段1 仅静态助手;段2 在此加 tick):

```js
// systems/terrainSystem.js — 地形系统(板型+地形 spec §4)。
// 段1:静态助手(plateau 射程加成查询);段2:terrainSystem(state) 每步 tick(浅滩/火谷/落石)。
// 铁律:render-free;查询 O(1) 走 level.terrainAt(boardVariants 加载期烘焙)。
import { BAL } from '../data/balance.js';

// 格地形类型(无 terrainAt 的合成关/测试关 → null,全部行为退化为平地)
export function terrainTypeAt(level, x, y) {
  return (level.terrainAt && level.terrainAt[y] && level.terrainAt[y][x]) || null;
}

// 将位射程加成:高台 +0.5,否则 0。建塔(economySystem)与续玩重建(main.applyResume)共用 → 快照零迁移。
export function rangeBonusFor(level, slot) {
  return terrainTypeAt(level, slot.x, slot.y) === 'plateau' ? BAL.PLATEAU_RANGE_BONUS : 0;
}
```

(c) `src/entities/tower.js` createTower 返回对象追加一行(放 `stunnedUntil` 后):

```js
    rangeBonus: 0,                                  // [地形] 高台射程加成(建塔/续玩时按 slot 落点,见 terrainSystem)
```

(d) `src/systems/economySystem.js`:顶部 `import { rangeBonusFor } from './terrainSystem.js';`,tryBuild 改:

```js
  state.gold -= GENERALS[generalId].cost;
  const t = createTower(generalId, slot);
  t.rangeBonus = rangeBonusFor(state.level, slot);   // [地形] 高台加成落实例(静态字段)
  state.towers.push(t);
  return true;
```

(e) 射程链三处(统一 `+ (tower.rangeBonus || 0)`):

`src/systems/targetingSystem.js:11`:
```js
    const rangePx = (towerStats(g, tower.level).range + (tower.rangeBonus || 0)) * BAL.CELL;
```
`src/systems/combatSystem.js:26`:
```js
    if (dx * dx + dy * dy > ((stats.range + (tower.rangeBonus || 0)) * BAL.CELL) ** 2) continue;
```
`src/systems/combat/attacks.js:31`:
```js
  const rangePx2 = ((stats.range + (tower.rangeBonus || 0)) * CELL) ** 2;
```

(f) `src/main.js` 三处:

顶部 import 追加 `import { rangeBonusFor } from './systems/terrainSystem.js';`

applyResume 塔重建(约 line 94):
```js
  state.towers = (snap.towers || []).map((ts) => {
    const t = createTower(ts.generalId, ts.slot);
    t.level = ts.level; t.mode = ts.mode; t.totalInvested = investedFor(ts.generalId, ts.level);
    t.rangeBonus = rangeBonusFor(state.level, ts.slot);   // [地形] 按 slot 重算(快照零迁移)
    return t;
  });
```

建造预览圈(约 line 153,hover 未占用 slot):
```js
      ctx.arc(slot.x * C + C / 2, slot.y * C + C / 2, (g.range + rangeBonusFor(state.level, slot)) * C, 0, Math.PI * 2);
```

选中塔范围圈(约 line 161):
```js
    const srng = towerStats(sg, selectedTower.level).range + (selectedTower.rangeBonus || 0);
```

(g) `src/ui/towerPanel.js:66` 属性行改(高台标记,孩子可见):

```js
  const rngEff = st.range + (tower.rangeBonus || 0);
  ctx.fillText(`攻击 ${Math.round(st.dmg)}　射程 ${rngEff.toFixed(1)}${tower.rangeBonus ? '⛰' : ''}　攻速 ${(1 / st.interval).toFixed(1)}`, L.x + 12, L.y + 40);
```

(towerPanel 的函数签名若拿不到 tower 变量,按该文件实际入参名对齐——drawTowerPanel(ctx, view, s, tower) 已传塔。)

- [ ] **Step 4: 跑测试 + 全门禁**

```bash
node tests/plateau.test.mjs && bash scripts/test.sh
```
(winnable 会因高台塔更强只松不紧,应全绿。)

- [ ] **Step 5: Commit**

```bash
git add src/data/balance.js src/systems/terrainSystem.js src/entities/tower.js src/systems/economySystem.js src/systems/targetingSystem.js src/systems/combatSystem.js src/systems/combat/attacks.js src/main.js src/ui/towerPanel.js tests/plateau.test.mjs
git commit -m "feat(tower-defender): plateau高台射程+0.5(建塔/续玩/锁敌/出手/范围圈/面板全链路,TDD)"
```

## Task 11: 静态地形渲染(六类型基底层)

**Files:**
- Modify: `src/render/board.js`

渲染层无单测(canvas),由 Task 12 冒烟截图验收。**绘制顺序(spec §5 写死)**:草地 → terrain 基底 → 蜀道 → terrain 特效(段2) → 将位 → 敌营/成都。

- [ ] **Step 1: drawBoard 内、棋盘格草地块之后/蜀道块之前插入调用**

```js
  drawTerrainBase(ctx, state);   // [地形] 基底层:路压河上=渡口浮桥视觉天然成立(spec §5)
```

- [ ] **Step 2: 文件尾追加实现(全程序化,ctx save/restore 包裹;动效读 state.time)**

```js
// —— [板型+地形] terrain 基底(spec §5):river 蓝带波纹 / shallow 亮蓝 / plateau 黄土台描边 /
//     mountain 深岩棱线 / firegully 橙红焦地 / rockfall 碎石警示底。章 faction tint 之上叠加。——
const TERRAIN_FILL = {
  river: '#3d6e9e', shallow: '#5da7c9', plateau: '#c9a85c',
  mountain: '#4a4640', firegully: '#8a3a24', rockfall: '#6e645a',
};

function drawTerrainBase(ctx, state) {
  const zones = state.level.terrain;
  if (!zones || !zones.length) return;
  const t = state.time || 0;
  ctx.save();
  for (const z of zones) {
    ctx.fillStyle = TERRAIN_FILL[z.type] || '#888';
    for (const c of z.cells) ctx.fillRect(c.x * C, c.y * C, C, C);
    if (z.type === 'river' || z.type === 'shallow') {
      // 波纹线:每格两道正弦短横线,相位随 time 流动
      ctx.strokeStyle = z.type === 'river' ? 'rgba(220,235,255,.28)' : 'rgba(255,255,255,.35)';
      ctx.lineWidth = 1.5;
      for (const c of z.cells) {
        const ph = t * 1.2 + (c.x * 7 + c.y * 13) * 0.7;
        const dy = Math.sin(ph) * 2;
        ctx.beginPath();
        ctx.moveTo(c.x * C + 6, c.y * C + C * 0.35 + dy); ctx.lineTo(c.x * C + C - 6, c.y * C + C * 0.35 + dy);
        ctx.moveTo(c.x * C + 9, c.y * C + C * 0.7 - dy); ctx.lineTo(c.x * C + C - 9, c.y * C + C * 0.7 - dy);
        ctx.stroke();
      }
    } else if (z.type === 'plateau') {
      // 黄土台:亮顶边+暗底边的"抬升"描边
      for (const c of z.cells) {
        ctx.strokeStyle = 'rgba(255,235,180,.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(c.x * C + 1, c.y * C + 1); ctx.lineTo(c.x * C + C - 1, c.y * C + 1); ctx.stroke();
        ctx.strokeStyle = 'rgba(70,50,20,.55)';
        ctx.beginPath(); ctx.moveTo(c.x * C + 1, c.y * C + C - 1); ctx.lineTo(c.x * C + C - 1, c.y * C + C - 1); ctx.stroke();
      }
    } else if (z.type === 'mountain') {
      // 岩壁棱线:对角短笔触
      ctx.strokeStyle = 'rgba(160,150,135,.45)'; ctx.lineWidth = 2;
      for (const c of z.cells) {
        ctx.beginPath();
        ctx.moveTo(c.x * C + 5, c.y * C + C - 7); ctx.lineTo(c.x * C + C * 0.45, c.y * C + 6);
        ctx.lineTo(c.x * C + C - 5, c.y * C + C - 7);
        ctx.stroke();
      }
    } else if (z.type === 'firegully') {
      // 焦地裂纹(静态;火苗动效段2)
      ctx.strokeStyle = 'rgba(255,150,60,.4)'; ctx.lineWidth = 1.5;
      for (const c of z.cells) {
        ctx.beginPath();
        ctx.moveTo(c.x * C + 5, c.y * C + C * 0.55); ctx.lineTo(c.x * C + C * 0.5, c.y * C + C * 0.4);
        ctx.lineTo(c.x * C + C - 5, c.y * C + C * 0.6);
        ctx.stroke();
      }
    } else if (z.type === 'rockfall') {
      // 碎石点(警示圈动效段2)
      ctx.fillStyle = 'rgba(40,35,30,.45)';
      for (const c of z.cells) {
        ctx.beginPath(); ctx.arc(c.x * C + C * 0.3, c.y * C + C * 0.62, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(c.x * C + C * 0.66, c.y * C + C * 0.34, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}
```

- [ ] **Step 3: 语法 + 全测试(渲染不破逻辑)**

```bash
node --check src/render/board.js && bash scripts/test.sh
```

- [ ] **Step 4: Commit**

```bash
git add src/render/board.js
git commit -m "feat(tower-defender): 六类地形静态基底渲染(河/滩/台/山/火谷/落石区,程序化零贴图)"
```

## Task 12: 段1 冒烟验收(每章截图 + 全门禁)— 段1 milestone

**Files:**
- Create: `tools/smoke-shots.mjs`

- [ ] **Step 1: 写截图脚本(host 侧 puppeteer-core + 系统 Chrome;参照 boom-worms 模式,见记忆 boom-worms-smoke-test-setup:沙箱挡 localhost,此脚本由执行者在 host bash 跑)**

```js
// tools/smoke-shots.mjs — 每章 1 关进局截图(板型+地形 spec §7 冒烟)。
// 前置:repo 根起 http 服务(python3 -m http.server 8850);puppeteer-core 环境见 boom-worms 记忆。
// 用法:node tools/smoke-shots.mjs(产出 /tmp/td-ch1..5.png + console error 检查)
import puppeteer from 'puppeteer-core';

const URL = 'http://localhost:8850/games/tower-defender/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT_LEVELS = [2, 13, 24, 35, 46];   // 各章 1 关(k=1..5 区间,非样板关 → 看生成关变体)
const errors = [];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--no-proxy-server', '--proxy-bypass-list=*'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle2' });

for (const id of SHOT_LEVELS) {
  await page.evaluate((n) => window.__td.loadLevel(n - 1), id);
  await new Promise((r) => setTimeout(r, 600));   // 等一帧渲染+资源
  const ch = Math.ceil(id / 10);
  await page.screenshot({ path: `/tmp/td-ch${ch}.png` });
  console.log(`shot L${id} → /tmp/td-ch${ch}.png`);
}
await browser.close();
if (errors.length) { console.error('❌ 页面错误:\n' + errors.join('\n')); process.exit(1); }
console.log('ok smoke-shots(5 章截图无 JS 错误)');
```

- [ ] **Step 2: 跑并目检**

```bash
cd /Users/james/Projects/game-hub && python3 -m http.server 8850 &>/dev/null &
# (puppeteer-core 环境按记忆 boom-worms-smoke-test-setup 准备)
node games/tower-defender/tools/smoke-shots.mjs
```

Read 工具逐张看 `/tmp/td-ch1..5.png`,目检清单:① 五章图肉眼明显不同;② ch2/ch3 河上路段呈渡口/浮桥观感(路压河);③ ch4 山壁挤窄路;④ 高台黄土块上有将位框;⑤ 城名牌/建筑不被地形基底遮挡。不达标回 Task 11 调样式或回基板调几何。

- [ ] **Step 3: 变体抽查(同板不同关肉眼不同)**

改 SHOT_LEVELS 为 `[12, 13, 16, 17]`(ch2 前半两关+后半两关)再跑一轮,确认同章 4 关图各不相同(镜像/将位/子集差异肉眼可辨)。

- [ ] **Step 4: 全门禁 + Commit + 汇报 James(段1 验收点)**

```bash
bash scripts/test.sh
git add tools/smoke-shots.mjs
git commit -m "feat(tower-defender): 冒烟截图工具+段1验收(50关图图不同/章主题可辨/高台生效/全门禁绿)"
```

向 James 汇报段1完成,附 5 章截图,等实玩反馈后进段2(不阻塞:段2 可先行开工,验收独立)。

---

# 段2「活地形」

验收点:三动态机制可见可感、winnable 50/50、L50 大雨彩蛋、娃实玩。

## Task 13: terrainSystem tick + shallow 浅滩减速(接线 gameLoop)

**Files:**
- Modify: `src/data/balance.js`、`src/systems/terrainSystem.js`、`src/core/gameState.js`、`src/core/gameLoop.js`
- Create: `tests/terrainSystem.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
// tests/terrainSystem.test.mjs — 浅滩减速/火谷envBurn/落石计时 的确定性(板型+地形 spec §4)
// 运行:node games/tower-defender/tests/terrainSystem.test.mjs
import assert from 'node:assert';
import { BAL } from '../src/data/balance.js';
import { terrainSystem, initTerrainState } from '../src/systems/terrainSystem.js';
import { expandTerrain } from '../src/data/boardVariants.js';
import { createEnemy } from '../src/entities/enemy.js';
import { effectiveSpeed } from '../src/systems/combat/statusEffects.js';

// 合成关:一条直路 y=5,x=0..12;浅滩盖 (4,5)(5,5)
const PATH = [{ x: 0, y: 5 }, { x: 12, y: 5 }];
function makeLevel(terrain) {
  const b = { cols: 24, rows: 14, terrain };
  const ex = expandTerrain(b);
  return { id: 901, scale: 1, cols: 24, rows: 14, paths: { a: PATH }, terrain: ex.terrain, terrainAt: ex.terrainAt };
}
function makeState(level, enemies) {
  return { phase: 'combat', time: 0, level, enemies, gold: 0, terrain: initTerrainState(level) };
}

// —— shallow:区内每帧维持减速(×0.7),出区 0.2s 后自然衰退 ——
{
  const lv = makeLevel([{ type: 'shallow', cells: [{ x: 4, y: 5 }, { x: 5, y: 5 }] }]);
  const e = createEnemy('footman', 'a', PATH, 1);
  e.gx = 4.3; e.gy = 5;                       // 格 (4,5) 内
  const s = makeState(lv, [e]);
  terrainSystem(s);
  assert.ok(Math.abs(effectiveSpeed(e, s.time) - e.speed * (1 - BAL.SHALLOW_SLOW_PCT)) < 1e-9, '区内 ×0.7');
  // 与塔减速取最强不叠加:已有更强减速(0.4)时维持 0.4
  e.statuses.slow = { pct: 0.4, until: 10 };
  terrainSystem(s);
  assert.equal(e.statuses.slow.pct, 0.4, '取最强不叠加');
  // 出区:0.25s 后(> SHALLOW_SLOW_DUR)减速过期
  const e2 = createEnemy('footman', 'a', PATH, 1); e2.gx = 4.3; e2.gy = 5;
  const s2 = makeState(lv, [e2]);
  terrainSystem(s2);
  e2.gx = 8; s2.time += BAL.SHALLOW_SLOW_DUR + 0.05;
  terrainSystem(s2);                          // 出区后 tick 不再刷新
  assert.equal(effectiveSpeed(e2, s2.time), e2.speed, '出区自然衰退');
  // 飞兵不受浅滩影响
  const f = createEnemy('flyer', 'a', PATH, 1); f.gx = 4.3; f.gy = 5;
  const s3 = makeState(lv, [f]);
  terrainSystem(s3);
  assert.equal(effectiveSpeed(f, s3.time), f.speed, '飞兵豁免');
}
console.log('ok terrainSystem');
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现**

(a) `balance.js` 地形段追加:

```js
  SHALLOW_SLOW_PCT: 0.3,      // 浅滩敌速 ×0.7(applySlow 取最强不叠加)
  SHALLOW_SLOW_DUR: 0.2,      // 每帧维持时长(略大于帧间隔,出格自然衰退;spec §4 集成选型)
```

(b) `terrainSystem.js` 追加(段1 助手保留):

```js
import { applySlow } from './combat/statusEffects.js';

// 运行时地形状态(gameState.newGameState 调用;resume 重建即重置——v1 续玩回到波首,语义正确)
export function initTerrainState(level) {
  const disabled = new Set(level.disableTerrain || []);
  const rockfalls = [];
  (level.terrain || []).forEach((z, i) => {
    if (z.type === 'rockfall' && !disabled.has('rockfall')) {
      rockfalls.push({ zoneIdx: i, nextStrikeAt: BAL.ROCKFALL_PERIOD, lastStrikeAt: -9 });
    }
  });
  return { rockfalls, disabled };
}

// 每步 tick(gameLoop 在 pathSystem 之后调;位置最新)。
// rockfall 计时不设相位守卫(prep 也走表,孩子备战时就能看见节奏);效果仅作用于场上敌(combat 才有)。
export function terrainSystem(state) {
  const lvl = state.level;
  if (!lvl.terrain || !lvl.terrain.length || !state.terrain) return;
  const now = state.time;
  // —— rockfall(Task 15 填)——
  if (state.phase !== 'combat') return;
  const disabled = state.terrain.disabled;
  for (const e of state.enemies) {
    if (!e.alive || e.flying) continue;                       // 飞兵不踩地形
    const ty = terrainTypeAt(lvl, Math.round(e.gx), Math.round(e.gy));
    if (ty === 'shallow' && !disabled.has('shallow')) {
      applySlow(e, BAL.SHALLOW_SLOW_PCT, BAL.SHALLOW_SLOW_DUR, now);   // 复用减速通道,取最强不叠加
    }
    // —— firegully(Task 14 填)——
  }
}
```

(c) `gameState.js`:顶部 `import { initTerrainState } from '../systems/terrainSystem.js';`,newGameState 返回对象追加:

```js
    terrain: initTerrainState(level),   // [地形] 运行时状态(落石计时/禁用集;敌身上的状态在敌实例)
```

(d) `gameLoop.js`:import `terrainSystem`,step() 中 `pathSystem(state, dt);` 之后插一行:

```js
  terrainSystem(state);           // [地形] 浅滩减速/火谷灼烧刷新/落石计时(位置已最新;落石击杀在 targeting 前)
```

- [ ] **Step 4: 跑测试 + 全门禁**

```bash
node tests/terrainSystem.test.mjs && bash scripts/test.sh
```
(winnable 含 ch3 浅滩后只松不紧;若有意外红,按报错处理。)

- [ ] **Step 5: Commit**

```bash
git add src/data/balance.js src/systems/terrainSystem.js src/core/gameState.js src/core/gameLoop.js tests/terrainSystem.test.mjs
git commit -m "feat(tower-defender): terrainSystem接线+浅滩减速(每帧维持/取最强/飞兵豁免,TDD)"
```

## Task 14: firegully 火谷灼烧(独立 envBurn 槽 × 火抗)

**Files:**
- Modify: `src/systems/terrainSystem.js`、`src/systems/statusSystem.js`、`src/entities/enemy.js`、`src/data/balance.js`
- Modify: `tests/terrainSystem.test.mjs`

- [ ] **Step 1: 追加失败测试(两行 import 放文件顶部,断言块放 console.log 之前)**

```js
import { statusSystem } from '../src/systems/statusSystem.js';          // ← 文件顶部
import { applyBurn } from '../src/systems/combat/statusEffects.js';    // ← 文件顶部

// —— firegully:独立 envBurn 槽,与塔灼烧栈并行;走火抗(藤甲×1.5,即 enemies.js 的 resist.fire;
//     spec §4 称"藤甲×2 照常"指的是诸葛 L3 招牌技数字,环境灼烧走的是通用火抗通道)——
{
  const lv = makeLevel([{ type: 'firegully', cells: [{ x: 4, y: 5 }] }]);
  const e = createEnemy('footman', 'a', PATH, 1); e.gx = 4.2; e.gy = 5;
  const s = makeState(lv, [e]);
  terrainSystem(s);
  assert.ok(e.envBurn && e.envBurn.dps === BAL.FIREGULLY_DPS && e.envBurn.until === BAL.FIREGULLY_LINGER, '区内刷 envBurn(until=now+1.5)');
  statusSystem(s, 1);
  assert.equal(e.hp, 60 - BAL.FIREGULLY_DPS, 'envBurn 结算扣血');
  // 与塔灼烧并行叠加(不挤 3 层栈)
  applyBurn(e, 8, 5, s.time);
  statusSystem(s, 1);
  assert.equal(e.hp, 60 - BAL.FIREGULLY_DPS * 2 - 8, '塔灼烧+环境灼烧并行');
  assert.equal(e.statuses.burn.length, 1, '塔栈不被环境占用');
  // 藤甲×1.5 火抗
  const tj = createEnemy('tengjia', 'a', PATH, 1); tj.gx = 4.2; tj.gy = 5;
  const s2 = makeState(lv, [tj]);
  terrainSystem(s2); statusSystem(s2, 1);
  assert.ok(Math.abs(tj.hp - (tj.maxHp - BAL.FIREGULLY_DPS * 1.5)) < 1e-9, '藤甲被火克 ×1.5');
  // 出区残留:出区后 1s 仍烧,1.6s 不烧
  const e3 = createEnemy('footman', 'a', PATH, 1); e3.gx = 4.2; e3.gy = 5;
  const s3 = makeState(lv, [e3]);
  terrainSystem(s3);
  e3.gx = 9; s3.time = 1.0; statusSystem(s3, 1);          // until=1.5 > 1.0 仍在烧
  assert.equal(e3.hp, 60 - BAL.FIREGULLY_DPS, '出区 1s 内残留');
  s3.time = 1.6; const hpBefore = e3.hp; statusSystem(s3, 1);
  assert.equal(e3.hp, hpBefore, '1.5s 后熄灭');
  // dps 随 scale:scale=2 的关 dps×2
  const lv2 = { ...lv, scale: 2 };
  const e4 = createEnemy('footman', 'a', PATH, 1); e4.gx = 4.2; e4.gy = 5;
  const s4 = makeState(lv2, [e4]);
  terrainSystem(s4);
  assert.equal(e4.envBurn.dps, BAL.FIREGULLY_DPS * 2, 'dps=6×scale');
}
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现**

(a) `balance.js` 地形段追加:

```js
  FIREGULLY_DPS: 6,           // 火谷灼烧 6×scale/s(独立环境槽,不占塔灼烧 3 层栈)
  FIREGULLY_LINGER: 1.5,      // 出区残留秒数(until = now + LINGER,区内每帧刷新)
```

(b) `terrainSystem.js` tick 内 firegully 分支(shallow 分支后):

```js
    else if (ty === 'firegully' && !disabled.has('firegully')) {
      e.envBurn = { dps: BAL.FIREGULLY_DPS * (lvl.scale || 1), until: now + BAL.FIREGULLY_LINGER };
    }
```

(c) `entities/enemy.js` 工厂 `statuses: {}` 行前追加:

```js
    envBurn: null,                                 // [地形] 火谷环境灼烧 {dps,until}(独立于塔灼烧栈;statusSystem 并行结算)
```

(d) `statusSystem.js` 灼烧求和块(`let burn = 0; for ...` 之后)追加:

```js
    // [地形] 火谷环境灼烧:独立单槽与塔栈并行叠加,走火抗通道(藤甲 resist.fire=1.5 照常被克)
    if (e.envBurn && e.envBurn.until > now) burn += e.envBurn.dps * (e.resist?.fire ?? 1);
```

- [ ] **Step 4: 跑测试 + 全门禁,Commit**

```bash
node tests/terrainSystem.test.mjs && bash scripts/test.sh
git add src/data/balance.js src/systems/terrainSystem.js src/systems/statusSystem.js src/entities/enemy.js tests/terrainSystem.test.mjs
git commit -m "feat(tower-defender): firegully火谷灼烧(独立envBurn槽×火抗,出区残留1.5s,TDD)"
```

## Task 15: rockfall 落石(确定性计时 + 落时格判定 AoE)

**Files:**
- Modify: `src/systems/terrainSystem.js`、`src/data/balance.js`
- Modify: `tests/terrainSystem.test.mjs`

- [ ] **Step 1: 追加失败测试(断言块放 console.log 之前;无需新 import)**

```js
// —— rockfall:6s 周期/1s 前摇(state 可读)/落时按"当时在区内"格判定结算;确定性步进 ——
{
  const lv = makeLevel([{ type: 'rockfall', cells: [{ x: 4, y: 5 }, { x: 5, y: 5 }] }]);
  const inZone = createEnemy('footman', 'a', PATH, 1); inZone.gx = 4.4; inZone.gy = 5;
  const outZone = createEnemy('footman', 'a', PATH, 1); outZone.gx = 9; outZone.gy = 5;
  const s = makeState(lv, [inZone, outZone]);
  // t=5.5:前摇窗口(nextStrikeAt=6,差 0.5<1) → 渲染可读,但未结算
  s.time = 5.5; terrainSystem(s);
  assert.equal(s.terrain.rockfalls[0].nextStrikeAt, BAL.ROCKFALL_PERIOD, '未到点不结算');
  assert.ok(s.terrain.rockfalls[0].nextStrikeAt - s.time <= BAL.ROCKFALL_WARN, '前摇窗口可判定');
  // t=6.01:落石 → 区内敌挨 30×scale,区外无伤;计时推进到 12
  s.time = 6.01; terrainSystem(s);
  assert.equal(inZone.hp, 60 - BAL.ROCKFALL_DMG, '区内被砸 30');
  assert.equal(outZone.hp, 60, '区外无伤');
  assert.equal(s.terrain.rockfalls[0].nextStrikeAt, BAL.ROCKFALL_PERIOD * 2, '周期推进');
  assert.ok(Math.abs(s.terrain.rockfalls[0].lastStrikeAt - 6) < 1e-9, 'lastStrikeAt 记录(渲染落石动画窗口)');
  // 落石可致死(走 killEnemy:掉金)
  inZone.hp = 10; s.time = 12.01; terrainSystem(s);
  assert.equal(inZone.alive, false, '落石致死');
  assert.equal(s.gold, inZone.gold, '致死掉金(killEnemy 通道)');
  // 飞兵不被砸
  const f = createEnemy('flyer', 'a', PATH, 1); f.gx = 4.4; f.gy = 5;
  const s2 = makeState(lv, [f]);
  s2.time = 6.01; terrainSystem(s2);
  assert.equal(f.hp, 70, '飞兵豁免落石');
  // 确定性:同序列两次模拟,计时/伤害逐位一致
  const run = () => {
    const e = createEnemy('footman', 'a', PATH, 1); e.gx = 4.4; e.gy = 5;
    const st = makeState(makeLevel([{ type: 'rockfall', cells: [{ x: 4, y: 5 }] }]), [e]);
    const log = [];
    for (let t = 0; t <= 13; t += 0.5) { st.time = t; terrainSystem(st); log.push(e.hp); }
    return log.join(',');
  };
  assert.equal(run(), run(), '确定性步进');
}
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现**

(a) `balance.js` 地形段追加:

```js
  ROCKFALL_PERIOD: 6,         // 落石周期(秒;每区独立计时,prep 也走表供观察节奏)
  ROCKFALL_WARN: 1,           // 前摇秒数(渲染读 nextStrikeAt-now ≤ WARN 画警示圈)
  ROCKFALL_DMG: 30,           // 落石伤害 30×scale(落石时刻按"当时在区内"格判定;spec §4 语义,无锁定不追击)
```

(b) `terrainSystem.js` tick 内 `// —— rockfall(Task 15 填)——` 处替换为(while 追赶语义:跨周期补结算,确定性不依赖帧率;实际 dt=1/60 不会跨双周期):

```js
  for (const rf of state.terrain.rockfalls) {
    while (now >= rf.nextStrikeAt) {                          // 追赶:落石时刻按"当时在区内"结算(spec §4,无前摇锁定)
      const zone = lvl.terrain[rf.zoneIdx];
      for (const e of state.enemies) {
        if (!e.alive || e.flying) continue;                   // 砸"路面"敌人:飞兵豁免
        if (!zone.cellSet.has(`${Math.round(e.gx)},${Math.round(e.gy)}`)) continue;
        e.hp -= BAL.ROCKFALL_DMG * (lvl.scale || 1);
        e.lastHitAt = now;                                    // 受击闪白(纯表现)
        if (e.hp <= 0) killEnemy(state, e);
      }
      rf.lastStrikeAt = rf.nextStrikeAt;                      // 渲染落石动画窗口
      rf.nextStrikeAt += BAL.ROCKFALL_PERIOD;
    }
  }
```

注意:这段在 `if (state.phase !== 'combat') return;` **之前**(prep 也走表,孩子备战时可观察节奏);文件顶部补 `import { killEnemy } from './combat/kill.js';`。

- [ ] **Step 4: 跑测试 + 全门禁,Commit**

```bash
node tests/terrainSystem.test.mjs && bash scripts/test.sh
git add src/data/balance.js src/systems/terrainSystem.js tests/terrainSystem.test.mjs
git commit -m "feat(tower-defender): rockfall落石(6s周期/1s前摇/落时格判定AoE/killEnemy通道,确定性TDD)"
```

## Task 16: L50 大雨彩蛋(disableTerrain flag)

**Files:**
- Modify: `src/data/campaign.js`(SAMPLES[50])
- Modify: `tests/terrainSystem.test.mjs`、`tests/levels-integrity.test.mjs`

(levels.js 的 disableTerrain 透传已在 Task 9 就位;initTerrainState 的 disabled 集已在 Task 13 就位。)

- [ ] **Step 1: 追加失败测试**

`tests/terrainSystem.test.mjs`:

```js
// —— disableTerrain:火谷失效(L50 大雨;shallow/rockfall 同机制顺带验证)——
{
  const lv = makeLevel([{ type: 'firegully', cells: [{ x: 4, y: 5 }] }]);
  lv.disableTerrain = ['firegully'];
  const e = createEnemy('footman', 'a', PATH, 1); e.gx = 4.2; e.gy = 5;
  const s = makeState(lv, [e]);
  terrainSystem(s); statusSystem(s, 1);
  assert.equal(e.envBurn, null, '禁用后不刷 envBurn');
  assert.equal(e.hp, 60, '大雨火谷不烧');
}
```

`tests/levels-integrity.test.mjs` 末尾(console.log 前)追加:

```js
// [板型+地形] L50 大雨彩蛋:终关火谷失效 flag + 板上确有火谷区(彩蛋有的可灭)
assert.deepEqual(LEVELS[49].disableTerrain, ['firegully'], 'L50 带 disableTerrain');
assert.ok(LEVELS[49].terrain.some((z) => z.type === 'firegully'), 'L50 板上有火谷区');
```

- [ ] **Step 2: 跑测试确认失败**(envBurn 仍被刷 / L50 无 flag)

- [ ] **Step 3: 实现**

`campaign.js` SAMPLES[50] 两处精确改动(其余字段一概不动;templateId/pathSubset 已在 Task 9 切好):

(a) 在 `rampMax: 1.0,` 行后插入一行:

```js
    disableTerrain: ['firegully'],   // [地形] 终关天命大雨:火谷失效(呼应火烧上方谷;渲染雨丝见 board.drawWeather)
```

(b) story 行的 `result` 值替换(spec:故事卡补一句雨文案;hook 已含"天降大雨",result 强化呼应):

```js
    story: { hook: '火烧上方谷,天降大雨救了司马懿!', year: '公元234年', place: '郿县·五丈原', sides: '诸葛亮 vs 司马懿', result: '大雨浇灭谷中烈火,诸葛亮病逝军中,北伐落幕', idiom: '死诸葛吓走活仲达', portrait: 'zhuge' },
```

(terrainSystem 的 disabled 检查 Task 13/14 已实现,此处纯数据。)

- [ ] **Step 4: L50 winnable 单独重验 + 全门禁,Commit**

```bash
node tests/terrainSystem.test.mjs && node tests/levels-winnable.test.mjs --sample && bash scripts/test.sh
git add src/data/campaign.js tests/terrainSystem.test.mjs tests/levels-integrity.test.mjs
git commit -m "feat(tower-defender): L50大雨彩蛋(disableTerrain火谷失效+story雨文案,rampMax1.0重验)"
```

## Task 17: 动效渲染(落石警示/落石/火苗/浅滩波光/雨丝)

**Files:**
- Modify: `src/render/board.js`、`src/main.js`

渲染层无单测;Task 18 冒烟目检。全部 ctx save/restore + `state.time` 驱动,无 Math.random(用格坐标哈希做相位差)。

- [ ] **Step 1: board.js drawBoard 内、蜀道块之后/将位块之前插**

```js
  drawTerrainFx(ctx, state);   // [地形] 特效层:压在路上(落石警示/火苗/浅滩高光;spec §5 顺序)
```

- [ ] **Step 2: 文件尾追加实现**

```js
// —— [板型+地形] terrain 特效层(路之上):落石警示圈/落石/火谷火苗/浅滩波光。time 驱动,零随机。——
function drawTerrainFx(ctx, state) {
  const zones = state.level.terrain;
  if (!zones || !zones.length || !state.terrain) return;
  const t = state.time || 0;
  const disabled = state.terrain.disabled || new Set();
  ctx.save();
  // 火谷火苗(disableTerrain 时不画 = 被雨浇灭,基底仍是焦地)
  for (const z of zones) {
    if (z.type === 'firegully' && !disabled.has('firegully')) {
      for (const c of z.cells) {
        const ph = t * 6 + (c.x * 11 + c.y * 17) * 0.9;
        const h = 5 + Math.sin(ph) * 3;                       // 火苗高度摆动
        const bx = c.x * C + C / 2 + Math.sin(ph * 0.7) * 3;
        const grd = ctx.createLinearGradient(bx, c.y * C + C - 4, bx, c.y * C + C - 4 - h * 2);
        grd.addColorStop(0, 'rgba(255,180,60,.85)'); grd.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(bx - 4, c.y * C + C - 4);
        ctx.quadraticCurveTo(bx, c.y * C + C - 4 - h * 2.2, bx + 4, c.y * C + C - 4);
        ctx.fill();
      }
    } else if (z.type === 'shallow') {
      // 波光高光点(路上敌减速可视暗示)
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (const c of z.cells) {
        const ph = t * 2 + (c.x * 5 + c.y * 3);
        if (Math.sin(ph) > 0.55) ctx.fillRect(c.x * C + C * 0.42, c.y * C + C * 0.45, 4, 2);
      }
    }
  }
  // 落石:前摇警示圈(脉动) + 落石瞬间(落后 0.4s 内画石块+尘圈)
  for (const rf of state.terrain.rockfalls) {
    const zone = state.level.terrain[rf.zoneIdx];
    const toStrike = rf.nextStrikeAt - t;
    if (toStrike > 0 && toStrike <= BAL.ROCKFALL_WARN) {
      const a = 0.25 + 0.35 * Math.abs(Math.sin(t * 10));     // 急促脉动
      ctx.strokeStyle = `rgba(255,80,40,${a.toFixed(3)})`; ctx.lineWidth = 2.5;
      for (const c of zone.cells) {
        ctx.beginPath(); ctx.arc(c.x * C + C / 2, c.y * C + C / 2, C * 0.42, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const sinceStrike = t - rf.lastStrikeAt;
    if (sinceStrike >= 0 && sinceStrike < 0.4) {
      const k = sinceStrike / 0.4;                            // 0→1
      for (const c of zone.cells) {
        const cx = c.x * C + C / 2, cy = c.y * C + C / 2;
        ctx.fillStyle = `rgba(90,80,70,${(1 - k).toFixed(3)})`;   // 石块淡出
        ctx.beginPath(); ctx.arc(cx, cy - (1 - k) * C * 0.8, C * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(180,165,140,${(0.6 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, C * (0.2 + k * 0.45), 0, Math.PI * 2); ctx.stroke();   // 尘圈扩散
      }
    }
  }
  ctx.restore();
}

// —— L50 大雨(disableTerrain 含 firegully 时;实体层之上,main.js 调)——
export function drawWeather(ctx, state) {
  if (!state.terrain || !state.terrain.disabled || !state.terrain.disabled.has('firegully')) return;
  const t = state.time || 0;
  const { cols, rows } = state.level;
  const W = cols * C, H = rows * C;
  ctx.save();
  ctx.strokeStyle = 'rgba(180,200,230,.35)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const seed = i * 7919 % 997;                              // 固定伪随机(零 Math.random)
    const x = ((seed * 13 + t * 260) % (W + 80)) - 40;
    const y = ((seed * 31 + t * 640) % (H + 40)) - 20;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40,60,90,.10)'; ctx.fillRect(0, 0, W, H);   // 雨幕压暗
  ctx.restore();
}
```

- [ ] **Step 3: main.js 接 drawWeather**

import 行 `drawBoard` 处改为 `import { drawBoard, drawWeather } from './render/board.js';`;render() 内 `for (const f of s.fx) drawFx(ctx, f);` 之后插:

```js
  drawWeather(ctx, s);   // [地形] L50 大雨(板坐标系内、实体之上)
```

- [ ] **Step 4: 语法 + 全门禁,Commit**

```bash
node --check src/render/board.js src/main.js && bash scripts/test.sh
git add src/render/board.js src/main.js
git commit -m "feat(tower-defender): 地形动效(落石警示圈+落石尘圈/火谷火苗/浅滩波光/L50雨丝,time驱动零随机)"
```

## Task 18: 全量平衡重校 + 段2 冒烟 + 终验收 — 段2 milestone

**Files:**
- 无新文件(调参可能动 `src/data/baseBoards.js` 地形区)

- [ ] **Step 1: 全 50 关 winnable + balance-report**

```bash
node tests/levels-winnable.test.mjs && node tools/balance-report.mjs > /tmp/td-balance.txt && head -80 /tmp/td-balance.txt
```

地形利好(高台/落石/火谷帮玩家)只会让关变松;winnable 是真模拟自然计入。观察 balance-report 富余度:若某关因地形变得过松(如火谷区把整波烧光),**优先缩该基板地形区格数**(改 baseBoards.js 后重跑 Task 4-8 的门禁),不动 difficulty 公式;L50(rampMax 1.0 + 火谷失效)单独确认在列。

- [ ] **Step 2: 段2 冒烟截图(动效目检)**

```bash
# http 服务同 Task 12;改 SHOT_LEVELS=[24, 35, 46, 50] 取动效关(ch3滩/ch4落石/ch5火谷/L50雨)
node games/tower-defender/tools/smoke-shots.mjs
```

目检:浅滩波光、落石警示圈(等 6s 周期,必要时截 2 张)、火谷火苗、L50 雨丝+火谷熄灭(进 L50 截图看焦地无火苗+雨)。动效不到位回 Task 17 调参数。

- [ ] **Step 3: 五章机制可演示清单(验收标准 §10.3,逐项过)**

浏览器手动/`__td` 钩子逐项确认并截图留档:
1. ch1:点高台将位 → 建造预览圈大于平地圈;建后选中塔范围圈带 ⛰。
2. ch2:敌从渡口过河,渡口集火可见。
3. ch3:敌过浅滩肉眼变慢(波光格上)。
4. ch4:警示圈脉动 → 落石 → 路上敌掉血/闪白。
5. ch5:敌过火谷持续跳灼烧扣血;L50 同板火谷无火苗、雨丝落下。

- [ ] **Step 4: 终门禁 + Commit + 汇报**

```bash
bash scripts/test.sh
git add -A games/tower-defender
git commit -m "feat(tower-defender): 段2活地形验收(三动态机制可演示/winnable50关/L50大雨,平衡重校)"
```

向 James 汇报:附两段验收清单 + 截图,请 James+娃实玩;实玩反馈进检查点B(经济曲线,范围外)。

---

## 验收总表(对照 spec §10)

| # | 标准 | 验证方式 | 任务 |
|---|---|---|---|
| 1 | 50 关指纹两两不同 | tests/fingerprints.test.mjs 自动断言 | T9 |
| 1b | 章主题视觉明显不同 | 冒烟截图人工判 | T12 |
| 2 | 逐关营数=现状;cities/cityAssign 断言体零改动全绿 | fingerprints EXPECT 表 + 存量测试 | T9 |
| 3 | 五章机制各自可演示 | 演示清单逐项 + 截图 | T18 |
| 3b | L50 下雨火谷熄灭 | terrainSystem 测试 + 冒烟 | T16/T18 |
| 4 | 全门禁绿(单测+verify 变体全量+check-imports+winnable 50/50+每章截图) | bash scripts/test.sh + smoke-shots | T12/T18 |

## 风险与回退

- **基板手写迭代超预期**(Task 4-8 最重):每章独立 commit,卡住不影响已 landed 章;门禁是客观判据,不许"先注释掉规则"。
- **winnable 偶发红**:优先调将位套(补槽/换 seed),其次缩地形区,最后才考虑 rampMax 级别的关参——difficulty 公式全局单调,禁止单关魔改。
- **切换炸面太大**(Task 9):该 commit 前所有新件已各自绿,炸点集中在 campaign/levels 两文件;若需回退 `git revert` 单 commit 即回老 6 板(boardTemplates 删除同在此 commit 内,revert 自动恢复)。
