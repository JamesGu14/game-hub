# 成都保卫战·关卡背景特色化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 替换 50 关千篇一律的双色棋盘格——5 章各一套地貌主题(调色盘/拼块/小景/地标/轻动效),同章逐关由 `seed='ground-'+level.id` 种子驱动布置,50 关张张不同;战斗帧性能优于现状。

**Architecture:** 新增纯数据 `chapterThemes.js` + 渲染层 `ground.js`(布点纯函数 computeGroundLayout 可 node 单测 / 进关一次性离屏烘焙 2× 底图 / 帧内轻动效)。board.js 棋盘格块改贴烘焙图+四层路+暗角;`BAL.GROUND_THEMES=false` 一键回滚走旧分支。Spec: `docs/superpowers/specs/2026-06-11-tower-defender-level-backgrounds-design.md`(已含 Kimi review 修订)。

**Tech Stack:** 原生 canvas 2D 矢量绘制(零贴图/零依赖),mulberry32 种子 RNG(core/rng.js),node 裸脚本单测(assert + `console.log('ok xxx')`),门禁 `bash scripts/test.sh`,视觉验收 `SHOT_LEVELS=1,11,21,31,41,50 node tools/smoke-shots.mjs`。

**工作目录:** `games/tower-defender/`(下文相对路径均以此为根;commit 在 repo 根 `/Users/james/Projects/game-hub` 执行)。

**两段交付:** 段1=Task 1-6(地基:数据+布点+烘焙+路精修+暗角+回滚开关,解决"千篇一律"主诉);段2=Task 7-10(点睛:小景 12 种+地标 10 种+轻动效 6 种)。每段末尾有独立验收 Task。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/data/chapterThemes.js` | 新建 | 5 章主题纯数据:grass/jitter/road/patches/decors/landmarks/accent/vignette/colors;themeOf() 越界回退。铁律:render-free、零随机、无 Date/Math.random |
| `src/render/ground.js` | 新建 | ① computeGroundLayout(level) 纯函数布点(禁区→抖动→地标→拼块→小景→动效) ② bakeGround 2× 离屏烘焙(只持当前关 1 张) ③ drawGround/drawVignette/drawGroundAccents ④ PATCH/DECOR/LANDMARK painter 注册表 + LANDMARK_COLORS |
| `src/data/balance.js` | 修改 | 末尾加 `GROUND_THEMES: true` 回滚开关 |
| `src/render/board.js` | 修改 | 棋盘格块(L16-21)→ 开关分支(贴烘焙图/旧格子);路两层→四层(开关分支);地形特效后插 accents+暗角 |
| `src/main.js` | 修改 | enterLevel 内 bake 一次(applyResume 内部走 enterLevel,同口) |
| `tests/chapterThemes.test.mjs` | 新建 | 主题数据完整性 |
| `tests/groundLayout.test.mjs` | 新建 | 全 50 关布点确定性+禁区不变量+数量区间 |

依赖方向:`ground.js → chapterThemes.js / rng.js / balance.js / terrainSystem.js(只用 terrainTypeAt 纯查询)`;`board.js / main.js → ground.js`。computeGroundLayout 及其助手零 canvas/DOM——node 可直接 import 单测;烘焙/绘制函数只在浏览器调用。

---

# 段1 · 地基

### Task 1: chapterThemes.js — 5 章主题纯数据

**Files:**
- Create: `src/data/chapterThemes.js`
- Test: `tests/chapterThemes.test.mjs`

- [ ] **Step 1.1: 写失败测试**

创建 `tests/chapterThemes.test.mjs`:

```js
// tests/chapterThemes.test.mjs — 主题数据完整性:5 章字段全/hex 合法/池非空/themeOf 回退
// 运行:node games/tower-defender/tests/chapterThemes.test.mjs
import assert from 'node:assert';
import { CHAPTER_THEMES, themeOf } from '../src/data/chapterThemes.js';

const HEX = /^#[0-9a-f]{6}$/i;
for (let ch = 1; ch <= 5; ch++) {
  const t = CHAPTER_THEMES[ch];
  assert.ok(t, `章${ch} 存在`);
  assert.ok(typeof t.name === 'string' && t.name.length >= 2, `章${ch} name`);
  assert.equal(t.grass.length, 2, `章${ch} grass×2`);
  t.grass.forEach((c) => assert.match(c, HEX, `章${ch} grass hex`));
  assert.equal(t.jitter.length, 3, `章${ch} jitter×3`);
  t.jitter.forEach((c) => assert.match(c, HEX, `章${ch} jitter hex`));
  for (const k of ['edge', 'outer', 'inner', 'worn']) assert.match(t.road[k], HEX, `章${ch} road.${k}`);
  assert.ok(t.patches.length >= 3, `章${ch} 拼块池≥3`);
  assert.ok(t.decors.length >= 2, `章${ch} 小景池≥2`);
  assert.equal(t.landmarks.length, 2, `章${ch} 地标池=2`);
  assert.ok(typeof t.accent === 'string', `章${ch} accent`);
  assert.ok('accentPatch' in t && (t.accentPatch === null || t.patches.includes(t.accentPatch)), `章${ch} accentPatch 合法`);
  assert.ok(t.vignette.startsWith('rgba('), `章${ch} vignette`);
  assert.ok(Object.keys(t.colors).length >= 6, `章${ch} colors 非空`);
  for (const k in t.colors) assert.match(t.colors[k], HEX, `章${ch} colors.${k}`);
  assert.ok(Array.isArray(t.waterAffinity), `章${ch} waterAffinity 数组`);
}
assert.equal(themeOf(99), CHAPTER_THEMES[1], 'themeOf 越界回退章1');
assert.equal(themeOf(undefined), CHAPTER_THEMES[1], 'themeOf 缺参回退');
assert.equal(themeOf(3), CHAPTER_THEMES[3], 'themeOf 正常');
console.log('ok chapterThemes');
```

- [ ] **Step 1.2: 跑测试确认失败**

Run: `cd /Users/james/Projects/game-hub/games/tower-defender && node tests/chapterThemes.test.mjs`
Expected: FAIL — `Cannot find module .../src/data/chapterThemes.js`

- [ ] **Step 1.3: 实现 chapterThemes.js**

创建 `src/data/chapterThemes.js`(色值全部来自 spec §2,勿改;colors 命名规范=painterId+部位 camelCase、高光 -Hi、描边 -Outline):

```js
// data/chapterThemes.js — [背景spec §2/§4] 5 章地貌主题纯数据。
// 铁律:render-free、零随机、加载期无 Math.random/Date。painter 取色只准经 colors(+ground.js LANDMARK_COLORS)。
export const CHAPTER_THEMES = {
  1: {
    name: '翠野平原',
    grass: ['#4f7a39', '#568740'], jitter: ['#538040', '#4b7536', '#5c8f42'],
    road: { edge: '#5d4626', outer: '#7a5e34', inner: '#b58f54', worn: '#caa66c' },
    patches: ['meadow', 'flowerField', 'grove'],
    decors: ['tuft', 'flower', 'haystack', 'stone'],
    landmarks: ['beacon', 'tent'],
    accent: 'flowerTwinkle', accentPatch: 'flowerField', vignette: 'rgba(15,25,5,.24)', waterAffinity: [],
    colors: {
      meadow: '#44702f', meadowHi: '#538040',
      field: '#5a8a3e', fieldB: '#548339', petal: '#f6f2dc', flowerCore: '#f0c84e', stem: '#6fa04a',
      groveBase: '#3f6a2b', crownA: '#3a652c', crownB: '#477837', crownOutline: '#2a4f1f',
      crownHi: '#5a8f47', trunk: '#6b4e30', trunkOutline: '#4a3520',
      tuft: '#8fbf5e', haystack: '#c9a85c', haystackOutline: '#8f7338',
      stone: '#9a9484', stoneHi: '#b5b0a2', stoneOutline: '#6f6a5c',
    },
  },
  2: {
    name: '官渡河滩',
    grass: ['#6e7c42', '#74834a'], jitter: ['#73824a', '#67753c', '#7b8a52'],
    road: { edge: '#6b5436', outer: '#8a7348', inner: '#b59a64', worn: '#c9ad78' },
    patches: ['sandbar', 'reedCluster', 'dryField'],
    decors: ['stone', 'deadBranch', 'tuft'],
    landmarks: ['watchtower', 'stele'],
    accent: 'reedSway', accentPatch: 'reedCluster', vignette: 'rgba(25,22,8,.22)', waterAffinity: ['sandbar', 'reedCluster'],
    colors: {
      sandbar: '#a89263', sandbarHi: '#b5a071',
      reedBase: '#7d8a4f', reed: '#c9c27a', reedHead: '#b3a45f',
      dryField: '#8a7a4e', furrow: '#6e6038',
      stone: '#9a9484', stoneHi: '#b5b0a2', stoneOutline: '#6f6a5c',
      deadBranch: '#7a6648', tuft: '#a3b35e',
    },
  },
  3: {
    name: '江东水乡',
    grass: ['#41775f', '#488468'], jitter: ['#457e65', '#3c6f58', '#4d8a6f'],
    road: { edge: '#52521f', outer: '#6b6a34', inner: '#a8a154', worn: '#bdb56e' },
    patches: ['bamboo', 'paddy', 'wetland'],
    decors: ['lotus', 'bambooShoot', 'tuft'],
    landmarks: ['pavilion', 'raft'],
    accent: 'bambooSway', accentPatch: 'bamboo', vignette: 'rgba(8,25,18,.22)', waterAffinity: [],
    colors: {
      bambooBase: '#2f5d46', stalk: '#7fc06a',
      paddy: '#6a8f3c', waterLine: '#9ec7c0', sprout: '#cfe8a0',
      wetland: '#3a6653', wetDot: '#9ec7c0',
      lotus: '#4f8f5e', lotusOutline: '#36704a', shoot: '#8fc07a', tuft: '#6fae84',
    },
  },
  4: {
    name: '蜀道松山',
    grass: ['#45663c', '#4b6e41'], jitter: ['#4a6c40', '#406036', '#507546'],
    road: { edge: '#544938', outer: '#75674f', inner: '#a39379', worn: '#b5a78c' },
    patches: ['pineWood', 'rockSlope', 'meadow'],
    decors: ['lonePine', 'rock', 'fern'],
    landmarks: ['stoneTower', 'trestle'],
    accent: 'smokeRise', accentPatch: null, vignette: 'rgba(10,18,10,.26)', waterAffinity: [],
    colors: {
      pineWoodBase: '#2f4e30', pineA: '#1f3d24', pineB: '#24452a', pineOutline: '#3a6038',
      trunk: '#5a4632', trunkOutline: '#3d2f22',
      rockSlope: '#7e7668', rock: '#8d887c', rockOutline: '#5f5a4e',
      meadow: '#557a47', meadowHi: '#618853', fern: '#6f9a55', tuft: '#6f9a55',
    },
  },
  5: {
    name: '夷陵焦土',
    grass: ['#7a7444', '#817b4a'], jitter: ['#7f7948', '#736d3e', '#878150'],
    road: { edge: '#523e2e', outer: '#6e5440', inner: '#9b7d5c', worn: '#b39676' },
    patches: ['mapleWood', 'scorch', 'dryGrass'],
    decors: ['charStump', 'leaf', 'tuft'],
    landmarks: ['brokenFlag', 'burntCamp'],
    accent: 'leafDrift', accentPatch: null, vignette: 'rgba(25,12,5,.26)', waterAffinity: [],
    colors: {
      mapleBase: '#6e4630', crownA: '#a85a38', crownB: '#c06a40', crownC: '#8a4530', crownOutline: '#7a3f28',
      scorch: '#4a4038', ash: '#6e645a', dryGrass: '#98905c', dryGrassHi: '#a59c66',
      charStump: '#3f352c', leaf: '#c06a40', tuft: '#a39a60',
    },
  },
};

// 取章主题(越界/缺参回退章1;render 层唯一入口)
export function themeOf(chapter) {
  return CHAPTER_THEMES[chapter] || CHAPTER_THEMES[1];
}
```

- [ ] **Step 1.4: 跑测试确认通过**

Run: `node tests/chapterThemes.test.mjs`
Expected: `ok chapterThemes`

- [ ] **Step 1.5: Commit**

```bash
cd /Users/james/Projects/game-hub && git add games/tower-defender/src/data/chapterThemes.js games/tower-defender/tests/chapterThemes.test.mjs && git commit -m "feat(tower-defender): 5章地貌主题纯数据chapterThemes.js(调色盘/拼块小景地标池/accent/vignette,spec§2全量hex)+完整性单测"
```

### Task 2: ground.js — 禁区/路径格助手(布点地基)

**Files:**
- Create: `src/render/ground.js`(本 Task 只含助手;后续 Task 续写同文件)
- Test: `tests/groundLayout.test.mjs`(本 Task 只测助手;Task 3 扩)

- [ ] **Step 2.1: 写失败测试**

创建 `tests/groundLayout.test.mjs`:

```js
// tests/groundLayout.test.mjs — 布点:路径格展开/硬软禁区/全50关确定性+禁区不变量+数量区间
// 运行:node games/tower-defender/tests/groundLayout.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { pathCellSet, hardBanSet, softBanSet } from '../src/render/ground.js';

// 1) 路径格:L1 path a 首段 (1,1)→(5,1) 应展开为 5 格;角点只记一次
{
  const lv = LEVELS[0];
  const set = pathCellSet(lv);
  for (let x = 1; x <= 5; x++) assert.ok(set.has(x + ',1'), `L1 路径格 (${x},1)`);
  assert.ok(!set.has('0,0'), 'L1 (0,0) 非路径格');
}

// 2) 硬禁区:含 路径/将位/城堡+名牌行/敌营+名牌格/玩法地形
{
  const lv = LEVELS[0];
  const set = pathCellSet(lv);
  const hard = hardBanSet(lv, set);
  const s0 = lv.slots[0];
  assert.ok(hard.has(s0.x + ',' + s0.y), '将位在硬禁区');
  const { c, r, w, h } = lv.castle;
  assert.ok(hard.has(c + ',' + r), '城堡格');
  assert.ok(hard.has(c + ',' + (r + h)), '城名牌行');
  assert.ok(hard.has(lv.camps[0].c + ',' + (lv.camps[0].r + 1)), '敌营名牌格');
  // L1 是 ch1A,有 plateau (8,6,2,2):
  const pl = lv.terrain.find((z) => z.type === 'plateau');
  assert.ok(pl && hard.has(pl.cells[0].x + ',' + pl.cells[0].y), '玩法地形格');
}

// 3) 软禁区:路径格 8 邻、且不与路径格重合
{
  const lv = LEVELS[0];
  const set = pathCellSet(lv);
  const soft = softBanSet(lv, set);
  assert.ok(soft.size > 0, '软禁区非空');
  for (const k of soft) assert.ok(!set.has(k), '软禁区不含路径格');
  assert.ok(soft.has('1,0') || soft.has('0,1'), '(1,1) 路径格的邻格入软禁区');
}
console.log('ok groundLayout');
```

- [ ] **Step 2.2: 跑测试确认失败**

Run: `node tests/groundLayout.test.mjs`
Expected: FAIL — `Cannot find module .../src/render/ground.js`

- [ ] **Step 2.3: 实现助手**

创建 `src/render/ground.js`:

```js
// render/ground.js — [背景spec] 章节化地表:布点纯函数 + 离屏烘焙 + 轻动效。
// 布点零 canvas/DOM(node 可单测);seed='ground-'+level.id 走 makeRng,零 Math.random。
// 烘焙只持当前关 1 张(≈7MB,防 50 关全缓存 OOM);BAL.GROUND_THEMES=false 时本模块不被触达。
import { BAL } from '../data/balance.js';
import { makeRng } from '../core/rng.js';
import { themeOf } from '../data/chapterThemes.js';
import { terrainTypeAt } from '../systems/terrainSystem.js';

const C = BAL.CELL;
const key = (x, y) => x + ',' + y;

// —— 布点助手(spec §5.1):路径格展开 / 硬禁区 / 软禁区(沿路 8 邻 1 格) ——
export function pathCellSet(level) {
  const set = new Set();
  for (const id in level.paths) {
    const wp = level.paths[id];
    for (let i = 1; i < wp.length; i++) {
      const a = wp[i - 1], b = wp[i];
      const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
      let x = a.x, y = a.y;
      set.add(key(x, y));
      while (x !== b.x || y !== b.y) { x += dx; y += dy; set.add(key(x, y)); }
    }
  }
  return set;
}

export function hardBanSet(level, pathSet) {
  const ban = new Set(pathSet);
  for (const s of level.slots) ban.add(key(s.x, s.y));
  const { c, r, w, h } = level.castle;
  for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) ban.add(key(x, y));
  for (let x = c; x < c + w; x++) ban.add(key(x, r + h));                  // 城名牌行(spec §5.1)
  for (const cp of level.camps) { ban.add(key(cp.c, cp.r)); ban.add(key(cp.c, cp.r + 1)); }  // 营 + 名牌格
  for (let y = 0; y < level.rows; y++) for (let x = 0; x < level.cols; x++) {
    if (terrainTypeAt(level, x, y)) ban.add(key(x, y));                    // 玩法地形:复用 terrainAt,不造第二套索引
  }
  return ban;
}

export function softBanSet(level, pathSet) {
  const soft = new Set();
  for (const k of pathSet) {
    const [x, y] = k.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k2 = key(x + dx, y + dy);
      if (!pathSet.has(k2)) soft.add(k2);
    }
  }
  return soft;
}
```

- [ ] **Step 2.4: 跑测试确认通过**

Run: `node tests/groundLayout.test.mjs`
Expected: `ok groundLayout`

- [ ] **Step 2.5: Commit**

```bash
cd /Users/james/Projects/game-hub && git add games/tower-defender/src/render/ground.js games/tower-defender/tests/groundLayout.test.mjs && git commit -m "feat(tower-defender): ground.js布点助手(路径格展开/硬禁区含名牌行与玩法地形/软禁区8邻)+单测"
```

### Task 3: computeGroundLayout — 种子化布点全算法

**Files:**
- Modify: `src/render/ground.js`(追加到文件末尾)
- Modify: `tests/groundLayout.test.mjs`(追加用例)

- [ ] **Step 3.1: 追加失败测试**

在 `tests/groundLayout.test.mjs` 的 `console.log('ok groundLayout');` 之前插入(并把 import 行改为 `import { pathCellSet, hardBanSet, softBanSet, computeGroundLayout } from '../src/render/ground.js';`,同时在顶部 import 区加 `import { CHAPTER_THEMES } from '../src/data/chapterThemes.js';`):

```js
// 4) 全 50 关:确定性 + 禁区不变量 + 数量区间 + 地标合法(spec §9)
{
  let hit = 0;   // 达到数量下限(拼块≥2/小景≥10/动效≥2/有地标)的关数
  for (const lv of LEVELS) {
    const a = computeGroundLayout(lv);
    const b = computeGroundLayout(lv);
    assert.deepStrictEqual(a, b, `L${lv.id} 确定性(同种子同布置)`);
    const pathSet = pathCellSet(lv);
    const hard = hardBanSet(lv, pathSet);
    for (const j of a.jitterCells) assert.ok(!hard.has(j.x + ',' + j.y), `L${lv.id} 抖动格出硬禁区`);
    for (const d of a.decors) assert.ok(!hard.has(d.x + ',' + d.y), `L${lv.id} 小景出硬禁区`);
    for (const p of a.patches) for (const lb of p.lobes) {
      for (let Y = Math.floor(p.cy + lb.dy - lb.ry); Y <= Math.ceil(p.cy + lb.dy + lb.ry) - 1; Y++)
        for (let X = Math.floor(p.cx + lb.dx - lb.rx); X <= Math.ceil(p.cx + lb.dx + lb.rx) - 1; X++)
          assert.ok(!hard.has(X + ',' + Y), `L${lv.id} 拼块瓣出硬禁区`);
    }
    if (a.landmark) {
      assert.ok(CHAPTER_THEMES[lv.chapter].landmarks.includes(a.landmark.kind), `L${lv.id} 地标在章池内`);
      for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++)
        assert.ok(!hard.has((a.landmark.x + dx) + ',' + (a.landmark.y + dy)), `L${lv.id} 地标2×2出硬禁区`);
    }
    assert.ok(a.patches.length <= 4, `L${lv.id} 拼块≤4`);
    assert.ok(a.decors.length <= 16, `L${lv.id} 小景≤16`);
    assert.ok(a.accents.length <= 3, `L${lv.id} 动效≤3`);
    for (const ac of a.accents) assert.ok(typeof ac.phase === 'number' && ac.kind, `L${lv.id} accent 形状`);
    if (a.patches.length >= 2 && a.decors.length >= 10 && a.accents.length >= 2 && a.landmark) hit++;
  }
  assert.ok(hit >= 45, `≥90% 关达到数量下限(实际 ${hit}/50)`);
}

// 5) 第2章亲水加权机制活着:全章10关里至少 1 个 沙洲/芦苇 拼块锚点 8 邻邻水
{
  const { terrainTypeAt } = await import('../src/systems/terrainSystem.js');
  let waterside = 0;
  for (const lv of LEVELS.filter((l) => l.chapter === 2)) {
    for (const p of computeGroundLayout(lv).patches) {
      if (p.kind !== 'sandbar' && p.kind !== 'reedCluster') continue;
      const ax = Math.round(p.cx - 1), ay = Math.round(p.cy - 1);   // 锚格 = 2×2 块左上
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const t = terrainTypeAt(lv, ax + dx, ay + dy);
        if (t === 'river' || t === 'shallow') waterside++;
      }
    }
  }
  assert.ok(waterside >= 1, `ch2 亲水加权生效(邻水命中 ${waterside})`);
}
```

- [ ] **Step 3.2: 跑测试确认失败**

Run: `node tests/groundLayout.test.mjs`
Expected: FAIL — `computeGroundLayout is not a function`(SyntaxError: does not provide an export)

- [ ] **Step 3.3: 实现 computeGroundLayout**

追加到 `src/render/ground.js` 末尾:

```js
// —— 布点主算法(spec §5):顺序 禁区→抖动→地标→拼块→小景→动效;先布者抢位(占用集) ——
// 输出全部格坐标制(cell 单位,可含小数);像素换算只在绘制侧 ×C。纯函数,node 可单测。
export function computeGroundLayout(level) {
  const theme = themeOf(level.chapter);
  const rng = makeRng('ground-' + level.id);
  const pathSet = pathCellSet(level);
  const hard = hardBanSet(level, pathSet);
  const soft = softBanSet(level, pathSet);
  const occupied = new Set();
  const free = [], strictFree = [];
  for (let y = 0; y < level.rows; y++) for (let x = 0; x < level.cols; x++) {
    const k = key(x, y);
    if (hard.has(k)) continue;
    free.push({ x, y });
    if (!soft.has(k)) strictFree.push({ x, y });
  }
  // ① 色抖动:自由格 12-18% 种子抽样
  const jitterCells = [];
  const rate = 0.12 + rng() * 0.06;
  for (const c0 of free) {
    if (rng() < rate) jitterCells.push({ x: c0.x, y: c0.y, colorIdx: Math.floor(rng() * theme.jitter.length) });
  }
  // ② 地标最先落(候选约束最严,优先抢位;spec §5.0)
  const landmark = placeLandmark(level, theme, rng, hard, soft, occupied, pathSet);
  // ③ 拼块 2-4
  const patches = placePatches(level, theme, rng, hard, occupied, strictFree);
  // ④ 小景 10-16
  const decors = placeDecors(theme, rng, occupied, free);
  // ⑤ 轻动效 2-3(从实际布上的可动项挑;不足减量,0 合法)
  const accents = pickAccents(theme, rng, patches, decors, landmark);
  return { jitterCells, patches, decors, landmark, accents };
}

// 2×2 块自由:界内、非硬禁区、非占用;checkSoft=true 时还须非软禁区
function blockFree(x, y, level, hard, soft, occupied, checkSoft) {
  for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
    const X = x + dx, Y = y + dy;
    if (X < 0 || Y < 0 || X >= level.cols || Y >= level.rows) return false;
    const k = key(X, Y);
    if (hard.has(k) || occupied.has(k) || (checkSoft && soft.has(k))) return false;
  }
  return true;
}

// 地标:种子选型 → 全盘扫描候选(硬+软禁区外/距城堡切比雪夫>4/2×2自由),取离路最远者(严格>,平手保行序首个)
function placeLandmark(level, theme, rng, hard, soft, occupied, pathSet) {
  const kind = theme.landmarks[Math.floor(rng() * theme.landmarks.length)];
  const ccx = level.castle.c + level.castle.w / 2, ccy = level.castle.r + level.castle.h / 2;
  const pathCells = [...pathSet].map((k) => k.split(',').map(Number));
  let best = null, bestD = -1;
  for (let y = 0; y < level.rows - 1; y++) for (let x = 0; x < level.cols - 1; x++) {
    if (Math.max(Math.abs(x + 0.5 - ccx), Math.abs(y + 0.5 - ccy)) <= 4) continue;
    if (!blockFree(x, y, level, hard, soft, occupied, true)) continue;
    let d = Infinity;
    for (const [px, py] of pathCells) {
      const dd = Math.max(Math.abs(px - x), Math.abs(py - y));
      if (dd < d) d = dd;
    }
    if (d > bestD) { bestD = d; best = { kind, x, y }; }
  }
  if (best) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) occupied.add(key(best.x + dx, best.y + dy));
  return best;   // null = 该关无地标(合法,spec §5.5)
}

// 瓣外接矩形覆盖的格(cell 坐标制)
function lobeCells(cx, cy, rx, ry) {
  const cells = [];
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry) - 1; y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx) - 1; x++) cells.push([x, y]);
  return cells;
}

// 拼块:锚点(硬+软+占用之外,2×2 自由,重试≤20)→ 2-3 椭圆瓣;瓣触硬禁区/占用 → 半径×0.7 重试≤3 → 放弃瓣。
// ch2 亲水(spec §5.6):waterAffinity 拼块的锚点池里,8 邻邻水候选重复入池 3 次(=权重×3,纯种子抽样)。
function placePatches(level, theme, rng, hard, occupied, strictFree) {
  const patches = [];
  const want = 2 + Math.floor(rng() * 3);                                  // 2-4
  for (let p = 0; p < want; p++) {
    // 首块强制 accentPatch(若有):保证该章可动拼块必在,动效数量下限有保障(spec §5.7 工程落地)
    const kind = (p === 0 && theme.accentPatch) ? theme.accentPatch : theme.patches[Math.floor(rng() * theme.patches.length)];
    let pool = strictFree;
    if (theme.waterAffinity.includes(kind)) {
      pool = [];
      for (const c0 of strictFree) {
        pool.push(c0);
        let waterside = false;
        for (let dy = -1; dy <= 1 && !waterside; dy++) for (let dx = -1; dx <= 1; dx++) {
          const t = terrainTypeAt(level, c0.x + dx, c0.y + dy);
          if (t === 'river' || t === 'shallow') { waterside = true; break; }
        }
        if (waterside) pool.push(c0, c0);
      }
    }
    if (!pool.length) continue;
    let anchor = null;
    for (let tr = 0; tr < 20 && !anchor; tr++) {                           // 选位重试 ≤20(spec §5.3)
      const c0 = pool[Math.floor(rng() * pool.length)];
      if (blockFree(c0.x, c0.y, level, hard, null, occupied, false)) anchor = c0;
    }
    if (!anchor) continue;
    const cx = anchor.x + 1, cy = anchor.y + 1;                            // 2×2 块中心
    const lobes = [];
    const nLobes = 2 + (rng() < 0.5 ? 0 : 1);                              // 2-3 瓣
    for (let i = 0; i < nLobes; i++) {
      const dx = rng() * 1.6 - 0.8, dy = rng() * 1.6 - 0.8;
      let rx = 1.2 + rng() * 1.3;
      for (let s = 0; s <= 3; s++) {
        const ry = rx * (i % 2 ? 0.85 : 0.6);                              // 交替扁圆(确定性,不耗 rng)
        const bad = lobeCells(cx + dx, cy + dy, rx, ry).some(([X, Y]) =>
          X < 0 || Y < 0 || X >= level.cols || Y >= level.rows || hard.has(key(X, Y)) || occupied.has(key(X, Y)));
        if (!bad) { lobes.push({ dx, dy, rx, ry }); break; }
        rx *= 0.7;                                                          // 触禁 → 收缩重试(spec §5.3)
      }
    }
    if (!lobes.length) continue;
    patches.push({ kind, cx, cy, lobes });
    for (const lb of lobes) for (const [X, Y] of lobeCells(cx + lb.dx, cy + lb.dy, lb.rx, lb.ry)) {
      if (X >= 0 && Y >= 0 && X < level.cols && Y < level.rows) occupied.add(key(X, Y));   // 拼块内部=占用(散布小景避开)
    }
  }
  return patches;
}

// 小景:章池种子抽,自由格(软禁区可入)、非占用,每格≤1,重试≤20/个
function placeDecors(theme, rng, occupied, free) {
  const decors = [];
  const want = 10 + Math.floor(rng() * 7);                                 // 10-16
  for (let i = 0; i < want; i++) {
    const kind = theme.decors[Math.floor(rng() * theme.decors.length)];
    for (let tr = 0; tr < 20; tr++) {
      const c0 = free[Math.floor(rng() * free.length)];
      const k = key(c0.x, c0.y);
      if (occupied.has(k)) continue;
      decors.push({ kind, x: c0.x, y: c0.y, variant: Math.floor(rng() * 3) });
      occupied.add(k);
      break;
    }
  }
  return decors;
}

// 轻动效:候选=实际布上的可动项(spec §5.7);ch4 狼烟仅石塔,无则退蕨丛;无放回抽 2-3 个
function pickAccents(theme, rng, patches, decors, landmark) {
  const cands = [];
  if (theme.accent === 'flowerTwinkle') {
    for (const p of patches) if (p.kind === 'flowerField') for (const lb of p.lobes) cands.push({ kind: 'flowerTwinkle', x: p.cx + lb.dx, y: p.cy + lb.dy });
    for (const d of decors) if (d.kind === 'flower') cands.push({ kind: 'flowerTwinkle', x: d.x + 0.5, y: d.y + 0.5 });
  } else if (theme.accent === 'reedSway') {
    for (const p of patches) if (p.kind === 'reedCluster') for (const lb of p.lobes) cands.push({ kind: 'reedSway', x: p.cx + lb.dx, y: p.cy + lb.dy });
  } else if (theme.accent === 'bambooSway') {
    for (const p of patches) if (p.kind === 'bamboo') for (const lb of p.lobes) cands.push({ kind: 'bambooSway', x: p.cx + lb.dx, y: p.cy + lb.dy });
  } else if (theme.accent === 'smokeRise') {
    if (landmark && landmark.kind === 'stoneTower') cands.push({ kind: 'smokeRise', x: landmark.x + 1, y: landmark.y + 1 });
    else for (const d of decors) if (d.kind === 'fern') cands.push({ kind: 'fernSway', x: d.x + 0.5, y: d.y + 0.5 });   // 狼烟降级(spec §7)
  } else if (theme.accent === 'leafDrift') {
    for (const d of decors) if (d.kind === 'leaf') cands.push({ kind: 'leafDrift', x: d.x + 0.5, y: d.y + 0.5 });
  }
  const want = Math.min(2 + Math.floor(rng() * 2), cands.length);          // 2-3,不足减量,0 合法
  const accents = [];
  for (let i = 0; i < want; i++) {
    const idx = Math.floor(rng() * cands.length);
    accents.push({ ...cands.splice(idx, 1)[0], phase: rng() * Math.PI * 2 });
  }
  return accents;
}
```

- [ ] **Step 3.4: 跑测试确认通过**

Run: `node tests/groundLayout.test.mjs`
Expected: `ok groundLayout`(全 50 关确定性/不变量/区间全过;若 `≥90% 关达到数量下限` 失败,排查方向=硬禁区是否把自由格吃光,而非放宽断言)

- [ ] **Step 3.5: Commit**

```bash
cd /Users/james/Projects/game-hub && git add games/tower-defender/src/render/ground.js games/tower-defender/tests/groundLayout.test.mjs && git commit -m "feat(tower-defender): computeGroundLayout种子化布点(抖动/地标先落/拼块硬软禁区+收缩重试/小景/动效候选)+全50关确定性与不变量单测"
```

### Task 4: 烘焙管线 + 12 种拼块 painter + 元素小件库

**Files:**
- Modify: `src/render/ground.js`(追加到文件末尾)

无新单测(烘焙需 DOM,归 smoke 验收);门禁=语法检查+既有单测不破。注意:`document`/`performance` 只准出现在函数体内,模块顶层零 DOM——否则 node 单测 import 即炸。

- [ ] **Step 4.1: 追加元素小件库(拼块/小景/动效三方共用)**

追加到 `src/render/ground.js` 末尾:

```js
// —— 元素小件(拼块 painter 与段2小景/动效共用;描边+投影规格与建筑同族,spec 精修②) ——
const SHADOW = 'rgba(0,0,0,.18)';
function ellipseFill(ctx, x, y, rx, ry, fill, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = fill;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
function shadowAt(ctx, x, y, rx) { ellipseFill(ctx, x, y, rx, rx * 0.32, SHADOW); }
// 软边椭圆:优先 ctx.filter(只在烘焙用);不支持(旧 iPad Safari<17.4)→ 同心三层退化(spec §3)
function softEllipse(ctx, x, y, rx, ry, fill, blurOk) {
  if (blurOk) {
    ctx.filter = 'blur(3px)';
    ellipseFill(ctx, x, y, rx, ry, fill, 0.9);
    ctx.filter = 'none';
  } else {
    ellipseFill(ctx, x, y, rx * 1.15, ry * 1.15, fill, 0.25);
    ellipseFill(ctx, x, y, rx * 1.07, ry * 1.07, fill, 0.35);
    ellipseFill(ctx, x, y, rx, ry, fill, 0.85);
  }
}
function softLobes(ctx, p, fills, blurOk) {   // fills:单色 [c] 或按瓣交替 [c1,c2]
  p.lobes.forEach((lb, i) =>
    softEllipse(ctx, (p.cx + lb.dx) * C, (p.cy + lb.dy) * C, lb.rx * C, lb.ry * C, fills[i % fills.length], blurOk));
}
// 瓣内确定性散点 k 个:角度黄金角递进+半径分层(零 rng → 烘焙可复现;像素坐标)
function lobeSpots(p, lb, k) {
  const spots = [];
  for (let i = 0; i < k; i++) {
    const ang = i * 2.4 + p.cx * 0.7 + p.cy * 1.3;
    const rad = 0.25 + 0.55 * ((i % 3) / 2);
    spots.push({ x: (p.cx + lb.dx + Math.cos(ang) * lb.rx * rad) * C, y: (p.cy + lb.dy + Math.sin(ang) * lb.ry * rad) * C });
  }
  return spots;
}
function flowerAt(ctx, x, y, col) {
  ctx.strokeStyle = col.stem; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y); ctx.stroke();
  ctx.fillStyle = col.petal;
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = col.flowerCore; ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
}
function crownAt(ctx, x, y, r, fill, outline) {
  ctx.fillStyle = fill; ctx.strokeStyle = outline; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
function treeAt(ctx, x, y, r, crownFill, col) {        // 圆冠树(grove/孤树)
  shadowAt(ctx, x, y + r * 1.5, r * 1.3);
  ctx.fillStyle = col.trunk; ctx.strokeStyle = col.trunkOutline; ctx.lineWidth = 1;
  ctx.fillRect(x - 2, y + r * 0.5, 4, r * 0.9); ctx.strokeRect(x - 2, y + r * 0.5, 4, r * 0.9);
  crownAt(ctx, x, y, r, crownFill, col.crownOutline);
  ellipseFill(ctx, x - r * 0.3, y - r * 0.4, r * 0.4, r * 0.32, col.crownHi, 0.85);
}
function pineAt(ctx, x, y, h, fill, col) {             // 松(三角冠)
  shadowAt(ctx, x, y + h * 0.55, h * 0.45);
  ctx.fillStyle = col.trunk; ctx.fillRect(x - 1.5, y + h * 0.35, 3, h * 0.2);
  ctx.fillStyle = fill; ctx.strokeStyle = col.pineOutline; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - h * 0.32, y + h * 0.4); ctx.lineTo(x + h * 0.32, y + h * 0.4); ctx.lineTo(x, y - h * 0.5); ctx.closePath();
  ctx.fill(); ctx.stroke();
}
function rockAt(ctx, x, y, r, col) {                   // 岩块(三角面)
  shadowAt(ctx, x, y + r * 0.5, r);
  ctx.fillStyle = col.rock; ctx.strokeStyle = col.rockOutline; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - r, y + r * 0.5); ctx.lineTo(x - r * 0.2, y - r * 0.7); ctx.lineTo(x + r * 0.9, y + r * 0.5); ctx.closePath();
  ctx.fill(); ctx.stroke();
}
function reedAt(ctx, x, y, col, sway) {                // 芦苇(sway=苇顶 x 偏移;烘焙传 0,动效传 sin)
  ctx.strokeStyle = col.reed; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sway, y - 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x - 5 + sway, y - 8, x - 8 + sway, y - 12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.quadraticCurveTo(x + 5 + sway, y - 8, x + 8 + sway, y - 12); ctx.stroke();
  ctx.fillStyle = col.reedHead;
  ctx.beginPath(); ctx.ellipse(x + sway, y - 16, 1.5, 4, 0, 0, Math.PI * 2); ctx.fill();
}
```

- [ ] **Step 4.2: 追加 12 种拼块 painter**

继续追加:

```js
// —— 拼块 painter 注册表(spec §2/§4):签名 (ctx, patch, theme.colors, blurOk);取色只准经 colors ——
const PATCH_PAINTERS = {
  meadow(ctx, p, col, blurOk) {                        // ch1/ch4 共用(各章 colors.meadow 不同)
    softLobes(ctx, p, [col.meadow], blurOk);
    const lb = p.lobes[0];
    softEllipse(ctx, (p.cx + lb.dx - lb.rx * 0.25) * C, (p.cy + lb.dy - lb.ry * 0.3) * C, lb.rx * 0.5 * C, lb.ry * 0.45 * C, col.meadowHi, blurOk);
  },
  flowerField(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.field, col.fieldB], blurOk);
    for (const lb of p.lobes) for (const s of lobeSpots(p, lb, 4)) flowerAt(ctx, s.x, s.y, col);
  },
  grove(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.groveBase], blurOk);
    for (const lb of p.lobes) {
      const s = lobeSpots(p, lb, 2);
      treeAt(ctx, s[0].x, s[0].y, C * 0.30, col.crownA, col);
      treeAt(ctx, s[1].x, s[1].y, C * 0.24, col.crownB, col);
    }
  },
  sandbar(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.sandbar], blurOk);
    const lb = p.lobes[0];
    softEllipse(ctx, (p.cx + lb.dx) * C, (p.cy + lb.dy - lb.ry * 0.3) * C, lb.rx * 0.6 * C, lb.ry * 0.4 * C, col.sandbarHi, blurOk);
  },
  reedCluster(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.reedBase], blurOk);
    for (const lb of p.lobes) for (const s of lobeSpots(p, lb, 3)) reedAt(ctx, s.x, s.y, col, 0);
  },
  dryField(ctx, p, col) {                              // 旱田:瓣外接盒转圆角矩形+横垄
    for (const lb of p.lobes) {
      const x = (p.cx + lb.dx - lb.rx) * C, y = (p.cy + lb.dy - lb.ry) * C, w = lb.rx * 2 * C, h = lb.ry * 2 * C;
      ctx.fillStyle = col.dryField;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
      ctx.strokeStyle = col.furrow; ctx.lineWidth = 2;
      for (let fy = y + 6; fy < y + h - 3; fy += 7) { ctx.beginPath(); ctx.moveTo(x + 5, fy); ctx.lineTo(x + w - 5, fy); ctx.stroke(); }
    }
  },
  bamboo(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.bambooBase], blurOk);
    ctx.strokeStyle = col.stalk; ctx.lineCap = 'round';
    for (const lb of p.lobes) for (const s of lobeSpots(p, lb, 4)) {
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(s.x, s.y + C * 0.4); ctx.lineTo(s.x, s.y - C * 0.45); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x, s.y - C * 0.3); ctx.lineTo(s.x + 6, s.y - C * 0.42); ctx.stroke();
    }
  },
  paddy(ctx, p, col) {                                 // 稻田:圆角矩形+水线+苗点
    for (const lb of p.lobes) {
      const x = (p.cx + lb.dx - lb.rx) * C, y = (p.cy + lb.dy - lb.ry) * C, w = lb.rx * 2 * C, h = lb.ry * 2 * C;
      ctx.fillStyle = col.paddy;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
      ctx.strokeStyle = col.waterLine; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
      for (let fy = y + 8; fy < y + h - 4; fy += 10) { ctx.beginPath(); ctx.moveTo(x + 5, fy); ctx.lineTo(x + w - 5, fy); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.fillStyle = col.sprout;
      for (const s of lobeSpots(p, lb, 4)) { ctx.beginPath(); ctx.arc(s.x, s.y, 1.4, 0, Math.PI * 2); ctx.fill(); }
    }
  },
  wetland(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.wetland], blurOk);
    ctx.fillStyle = col.wetDot; ctx.globalAlpha = 0.7;
    for (const lb of p.lobes) for (const s of lobeSpots(p, lb, 3)) { ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  },
  pineWood(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.pineWoodBase], blurOk);
    for (const lb of p.lobes) {
      const s = lobeSpots(p, lb, 2);
      pineAt(ctx, s[0].x, s[0].y, C * 0.55, col.pineA, col);
      pineAt(ctx, s[1].x, s[1].y, C * 0.42, col.pineB, col);
    }
  },
  rockSlope(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.rockSlope], blurOk);
    for (const lb of p.lobes) {
      const s = lobeSpots(p, lb, 2);
      rockAt(ctx, s[0].x, s[0].y, C * 0.3, col);
      rockAt(ctx, s[1].x, s[1].y, C * 0.22, col);
    }
  },
  mapleWood(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.mapleBase], blurOk);
    for (const lb of p.lobes) {
      const s = lobeSpots(p, lb, 3);
      crownAt(ctx, s[0].x, s[0].y, C * 0.28, col.crownA, col.crownOutline);
      crownAt(ctx, s[1].x, s[1].y, C * 0.33, col.crownB, col.crownOutline);
      crownAt(ctx, s[2].x, s[2].y, C * 0.24, col.crownC, col.crownOutline);
    }
  },
  scorch(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.scorch], blurOk);
    ctx.fillStyle = col.ash;
    for (const lb of p.lobes) for (const s of lobeSpots(p, lb, 4)) { ctx.beginPath(); ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2); ctx.fill(); }
  },
  dryGrass(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.dryGrass], blurOk);
    const lb = p.lobes[0];
    softEllipse(ctx, (p.cx + lb.dx) * C, (p.cy + lb.dy - lb.ry * 0.25) * C, lb.rx * 0.55 * C, lb.ry * 0.4 * C, col.dryGrassHi, blurOk);
  },
};
```

- [ ] **Step 4.3: 追加烘焙与绘制入口**

继续追加:

```js
// —— 烘焙(spec §3):2× 板像素一次性离屏;只持当前关 1 张(防 50 关全缓存 OOM) ——
let cache = { id: -1, canvas: null, layout: null, vignette: null };

export function bakeGround(level) {
  if (cache.id === level.id && cache.canvas) return cache;
  const t0 = performance.now();
  const layout = computeGroundLayout(level);
  const theme = themeOf(level.chapter);
  const cv = document.createElement('canvas');
  cv.width = level.cols * C * 2; cv.height = level.rows * C * 2;
  const ctx = cv.getContext('2d');
  ctx.scale(2, 2);
  ctx.filter = 'blur(1px)';                            // 软边能力检测(spec §3 兼容退化)
  const blurOk = ctx.filter === 'blur(1px)';
  ctx.filter = 'none';
  paintBase(ctx, level, theme, layout);
  for (const p of layout.patches) {
    const painter = PATCH_PAINTERS[p.kind];
    if (painter) painter(ctx, p, theme.colors, blurOk);
  }
  cache = { id: level.id, canvas: cv, layout, vignette: null };
  const ms = performance.now() - t0;
  if (ms > 30) console.warn(`[ground] bake L${level.id} ${ms.toFixed(1)}ms > 30ms 预算`);
  return cache;
}

function paintBase(ctx, level, theme, layout) {        // 弱格子 + 种子色抖动
  const [gA, gB] = theme.grass;
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) {
    ctx.fillStyle = ((r + c) & 1) ? gA : gB;
    ctx.fillRect(c * C, r * C, C, C);
  }
  ctx.globalAlpha = 0.3;
  for (const j of layout.jitterCells) {
    ctx.fillStyle = theme.jitter[j.colorIdx];
    ctx.fillRect(j.x * C, j.y * C, C, C);
  }
  ctx.globalAlpha = 1;
}

// 战斗帧:贴 1 张烘焙图(板坐标;比旧版每帧 336 个 fillRect 快)
export function drawGround(ctx, state) {
  const lvl = state.level;
  const { canvas } = bakeGround(lvl);                  // 兜底懒烘(enterLevel 已预烘则直接命中)
  ctx.drawImage(canvas, 0, 0, lvl.cols * C, lvl.rows * C);
}

// 暗角:帧内 1 次填充;渐变对象进关缓存(spec §3,画在路之后压住路的边角)
export function drawVignette(ctx, state) {
  const lvl = state.level;
  const entry = bakeGround(lvl);
  const W = lvl.cols * C, H = lvl.rows * C;
  if (!entry.vignette) {
    const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.45, W / 2, H * 0.45, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, themeOf(lvl.chapter).vignette);
    entry.vignette = g;
  }
  ctx.fillStyle = entry.vignette;
  ctx.fillRect(0, 0, W, H);
}
```

- [ ] **Step 4.4: 语法+回归检查**

Run: `node --check src/render/ground.js && node tests/groundLayout.test.mjs && node tests/chapterThemes.test.mjs`
Expected: 无输出 + `ok groundLayout` + `ok chapterThemes`(模块顶层无 DOM 引用,node import 安全)

- [ ] **Step 4.5: Commit**

```bash
cd /Users/james/Projects/game-hub && git add games/tower-defender/src/render/ground.js && git commit -m "feat(tower-defender): ground.js烘焙管线(2×离屏/只持当前关/blur能力检测+三层退化)+12拼块painter+元素小件库+暗角(渐变进关缓存)"
```

### Task 5: 集成 — balance 开关 / board.js 贴图+四层路+暗角 / main.js 预烘

**Files:**
- Modify: `src/data/balance.js`(末尾加开关)
- Modify: `src/render/board.js:15-34`(格子块+路块)
- Modify: `src/main.js:60-68`(enterLevel)

- [ ] **Step 5.1: balance.js 加回滚开关**

在 `src/data/balance.js` 的 `FIREGULLY_LINGER: 1.5,` 行之后、`};` 之前追加:

```js
  // —— 背景特色化(背景spec §3/§10)——
  GROUND_THEMES: true,        // false=回滚:旧棋盘格+faction tint 路色,ground.js 整体不触达
```

- [ ] **Step 5.2: board.js 接入**

`src/render/board.js` 顶部 import 区(`import { plateRect } from './plate.js';` 之后)加:

```js
import { drawGround, drawVignette } from './ground.js';
import { themeOf } from '../data/chapterThemes.js';
```

把棋盘格块:

```js
  // 棋盘格草地
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = ((r + c) & 1) ? tint.grassA : tint.grassB;
      ctx.fillRect(c * C, r * C, C, C);
    }
  }
```

替换为:

```js
  // [背景spec] 章节化地表(烘焙图);开关关闭=旧棋盘格(回滚分支,勿删)
  if (BAL.GROUND_THEMES) {
    drawGround(ctx, state);
  } else {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = ((r + c) & 1) ? tint.grassA : tint.grassB;
        ctx.fillRect(c * C, r * C, C, C);
      }
    }
  }
```

把蜀道块:

```js
  // 弯曲蜀道（沿 waypoint 画粗线）
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const id in paths) {
    const wp = paths[id];
    ctx.beginPath();
    ctx.moveTo(wp[0].x * C + C / 2, wp[0].y * C + C / 2);
    for (let i = 1; i < wp.length; i++) ctx.lineTo(wp[i].x * C + C / 2, wp[i].y * C + C / 2);
    ctx.strokeStyle = tint.road; ctx.lineWidth = C * 0.72; ctx.stroke();
    ctx.strokeStyle = tint.road2; ctx.lineWidth = C * 0.58; ctx.stroke();
  }
```

替换为(四层:edge→outer→inner→worn,spec §2 通用;开关关闭=旧两层 faction tint):

```js
  // 弯曲蜀道:四层(缘/面/芯/磨损虚线;spec §2);回滚开关=旧两层 faction tint
  const road = BAL.GROUND_THEMES ? themeOf(state.level.chapter).road : { outer: tint.road, inner: tint.road2 };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const id in paths) {
    const wp = paths[id];
    ctx.beginPath();
    ctx.moveTo(wp[0].x * C + C / 2, wp[0].y * C + C / 2);
    for (let i = 1; i < wp.length; i++) ctx.lineTo(wp[i].x * C + C / 2, wp[i].y * C + C / 2);
    if (road.edge) { ctx.strokeStyle = road.edge; ctx.lineWidth = C * 0.80; ctx.stroke(); }
    ctx.strokeStyle = road.outer; ctx.lineWidth = C * 0.72; ctx.stroke();
    ctx.strokeStyle = road.inner; ctx.lineWidth = C * 0.58; ctx.stroke();
    if (road.worn) {
      ctx.save();
      ctx.strokeStyle = road.worn; ctx.lineWidth = C * 0.14;
      ctx.setLineDash([C * 0.28, C * 0.39]); ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.restore();
    }
  }
```

在 `drawTerrainFx(ctx, state);` 行之后、`// 将位（未占用 = 虚线绿框）` 之前插入:

```js
  if (BAL.GROUND_THEMES) drawVignette(ctx, state);   // [背景spec §3] 暗角:路之后才能压住路的边角(段2在此前插 accents)
```

- [ ] **Step 5.3: main.js 进关预烘**

`src/main.js` import 区 `import { drawBoard, drawWeather } from './render/board.js';` 之后加:

```js
import { bakeGround } from './render/ground.js';
```

`enterLevel` 内 `Object.assign(state, newGameState(...));` 行之后加:

```js
  if (BAL.GROUND_THEMES) bakeGround(state.level);   // [背景spec §3] 进关预烘(applyResume 内部走本函数,同口;drawGround 仍有懒烘兜底)
```

- [ ] **Step 5.4: 全门禁回归**

Run: `bash scripts/test.sh`
Expected: `✅✅ 全部门禁通过`(语法/54+2 单测/verify-levels/check-imports;board.js 改动不碰玩法数据)

- [ ] **Step 5.5: Commit**

```bash
cd /Users/james/Projects/game-hub && git add games/tower-defender/src/data/balance.js games/tower-defender/src/render/board.js games/tower-defender/src/main.js && git commit -m "feat(tower-defender): 接入章节化地表(GROUND_THEMES开关/棋盘格→烘焙图/路四层edge+worn磨损/暗角压路/进关预烘)"
```

### Task 6: 段1 验收(smoke 截图 + 回滚开关验证)

**Files:** 无新文件(验收任务)

- [ ] **Step 6.1: 全量门禁**

Run: `bash scripts/test.sh`
Expected: `✅✅ 全部门禁通过`

- [ ] **Step 6.2: 6 关 smoke 截图(每章首关+L50)**

Run: `SHOT_LEVELS=1,11,21,31,41,50 node tools/smoke-shots.mjs`
Expected: `ok smoke-shots(6 关截图,无 JS 错误)`;截图目录中 L1/L11/L21/L31/L41/L50 应呈现 5 套不同地表(翠绿/橄榄/青绿/深绿/枯黄)+ 拼块 + 四层路;若 console 出现 `[ground] bake ... > 30ms 预算` 即性能超标,需排查(常见原因:blur 退化路径三层叠加被误用于全部拼块)

- [ ] **Step 6.3: 回滚开关验证**

把 `src/data/balance.js` 的 `GROUND_THEMES: true` 临时改为 `false`,再跑:
`SHOT_LEVELS=1,21 node tools/smoke-shots.mjs`
Expected: `ok smoke-shots(2 关截图,无 JS 错误)`,截图=旧版双色棋盘格+旧两层路。验完改回 `true`,再跑一次确认恢复。

- [ ] **Step 6.4: 同章差异抽查(种子生效)**

Run: `SHOT_LEVELS=2,3,4 node tools/smoke-shots.mjs`
Expected: 3 张同章(ch1)截图地表布置肉眼可辨不同(拼块位置/数量/抖动格不同)——这是"50 关张张不同"主诉的直接证据

- [ ] **Step 6.5: 段1 检查点 commit(如有修补)**

```bash
cd /Users/james/Projects/game-hub && git add -A games/tower-defender && git commit -m "feat(tower-defender): 背景段1地基验收过(6关smoke五章配色可辨/同章种子差异/回滚开关双向验证)" --allow-empty
```

---

# 段2 · 点睛

### Task 7: 12 种小景 painter + 接入烘焙

**Files:**
- Modify: `src/render/ground.js`(追加 painter;bakeGround 内插一行)

- [ ] **Step 7.1: 追加小景 painter 注册表**

追加到 `src/render/ground.js` 末尾(fernAt/leafAt 同时供 Task 9 动效复用):

```js
// —— 小景 painter(spec §2 各章 decors):签名 (ctx, px, py, variant, colors);variant 0-2 控大小/数量 ——
function fernAt(ctx, x, y, col, sway) {                // 蕨丛(sway 供动效;烘焙传 0)
  ctx.strokeStyle = col.fern; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (const k of [-1, 0, 1]) {
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + k * 5 + sway, y - 7, x + k * 8 + sway, y - 10 + Math.abs(k) * 3);
    ctx.stroke();
  }
}
function leafAt(ctx, x, y, col, rot) {                 // 单片红叶(rot 弧度;动效复用)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = col.leaf;
  ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
const DECOR_PAINTERS = {
  tuft(ctx, x, y, v, col) {
    const s = 0.85 + v * 0.15;
    ctx.strokeStyle = col.tuft; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 3 * s, y - 6 * s, x - 6 * s, y - 8 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 12 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 3 * s, y - 6 * s, x + 6 * s, y - 8 * s); ctx.stroke();
  },
  flower(ctx, x, y, v, col) { flowerAt(ctx, x, y, col); },
  haystack(ctx, x, y, v, col) {
    const r = 7 + v;
    shadowAt(ctx, x, y + 2, r);
    ctx.fillStyle = col.haystack; ctx.strokeStyle = col.haystackOutline; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y); ctx.stroke();
  },
  stone(ctx, x, y, v, col) {
    shadowAt(ctx, x + 2, y + 4, 8);
    ctx.fillStyle = col.stone; ctx.strokeStyle = col.stoneOutline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, 7, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (v > 0) { ctx.beginPath(); ctx.ellipse(x + 9, y + 3, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = col.stoneHi; ctx.beginPath(); ctx.arc(x - 2, y - 2, 1.5, 0, Math.PI * 2); ctx.fill();
  },
  deadBranch(ctx, x, y, v, col) {
    ctx.strokeStyle = col.deadBranch; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 7, y + 3); ctx.lineTo(x + 7, y - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 4); ctx.stroke();
  },
  lotus(ctx, x, y, v, col) {
    ctx.fillStyle = col.lotus; ctx.strokeStyle = col.lotusOutline; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 5 + v, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 9, y + 3, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y - 2); ctx.stroke();   // 叶脉缺口
  },
  bambooShoot(ctx, x, y, v, col) {
    ctx.fillStyle = col.shoot; ctx.strokeStyle = col.bambooBase; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 3, y + 4); ctx.lineTo(x + 3, y + 4); ctx.lineTo(x, y - 7 - v); ctx.closePath();
    ctx.fill(); ctx.stroke();
  },
  lonePine(ctx, x, y, v, col) { pineAt(ctx, x, y, C * (0.5 + v * 0.1), col.pineA, col); },
  rock(ctx, x, y, v, col) { rockAt(ctx, x, y, C * (0.22 + v * 0.05), col); },
  fern(ctx, x, y, v, col) { fernAt(ctx, x, y, col, 0); },
  charStump(ctx, x, y, v, col) {
    shadowAt(ctx, x, y + 5, 6);
    ctx.fillStyle = col.charStump;
    ctx.fillRect(x - 3, y - 6 - v, 6, 11 + v);
    ctx.beginPath(); ctx.ellipse(x, y - 6 - v, 3, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col.ash; ctx.beginPath(); ctx.arc(x + 5, y + 4, 1.5, 0, Math.PI * 2); ctx.fill();
  },
  leaf(ctx, x, y, v, col) { leafAt(ctx, x, y, col, v * 0.6); },
};
```

- [ ] **Step 7.2: bakeGround 接入小景**

在 `bakeGround` 内拼块循环(`for (const p of layout.patches) {...}`)之后、`cache = { id: level.id, ... }` 之前插入:

```js
  for (const d of layout.decors) {
    const painter = DECOR_PAINTERS[d.kind];
    if (painter) painter(ctx, (d.x + 0.5) * C, (d.y + 0.6) * C, d.variant, theme.colors);
  }
```

(锚点取格中心略偏下:小件"立"在格里,影子不出格。)

- [ ] **Step 7.3: 检查 + smoke**

Run: `node --check src/render/ground.js && node tests/groundLayout.test.mjs && SHOT_LEVELS=1,11,21,31,41,50 node tools/smoke-shots.mjs`
Expected: `ok groundLayout` + `ok smoke-shots(6 关截图,无 JS 错误)`;截图里每关可见 10-16 个章节小景(ch1 草丛野花麦垛/ch2 卵石枯枝/ch3 莲叶竹笋/ch4 孤松岩块蕨/ch5 焦木红叶)

- [ ] **Step 7.4: Commit**

```bash
cd /Users/james/Projects/game-hub && git add games/tower-defender/src/render/ground.js && git commit -m "feat(tower-defender): 12种章节小景painter(草丛/野花/麦垛/石/枯枝/莲叶/竹笋/孤松/岩/蕨/焦木/红叶)接入烘焙"
```

### Task 8: 10 种地标 painter + LANDMARK_COLORS + 接入烘焙

**Files:**
- Modify: `src/render/ground.js`(追加;bakeGround 内插一段)

- [ ] **Step 8.1: 追加地标常量与 painter**

追加到 `src/render/ground.js` 末尾。注:LANDMARK_COLORS 在 spec §4 的 7 键基础上扩 bambooA/bambooB/ash 3 键(竹排/焦营帐用料,守"painter 不散落字面量"铁律):

```js
// —— 地标(spec §2 各章 landmarks ×2 共10种):跨章统一质感,取色只准经 LANDMARK_COLORS ——
export const LANDMARK_COLORS = {
  wood: '#6b4e30', woodDark: '#4a3520', stone: '#8d887a', stoneDark: '#5f5a4e',
  cloth: '#b3a079', clothDark: '#7a6a4a', flag: '#a8323a', fire: '#e08a3c',
  smoke: '#9a9aa2', char: '#3f352c', ash: '#6e645a', bambooA: '#8ab368', bambooB: '#9ec07a',
};
export const LANDMARK_META = { stoneTower: { smokeDy: -1.2 } };   // accent 锚点偏移(C 单位;spec §5.7)
const LK = LANDMARK_COLORS;

// 签名 (ctx, cx, footY):cx=2×2 块中心x,footY=块底边像素(投影/立面同建筑 billboard 规)
const LANDMARK_PAINTERS = {
  beacon(ctx, cx, footY) {       // 烽火台:石基梯形+木台+火点+静态烟丝
    shadowAt(ctx, cx, footY, C * 0.45);
    ctx.fillStyle = LK.stone; ctx.strokeStyle = LK.stoneDark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 13, footY); ctx.lineTo(cx + 13, footY); ctx.lineTo(cx + 10, footY - 22); ctx.lineTo(cx - 10, footY - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 8, footY - 8); ctx.lineTo(cx + 8, footY - 8); ctx.stroke();
    ctx.fillStyle = LK.wood; ctx.strokeStyle = LK.woodDark;
    ctx.beginPath(); ctx.roundRect(cx - 13, footY - 31, 26, 9, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = LK.fire; ctx.beginPath(); ctx.arc(cx, footY - 34, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = LK.smoke; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, footY - 38); ctx.quadraticCurveTo(cx + 3, footY - 45, cx, footY - 51); ctx.stroke();
    ctx.globalAlpha = 1;
  },
  tent(ctx, cx, footY) {         // 军帐:三角帐+门帘+小旗
    shadowAt(ctx, cx, footY, C * 0.5);
    ctx.fillStyle = LK.cloth; ctx.strokeStyle = LK.clothDark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 16, footY); ctx.lineTo(cx + 16, footY); ctx.lineTo(cx, footY - 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = LK.clothDark;
    ctx.beginPath(); ctx.moveTo(cx - 4, footY); ctx.lineTo(cx, footY - 8); ctx.lineTo(cx + 4, footY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = LK.woodDark; ctx.beginPath(); ctx.moveTo(cx, footY - 24); ctx.lineTo(cx, footY - 32); ctx.stroke();
    ctx.fillStyle = LK.flag;
    ctx.beginPath(); ctx.moveTo(cx, footY - 32); ctx.lineTo(cx + 9, footY - 29); ctx.lineTo(cx, footY - 26); ctx.closePath(); ctx.fill();
  },
  watchtower(ctx, cx, footY) {   // 木瞭望塔:斜腿+横撑+平台+布棚
    shadowAt(ctx, cx, footY, C * 0.45);
    ctx.strokeStyle = LK.wood; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 10, footY); ctx.lineTo(cx - 6, footY - 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 10, footY); ctx.lineTo(cx + 6, footY - 26); ctx.stroke();
    ctx.strokeStyle = LK.woodDark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 9, footY - 8); ctx.lineTo(cx + 9, footY - 8); ctx.stroke();
    ctx.fillStyle = LK.wood; ctx.strokeStyle = LK.woodDark;
    ctx.beginPath(); ctx.roundRect(cx - 10, footY - 30, 20, 6, 1.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = LK.clothDark;
    ctx.beginPath(); ctx.moveTo(cx - 11, footY - 30); ctx.lineTo(cx + 11, footY - 30); ctx.lineTo(cx, footY - 38); ctx.closePath(); ctx.fill();
  },
  stele(ctx, cx, footY) {        // 石碑:底座+碑身+刻痕三道
    shadowAt(ctx, cx, footY, C * 0.35);
    ctx.fillStyle = LK.stone; ctx.strokeStyle = LK.stoneDark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(cx - 10, footY - 5, 20, 5, 1.5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(cx - 6, footY - 26, 12, 21, 3); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx - 2, footY - 21 + i * 5); ctx.lineTo(cx + 2, footY - 21 + i * 5); ctx.stroke(); }
  },
  pavilion(ctx, cx, footY) {     // 孤亭:石台基+双柱+暗红翘檐
    shadowAt(ctx, cx, footY, C * 0.5);
    ctx.fillStyle = LK.stone; ctx.strokeStyle = LK.stoneDark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(cx - 14, footY - 4, 28, 4, 1); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = LK.wood; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - 9, footY - 4); ctx.lineTo(cx - 9, footY - 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 9, footY - 4); ctx.lineTo(cx + 9, footY - 18); ctx.stroke();
    ctx.fillStyle = LK.flag; ctx.strokeStyle = LK.woodDark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 16, footY - 18); ctx.quadraticCurveTo(cx, footY - 30, cx + 16, footY - 18);
    ctx.quadraticCurveTo(cx, footY - 24, cx - 16, footY - 18); ctx.closePath(); ctx.fill(); ctx.stroke();
  },
  raft(ctx, cx, footY) {         // 竹排:5 竹并排+两道横绑
    shadowAt(ctx, cx, footY - 4, C * 0.5);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = i % 2 ? LK.bambooB : LK.bambooA; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(cx - 14 + i * 7, footY - 14); ctx.lineTo(cx - 10 + i * 7, footY + 2); ctx.stroke();
    }
    ctx.strokeStyle = LK.woodDark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 15, footY - 9); ctx.lineTo(cx + 15, footY - 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 14, footY - 2); ctx.lineTo(cx + 16, footY); ctx.stroke();
  },
  stoneTower(ctx, cx, footY) {   // 石塔:双层塔身+檐+窗(狼烟 accent 自塔顶,见 LANDMARK_META)
    shadowAt(ctx, cx, footY, C * 0.4);
    ctx.fillStyle = LK.stone; ctx.strokeStyle = LK.stoneDark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(cx - 11, footY - 16, 22, 16, 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(cx - 8, footY - 30, 16, 14, 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(cx - 11, footY - 33, 22, 3, 1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = LK.char; ctx.fillRect(cx - 2, footY - 27, 4, 5);
  },
  trestle(ctx, cx, footY) {      // 栈道木架:X 腿+横板+三短柱
    shadowAt(ctx, cx, footY, C * 0.45);
    ctx.strokeStyle = LK.wood; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 12, footY); ctx.lineTo(cx + 8, footY - 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 12, footY); ctx.lineTo(cx - 8, footY - 20); ctx.stroke();
    ctx.fillStyle = LK.wood; ctx.strokeStyle = LK.woodDark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(cx - 14, footY - 24, 28, 5, 1); ctx.fill(); ctx.stroke();
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 8, footY - 24); ctx.lineTo(cx + i * 8, footY - 19); ctx.stroke(); }
  },
  brokenFlag(ctx, cx, footY) {   // 残旗:斜杆+撕裂旗面+碎石两粒
    shadowAt(ctx, cx, footY, C * 0.35);
    ctx.strokeStyle = LK.woodDark; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 3, footY); ctx.lineTo(cx + 6, footY - 26); ctx.stroke();
    ctx.fillStyle = LK.flag; ctx.strokeStyle = LK.char; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx + 6, footY - 26); ctx.lineTo(cx + 20, footY - 22);
    ctx.lineTo(cx + 14, footY - 19); ctx.lineTo(cx + 17, footY - 15); ctx.lineTo(cx + 5, footY - 18);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = LK.char;
    ctx.beginPath(); ctx.arc(cx - 6, footY - 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 2, footY + 2, 1.5, 0, Math.PI * 2); ctx.fill();
  },
  burntCamp(ctx, cx, footY) {    // 焦营帐:坍塌帐+断梁+余烬+烬点
    shadowAt(ctx, cx, footY, C * 0.5);
    ctx.fillStyle = LK.char; ctx.strokeStyle = LK.woodDark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 16, footY); ctx.lineTo(cx + 16, footY); ctx.lineTo(cx + 6, footY - 14); ctx.lineTo(cx - 4, footY - 18); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = LK.char; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 4, footY - 18); ctx.lineTo(cx - 8, footY - 24); ctx.stroke();
    ctx.fillStyle = LK.fire; ctx.beginPath(); ctx.arc(cx + 9, footY - 3, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = LK.ash; ctx.beginPath(); ctx.arc(cx - 8, footY - 4, 1.5, 0, Math.PI * 2); ctx.fill();
  },
};
```

- [ ] **Step 8.2: bakeGround 接入地标**

在 `bakeGround` 内小景循环(Step 7.2 插入的那段)之后、`cache = { id: level.id, ... }` 之前插入:

```js
  if (layout.landmark) {
    const painter = LANDMARK_PAINTERS[layout.landmark.kind];
    if (painter) painter(ctx, (layout.landmark.x + 1) * C, (layout.landmark.y + 2) * C - 4);
  }
```

(锚 = 2×2 块中心x + 块底边-4px,与建筑 billboard 底边锚同规。)

- [ ] **Step 8.3: 检查 + smoke**

Run: `node --check src/render/ground.js && node tests/groundLayout.test.mjs && SHOT_LEVELS=1,11,21,31,41,50 node tools/smoke-shots.mjs`
Expected: `ok groundLayout` + `ok smoke-shots(6 关截图,无 JS 错误)`;每关截图应有且仅有 1 个地标(L1/L11=烽火台或军帐… L41/L50=残旗或焦营帐),离路远、不压任何玩法元素

- [ ] **Step 8.4: Commit**

```bash
cd /Users/james/Projects/game-hub && git add games/tower-defender/src/render/ground.js && git commit -m "feat(tower-defender): 10种地标painter(烽火台/军帐/瞭望塔/石碑/孤亭/竹排/石塔/栈道架/残旗/焦营帐)+LANDMARK_COLORS收口(扩bambooA/B+ash 3键)+接入烘焙"
```

### Task 9: 轻动效 drawGroundAccents + board.js 接线

**Files:**
- Modify: `src/render/ground.js`(追加)
- Modify: `src/render/board.js`(import 行 + 暗角行)

- [ ] **Step 9.1: 追加动效绘制**

追加到 `src/render/ground.js` 末尾:

```js
// —— 轻动效(spec §6):time 驱动零随机;叠加式覆画(烘焙底不动);每关 ≤3 处,帧开销远低于地形特效 ——
export function drawGroundAccents(ctx, state) {
  const entry = bakeGround(state.level);
  const accents = entry.layout.accents;
  if (!accents.length) return;
  const col = themeOf(state.level.chapter).colors;
  const t = state.time || 0;
  ctx.save();
  for (const a of accents) {
    const px = a.x * C, py = a.y * C;
    if (a.kind === 'flowerTwinkle') {                  // alpha = .6+.4·sin(t·2+phase)
      ctx.globalAlpha = Math.max(0, 0.6 + 0.4 * Math.sin(t * 2 + a.phase));
      ctx.fillStyle = col.petal;
      ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col.flowerCore;
      ctx.beginPath(); ctx.arc(px, py, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (a.kind === 'reedSway') {                // 苇顶 x 偏移 sin(t·1.5+phase)·3px
      reedAt(ctx, px, py, col, Math.sin(t * 1.5 + a.phase) * 3);
    } else if (a.kind === 'bambooSway') {              // 竹端小幅旋摆(顶端偏移近似 ±8°)
      const sway = Math.sin(t * 1.2 + a.phase) * 4;
      ctx.strokeStyle = col.stalk; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, py + C * 0.4);
      ctx.quadraticCurveTo(px, py - C * 0.1, px + sway, py - C * 0.5); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px + sway * 0.7, py - C * 0.35); ctx.lineTo(px + sway * 0.7 + 6, py - C * 0.47); ctx.stroke();
    } else if (a.kind === 'smokeRise') {               // 狼烟:城堡烟雾同式细灰白版,自塔顶(LANDMARK_META)
      const top = py + LANDMARK_META.stoneTower.smokeDy * C;
      const sway = Math.sin(t * 0.9 + a.phase) * C * 0.18;
      ctx.strokeStyle = LANDMARK_COLORS.smoke; ctx.lineWidth = C * 0.14; ctx.lineCap = 'round';
      ctx.globalAlpha = 0.3 + 0.12 * Math.sin(t * 1.7 + a.phase);
      ctx.beginPath(); ctx.moveTo(px, top);
      ctx.bezierCurveTo(px + sway, top - C * 0.5, px - sway, top - C * 0.9, px + sway * 1.4, top - C * 1.3);
      ctx.stroke(); ctx.globalAlpha = 1;
    } else if (a.kind === 'fernSway') {                // 蕨丛微动(狼烟降级项)
      fernAt(ctx, px, py, col, Math.sin(t * 1.4 + a.phase) * 2.5);
    } else if (a.kind === 'leafDrift') {               // 红叶绕锚点椭圆轨迹缓漂(rx12,ry6,θ=t·0.3+phase)
      const th = t * 0.3 + a.phase;
      leafAt(ctx, px + Math.cos(th) * 12, py + Math.sin(th) * 6, col, th);
    }
  }
  ctx.restore();
}
```

- [ ] **Step 9.2: board.js 接线**

`src/render/board.js` 把 import 行:

```js
import { drawGround, drawVignette } from './ground.js';
```

改为:

```js
import { drawGround, drawVignette, drawGroundAccents } from './ground.js';
```

把暗角行:

```js
  if (BAL.GROUND_THEMES) drawVignette(ctx, state);   // [背景spec §3] 暗角:路之后才能压住路的边角(段2在此前插 accents)
```

改为:

```js
  if (BAL.GROUND_THEMES) { drawGroundAccents(ctx, state); drawVignette(ctx, state); }   // [背景spec §3] 层序:地形特效→轻动效→暗角→将位
```

- [ ] **Step 9.3: 检查 + smoke**

Run: `bash scripts/test.sh && SHOT_LEVELS=11,21,31,41 node tools/smoke-shots.mjs`
Expected: `✅✅ 全部门禁通过` + `ok smoke-shots(4 关截图,无 JS 错误)`;L11 截图可见芦苇/L21 竹/L31 狼烟或蕨/L41 红叶(单帧定格姿态,位置在拼块/小景/地标上)

- [ ] **Step 9.4: Commit**

```bash
cd /Users/james/Projects/game-hub && git add games/tower-defender/src/render/ground.js games/tower-defender/src/render/board.js && git commit -m "feat(tower-defender): 6种地表轻动效(野花闪/芦苇摆/竹摇/狼烟/蕨动/红叶飘,time驱动零随机叠加式)接入板渲染层序"
```

### Task 10: 段2 验收 + 全量收尾

**Files:** 无新文件(验收任务)

- [ ] **Step 10.1: 全量门禁**

Run: `bash scripts/test.sh`
Expected: `✅✅ 全部门禁通过`

- [ ] **Step 10.2: 6 关全要素 smoke**

Run: `SHOT_LEVELS=1,11,21,31,41,50 node tools/smoke-shots.mjs`
Expected: `ok smoke-shots(6 关截图,无 JS 错误)`;无 `[ground] bake ... > 30ms` 警告;逐张核对:五章配色可辨/拼块软边/小景 10-16/地标 1 个/路四层含磨损虚线/暗角不压边角将位可读

- [ ] **Step 10.3: L50 大雨同框(spec §7 边界)**

Run: `SHOT_LEVELS=50 WAIT_MS=2000 node tools/smoke-shots.mjs`
Expected: 焦土主题 + 雨丝 + 火谷熄灭(焦地基底仍在)同框无冲突

- [ ] **Step 10.4: 回滚开关末验**

`GROUND_THEMES` 改 `false` → `SHOT_LEVELS=1 node tools/smoke-shots.mjs` 出旧棋盘格;改回 `true` 再跑恢复新地表。两次均 `ok smoke-shots(1 关截图,无 JS 错误)`。

- [ ] **Step 10.5: 收尾 commit**

```bash
cd /Users/james/Projects/game-hub && git add -A games/tower-defender && git commit -m "feat(tower-defender): 背景段2点睛验收过(小景/地标/动效全要素smoke+L50雨夜同框+回滚双向)" --allow-empty
```

---

## 验收对照(spec §9 门禁)

| 门禁 | 落点 |
|---|---|
| `npm test`/`bash scripts/test.sh` 全绿(现有全部+新增2) | Task 1-3 新测;Task 5.4/6.1/9.3/10.1 回归 |
| `SHOT_LEVELS=1,11,21,31,41,50` 截图 James 过目 | Task 6.2(段1)/10.2(段2)产出截图,**人工项:James 过目 + 娃实玩** |
| 烘焙 < 30ms(开发期打点) | bakeGround 内置 `console.warn` 超标即报(Task 4.3) |
| 纯视觉层不碰玩法,winnable 免重验 | 全计划零改 data/waves/systems 数值;verify-levels 在 test.sh 内兜底 |
| 回滚 = 改 `BAL.GROUND_THEMES` 一个 flag | Task 6.3/10.4 双向验证 |

**对 spec 的两处计划级落地细化**(不改设计语义):① LANDMARK_COLORS 扩 bambooA/bambooB/ash 3 键(竹排/焦营帐用料,守零字面量铁律);② 新增 `theme.accentPatch`——首拼块强制为该章可动拼块(ch1 花田/ch2 芦苇/ch3 竹林),保证 §5.7 动效数量下限的达标率(否则 ch2/ch3 有 20-44% 概率抽不到可动拼块致该关 0 动效)。




