# 塔防敌方兵种扩展三件套 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给敌方加骑兵新兵种、给吴卒/魏卒/骑兵绘制 faction 专属立绘、并让每关第 10 波后每路兵种混编。

**Architecture:** 锚回主设计文档 `docs/superpowers/specs/2026-06-06-tower-defender-design.md`(§5/§17.3/§17.5,commit 7367439)。纯数据/纯函数改动为主:`enemies.js` 加 cavalry 原型 → `factions.js` 加魏吴换皮 → `chapterThemes.js` tiers 解锁 → `entities/enemy.js` 实体补 `faction` 字段 → `entityRenderer.js` 选图改 faction 感知(缺图回退) → `waveGen.js` 第10波后确定性切分混编。立绘由 James 跑 OpenRouter 生成(不进测试门禁)。

**Tech Stack:** 原生 ES Modules + Canvas2D;`node:test` + `node:assert/strict` 单测;`tools/sim-economy.mjs` winnable 50/50 平衡门禁;`tools/gen-sprites.mjs`(OpenRouter Gemini 2.5 Flash Image)生成立绘。

**铁律:**
- `waveGen` 确定性:seed required、加载期零随机、**混编切分不新增 rng 调用**(honor 已提交 spec §17.5)。
- 缺图零崩溃:新 sprite key 全部走"专属→原型→色块"回退链。
- 平衡敏感:cavalry 入池 + 混编会改 wave>10 输出 → **Task 7 必须 sim 复验 winnable 50/50 不回归**。
- OpenRouter key 仅经环境变量传入,**绝不落盘**。

---

## File Structure

| 文件 | 责任 | 改动 |
|---|---|---|
| `src/data/enemies.js` | 兵种原型数值 | 新增 `cavalry` 原型 |
| `src/data/factions.js` | 三势力换皮(name/color) | wu/wei 加 `cavalry` 皮 |
| `src/data/chapterThemes.js` | 章节兵种解锁池 tiers | wu/wei/qunxiong/zhongyuan tiers 末尾加 `cavalry` |
| `src/entities/enemy.js` | 敌实例工厂 | 返回实体补 `faction` 字段(供渲染选图) |
| `src/render/entityRenderer.js` | 渲染契约 | 加 `enemySprite()` faction 感知选图 + `ENEMY_R.cavalry` |
| `src/core/assets.js` | 资源 MANIFEST | 加 `enemy_wu_footman/enemy_wei_footman/enemy_wu_cavalry/enemy_wei_cavalry` |
| `src/data/waveGen.js` | 波次生成 | 第10波后每路确定性切分为 2-3 兵种 |
| `tools/gen-sprites.mjs` | 立绘生成 | 加 `--enemies` 模式 + 4 条敌兵生成数据(James 跑) |
| `tests/*.mjs` | 单测 | 新增 cavalry/faction-sprite/mixing 测试 + 更新受影响断言 |

---

## Task 1: cavalry 兵种原型

**Files:**
- Modify: `src/data/enemies.js`(在 `shaman` 与 `heavy` 之间插入)
- Test: `tests/cavalry.test.mjs`(新建)

- [ ] **Step 1: 写失败测试**

`tests/cavalry.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';

test('cavalry 原型数值正确', () => {
  const c = ENEMIES.cavalry;
  assert.ok(c, 'cavalry 原型应存在');
  assert.equal(c.id, 'cavalry');
  assert.equal(c.name, '骑兵');
  assert.equal(c.hp, 120);
  assert.equal(c.speed, 0.9);
  assert.equal(c.gold, 10);
  assert.equal(c.castleDmg, 2);
  assert.equal(c.flying, false);
  assert.equal(c.resist, undefined, 'cavalry 无抗性(靠血厚+冲速)');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/cavalry.test.mjs`
Expected: FAIL(`cavalry 原型应存在` — ENEMIES.cavalry undefined)

- [ ] **Step 3: 实现 — 在 `enemies.js` 的 `shaman` 块之后、`heavy` 块之前插入**

```js
  cavalry: {
    id: 'cavalry', name: '骑兵',
    hp: 120, speed: 0.9, gold: 10, castleDmg: 2, flying: false,  // 重装冲锋·仅魏吴·无抗性,血厚+冲速施压(填轻骑↔重甲空位)
    color: '#6c5ce7',
  },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/cavalry.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/enemies.js tests/cavalry.test.mjs
git commit -m "feat(tower-defender): 新增骑兵兵种原型(hp120/速0.9/扣城2,需求②)"
```

---

## Task 2: 三势力 cavalry 换皮(魏吴)

**Files:**
- Modify: `src/data/factions.js`(`wu.skin` 与 `wei.skin` 各加 `cavalry` 行)
- Test: `tests/factions.test.mjs`(追加用例)

- [ ] **Step 1: 写失败测试 — 追加到 `tests/factions.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skinOf } from '../src/data/factions.js';

test('cavalry 换皮:东吴=丹阳劲骑 / 曹魏=具装铁骑 / 南蛮无', () => {
  assert.equal(skinOf('wu', 'cavalry').name, '丹阳劲骑');
  assert.equal(skinOf('wei', 'cavalry').name, '具装铁骑');
  assert.equal(skinOf('nanman', 'cavalry'), null, '南蛮无骑兵皮');
});
```
> 注:若 `factions.test.mjs` 已有 `import` 同名符号,合并 import 行,勿重复声明。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/factions.test.mjs`
Expected: FAIL(`skinOf('wu','cavalry')` 为 null → `.name` 抛 TypeError)

- [ ] **Step 3: 实现 — `factions.js`**

`wu.skin` 末尾(在 `boss:` 行之前)加:
```js
      cavalry: { name: '丹阳劲骑', color: '#16a085' },
```
`wei.skin` 末尾(在 `boss:` 行之前)加:
```js
      cavalry: { name: '具装铁骑', color: '#34495e' },
```
> `nanman.skin` **不加** cavalry(南蛮无马军 → skinOf 回退 null → 工厂用原型名/色)。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/factions.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/factions.js tests/factions.test.mjs
git commit -m "feat(tower-defender): 骑兵魏吴换皮 丹阳劲骑/具装铁骑(需求②)"
```

---

## Task 3: chapterThemes tiers 解锁 cavalry

**Files:**
- Modify: `src/data/chapterThemes.js`(wu/wei/qunxiong/zhongyuan 的 `tiers` 末尾加 `'cavalry'`)
- Test: `tests/chapterThemes.test.mjs`(追加 + 按需更新既有断言)

- [ ] **Step 1: 写失败测试 — 追加到 `tests/chapterThemes.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS } from '../src/data/chapterThemes.js';

test('骑兵仅进魏吴系章节 tiers,南蛮不含', () => {
  for (const id of ['wu', 'wei', 'qunxiong', 'zhongyuan']) {
    assert.ok(CHAPTERS[id].tiers.includes('cavalry'), `${id} 应含 cavalry`);
  }
  assert.ok(!CHAPTERS.nanman.tiers.includes('cavalry'), '南蛮不含 cavalry');
  assert.equal(CHAPTERS.nanman.tiers[0], 'footman', 'tiers[0] 恒 footman');
  for (const id of ['wu', 'wei', 'qunxiong', 'zhongyuan']) {
    assert.equal(CHAPTERS[id].tiers[0], 'footman', `${id} tiers[0] 仍 footman`);
  }
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/chapterThemes.test.mjs`
Expected: FAIL(`wu 应含 cavalry`)

- [ ] **Step 3: 实现 — `chapterThemes.js`,把这四章的 tiers 改为(cavalry 放末尾,保证最后解锁、tiers[0] 仍 footman):**

```js
  wu: {
    id: 'wu', name: '东吴', faction: 'wu',
    tiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'cavalry'],
    bgKey: 'bg_wu',
  },
  wei: {
    id: 'wei', name: '曹魏', faction: 'wei',
    tiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'cavalry'],
    bgKey: 'bg_wei',
  },
  qunxiong: {
    id: 'qunxiong', name: '群雄', faction: 'wei',
    tiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'cavalry'],
    bgKey: 'bg_qunxiong',
  },
  zhongyuan: {
    id: 'zhongyuan', name: '终章·中原', faction: 'wei',
    tiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'cavalry'],
    bgKey: 'bg_zhongyuan',
  },
```
> `nanman` 块**不动**。

- [ ] **Step 4: 跑测试 + 检查既有断言**

Run: `node --test tests/chapterThemes.test.mjs tests/campaign.test.mjs tests/levels-integrity.test.mjs`
Expected: 新测试 PASS。**若既有断言硬编码了 tiers 长度/内容而失败 → 更新为含 cavalry 的新值**(只改断言期望值,不改逻辑)。

- [ ] **Step 5: Commit**

```bash
git add src/data/chapterThemes.js tests/chapterThemes.test.mjs
git commit -m "feat(tower-defender): 骑兵入魏吴系章节兵种池 tiers(需求②)"
```

---

## Task 4: 敌兵 faction 感知选图 + cavalry 渲染半径 + MANIFEST

**Files:**
- Modify: `src/entities/enemy.js`(返回实体补 `faction` 字段)
- Modify: `src/render/entityRenderer.js`(加 `enemySprite()` + 导出 + `ENEMY_R.cavalry` + 替换 `drawEnemy` 选图行)
- Modify: `src/core/assets.js`(MANIFEST 加 4 个 enemy key)
- Test: `tests/entityRenderer.test.mjs`(追加 enemySprite 用例)、`tests/assets.test.mjs`(追加 MANIFEST 键断言)

- [ ] **Step 1: 写失败测试**

追加到 `tests/entityRenderer.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enemySprite } from '../src/render/entityRenderer.js';
import { assets } from '../src/core/assets.js';

test('enemySprite:faction 专属图优先 → 原型图 → null', () => {
  assets.images = {
    enemy_footman: 'PROTO',
    enemy_wu_footman: 'WU',
  };
  assert.equal(enemySprite({ type: 'footman', faction: 'wu' }), 'WU', 'wu 有专属图取专属');
  assert.equal(enemySprite({ type: 'footman', faction: 'wei' }), 'PROTO', 'wei 无专属图回退原型');
  assert.equal(enemySprite({ type: 'footman', faction: null }), 'PROTO', '无 faction 用原型');
  assert.equal(enemySprite({ type: 'cavalry', faction: 'wu' }), null, '全缺 → null(色块回退)');
});
```
追加到 `tests/assets.test.mjs`:
```js
import { MANIFEST } from '../src/core/assets.js';
test('敌兵 faction 专属图 + 骑兵图入 MANIFEST', () => {
  for (const k of ['enemy_wu_footman', 'enemy_wei_footman', 'enemy_wu_cavalry', 'enemy_wei_cavalry']) {
    assert.ok(MANIFEST[k], `${k} 应在 MANIFEST`);
  }
});
```
> 合并已有 import,勿重复 `test`/`assert` 声明。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/entityRenderer.test.mjs tests/assets.test.mjs`
Expected: FAIL(`enemySprite` 未导出 / MANIFEST 缺键)

- [ ] **Step 3a: 实现 — `src/entities/enemy.js`**

在 `createEnemy` 返回的实体对象里(`name:` 行附近,~line 22)补一行,使渲染层能取势力:
```js
    faction: opts.faction || null,                 // [需求①] 供 entityRenderer faction 感知选图
```
> 读文件确认插入位置,与现有 `color`/`name`/`resist` 字段并列。

- [ ] **Step 3b: 实现 — `src/render/entityRenderer.js`**

(1) `ENEMY_R` 常量(line 11)加 `cavalry`:
```js
const ENEMY_R = { footman: 0.26, wolf: 0.22, tengjia: 0.32, flyer: 0.24, shaman: 0.26, heavy: 0.3, cavalry: 0.28, boss: 0.44 };
```
(2) 在 `drawEnemy` 之前新增并导出 helper:
```js
// [需求①] 敌兵选图:faction 专属图(enemy_<faction>_<type>)优先 → 原型通用图(enemy_<type>)→ null(调用方画色块)。
export function enemySprite(e) {
  return (e.faction && assets.images['enemy_' + e.faction + '_' + e.type]) || assets.images['enemy_' + e.type] || null;
}
```
(3) 替换 `drawEnemy` 内选图行(原 line 142):
```js
  const img = e.isBoss ? assets.images['boss_' + e.bossId] : enemySprite(e);
```

- [ ] **Step 3c: 实现 — `src/core/assets.js` MANIFEST,在 `enemy_shaman` 行之后加:**

```js
  // —— [需求①②] faction 专属敌兵图(缺图→ enemySprite 回退原型图→色块;James 跑 gen-sprites --enemies 产出)——
  enemy_wu_footman: 'assets/sprites/enemies/wu_footman.png',
  enemy_wei_footman: 'assets/sprites/enemies/wei_footman.png',
  enemy_wu_cavalry: 'assets/sprites/enemies/wu_cavalry.png',
  enemy_wei_cavalry: 'assets/sprites/enemies/wei_cavalry.png',
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/entityRenderer.test.mjs tests/assets.test.mjs tests/heavy.test.mjs`
Expected: PASS(heavy 测试一并跑,确认 createEnemy 改动未破坏既有实体字段)

- [ ] **Step 5: Commit**

```bash
git add src/entities/enemy.js src/render/entityRenderer.js src/core/assets.js tests/entityRenderer.test.mjs tests/assets.test.mjs
git commit -m "feat(tower-defender): 敌兵 faction 感知选图 + 骑兵渲染半径 + 专属图 MANIFEST(需求①②)"
```

---

## Task 5: waveGen 第10波后每路混编(确定性切分)

**Files:**
- Modify: `src/data/waveGen.js`(在每路 spawns 构建后、装甲/特种后处理前插入混编块)
- Test: `tests/waveGen.test.mjs`(追加混编 + 确定性用例;按需更新既有断言)

- [ ] **Step 1: 写失败测试 — 追加到 `tests/waveGen.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genWaves } from '../src/data/waveGen.js';

const TEMPLATE = { camps: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], paths: { a: [], b: [], c: [] } };
const PARAMS = {
  waveCount: 15, difficulty: 3,
  enemyTiers: ['footman', 'wolf', 'heavy', 'cavalry'],
  boss: { id: 'caocao', name: '曹操', hpMult: 1 }, lieutenants: [],
};

test('第10波后每路混编:waveId>10 非末波至少出现 2 种兵种', () => {
  const waves = genWaves(TEMPLATE, PARAMS, 1234);
  const w = waves.find((x) => x.waveId === 12);          // 非末波
  const types = new Set(w.spawns.filter((s) => s.enemyType !== 'boss').map((s) => s.enemyType));
  assert.ok(types.size >= 2, `waveId 12 应混编多兵种,实际 ${[...types]}`);
});

test('第10波前仍单一兵种(每路一种)', () => {
  const waves = genWaves(TEMPLATE, PARAMS, 1234);
  const w = waves.find((x) => x.waveId === 5);
  // 每个 lane(campId)在该波至多 1 个 spawn(未切分)
  const perLane = {};
  for (const s of w.spawns) perLane[s.campId] = (perLane[s.campId] || 0) + 1;
  for (const n of Object.values(perLane)) assert.ok(n <= 1, '第10波前每路单 spawn');
});

test('确定性:同 seed 两次生成完全一致', () => {
  assert.deepEqual(genWaves(TEMPLATE, PARAMS, 1234), genWaves(TEMPLATE, PARAMS, 1234));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/waveGen.test.mjs`
Expected: FAIL(`waveId 12 应混编多兵种` — 现每路单一 type,types.size===1)

- [ ] **Step 3: 实现 — `src/data/waveGen.js`,在 `const spawns = chosenLanes.map(...)` 块结束后(原 line 57 之后)、装甲/特种后处理 `let armorSeen = false;`(原 line 63)之前插入:**

```js
    // [2026-06-13 需求③] 第10波后每路混编:把单一 type 的一路确定性切成 2-3 个不同兵种子 spawn
    //（总数量不变=切分非叠加;不新增 rng 调用 → 保 seed 确定性;末波不混编,聚焦主将;
    //  置于装甲限路/特种折扣之前,使既有折扣规则照常作用于切分后的子 spawn）。
    if (i >= 10 && !last && pool.length >= 2) {
      const mixed = [];
      for (const sp of spawns) {
        const k = Math.min(3, pool.length);                       // 每路混 2-3 种
        const start = Math.max(0, pool.indexOf(sp.enemyType));     // 从该路原 type 起,沿 pool 顺取 k 种
        const base = Math.floor(sp.count / k), rem = sp.count % k; // 均分,余数前置
        for (let j = 0; j < k; j++) {
          const c = base + (j < rem ? 1 : 0);
          if (c <= 0) continue;
          mixed.push({ ...sp, enemyType: pool[(start + j) % pool.length], count: c, leadDelay: sp.leadDelay + j * 0.5 });
        }
      }
      spawns.length = 0;
      spawns.push(...mixed);
    }
```

- [ ] **Step 4: 跑测试确认通过 + 既有断言**

Run: `node --test tests/waveGen.test.mjs tests/waveSystemRamp.test.mjs tests/enemyRamp.test.mjs`
Expected: 新测试 PASS。**若既有断言假设 wave>10 每路单 type 而失败 → 更新断言以容纳混编**(只改期望,不改逻辑)。

- [ ] **Step 5: Commit**

```bash
git add src/data/waveGen.js tests/waveGen.test.mjs
git commit -m "feat(tower-defender): 第10波后每路确定性切分混编(需求③,零新增rng)"
```

---

## Task 6: 敌兵立绘生成(吴卒/魏卒/骑兵魏吴 = 4 张,James 跑)

**Files:**
- Modify: `tools/gen-sprites.mjs`(加 `--enemies` 模式 + 敌兵生成数据)
- 产出(James 跑后):`assets/sprites/enemies/{wu_footman,wei_footman,wu_cavalry,wei_cavalry}.png`

> 本任务**不进自动门禁**(生成需 API key + 网络);代码先落,缺图时 Task 4 的回退链保证零崩溃。验收靠 James 跑生成 + 浏览器冒烟。

- [ ] **Step 1: 实现 — `tools/gen-sprites.mjs` 末尾(main 调度处)加敌兵生成数据与函数**

在文件顶部 STYLE 常量之后加敌兵生成表:
```js
// —— [需求①②] 敌兵立绘生成表(风格锚 = 同 STYLE 工笔重彩国画,纯白底便于 debg)——
const ENEMY_GEN = {
  wu_footman:  { out: 'wu_footman',  desc: '东吴步卒,青蓝战袍皮甲,持环首刀与藤牌,江东水乡军容,普通士兵' },
  wei_footman: { out: 'wei_footman', desc: '曹魏步卒,玄黑赭红战袍铁甲,持长戟,中原雄师军容,普通士兵' },
  wu_cavalry:  { out: 'wu_cavalry',  desc: '东吴丹阳劲骑,青蓝具装骑兵骑战马,持马槊,冲锋姿态,精锐重骑' },
  wei_cavalry: { out: 'wei_cavalry', desc: '曹魏具装铁骑,玄铁重甲骑兵骑披甲战马(马铠),持长矛,冲锋姿态,虎豹骑级精锐' },
};

async function genEnemy(key) {
  const e = ENEMY_GEN[key];
  const prompt = STYLE + `【单位】${e.desc}。【姿态】面向左侧行进/冲锋,全身像,纯白背景。`;
  const body = { model: MODEL, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }] };
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const imgUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imgUrl) throw new Error(`无图片返回: ${JSON.stringify(data).slice(0, 200)}`);
  fs.writeFileSync(path.join('assets/sprites/enemies', `${e.out}.png`), Buffer.from(imgUrl.split(',')[1], 'base64'));
  console.log(`✓ enemies/${e.out}.png`);
}
```
在 main 调度(解析 argv 处)加 `--enemies` 分支:
```js
if (process.argv.includes('--enemies')) {
  for (const key of Object.keys(ENEMY_GEN)) { await genEnemy(key); }
  return;   // 或 process.exit(0),依现有 main 结构
}
```
> 读 `gen-sprites.mjs` 现有 main/argv 解析结构,把分支接到既有调度里(与 `--stages`/`--only` 同级)。

- [ ] **Step 2: 语法自检(不调 API)**

Run: `node --check tools/gen-sprites.mjs`
Expected: 无语法错误(无输出 = 通过)。

- [ ] **Step 3: Commit(代码,先于生成)**

```bash
git add tools/gen-sprites.mjs
git commit -m "feat(tower-defender): gen-sprites 加 --enemies 模式生成吴魏步卒/骑兵立绘(需求①②)"
```

- [ ] **Step 4: James 跑生成 + 去白底(手动,会话外)**

```bash
OPENROUTER_API_KEY=<key> node tools/gen-sprites.mjs --enemies
python3 tools/debg-sprites.py   # 或对应去白脚本,处理 assets/sprites/enemies/*.png
```
> key 仅经环境变量;**不写入任何文件/commit**。产图后浏览器冒烟核对四图风格与现有南蛮兵协调。

---

## Task 7: 门禁复验 + 平衡 + 收尾提交

**Files:** 无新代码(验证 + 按需微调)

- [ ] **Step 1: 全量单测**

Run: `node --test tests/`
Expected: 全绿(含 Task 1-5 新增 + 受影响断言更新后)。

- [ ] **Step 2: 平衡门禁 — winnable 不回归**

Run: `node tools/sim-economy.mjs`
Expected: winnable **50/50** 不下降(cavalry 入池 + wave>10 混编后,基础难度无回归)。
- 若个别关掉出 winnable:**优先调 cavalry**(`enemies.js` hp 120→100 或 speed 0.9→0.85),复跑;
- 若混编致后期过载:把 Task 5 的 `k = Math.min(3, pool.length)` 收紧为 `Math.min(2, pool.length)`(温和档),复跑;
- 反复直到 winnable 恢复 50/50,记录最终参数。

- [ ] **Step 3: 基线核对(可选)**

Run: `node tools/balance-report.mjs`
Expected: 基础数值基线不因本次改动异常漂移(cavalry 是新行,关注其威胁分落在合理带)。

- [ ] **Step 4: 浏览器冒烟(主验收)**

进东吴/曹魏关:确认 ① 吴卒/魏卒/骑兵立绘正确(有图)或色块带正确皮名(缺图回退)② 骑兵血厚冲快、扣城 2 ③ 第10波后每路明显多兵种混编。

- [ ] **Step 5: 收尾提交**

```bash
git add -A
git commit -m "test(tower-defender): 敌方兵种扩展三件套门禁复验 winnable 50/50(需求①②③)"
```
> ⚠️ `git add -A` 前先 `git status` 确认**不误提交** James 的 L4/L5 武将立绘(`assets/sprites/generals/*_4.png`/`*_5.png`)与 `gen-sprites.mjs` 中美化 Seg B 的改动 —— 那是并行流,本计划不碰。只 add 本计划相关文件。

---

## Self-Review

**Spec 覆盖:** ①吴卒/魏卒立绘 → Task 4(选图)+Task 6(生成);②骑兵 → Task 1(原型)+2(换皮)+3(入池)+4(渲染)+6(立绘);③第10波混编 → Task 5。门禁 → Task 7。全覆盖。

**类型/命名一致:** `enemySprite(e)` 在 Task 4 定义并在 drawEnemy 调用;`faction` 字段 Task 4 写入(enemy.js)、Task 4 读取(enemySprite);`cavalry` 贯穿 enemies/factions/chapterThemes/ENEMY_R/ENEMY_GEN 一致;sprite key `enemy_<faction>_<type>` 与 MANIFEST 键(`enemy_wu_footman` 等)一致。

**确定性:** Task 5 混编零新增 rng(顺取 pool + 整除均分),honor 已提交 spec §17.5;`deepEqual` 同 seed 用例守护。

**平衡:** cavalry 入池 + 混编改 wave>10 输出 → Task 7 sim 复验 winnable 50/50 为硬门禁,附回退调参路径。
