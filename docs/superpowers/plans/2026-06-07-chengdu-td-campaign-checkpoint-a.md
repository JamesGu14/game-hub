# 成都保卫战 · 50 关战役检查点 A 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 tower-defender 从 8 关手工战役升级为「50 关运行时确定性生成 + 5 关样板剧情端到端 + 塔升 L5 防数值爆炸 + 中断续玩 + 分章选关 + 图文故事卡」的首交付垂直切片,全部客观门禁(0 漏怪 / 50 关满防可通关 / balance-report / 全单测 / check-imports / 浏览器实玩)通过。

**Architecture:** `campaign.js`(紧凑 50 关谱)+ `boardTemplates.js`(6 套带 slots 板型)经 `waveGen.js`(纯函数·强制 seed)在 **加载期确定性展开**成与现 `LEVELS[i]` 完全同形的关卡对象;下游(渲染/存档/verify/winnable)零感知。塔升级上限 L3→L5,招牌技解锁点 `SIGNATURE_LEVEL=3` 与封顶 `MAX_TOWER_LEVEL=5` 解耦,`towerStats` 用**分段软倍率**(L1→L3 维持现曲线,L3→L5 软续)防 L5 秒杀。新增故事屏 `'story'`、中断续玩(`save.js` 快照)、分章分页选关。

**Tech Stack:** 纯 ES Module(无构建)、Canvas2D、Node 内置 `assert` 单测(`*.test.mjs`)、`mulberry32` 确定性 RNG(`core/rng.js`)。铁律:`core/*`·`data/*` render-free、自包含(check-imports 守)、加载期无 `Math.random`/`Date`。

---

## 架构决策(已锁,实现时勿偏离)

1. **L1→L3 数值完全不变**:`towerStats` 分段断点 = `SIGNATURE_LEVEL`(3);L1/L2/L3 公式与现状逐位相等(现有 towerStats/economy/winnable 的 L1-L3 断言原样保留)。
2. **软倍率起点值**(`balance.js`,balance-report 可调):`UPGRADE_DMG_MULT_SOFT=1.35`、`UPGRADE_INTERVAL_MULT_SOFT=0.95` → L5 DPS ≈ 2.0×L3(在 §5.3 目标带 2-2.5× 内);`range` 仍线性 `+0.5/级`(不影响 DPS,coverage 由 verify 保证)。
3. **造价**:`UPGRADE_COST_L4=2.4`、`UPGRADE_COST_L5=3.4`(× 基础 cost,起点,balance-report 可调)。
4. **招牌技 6 触点改 `>=SIGNATURE_LEVEL`**:combatSystem×1、attacks×3、damageCalc×1、towerPanel 招牌行×1、entityRenderer 充能条×1。**仍用 `MAX_TOWER_LEVEL`** 的 2 触点:economySystem(封顶判定)、towerPanel「满级」按钮。
5. **pathSubset 展开**:`level.paths`/`level.camps` 只含 subset;`level.slots` 用模板**全量** slots(覆盖 superset ⊇ subset,verify 必过)。
6. **全 50 关都生成且可玩**:门禁(verify/winnable)对全 50 关跑硬 assert;"骨架"指 45 关元数据由确定性 builder 程序化派生(非手写),5 样板关额外有 rich story + 手选 template/boss。
7. **续玩快照恢复粒度**:回到所在波的 **prep 起点**(不重建半场出兵 / 半成品 enemies),`save.js` 存 `phase`/`prepTimer` 但 `applyResume` 统一规整到 `prep`。理由:稳健、无新玩法、对一年级娃语义清晰。
8. **seed = level.id**(number)。`genWaves` 的 seed 为 required 有限数,`!Number.isFinite` 即 throw → 堵死 `rng.js` 的 `Date.now()^Math.random()` 非确定性 fallback 在加载期被触发。

---

## File Structure

### 新建
| 文件 | 职责 |
|---|---|
| `src/data/boardTemplates.js` | 6 套板型(twoCamp/threeCamp/fourCamp/fiveCamp/sixCamp/eightCamp),各含 `cols/rows/castle/camps/paths/slots`,种子自现 8 关布局。 |
| `src/data/waveGen.js` | 纯函数 `genWaves(template, params, seed)` → `waves[]`(强制 seed、前松后紧、末波 boss)。 |
| `src/data/campaign.js` | `CHAPTERS`(5 章)+ `CAMPAIGN`(50 记录:5 手写样板 + 45 程序化骨架)+ 故事文本。 |
| `src/ui/storyCard.js` | 开场故事卡 `storyCardLayout`/`hitStoryCard`/`drawStoryCard`(copy-and-own theme)。 |
| `tools/balance-report.mjs` | headless 经济/DPS/覆盖诊断器(带宽容带告警,非硬 assert)。 |
| `tools/dump-levels.mjs` | 展开后 `LEVELS` → JSON(审波次/diff)。 |
| `scripts/test.sh` | 串跑全部 `tests/*.test.mjs` + `node --check`。 |
| `tests/towerStats-l5.test.mjs` | 复用现 towerStats.test 扩 L4/L5(见 Task 1,**改现文件**非新建)。 |
| `tests/waveGen.test.mjs` | waveGen 确定性/波数/单调/末波 boss/前松后紧。 |
| `tests/boardTemplates.test.mjs` | 每模板过 verifyLevel(0 errors/0 leaks)+ 必带 slots。 |
| `tests/campaign.test.mjs` | 50 记录字段齐全、id 连续唯一、template/boss.id 合法、story 6 要素。 |
| `tests/storyCard.test.mjs` | stub ctx 不抛、layout/hit 自洽、save/restore 平衡。 |
| `tests/resume.test.mjs` | 续玩快照 写/读/清(注入假 storage)。 |

### 修改
| 文件 | 改动 |
|---|---|
| `src/data/balance.js` | `MAX_TOWER_LEVEL 3→5` + `SIGNATURE_LEVEL=3` + `UPGRADE_COST_L4/L5` + `UPGRADE_DMG_MULT_SOFT`/`UPGRADE_INTERVAL_MULT_SOFT`。 |
| `src/data/generals.js` | `towerStats` 分段软倍率。 |
| `src/systems/economySystem.js` | `upgradeCost` 支持 L4/L5(COST_MULT 表);封顶仍用 MAX。 |
| `src/systems/combatSystem.js` | 招牌冷却技 gate `MAX→SIGNATURE_LEVEL`。 |
| `src/systems/combat/attacks.js` | 赵云连射/马超击退/诸葛火烧 3 处 gate `MAX→SIGNATURE_LEVEL`。 |
| `src/systems/combat/damageCalc.js` | 黄忠暴击 gate `MAX→SIGNATURE_LEVEL`。 |
| `src/ui/towerPanel.js` | 招牌行 gate `MAX→SIGNATURE_LEVEL` + 文案「升至 L{SIGNATURE_LEVEL}」;「满级」按钮仍用 MAX。 |
| `src/render/entityRenderer.js` | 充能条 gate `MAX→SIGNATURE_LEVEL`。 |
| `src/data/bosses.js` | 扩到 20 条名将 boss。 |
| `src/data/levels.js` | 删手写 8 关 → `CAMPAIGN.map(expand)` 运行时展开。 |
| `src/core/save.js` | + `resumeSnapshot`/`writeResume`/`loadResume`/`clearResume` + browser 包装。 |
| `src/ui/levelSelect.js` | 分章/分页(章头 + 当前章 ≤10 卡 + ◀章▶ 导航);hit 返回 `{kind:'level',index}`\|`{kind:'chapter',delta}`\|null。 |
| `src/ui/pauseMenu.js` | + 「重看故事」项。 |
| `src/main.js` | + `'story'` 屏 + 续玩接线(visibilitychange/beforeunload 写、退出清)+ 章节态 + 重看故事。 |
| `tests/towerStats.test.mjs` | 加 L4/L5 断言 + L5/L3 DPS 守护带。 |
| `tests/economy-upgrade.test.mjs` | 封顶改 L5、加 L4/L5 造价(从 BAL 动态读)。 |
| `tests/signatureSkills.test.mjs` | `t.level=3` → `BAL.SIGNATURE_LEVEL`。 |
| `tests/levels-integrity.test.mjs` | 8→50:length、id 连续、逐关 verify、章节/波数/末波 boss、司马懿终局。 |
| `tests/levels-winnable.test.mjs` | 升满到 `MAX_TOWER_LEVEL`;guard = `Math.max(400000, waves.length*20000)`。 |
| `tests/levelSelect.test.mjs` | 重写为分章 API。 |

> `tests/levels-coverage.test.mjs`、`tests/progress.test.mjs`、`tests/attacks.test.mjs`、`tests/damageCalc.test.mjs` **无需改**:coverage 循环全 LEVELS 自动适配;progress 用显式 total;attacks/damageCalc 用 `level=3`(=`SIGNATURE_LEVEL`,仍满足 gate)。

---

## Task 1: L5 数值地基 — balance.js 常量 + towerStats 分段软倍率

**Files:**
- Modify: `src/data/balance.js:13`
- Modify: `src/data/generals.js:58-66`
- Test: `tests/towerStats.test.mjs`

- [ ] **Step 1: 改测试 — 加 L4/L5 断言 + DPS 守护带(先红)**

将 `tests/towerStats.test.mjs` 整体替换为:

```js
// tests/towerStats.test.mjs — 升级曲线 L1-L3 硬坡(§17.1)+ L4-L5 软坡防爆(§5.3)
// 运行：node games/tower-defender/tests/towerStats.test.mjs
import assert from 'node:assert';
import { GENERALS, towerStats } from '../src/data/generals.js';
import { BAL } from '../src/data/balance.js';

const h = GENERALS.huang;
const l1 = towerStats(h, 1), l2 = towerStats(h, 2), l3 = towerStats(h, 3);
const l4 = towerStats(h, 4), l5 = towerStats(h, 5);

// —— L1-L3 维持现曲线(逐位不变)——
assert.equal(l1.dmg, 9, 'L1 基准 dmg');
assert.equal(l1.range, 3.5, 'L1 射程');
assert.ok(Math.abs(l1.interval - 0.7) < 1e-9, 'L1 间隔');
assert.ok(Math.abs(l2.dmg - 14.4) < 1e-9, 'L2 dmg 9×1.6');
assert.equal(l2.range, 4.0, 'L2 射程 +0.5');
assert.ok(Math.abs(l2.interval - 0.63) < 1e-9, 'L2 间隔 ×0.9');
assert.ok(Math.abs(l3.dmg - 23.04) < 1e-9, 'L3 dmg 9×1.6²');
assert.equal(l3.range, 4.5, 'L3 射程 +1.0');
assert.ok(Math.abs(l3.interval - 0.567) < 1e-9, 'L3 间隔 ×0.81');

// —— L4-L5 软坡(dmg×SOFT、interval×SOFT,range 仍线性)——
assert.ok(Math.abs(l4.dmg - 23.04 * BAL.UPGRADE_DMG_MULT_SOFT) < 1e-9, 'L4 dmg = L3×SOFT');
assert.ok(Math.abs(l4.interval - 0.567 * BAL.UPGRADE_INTERVAL_MULT_SOFT) < 1e-9, 'L4 间隔 = L3×SOFT');
assert.equal(l4.range, 5.0, 'L4 射程 +1.5(线性)');
assert.ok(Math.abs(l5.dmg - 23.04 * BAL.UPGRADE_DMG_MULT_SOFT ** 2) < 1e-9, 'L5 dmg = L3×SOFT²');
assert.ok(Math.abs(l5.interval - 0.567 * BAL.UPGRADE_INTERVAL_MULT_SOFT ** 2) < 1e-9, 'L5 间隔 = L3×SOFT²');
assert.equal(l5.range, 5.5, 'L5 射程 +2.0(线性)');

// —— 防爆守护:L5 DPS / L3 DPS 必在 [1.8, 2.5](§5.3 目标 2-2.5×)——
const dps = (s) => s.dmg / s.interval;
const ratio = dps(l5) / dps(l3);
assert.ok(ratio >= 1.8 && ratio <= 2.5, `L5/L3 DPS=${ratio.toFixed(3)} 必在 [1.8,2.5] 防秒杀`);

// —— 单调:dmg 升、interval 降 ——
assert.ok(l3.dmg < l4.dmg && l4.dmg < l5.dmg, 'dmg 单调升');
assert.ok(l3.interval > l4.interval && l4.interval > l5.interval, 'interval 单调降');

console.log('ok towerStats');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/towerStats.test.mjs`
Expected: FAIL(`UPGRADE_DMG_MULT_SOFT` 未定义 / towerStats L4/L5 错误)。

- [ ] **Step 3: balance.js 加常量**

`src/data/balance.js` 第 13 行 `MAX_TOWER_LEVEL: 3,` 替换为:

```js
  MAX_TOWER_LEVEL: 5,         // 原地升级 L1→L5(封顶/满级判定用此)
  SIGNATURE_LEVEL: 3,         // 招牌技解锁/充能门槛(与封顶解耦;勿混用 MAX)
```

并在 `UPGRADE_COST_L3: 1.6,`(第 18 行)之后插入:

```js
  UPGRADE_COST_L4: 2.0,       // L4 造价 = 基础 cost ×2.0(保守起点;balance-report 跑完再上调)
  UPGRADE_COST_L5: 2.8,       // L5 造价 = 基础 cost ×2.8(同上)
  UPGRADE_DMG_MULT_SOFT: 1.35,     // [§5.3] L3→L5 软坡:每级伤害 ×1.35(防 DPS 爆炸)
  UPGRADE_INTERVAL_MULT_SOFT: 0.95,// [§5.3] L3→L5 软坡:每级间隔 ×0.95
```

- [ ] **Step 4: generals.js towerStats 分段**

`src/data/generals.js` 第 58-66 行(`// 升级曲线…` 注释起到函数结束)替换为:

```js
// 升级曲线(§17.1 硬坡 + §5.3 软坡)：断点=SIGNATURE_LEVEL。
// L1→SIGNATURE_LEVEL：dmg×1.6 · interval×0.9(原曲线不变)。
// SIGNATURE_LEVEL→MAX：软坡 dmg×SOFT · interval×SOFT(防 L5 秒杀)。range 全程线性 +0.5/级。
export function towerStats(g, level) {
  const HARD = Math.min(level, BAL.SIGNATURE_LEVEL) - 1;   // 硬坡指数 0..(SIGNATURE_LEVEL-1)
  const SOFT = Math.max(0, level - BAL.SIGNATURE_LEVEL);   // 软坡指数 0..(MAX-SIGNATURE_LEVEL)
  return {
    dmg: g.dmg * BAL.UPGRADE_DMG_MULT ** HARD * BAL.UPGRADE_DMG_MULT_SOFT ** SOFT,
    range: g.range + BAL.UPGRADE_RANGE_ADD * (level - 1),
    interval: g.interval * BAL.UPGRADE_INTERVAL_MULT ** HARD * BAL.UPGRADE_INTERVAL_MULT_SOFT ** SOFT,
  };
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `node tests/towerStats.test.mjs`
Expected: `ok towerStats`

- [ ] **Step 6: 提交**

```bash
git add src/data/balance.js src/data/generals.js tests/towerStats.test.mjs
git commit -m "feat(tower-defender): L5 数值地基 — SIGNATURE_LEVEL 解耦 + towerStats 分段软倍率(L5≈2×L3 DPS)"
```

---

## Task 2: 经济 L4/L5 造价 + 封顶解耦

**Files:**
- Modify: `src/systems/economySystem.js:28-33`
- Test: `tests/economy-upgrade.test.mjs`

- [ ] **Step 1: 改测试 — 封顶改 L5、加 L4/L5 造价(先红)**

将 `tests/economy-upgrade.test.mjs` 第一个 block(第 7-21 行,`// 升级造价…` 到对应 `}`)替换为:

```js
import { BAL } from '../src/data/balance.js';
import { GENERALS } from '../src/data/generals.js';

// 升级造价 L2..L5(× 基础 cost);满级=MAX_TOWER_LEVEL；invested 累加
{
  const s = { gold: 100000, towers: [] };
  tryBuild(s, { x: 1, y: 1 }, 'huang');           // -70；L1，invested 70
  const t = s.towers[0];
  const base = GENERALS.huang.cost;               // 70
  const costAt = (lvl) => Math.round(base * { 1: BAL.UPGRADE_COST_L2, 2: BAL.UPGRADE_COST_L3, 3: BAL.UPGRADE_COST_L4, 4: BAL.UPGRADE_COST_L5 }[lvl]);
  let invested = 70;
  for (let lvl = 1; lvl < BAL.MAX_TOWER_LEVEL; lvl++) {
    const c = costAt(lvl);
    assert.equal(upgradeCost(t), c, `L${lvl + 1} 造价 ${c}`);
    assert.equal(tryUpgrade(s, t), true, `升 L${lvl + 1}`);
    assert.equal(t.level, lvl + 1);
    invested += c;
    assert.equal(t.totalInvested, invested, `invested 累加到 ${invested}`);
  }
  assert.equal(t.level, BAL.MAX_TOWER_LEVEL, `已到满级 L${BAL.MAX_TOWER_LEVEL}`);
  assert.equal(tryUpgrade(s, t), false, '满级不可升');
  assert.equal(upgradeCost(t), Infinity, '满级造价 ∞');
}
```

(其余两个 block —「钱不够」「拆除返还」原样保留;import 行 `import assert`/`import {…economySystem.js}` 保留,新增的两个 import 放在文件顶部 import 区。)

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/economy-upgrade.test.mjs`
Expected: FAIL(`upgradeCost` 在 L3 返回 ∞ / L4 造价错)。

- [ ] **Step 3: economySystem.upgradeCost 支持 L4/L5**

`src/systems/economySystem.js` 第 27-33 行(`// —— [P2] 升级…` 注释 + `upgradeCost` 函数)替换为:

```js
// —— 升级造价(§17.1 L2/L3 + §5.3 L4/L5)。封顶仍由 MAX_TOWER_LEVEL 判定 ——
const UP_COST_MULT = { 1: BAL.UPGRADE_COST_L2, 2: BAL.UPGRADE_COST_L3, 3: BAL.UPGRADE_COST_L4, 4: BAL.UPGRADE_COST_L5 };
export function upgradeCost(tower) {
  if (tower.level >= BAL.MAX_TOWER_LEVEL) return Infinity;
  const base = GENERALS[tower.generalId].cost;
  return Math.round(base * UP_COST_MULT[tower.level]);
}
```

(`canUpgrade`/`tryUpgrade` 不变 — 已用 `MAX_TOWER_LEVEL`。)

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/economy-upgrade.test.mjs`
Expected: `ok economy-upgrade`

- [ ] **Step 5: 提交**

```bash
git add src/systems/economySystem.js tests/economy-upgrade.test.mjs
git commit -m "feat(tower-defender): 升级造价扩到 L4/L5(封顶仍用 MAX_TOWER_LEVEL)"
```

---

## Task 3: 招牌技与封顶解耦(6 触点 → SIGNATURE_LEVEL)

**Files:**
- Modify: `src/systems/combatSystem.js:18`
- Modify: `src/systems/combat/attacks.js:45,96,106`
- Modify: `src/systems/combat/damageCalc.js:10`
- Modify: `src/ui/towerPanel.js:64,69`
- Modify: `src/render/entityRenderer.js:101`
- Modify: `tests/signatureSkills.test.mjs`

- [ ] **Step 1: 改 signatureSkills.test — level 用 SIGNATURE_LEVEL(先红/防回归)**

`tests/signatureSkills.test.mjs`:在 import 区加 `import { BAL } from '../src/data/balance.js';`,把 4 处 `t.level = 3;` 全部替换为 `t.level = BAL.SIGNATURE_LEVEL;`(`replace_all`)。

- [ ] **Step 2: combatSystem 冷却技 gate**

`src/systems/combatSystem.js:18`:`tower.level >= BAL.MAX_TOWER_LEVEL` → `tower.level >= BAL.SIGNATURE_LEVEL`。

- [ ] **Step 3: attacks.js 三处被动 gate**

`src/systems/combat/attacks.js` 第 45、96、106 行,三处 `tower.level >= BAL.MAX_TOWER_LEVEL` → `tower.level >= BAL.SIGNATURE_LEVEL`(逐处确认上下文:45=赵云 qijin、96=马超 tuzhen、106=诸葛 huoshao)。

- [ ] **Step 4: damageCalc.js 暴击 gate**

`src/systems/combat/damageCalc.js:10`:`tower.level >= BAL.MAX_TOWER_LEVEL` → `tower.level >= BAL.SIGNATURE_LEVEL`。

- [ ] **Step 5: towerPanel 招牌行 gate + 文案;满级按钮保持 MAX**

`src/ui/towerPanel.js`:
- 第 64 行 `if (tower.level >= BAL.MAX_TOWER_LEVEL && g.signature)` → `if (tower.level >= BAL.SIGNATURE_LEVEL && g.signature)`。
- 第 69 行 `ctx.fillText('升满 L3 解锁招牌技', …)` → 改用模板字面量(常量改了文案自动跟随):`ctx.fillText(\`升至 L${BAL.SIGNATURE_LEVEL} 解锁招牌技\`, L.x + 12, L.y + 37);`。
- 第 75 行 `if (tower.level >= BAL.MAX_TOWER_LEVEL) { label = '满级'; … }` **保持不变**(满级=MAX)。

- [ ] **Step 6: entityRenderer 充能条 gate**

`src/render/entityRenderer.js:101`:`if (t.level >= BAL.MAX_TOWER_LEVEL && g.signature?.type === 'cooldown')` → `if (t.level >= BAL.SIGNATURE_LEVEL && g.signature?.type === 'cooldown')`。

- [ ] **Step 7: 跑全部战斗/招牌相关测试确认通过**

Run: `node tests/signatureSkills.test.mjs && node tests/attacks.test.mjs && node tests/damageCalc.test.mjs && node tests/combat.test.mjs && node tests/towerStats.test.mjs`
Expected: 全部 `ok …`(`attacks`/`damageCalc` 用 `level=3`=SIGNATURE_LEVEL,仍满足 gate)。

- [ ] **Step 8: node --check 改动文件**

Run: `node --check src/systems/combatSystem.js && node --check src/systems/combat/attacks.js && node --check src/systems/combat/damageCalc.js && node --check src/ui/towerPanel.js && node --check src/render/entityRenderer.js`
Expected: 无输出(语法 OK)。

- [ ] **Step 9: 提交**

```bash
git add src/systems/combatSystem.js src/systems/combat/attacks.js src/systems/combat/damageCalc.js src/ui/towerPanel.js src/render/entityRenderer.js tests/signatureSkills.test.mjs
git commit -m "refactor(tower-defender): 招牌技解锁 6 触点改 SIGNATURE_LEVEL(与封顶 MAX 解耦)"
```

---

## Task 4: boardTemplates.js — 6 套带 slots 板型

**Files:**
- Create: `src/data/boardTemplates.js`
- Test: `tests/boardTemplates.test.mjs`

板型几何 + slots **直接取自现 `levels.js`** 的 6 个布局常量与对应关卡 slots(已过 verify):twoCamp←L1、threeCamp←L3、fourCamp←L4、fiveCamp←L5、sixCamp←L6、eightCamp←L8。

- [ ] **Step 1: 写失败测试**

Create `tests/boardTemplates.test.mjs`:

```js
// tests/boardTemplates.test.mjs — 每板型几何过 verifyLevel(0 errors/0 leaks)+ 必带 slots
// 运行：node games/tower-defender/tests/boardTemplates.test.mjs
import assert from 'node:assert';
import { TEMPLATES } from '../src/data/boardTemplates.js';
import { verifyLevel } from '../tools/verify-levels.mjs';

const ids = Object.keys(TEMPLATES);
assert.ok(ids.length >= 4 && ids.length <= 16, `板型数 ${ids.length} 应在 4-16`);

for (const id of ids) {
  const t = TEMPLATES[id];
  assert.ok(Array.isArray(t.slots) && t.slots.length > 0, `${id} 必带 slots`);
  assert.ok(Array.isArray(t.camps) && t.camps.length > 0, `${id} 有 camps`);
  assert.ok(t.paths && Object.keys(t.paths).length === t.camps.length, `${id} camps↔paths 数一致`);
  // camp.id 与 path key 一一对应
  for (const c of t.camps) assert.ok(t.paths[c.id], `${id} camp ${c.id} 有同名 path`);
  // 构造最小关跑 verify(全路各一波 footman,验几何+slot 覆盖)
  const lv = {
    id: 'T_' + id, faction: 'nanman', scale: 1, startGold: 300, castleHp: 20,
    cols: t.cols, rows: t.rows, castle: t.castle, camps: t.camps, paths: t.paths, slots: t.slots,
    waves: [{ waveId: 1, startDelay: 0, spawns: t.camps.map((c) => ({ campId: c.id, pathId: c.id, enemyType: 'footman', count: 1, spawnInterval: 1, leadDelay: 0 })) }],
  };
  const r = verifyLevel(lv);
  assert.equal(r.errors.length, 0, `${id} verify errors: ${r.errors.join('; ')}`);
  assert.equal(r.leaks.length, 0, `${id} verify leaks: ${JSON.stringify(r.leaks)}`);
}

console.log('ok boardTemplates');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/boardTemplates.test.mjs`
Expected: FAIL(`Cannot find module …/boardTemplates.js`)。

- [ ] **Step 3: 写 boardTemplates.js**

Create `src/data/boardTemplates.js`(几何/slots 逐字段拷自 levels.js;`slots` 取自现 L1/L3/L4/L5/L6/L8):

```js
// data/boardTemplates.js — 板型池(检查点A·§5.2)。几何 + slots 种子自现 8 关布局(均已过 verify)。
// 每套:{ cols, rows, castle, camps, paths, slots }。camp.id === path key。
// levels.js 展开时按 pathSubset 取路子集,slots 用全量(覆盖 superset ⊇ subset,verify 必过)。
// 铁律:render-free、纯数据、无随机。

// —— 2 营(种子 L1 南蛮)——
const twoCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [{ id: 'a', c: 1, r: 2 }, { id: 'b', c: 22, r: 11 }],
  paths: {
    a: [{ x: 1, y: 2 }, { x: 1, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 9 }, { x: 4, y: 9 }, { x: 4, y: 11 }, { x: 11, y: 11 }, { x: 11, y: 7 }],
    b: [{ x: 22, y: 11 }, { x: 22, y: 8 }, { x: 15, y: 8 }, { x: 15, y: 4 }, { x: 19, y: 4 }, { x: 19, y: 2 }, { x: 12, y: 2 }, { x: 12, y: 6 }],
  },
  slots: [{ x: 6, y: 10 }, { x: 17, y: 3 }, { x: 10, y: 9 }, { x: 13, y: 4 }, { x: 3, y: 4 }, { x: 17, y: 7 }, { x: 6, y: 6 }, { x: 20, y: 9 }, { x: 9, y: 9 }, { x: 14, y: 4 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 9, y: 10 }, { x: 14, y: 3 }],
};

// —— 3 营(种子 L3 南蛮:2 营 + 顶部 c 路)——
const threeCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...twoCamp.camps, { id: 'c', c: 13, r: 0 }],
  paths: { ...twoCamp.paths, c: [{ x: 13, y: 0 }, { x: 13, y: 3 }, { x: 9, y: 3 }, { x: 9, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 9, y: 4 }, { x: 9, y: 6 }, { x: 11, y: 6 }] },
  slots: [{ x: 8, y: 3 }, { x: 13, y: 4 }, { x: 6, y: 10 }, { x: 17, y: 3 }, { x: 9, y: 8 }, { x: 3, y: 4 }, { x: 17, y: 7 }, { x: 20, y: 9 }, { x: 9, y: 10 }, { x: 5, y: 3 }, { x: 9, y: 7 }, { x: 11, y: 0 }, { x: 7, y: 3 }, { x: 10, y: 4 }, { x: 11, y: 4 }, { x: 10, y: 5 }, { x: 14, y: 3 }, { x: 11, y: 2 }, { x: 14, y: 4 }, { x: 8, y: 2 }, { x: 7, y: 6 }],
};

// —— 4 营(种子 L4 东吴:3 营 + 底中 d 路)——
const fourCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...threeCamp.camps, { id: 'd', c: 11, r: 13 }],
  paths: { ...threeCamp.paths, d: [{ x: 11, y: 13 }, { x: 16, y: 13 }, { x: 16, y: 9 }, { x: 12, y: 9 }, { x: 12, y: 7 }] },
  slots: [{ x: 8, y: 3 }, { x: 13, y: 4 }, { x: 10, y: 9 }, { x: 6, y: 10 }, { x: 15, y: 11 }, { x: 17, y: 3 }, { x: 3, y: 4 }, { x: 17, y: 7 }, { x: 10, y: 7 }, { x: 20, y: 9 }, { x: 5, y: 3 }, { x: 12, y: 11 }, { x: 11, y: 0 }, { x: 7, y: 3 }, { x: 10, y: 4 }, { x: 11, y: 4 }, { x: 10, y: 5 }, { x: 14, y: 3 }, { x: 11, y: 2 }, { x: 14, y: 4 }, { x: 8, y: 2 }, { x: 11, y: 5 }, { x: 7, y: 6 }],
};

// —— 5 营(种子 L5 东吴:4 营 + 右上 e 路)——
const fiveCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...fourCamp.camps, { id: 'e', c: 22, r: 1 }],
  paths: { ...fourCamp.paths, e: [{ x: 22, y: 1 }, { x: 18, y: 1 }, { x: 18, y: 6 }, { x: 12, y: 6 }] },
  slots: [{ x: 8, y: 3 }, { x: 13, y: 4 }, { x: 17, y: 3 }, { x: 10, y: 9 }, { x: 16, y: 7 }, { x: 6, y: 10 }, { x: 14, y: 11 }, { x: 3, y: 4 }, { x: 20, y: 9 }, { x: 10, y: 7 }, { x: 19, y: 0 }, { x: 5, y: 3 }, { x: 14, y: 12 }, { x: 11, y: 0 }, { x: 11, y: 4 }, { x: 14, y: 4 }, { x: 7, y: 3 }, { x: 10, y: 4 }, { x: 10, y: 5 }, { x: 13, y: 7 }, { x: 14, y: 7 }, { x: 14, y: 8 }, { x: 11, y: 5 }, { x: 13, y: 8 }],
};

// —— 6 营(种子 L6 曹魏:5 营 + 左下 f 路)——
const sixCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...fiveCamp.camps, { id: 'f', c: 1, r: 13 }],
  paths: { ...fiveCamp.paths, f: [{ x: 1, y: 13 }, { x: 4, y: 13 }, { x: 4, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 11 }, { x: 11, y: 11 }, { x: 11, y: 7 }] },
  slots: [{ x: 10, y: 9 }, { x: 6, y: 10 }, { x: 8, y: 3 }, { x: 13, y: 4 }, { x: 17, y: 3 }, { x: 16, y: 7 }, { x: 14, y: 11 }, { x: 3, y: 4 }, { x: 20, y: 9 }, { x: 10, y: 7 }, { x: 2, y: 12 }, { x: 19, y: 0 }, { x: 4, y: 6 }, { x: 14, y: 12 }, { x: 4, y: 0 }, { x: 11, y: 0 }, { x: 9, y: 9 }, { x: 9, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 8 }, { x: 9, y: 8 }, { x: 13, y: 7 }, { x: 13, y: 8 }, { x: 9, y: 7 }, { x: 11, y: 4 }, { x: 14, y: 4 }, { x: 7, y: 3 }, { x: 7, y: 10 }],
};

// —— 8 营(种子 L8 曹魏决战:7 营 + 右中 g、上中 h 路)——
const eightCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...sixCamp.camps, { id: 'g', c: 23, r: 7 }, { id: 'h', c: 8, r: 0 }],
  paths: {
    ...sixCamp.paths,
    g: [{ x: 23, y: 7 }, { x: 20, y: 7 }, { x: 20, y: 11 }, { x: 16, y: 11 }, { x: 16, y: 7 }, { x: 12, y: 7 }],
    h: [{ x: 8, y: 0 }, { x: 8, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 6 }, { x: 8, y: 6 }, { x: 11, y: 6 }],
  },
  // 种子 L8 精确 29 点(L8 已 ship 且过 verify,覆盖 a–h 全 8 路;**勿手加冗余点**,易落路上触发 verify 错误)
  slots: [{ x: 10, y: 9 }, { x: 7, y: 3 }, { x: 14, y: 8 }, { x: 6, y: 10 }, { x: 17, y: 3 }, { x: 11, y: 4 }, { x: 18, y: 10 }, { x: 3, y: 4 }, { x: 21, y: 9 }, { x: 7, y: 7 }, { x: 14, y: 12 }, { x: 16, y: 5 }, { x: 2, y: 12 }, { x: 11, y: 2 }, { x: 19, y: 0 }, { x: 2, y: 7 }, { x: 13, y: 4 }, { x: 6, y: 7 }, { x: 9, y: 7 }, { x: 9, y: 9 }, { x: 10, y: 8 }, { x: 8, y: 3 }, { x: 9, y: 8 }, { x: 10, y: 7 }, { x: 13, y: 8 }, { x: 9, y: 10 }, { x: 10, y: 5 }, { x: 10, y: 4 }, { x: 10, y: 10 }],
};

export const TEMPLATES = { twoCamp, threeCamp, fourCamp, fiveCamp, sixCamp, eightCamp };
```

> ⚠ **eightCamp.slots**:用 L8 的**精确 29 点**(L8 已 ship 且过 verify,本就覆盖 a–h 全 8 路含 g/h)。**切勿手加冗余点**——早期版本加的 `{20,7}`/`{6,2}` 恰落在 g/h 路顶点上,会触发"将位落在蜀道"错误。Step 4 verify 仍兜底:万一 leak,用 `node tools/suggest-slots.mjs` 补点。

- [ ] **Step 4: 跑测试;若 eightCamp 漏怪则补 slots**

Run: `node tests/boardTemplates.test.mjs`
Expected: `ok boardTemplates`。

若 eightCamp(或任何模板)报 leaks:临时写 `tools/_tmpl-slots.mjs` 引入 TEMPLATES、对漏的模板用 suggest-slots 的贪心(已在 `tools/suggest-slots.mjs`)生成覆盖 slots 数组,粘回该模板 `slots`,重跑至 0 leaks。删临时文件。

- [ ] **Step 5: 提交**

```bash
git add src/data/boardTemplates.js tests/boardTemplates.test.mjs
git commit -m "feat(tower-defender): boardTemplates 6 套带 slots 板型(种子自现 8 关,过 verify)"
```

---

## Task 5: waveGen.js — 纯函数确定性波次生成器

**Files:**
- Create: `src/data/waveGen.js`
- Test: `tests/waveGen.test.mjs`

- [ ] **Step 1: 写失败测试**

Create `tests/waveGen.test.mjs`:

```js
// tests/waveGen.test.mjs — 确定性/波数/单调/末波 boss/前松后紧/seed 强制(§8/§9.1)
// 运行：node games/tower-defender/tests/waveGen.test.mjs
import assert from 'node:assert';
import { genWaves } from '../src/data/waveGen.js';
import { TEMPLATES } from '../src/data/boardTemplates.js';
import { ENEMIES } from '../src/data/enemies.js';

const tmpl = TEMPLATES.fourCamp;
const params = { waveCount: 24, difficulty: 1.6, enemyTiers: ['footman', 'wolf', 'heavy', 'flyer'], boss: { id: 'caocao', name: '曹操', hpMult: 1.3 } };
const totalCount = (waves) => waves.reduce((n, w) => n + w.spawns.reduce((m, s) => m + (s.enemyType === 'boss' ? 0 : s.count), 0), 0);

// seed 强制:非有限数即 throw
assert.throws(() => genWaves(tmpl, params, undefined), /seed/, 'seed 缺失 throw');
assert.throws(() => genWaves(tmpl, params, null), /seed/, 'seed null throw');
assert.throws(() => genWaves(tmpl, params, NaN), /seed/, 'seed NaN throw');

// 确定性:同 seed → 深度相等;异 seed → 不等
const a = genWaves(tmpl, params, 14), b = genWaves(tmpl, params, 14), c = genWaves(tmpl, params, 15);
assert.deepEqual(a, b, '同 seed 同输出');
assert.notDeepEqual(a, c, '异 seed 异输出');

// 波数正确
assert.equal(a.length, 24, '波数 = waveCount');

// 末波含 boss + 透传字段(id/name/hpMult)
const lastSpawns = a[a.length - 1].spawns;
const bossSp = lastSpawns.find((s) => s.enemyType === 'boss');
assert.ok(bossSp, '末波含 boss');
assert.equal(bossSp.id, 'caocao'); assert.equal(bossSp.name, '曹操'); assert.equal(bossSp.hpMult, 1.3);
// 末波无飞兵(沿用「无飞兵同波」)
assert.ok(lastSpawns.every((s) => s.enemyType !== 'flyer'), '末波无飞兵');

// 前松后紧:首波总量 < 倒数第二波(非 boss 波)总量
const w0 = a[0].spawns.reduce((m, s) => m + s.count, 0);
const wLate = a[a.length - 2].spawns.reduce((m, s) => m + s.count, 0);
assert.ok(w0 < wLate, `前松后紧:首波 ${w0} < 后波 ${wLate}`);
// 首波单路教学
assert.equal(a[0].spawns.length, 1, '首波单路(教学)');

// 章内单调:高 difficulty 总兵力 > 低 difficulty
const lo = genWaves(tmpl, { ...params, difficulty: 0 }, 14);
const hi = genWaves(tmpl, { ...params, difficulty: 3 }, 14);
assert.ok(totalCount(hi) > totalCount(lo), 'difficulty 升 → 总兵力升');

// 合法性:每 spawn campId/pathId ∈ 模板,enemyType ∈ ENEMIES
const lanes = new Set(tmpl.camps.map((c) => c.id));
for (const w of a) for (const s of w.spawns) {
  assert.ok(lanes.has(s.campId), `campId ${s.campId} 合法`);
  assert.ok(lanes.has(s.pathId), `pathId ${s.pathId} 合法`);
  assert.ok(ENEMIES[s.enemyType], `enemyType ${s.enemyType} 合法`);
  assert.ok(s.count >= 1 && s.spawnInterval > 0, '数量/间隔正');
}
// 每关 ≥20 波(本例 24,断言 waveCount 透传)
assert.ok(a.length >= 20, '≥20 波');

console.log('ok waveGen');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/waveGen.test.mjs`
Expected: FAIL(`Cannot find module …/waveGen.js`)。

- [ ] **Step 3: 写 waveGen.js**

Create `src/data/waveGen.js`:

```js
// data/waveGen.js — 纯函数·确定性波次生成器(检查点A·§8)。
// genWaves(template, params, seed) → waves[](与手写 levels.js 完全同形)。
// 铁律:seed 为 required 有限数;缺失即 throw(堵 rng.js 的 Date/Math.random fallback,加载期零随机外泄)。
// template:{ camps:[{id}], paths:{id:[...]} }(已是 pathSubset 后的子集)。campId === pathId。
// params:{ waveCount, difficulty, enemyTiers, boss:{id,name,hpMult,bossSkills?} }。
import { makeRng } from '../core/rng.js';

const lerp = (a, b, t) => a + (b - a) * t;

// Fisher-Yates(注入 rng,确定性)
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
  return a;
}

export function genWaves(template, params, seed) {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new Error('genWaves: seed 必须为有限数(确定性铁律)');
  }
  const { waveCount, difficulty, enemyTiers, boss } = params;
  const rng = makeRng(seed);
  const lanes = template.camps.map((c) => c.id);          // campId===pathId
  const tiers = enemyTiers.filter((t) => t !== 'boss');    // 可用兵种池(不含 boss)
  const waves = [];

  for (let i = 0; i < waveCount; i++) {
    const last = i === waveCount - 1;
    const intensity = waveCount > 1 ? i / (waveCount - 1) : 0;   // 0→1
    const diffK = 1 + difficulty * 0.18;                        // 章内难度抬升

    // 同步开火路数:前松(1)→后紧(≤min(lanes,3))
    const maxLanes = Math.min(lanes.length, 3);
    const laneCount = Math.max(1, Math.round(lerp(1, maxLanes, intensity)));
    const chosenLanes = shuffle(lanes, rng).slice(0, laneCount);

    // 解锁兵种:前松(仅 tiers[0])→后紧(全 tiers),随 intensity 渐增(教学曲线)
    const unlocked = Math.max(1, Math.min(tiers.length, 1 + Math.floor(intensity * tiers.length)));
    const pool = tiers.slice(0, unlocked);

    // 每路数量:前松(~5)→后紧(~16)× 难度
    const baseCount = Math.round(lerp(5, 16, intensity) * diffK);
    const spawnInterval = +lerp(1.2, 0.5, intensity).toFixed(2);

    const spawns = chosenLanes.map((lane, k) => {
      let type = intensity < 0.18 ? 'footman' : pool[Math.floor(rng() * pool.length)];
      if (last && type === 'flyer') type = 'footman';          // 末波无飞兵
      const count = Math.max(2, baseCount + (Math.floor(rng() * 3) - 1));   // ±1 抖动
      return { campId: lane, pathId: lane, enemyType: type, count, spawnInterval, leadDelay: k };
    });

    // 末波:boss + 护卫(boss 落首条 lane,leadDelay 靠后)
    if (last) {
      spawns.push({ campId: chosenLanes[0], pathId: chosenLanes[0], enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 6, ...boss });
    }

    waves.push({ waveId: i + 1, startDelay: i === 0 ? 0 : Math.round(lerp(6, 9, intensity)), spawns });
  }
  return waves;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/waveGen.test.mjs`
Expected: `ok waveGen`

- [ ] **Step 5: 提交**

```bash
git add src/data/waveGen.js tests/waveGen.test.mjs
git commit -m "feat(tower-defender): waveGen 纯函数确定性波次生成器(强制 seed·前松后紧·末波 boss)"
```

---

## Task 6: bosses.js — 扩到 20 条名将

**Files:**
- Modify: `src/data/bosses.js`
- Test: `tests/bosses.test.mjs`(新建)

- [ ] **Step 1: 写失败测试**

Create `tests/bosses.test.mjs`:

```js
// tests/bosses.test.mjs — boss 名册完整性(§5.2 扩 15-20)
// 运行：node games/tower-defender/tests/bosses.test.mjs
import assert from 'node:assert';
import { BOSSES } from '../src/data/bosses.js';

const ids = Object.keys(BOSSES);
assert.ok(ids.length >= 15 && ids.length <= 20, `boss 数 ${ids.length} 应在 15-20`);
for (const id of ids) {
  const b = BOSSES[id];
  assert.equal(b.id, id, `${id} id 自洽`);
  assert.ok(typeof b.name === 'string' && b.name.length, `${id} 有 name`);
  assert.ok(typeof b.hpMult === 'number' && b.hpMult >= 1, `${id} hpMult≥1`);
}
// 司马懿仍带双主动技
assert.ok(BOSSES.simayi.bossSkills?.includes('summon') && BOSSES.simayi.bossSkills?.includes('stunTower'), '司马懿 召唤+震慑');
// 5 样板战 boss 必在册
for (const id of ['xiahoudun', 'zhangliao', 'caocao', 'xiahouyuan', 'luxun']) {
  assert.ok(BOSSES[id], `样板战 boss ${id} 在册`);
}

console.log('ok bosses');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/bosses.test.mjs`
Expected: FAIL(boss 数 8 < 15 / `xiahoudun` 不在册)。

- [ ] **Step 3: 扩 bosses.js**

`src/data/bosses.js` 的 `export const BOSSES = { … };` 整体替换为(保留现 8 条,新增 12 条 → 20):

```js
export const BOSSES = {
  // —— 现有 8 条(Phase 1-3)——
  mulu: { id: 'mulu', name: '木鹿大王', hpMult: 1.0 },
  wutugu: { id: 'wutugu', name: '兀突骨', hpMult: 1.3 },
  ganning: { id: 'ganning', name: '甘宁', hpMult: 1.0 },
  luxun: { id: 'luxun', name: '陆逊', hpMult: 1.2 },
  zhangliao: { id: 'zhangliao', name: '张辽', hpMult: 1.0 },
  zhanghe: { id: 'zhanghe', name: '张郃', hpMult: 1.0 },
  xuchu: { id: 'xuchu', name: '许褚', hpMult: 1.1 },
  simayi: { id: 'simayi', name: '司马懿', hpMult: 1.6, bossSkills: ['summon', 'stunTower'] },
  // —— 检查点A 扩充 12 条(覆盖 50 关战役主将;美术 v1 fallback 色块+名)——
  huaxiong: { id: 'huaxiong', name: '华雄', hpMult: 1.0 },
  lvbu: { id: 'lvbu', name: '吕布', hpMult: 1.4 },
  yanliang: { id: 'yanliang', name: '颜良', hpMult: 1.0 },
  wenchou: { id: 'wenchou', name: '文丑', hpMult: 1.0 },
  caocao: { id: 'caocao', name: '曹操', hpMult: 1.3 },
  xiahoudun: { id: 'xiahoudun', name: '夏侯惇', hpMult: 1.1 },
  xiahouyuan: { id: 'xiahouyuan', name: '夏侯渊', hpMult: 1.1 },
  caoren: { id: 'caoren', name: '曹仁', hpMult: 1.2 },
  zhangren: { id: 'zhangren', name: '张任', hpMult: 1.0 },
  menghuo: { id: 'menghuo', name: '孟获', hpMult: 1.1 },
  sunquan: { id: 'sunquan', name: '孙权', hpMult: 1.2 },
  zhuran: { id: 'zhuran', name: '朱然', hpMult: 1.0 },
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/bosses.test.mjs`
Expected: `ok bosses`

- [ ] **Step 5: 提交**

```bash
git add src/data/bosses.js tests/bosses.test.mjs
git commit -m "feat(tower-defender): boss 名册扩到 20 条名将(覆盖 50 关战役主将)"
```

---

## Task 7: campaign.js — 5 章 + 50 关谱(5 样板 + 45 骨架)

**Files:**
- Create: `src/data/campaign.js`
- Test: `tests/campaign.test.mjs`

CHAPTERS 5 章,每章承载 10 关(共 50)。`CAMPAIGN` 由 5 个**手写样板关**(博望坡 ch1 / 长坂坡 ch2 / 赤壁 ch3 / 定军山 ch4 / 夷陵 ch5,各落本章首关 id=1/11/21/31/41)+ **程序化骨架 builder**(其余 45 关,按章派生 template/faction/enemyTiers/boss/difficulty/waveCount + 轻量自动 story)合成。全程确定性(仅 index 数学,无 Math.random/Date)。

- [ ] **Step 1: 写失败测试**

Create `tests/campaign.test.mjs`:

```js
// tests/campaign.test.mjs — 50 关谱完整性(§6/§9.1)
// 运行：node games/tower-defender/tests/campaign.test.mjs
import assert from 'node:assert';
import { CHAPTERS, CAMPAIGN } from '../src/data/campaign.js';
import { TEMPLATES } from '../src/data/boardTemplates.js';
import { BOSSES } from '../src/data/bosses.js';
import { ENEMIES } from '../src/data/enemies.js';

const VALID_FACTIONS = new Set(['nanman', 'wu', 'wei']);

assert.equal(CHAPTERS.length, 5, '5 章');
assert.equal(CAMPAIGN.length, 50, '50 关');

// id 连续唯一 1..50
const ids = CAMPAIGN.map((c) => c.id);
assert.deepEqual(ids, Array.from({ length: 50 }, (_, i) => i + 1), 'id 连续唯一 1..50');

const STORY_KEYS = ['hook', 'year', 'place', 'sides', 'result', 'idiom'];
const sampleIds = new Set([1, 11, 21, 31, 41, 50]);   // 6 样板关(含 L50 司马懿终局)

for (const c of CAMPAIGN) {
  assert.ok(c.name && c.name.length, `L${c.id} 有 name`);
  assert.ok(c.chapter >= 1 && c.chapter <= 5, `L${c.id} chapter 合法`);
  assert.ok(VALID_FACTIONS.has(c.faction), `L${c.id} faction 合法`);
  assert.ok(TEMPLATES[c.templateId], `L${c.id} templateId ${c.templateId} 合法`);
  assert.ok(c.waveCount >= 20, `L${c.id} waveCount≥20`);
  assert.ok(typeof c.difficulty === 'number', `L${c.id} difficulty 数`);
  assert.ok(Array.isArray(c.enemyTiers) && c.enemyTiers.length, `L${c.id} enemyTiers 非空`);
  assert.equal(c.enemyTiers[0], 'footman', `L${c.id} enemyTiers[0]=footman(教学保底)`);
  for (const t of c.enemyTiers) assert.ok(ENEMIES[t], `L${c.id} enemyTier ${t} 合法`);
  assert.ok(c.boss && BOSSES[c.boss.id], `L${c.id} boss.id ${c.boss?.id} 在册`);
  // pathSubset(若有)⊆ 模板路
  if (c.pathSubset) for (const p of c.pathSubset) assert.ok(TEMPLATES[c.templateId].paths[p], `L${c.id} pathSubset ${p} ∈ 模板`);
  // story 6 键齐全(全关)
  assert.ok(c.story, `L${c.id} 有 story`);
  for (const k of STORY_KEYS) assert.ok(typeof c.story[k] === 'string', `L${c.id} story.${k} 是字符串`);
  // 'portrait' 键存在(null 或字符串)
  assert.ok('portrait' in c.story, `L${c.id} story.portrait 键存在`);
  // 样板关 story 非占位(hook ≥4 字、idiom 非空且非 '—')
  if (sampleIds.has(c.id)) {
    assert.ok(c.story.hook.length >= 4 && c.story.idiom && c.story.idiom !== '—', `样板 L${c.id} story 充实`);
  }
}

// 章节覆盖 1..5 各 10 关
for (let ch = 1; ch <= 5; ch++) {
  assert.equal(CAMPAIGN.filter((c) => c.chapter === ch).length, 10, `第${ch}章 10 关`);
}
// 终关 50 = 司马懿(带主动技)
assert.equal(CAMPAIGN[49].boss.id, 'simayi', 'L50 boss=司马懿');

// difficulty 全局单调非降(章带 positional 公式,无锯齿 → 不触发 balance-report 单调告警)
for (let i = 1; i < CAMPAIGN.length; i++) {
  assert.ok(CAMPAIGN[i].difficulty >= CAMPAIGN[i - 1].difficulty, `L${i + 1} difficulty 不低于 L${i}`);
}

console.log('ok campaign');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/campaign.test.mjs`
Expected: FAIL(`Cannot find module …/campaign.js`)。

- [ ] **Step 3: 写 campaign.js**

Create `src/data/campaign.js`:

```js
// data/campaign.js — 50 关编年战役谱(检查点A·§6)。
// 5 章 × 10 关。6 手写样板关(博望坡/长坂坡/赤壁/定军山/夷陵 各章首 + L50 上方谷·司马懿)有 rich story;
// 其余 44 关由确定性 builder 按章派生(template/faction/enemyTiers/boss + 轻量 story)。
// difficulty/waveCount 全部由 positionParams(章带) 统一计算 → 全 50 关单调,样板只覆盖内容字段。
// 铁律:render-free、纯数据、加载期无 Math.random/Date(仅 index 数学)。
// 故事铁律:原创、史实向、一年级能懂、不抄受版权文本;成语取公共常识。
// 框架声明(统一话术)由 storyCard.js 固定渲染,避免误导孩子把"守成都"当史实。

export const CHAPTERS = [
  { id: 1, title: '天下大乱·诸侯并起', faction: 'wei', templates: ['twoCamp', 'threeCamp'], tiers: ['footman', 'wolf'], bossPool: ['huaxiong', 'lvbu', 'menghuo'], diffLo: 0.0, diffHi: 0.8 },
  { id: 2, title: '官渡之争·以弱胜强', faction: 'wei', templates: ['threeCamp', 'fourCamp'], tiers: ['footman', 'wolf', 'heavy'], bossPool: ['yanliang', 'wenchou', 'zhangliao'], diffLo: 0.8, diffHi: 1.6 },
  { id: 3, title: '火烧赤壁·三分天下', faction: 'wu', templates: ['fourCamp', 'fiveCamp'], tiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman'], bossPool: ['caocao', 'ganning', 'sunquan'], diffLo: 1.6, diffHi: 2.4 },
  { id: 4, title: '进取西川·汉中之战', faction: 'wei', templates: ['fiveCamp', 'sixCamp'], tiers: ['footman', 'wolf', 'heavy', 'tengjia'], bossPool: ['xiahouyuan', 'zhangren', 'caoren'], diffLo: 2.4, diffHi: 3.2 },
  { id: 5, title: '夷陵之火·六出祁山', faction: 'wu', templates: ['sixCamp', 'eightCamp'], tiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'tengjia'], bossPool: ['luxun', 'zhuran', 'zhanghe', 'xuchu'], diffLo: 3.2, diffHi: 4.0 },
];

const FACTION_CN = { nanman: '南蛮', wu: '东吴', wei: '曹魏' };

// 位置 → difficulty/waveCount(章带内线性、跨章接续 → 全 50 关单调,无锯齿)。k=0..9 章内位置。
function positionParams(ch, k) {
  const C = CHAPTERS[ch - 1];
  const p = k / 9;
  return {
    difficulty: +(C.diffLo + (C.diffHi - C.diffLo) * p).toFixed(2),
    waveCount: 20 + Math.round(p * (ch - 1)),   // 20→(20+章号-1),后章更长,恒 ≥20
  };
}

// —— 6 手写样板关(键=id;只覆盖"内容"字段;difficulty/waveCount 由 positionParams 给 → 全局单调)——
// 落点:各章首关 1/11/21/31/41(章首=该章最易,适合开篇)+ L50 终局(司马懿,验主动技管线)。
const SAMPLES = {
  1: {
    name: '博望坡之战', faction: 'wei', templateId: 'threeCamp', pathSubset: ['a', 'b', 'c'], enemyTiers: ['footman', 'wolf'],
    boss: { id: 'xiahoudun', name: '夏侯惇', hpMult: 1.1 },
    story: { hook: '初出茅庐第一计,一把火烧退曹军!', year: '公元202年', place: '新野·博望坡', sides: '刘备军 vs 夏侯惇', result: '蜀军以火攻大胜', idiom: '初出茅庐', portrait: 'zhuge' },
  },
  11: {
    name: '长坂坡之战', faction: 'wei', templateId: 'fourCamp', pathSubset: ['a', 'b', 'c', 'd'], enemyTiers: ['footman', 'wolf', 'heavy'],
    boss: { id: 'zhangliao', name: '张辽', hpMult: 1.0 },
    story: { hook: '赵云七进七出,怀里护着小阿斗!', year: '公元208年', place: '当阳·长坂坡', sides: '刘备军 vs 曹操追兵', result: '赵云单骑救主', idiom: '单骑救主', portrait: 'zhao' },
  },
  21: {
    name: '赤壁之战', faction: 'wu', templateId: 'fiveCamp', pathSubset: ['a', 'b', 'c', 'd', 'e'], enemyTiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman'],
    boss: { id: 'caocao', name: '曹操', hpMult: 1.3 },
    story: { hook: '借东风一把火,烧退曹操八十万大军!', year: '公元208年', place: '长江·赤壁', sides: '孙刘联军 vs 曹操', result: '曹操大败,三分天下', idiom: '火烧赤壁', portrait: 'zhuge' },
  },
  31: {
    name: '定军山之战', faction: 'wei', templateId: 'sixCamp', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f'], enemyTiers: ['footman', 'wolf', 'heavy', 'tengjia'],
    boss: { id: 'xiahouyuan', name: '夏侯渊', hpMult: 1.1 },
    story: { hook: '老将黄忠一刀斩下夏侯渊!', year: '公元219年', place: '汉中·定军山', sides: '刘备军 vs 夏侯渊', result: '黄忠斩将夺山', idiom: '老当益壮', portrait: 'huang' },
  },
  41: {
    name: '夷陵之战', faction: 'wu', templateId: 'eightCamp', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], enemyTiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'tengjia'],
    boss: { id: 'luxun', name: '陆逊', hpMult: 1.2 },
    story: { hook: '陆逊火烧连营七百里!', year: '公元222年', place: '夷陵·猇亭', sides: '刘备军 vs 陆逊', result: '蜀军连营被焚', idiom: '火烧连营', portrait: null },
  },
  50: {
    name: '上方谷·五丈原', faction: 'wei', templateId: 'eightCamp', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], enemyTiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'tengjia'],
    boss: { id: 'simayi', name: '司马懿', hpMult: 1.6 },   // bossSkills 由 BOSSES.simayi 透传(summon+stunTower)
    story: { hook: '火烧上方谷,天降大雨救了司马懿!', year: '公元234年', place: '郿县·五丈原', sides: '诸葛亮 vs 司马懿', result: '诸葛亮病逝军中,北伐落幕', idiom: '死诸葛吓走活仲达', portrait: 'zhuge' },
  },
};

// —— 骨架 builder:第 ch 章第 k 关(k=0..9)→ 内容字段(difficulty/waveCount 不在此,由 positionParams 给)——
function buildSkeleton(ch, k) {
  const C = CHAPTERS[ch - 1];
  const p = k / 9;
  const templateId = C.templates[k < 5 ? 0 : 1];   // 章内前半 templates[0]、后半 templates[1]
  const tierN = Math.max(1, Math.min(C.tiers.length, 1 + Math.round(p * (C.tiers.length - 1))));
  const bossId = C.bossPool[k % C.bossPool.length];
  const facCn = FACTION_CN[C.faction];
  return {
    name: `${C.title.split('·')[0]}·第${k + 1}阵`,
    faction: C.faction, templateId, enemyTiers: C.tiers.slice(0, tierN),
    boss: { id: bossId },   // levels.js 展开时 { ...BOSSES[id], ...boss } 补 name/hpMult
    story: {
      hook: `${C.title.split('·')[1] || '守护成都'},守住我们的家!`,
      year: '三国时期', place: C.title.split('·')[0],
      sides: `蜀汉六将 vs ${facCn}军`, result: '待你来改写', idiom: '众志成城', portrait: null,
    },
  };
}

// —— 合成 50 关:difficulty/waveCount 统一由 positionParams 给(单调);内容来自 SAMPLES 或 buildSkeleton ——
export const CAMPAIGN = Array.from({ length: 50 }, (_, i) => {
  const id = i + 1;
  const ch = Math.floor(i / 10) + 1;
  const k = i % 10;
  const pos = positionParams(ch, k);
  const content = SAMPLES[id] || buildSkeleton(ch, k);
  return { id, chapter: ch, waveCount: pos.waveCount, difficulty: pos.difficulty, ...content };
});
```

> 注:difficulty/waveCount **不在 SAMPLES 里写死**,统一由 `positionParams(ch,k)` 算(章带内线性、跨章接续)→ 全 50 关 difficulty 单调非降,消除"骨架→样板"章内锯齿(否则触发 balance-report 单调告警)。`{ ...content }` 后置展开,故 SAMPLES/buildSkeleton 的 name/faction/templateId/enemyTiers/boss/story 生效,但不含 difficulty/waveCount(用 pos 的)。

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/campaign.test.mjs`
Expected: `ok campaign`

- [ ] **Step 5: 提交**

```bash
git add src/data/campaign.js tests/campaign.test.mjs
git commit -m "feat(tower-defender): campaign.js — 5 章 50 关谱(5 样板战 + 45 确定性骨架)"
```

---

## Task 8: levels.js 运行时展开 + 受影响测试(integrity/winnable)

**Files:**
- Modify: `src/data/levels.js`(整体重写)
- Modify: `tests/levels-integrity.test.mjs`(整体重写)
- Modify: `tests/levels-winnable.test.mjs:11-24`

- [ ] **Step 1: 重写 levels.js 为运行时展开**

`src/data/levels.js` 整体替换为:

```js
// data/levels.js — 运行时确定性展开(检查点A·§5.1)。
// CAMPAIGN(50 关谱)× boardTemplates(板型)× waveGen(确定性波次)→ LEVELS。
// 对外仍 export const LEVELS(与现手写关完全同形);下游(渲染/存档/verify/winnable)零感知。
// 铁律:加载期无 Math.random/Date — waveGen seed=level.id(有限数),genWaves 强制确定性。
import { CAMPAIGN } from './campaign.js';
import { TEMPLATES } from './boardTemplates.js';
import { genWaves } from './waveGen.js';
import { BOSSES } from './bosses.js';

// difficulty → 关参数(§5.1 公式;起点,balance-report 可调)
export function difficultyParams(difficulty) {
  return {
    scale: +(1 + difficulty * 0.5).toFixed(3),
    startGold: Math.round(300 + difficulty * 150),
    castleHp: 20,
  };
}

function expand(c) {
  const tmpl = TEMPLATES[c.templateId];
  if (!tmpl) throw new Error(`levels: 未知 templateId '${c.templateId}' (L${c.id})`);
  const subset = (c.pathSubset && c.pathSubset.length) ? c.pathSubset : Object.keys(tmpl.paths);
  const paths = {}; for (const id of subset) paths[id] = tmpl.paths[id];
  const camps = tmpl.camps.filter((cp) => subset.includes(cp.id));
  // boss:bosses.js 提供 name/hpMult/bossSkills;campaign 可覆盖 name/hpMult
  const baseBoss = BOSSES[c.boss.id];
  if (!baseBoss) throw new Error(`levels: 未知 boss.id '${c.boss.id}' (L${c.id})`);
  const boss = { ...baseBoss, ...c.boss };
  const { scale, startGold, castleHp } = difficultyParams(c.difficulty);
  const waves = genWaves(
    { ...tmpl, camps, paths },
    { waveCount: c.waveCount, difficulty: c.difficulty, enemyTiers: c.enemyTiers, boss },
    c.id,                                   // seed = level.id(确定性)
  );
  return {
    id: c.id, name: c.name, chapter: c.chapter, faction: c.faction,
    scale, startGold, castleHp,
    cols: tmpl.cols, rows: tmpl.rows, castle: tmpl.castle,
    camps, paths, slots: tmpl.slots, waves,
  };
}

export const LEVELS = CAMPAIGN.map(expand);
```

- [ ] **Step 2: node --check + verify-levels + coverage(展开正确性首验)**

Run: `node --check src/data/levels.js && node tools/verify-levels.mjs`
Expected: 打印 50 行 `✅ L1..L50`,末行 `✅ 全部 50 关通过(无漏怪+完整)`,exit 0。

若某关报 leaks(多半 pathSubset 选了模板里 slots 覆盖不足的组合):调整该 campaign 记录的 `pathSubset`(选 slots 覆盖更全的路子集),或在 Task 4 给对应模板补 slots,重跑至全绿。

- [ ] **Step 3: 重写 levels-integrity.test 为 50 关**

`tests/levels-integrity.test.mjs` 整体替换为:

```js
// tests/levels-integrity.test.mjs — 50 关战役完整性(§6/§9.2)
// 运行：node games/tower-defender/tests/levels-integrity.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { CHAPTERS } from '../src/data/campaign.js';
import { verifyLevel } from '../tools/verify-levels.mjs';

assert.equal(LEVELS.length, 50, '50 关战役');

// id 连续唯一 1..50
assert.deepEqual(LEVELS.map((l) => l.id), Array.from({ length: 50 }, (_, i) => i + 1), 'id 连续唯一');

const VALID_FACTIONS = new Set(['nanman', 'wu', 'wei']);
for (const lv of LEVELS) {
  const r = verifyLevel(lv);
  assert.equal(r.errors.length, 0, `L${lv.id} 完整性错误: ${r.errors.join('; ')}`);
  assert.equal(r.leaks.length, 0, `L${lv.id} 漏怪: ${JSON.stringify(r.leaks)}`);
  assert.ok(VALID_FACTIONS.has(lv.faction), `L${lv.id} 势力合法`);
  assert.ok(lv.chapter >= 1 && lv.chapter <= CHAPTERS.length, `L${lv.id} 章号合法`);
  assert.ok(lv.waves.length >= 20, `L${lv.id} ≥20 波(实际 ${lv.waves.length})`);
  // 末波含 boss
  const lastSpawns = lv.waves[lv.waves.length - 1].spawns;
  assert.ok(lastSpawns.some((s) => s.enemyType === 'boss'), `L${lv.id} 末波含 boss`);
}

// 每章 10 关
for (const ch of CHAPTERS) {
  assert.equal(LEVELS.filter((l) => l.chapter === ch.id).length, 10, `第${ch.id}章 10 关`);
}

// 终关 50 = 司马懿带主动技(summon + stunTower)
const simayi = LEVELS[49].waves.flatMap((w) => w.spawns).find((s) => s.bossSkills);
assert.ok(simayi && simayi.bossSkills.includes('summon') && simayi.bossSkills.includes('stunTower') && simayi.name === '司马懿', 'L50 司马懿双技');

// boss 覆盖正确:展开后末波 boss spawn 的 name/hpMult = campaign 记录覆盖值(防 {...baseBoss,...c.boss} merge 顺序 reverse)。
// L21 赤壁样板 boss={id:caocao,name:'曹操',hpMult:1.3} 覆盖 BOSSES.caocao。
const chibiBoss = LEVELS[20].waves[LEVELS[20].waves.length - 1].spawns.find((s) => s.enemyType === 'boss');
assert.equal(chibiBoss.name, '曹操', 'L21 boss name 来自 campaign 覆盖');
assert.ok(Math.abs(chibiBoss.hpMult - 1.3) < 1e-9, 'L21 boss hpMult=1.3(campaign 覆盖 BOSSES)');

console.log('ok levels-integrity');
```

- [ ] **Step 4: 改 levels-winnable.test(升满 + guard 公式)**

`tests/levels-winnable.test.mjs` 第 13-23 行 的循环体替换为:

```js
import { BAL } from '../src/data/balance.js';

// --sample:分层抽样(每章 首/中/末 = 15 关)给调参循环快速收敛;无 flag = 全 50 关(提交门禁/test.sh)。
const SAMPLE = process.argv.includes('--sample');
const SAMPLE_IDS = new Set([1, 5, 10, 11, 15, 20, 21, 25, 30, 31, 35, 40, 41, 45, 50]);

for (let i = 0; i < LEVELS.length; i++) {
  if (SAMPLE && !SAMPLE_IDS.has(LEVELS[i].id)) continue;
  const s = newGameState(LEVELS[i]);
  s.gold = 99999999;
  s.level.slots.forEach((sl, k) => {
    if (tryBuild(s, sl, defenders[k % 6])) {
      const t = s.towers[s.towers.length - 1];
      while (tryUpgrade(s, t)) { /* 升满到 MAX_TOWER_LEVEL */ }
    }
  });
  const guard = Math.max(400000, s.level.waves.length * 20000);
  let g = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && g < guard) {
    if (s.phase === 'prep') s.earlyRequested = true;
    step(s, 1 / 60);
    g++;
  }
  assert.equal(s.phase, 'won', `L${LEVELS[i].id} 满防应可通关(实际 ${s.phase}, castleHp ${s.castleHp})`);
}
```

(顶部加 `import { BAL }`;`defenders` 数组与 import 区其余不变。`L${LEVELS[i].id}` 而非 `i+1`,抽样下标签仍准。)

- [ ] **Step 5: 跑 integrity + coverage + winnable(关键门禁)**

Run: `node tests/levels-integrity.test.mjs && node tests/levels-coverage.test.mjs && node tests/levels-winnable.test.mjs`
Expected: `ok levels-integrity` / `ok levels-coverage` / `ok levels-winnable`。

⚠ **性能与调参循环**:全 50 关 winnable 聚合可能数分钟(每关胜即 break,过关的关只跑几千步;慢在边界/失败关跑满 guard)。**调参循环先跑 `node tests/levels-winnable.test.mjs --sample`(每章首/中/末 15 关,快得多)**,收敛后再跑全 50(本步)+ test.sh 终验。

⚠ **若 winnable 某关红**(生成波太强/不可通关):这是生成式管线的核心调参点。按序尝试:(a) 调 `waveGen` 的 `baseCount` 上限(`lerp(5,16,…)` 的 16↓)或 `diffK`(0.18↓);(b) 调 `difficultyParams` 的 `scale` 斜率(0.5↓)或 `startGold`(↑);(c) 调该关 campaign `difficulty`/`waveCount`。**以 winnable 硬 assert 为准绳反复调到全 50 绿**(这是"生成即自检"的安全网)。每次调完重跑本步。

- [ ] **Step 6: 提交**

```bash
git add src/data/levels.js tests/levels-integrity.test.mjs tests/levels-winnable.test.mjs
git commit -m "feat(tower-defender): levels.js 运行时确定性展开 50 关 + integrity/winnable 适配(全门禁绿)"
```

---

## Task 9: save.js 中断续玩快照

**Files:**
- Modify: `src/core/save.js`(追加 resume 子系统)
- Test: `tests/resume.test.mjs`

- [ ] **Step 1: 写失败测试**

Create `tests/resume.test.mjs`:

```js
// tests/resume.test.mjs — 中断续玩快照 写/读/清(注入假 storage,§5.4)
// 运行：node games/tower-defender/tests/resume.test.mjs
import assert from 'node:assert';
import { resumeSnapshot, writeResume, loadResume, clearResume } from '../src/core/save.js';

function fakeStore() {
  return {
    m: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this.m, k) ? this.m[k] : null; },
    setItem(k, v) { this.m[k] = v; },
    removeItem(k) { delete this.m[k]; },
  };
}

// resumeSnapshot:从 state 抽快照(纯函数)
{
  const state = {
    level: { id: 7 }, waveIndex: 3, gold: 250, castleHp: 14, phase: 'combat', prepTimer: 0,
    towers: [{ generalId: 'huang', slot: { x: 6, y: 10 }, level: 4, mode: 'last', cooldown: 9 }],
  };
  const snap = resumeSnapshot(state);
  assert.equal(snap.levelId, 7); assert.equal(snap.waveIndex, 3);
  assert.equal(snap.gold, 250); assert.equal(snap.castleHp, 14);
  assert.equal(snap.seed, 7, 'seed = levelId');
  assert.equal(snap.towers.length, 1);
  assert.deepEqual(snap.towers[0], { generalId: 'huang', slot: { x: 6, y: 10 }, level: 4, mode: 'last' }, '塔只存 generalId/slot/level/mode');
}

// 写 → 读往返一致
{
  const s = fakeStore();
  const snap = { levelId: 7, waveIndex: 3, gold: 250, castleHp: 14, phase: 'combat', prepTimer: 0, towers: [], seed: 7 };
  writeResume(s, snap);
  assert.deepEqual(loadResume(s), snap, '续玩往返一致');
}

// 无记录 → null
{
  assert.equal(loadResume(fakeStore()), null, '无续玩记录 → null');
}

// 坏 JSON → null(不抛)
{
  const bad = { getItem() { return '{not json'; }, setItem() {}, removeItem() {} };
  assert.equal(loadResume(bad), null, '坏 JSON → null');
}

// 清除
{
  const s = fakeStore();
  writeResume(s, { levelId: 1, waveIndex: 0, gold: 0, castleHp: 20, phase: 'prep', prepTimer: 30, towers: [], seed: 1 });
  clearResume(s);
  assert.equal(loadResume(s), null, '清除后 → null');
}

console.log('ok resume');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/resume.test.mjs`
Expected: FAIL(`resumeSnapshot` 等未导出)。

- [ ] **Step 3: save.js 追加 resume 子系统**

在 `src/core/save.js` 第 5 行 `const KEY = 'save_td_v1';` 之后插入:

```js
const RKEY = 'save_td_resume_v1';   // [检查点A·§5.4] 中断续玩快照 key
```

并在文件末尾(`browserWrite` 之后)追加:

```js

// —— [检查点A·§5.4] 中断续玩:state 快照 写/读/清(注入式纯函数,可单测)——
// 退出游戏中(非结算)写快照;重进该关给「续上次/重头」;胜/负/退到选关清除。
export function resumeSnapshot(state) {
  return {
    levelId: state.level.id,
    waveIndex: state.waveIndex,
    gold: state.gold,
    castleHp: state.castleHp,
    phase: state.phase,
    prepTimer: state.prepTimer,
    towers: state.towers.map((t) => ({ generalId: t.generalId, slot: { x: t.slot.x, y: t.slot.y }, level: t.level, mode: t.mode })),
    seed: state.level.id,
  };
}
export function writeResume(storage, snap) {
  try { storage.setItem(RKEY, JSON.stringify(snap)); } catch { /* 隐私模式/配额 → 忽略 */ }
}
export function loadResume(storage) {
  try { const raw = storage && storage.getItem(RKEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearResume(storage) {
  try { storage.removeItem(RKEY); } catch { /* 忽略 */ }
}
export const browserWriteResume = (snap) => writeResume(window.localStorage, snap);
export const browserLoadResume = () => loadResume(window.localStorage);
export const browserClearResume = () => clearResume(window.localStorage);
```

- [ ] **Step 4: 跑测试确认通过 + save 回归**

Run: `node tests/resume.test.mjs && node tests/save.test.mjs && node tests/progress.test.mjs`
Expected: `ok resume` / `ok save` / `ok progress`。

- [ ] **Step 5: 提交**

```bash
git add src/core/save.js tests/resume.test.mjs
git commit -m "feat(tower-defender): save.js 中断续玩快照 writeResume/loadResume/clearResume(注入式·单测)"
```

---

## Task 10: storyCard.js 开场故事卡

**Files:**
- Create: `src/ui/storyCard.js`
- Test: `tests/storyCard.test.mjs`

参照 `tests/theme.test.mjs`/`tests/entityRenderer.test.mjs` 的 stub-ctx 风格。组件:`storyCardLayout(view, hasResume)` → `{ panel:{x,y,w,h}, buttons:[{id,x,y,w,h}] }`(hasResume → `resume`+`restart` 两钮;否则 `continue` 单钮)。`hitStoryCard(view, hasResume, sx, sy)` → `'continue'|'resume'|'restart'|null`。`drawStoryCard(ctx, view, level, hasResume)`。

- [ ] **Step 1: 写失败测试**

Create `tests/storyCard.test.mjs`:

```js
// tests/storyCard.test.mjs — 故事卡 layout/hit 自洽 + stub ctx 不抛 + save/restore 平衡
// 运行：node games/tower-defender/tests/storyCard.test.mjs
import assert from 'node:assert';
import { storyCardLayout, hitStoryCard, drawStoryCard } from '../src/ui/storyCard.js';

const view = { w: 1280, h: 800 };

// 无续玩:单「继续」钮
{
  const L = storyCardLayout(view, false);
  assert.equal(L.buttons.length, 1, '无续玩 → 1 钮');
  assert.equal(L.buttons[0].id, 'continue');
  const b = L.buttons[0];
  assert.equal(hitStoryCard(view, false, b.x + 2, b.y + 2), 'continue', '命中继续');
  assert.equal(hitStoryCard(view, false, 1, 1), null, '空白 → null');
}

// 有续玩:续上次 + 重头 两钮
{
  const L = storyCardLayout(view, true);
  assert.equal(L.buttons.length, 2, '有续玩 → 2 钮');
  const ids = L.buttons.map((b) => b.id).sort();
  assert.deepEqual(ids, ['restart', 'resume'], '续上次/重头');
  const resume = L.buttons.find((b) => b.id === 'resume');
  assert.equal(hitStoryCard(view, true, resume.x + 2, resume.y + 2), 'resume', '命中续上次');
}

// stub ctx:draw 不抛 + save/restore 平衡
{
  let depth = 0, maxNeg = 0;
  const ctx = new Proxy({
    save() { depth++; }, restore() { depth--; if (depth < 0) maxNeg++; },
    measureText(t) { return { width: (t ? String(t).length : 0) * 8 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, closePath() {},
    fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {}, clip() {},
    setTransform() {}, ellipse() {}, rect() {}, setLineDash() {},
  }, { get(t, p) { return p in t ? t[p] : () => {}; }, set() { return true; } });

  const level = { id: 21, chapter: 3, name: '赤壁之战', faction: 'wu',
    story: { hook: '借东风一把火,烧退曹操八十万大军!', year: '公元208年', place: '长江·赤壁', sides: '孙刘联军 vs 曹操', result: '曹操大败,三分天下', idiom: '火烧赤壁', portrait: null } };
  drawStoryCard(ctx, view, level, false);
  drawStoryCard(ctx, view, level, true);
  assert.equal(depth, 0, 'save/restore 平衡');
  assert.equal(maxNeg, 0, '无多余 restore');
}

console.log('ok storyCard');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/storyCard.test.mjs`
Expected: FAIL(`Cannot find module …/storyCard.js`)。

- [ ] **Step 3: 写 storyCard.js**

Create `src/ui/storyCard.js`:

```js
// ui/storyCard.js — [检查点A·§7] 开场图文故事卡(屏幕坐标 layout/hit/draw)。
// 混合式:章·战役名 + 故事钩子(楷体)+ 小档案(年/地点/双方/结果/成语)+ 统一话术声明 + 可选头像 + 继续/续玩。
// copy-and-own theme.js(panel/title/button)。render-only,不改 state。
import { backdrop, panel, title, button, roundRect, FONT, PAL } from './theme.js';
import { assets } from '../core/assets.js';
import { CHAPTERS } from '../data/campaign.js';

const PW = 560, PH = 460, BTN_W = 200, BTN_H = 52, GAP = 20;

// 统一话术(内容铁律:避免误导孩子把"守成都"当史实)
const DISCLAIMER = '历史上这是真实的大战;游戏里,我们想象蜀汉六将来守护这片战场。';

export function storyCardLayout(view, hasResume) {
  const x = (view.w - PW) / 2, y = (view.h - PH) / 2;
  const by = y + PH - BTN_H - 28;
  let buttons;
  if (hasResume) {
    const totalW = BTN_W * 2 + GAP, bx = (view.w - totalW) / 2;
    buttons = [
      { id: 'resume', x: bx, y: by, w: BTN_W, h: BTN_H },
      { id: 'restart', x: bx + BTN_W + GAP, y: by, w: BTN_W, h: BTN_H },
    ];
  } else {
    buttons = [{ id: 'continue', x: (view.w - BTN_W) / 2, y: by, w: BTN_W, h: BTN_H }];
  }
  return { panel: { x, y, w: PW, h: PH }, buttons };
}

export function hitStoryCard(view, hasResume, sx, sy) {
  for (const b of storyCardLayout(view, hasResume).buttons) {
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return b.id;
  }
  return null;
}

export function drawStoryCard(ctx, view, level, hasResume) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(ctx, view.w, view.h);
  const L = storyCardLayout(view, hasResume);
  const P = L.panel;
  panel(ctx, P.x, P.y, P.w, P.h, { variant: 'parch', r: 16 });

  const chapter = CHAPTERS.find((c) => c.id === level.chapter);
  const cx = view.w / 2;
  let y = P.y + 46;

  // 章号 + 章名
  ctx.fillStyle = PAL.parchEdge; ctx.font = FONT.body(14, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`第 ${level.chapter} 章 · ${chapter ? chapter.title : ''}`, cx, y); y += 30;
  // 战役名(金标题)
  title(ctx, level.name, cx, y + 8, 38); y += 48;

  const st = level.story || {};
  // 故事钩子(楷体大字)
  ctx.fillStyle = '#7a3a12'; ctx.font = FONT.head(20);
  ctx.fillText(st.hook || '', cx, y); y += 38;

  // 小档案(左对齐两列)
  const items = [
    ['年代', st.year], ['地点', st.place], ['双方', st.sides], ['结果', st.result], ['成语', st.idiom],
  ].filter(([, v]) => v);
  ctx.textAlign = 'left'; ctx.font = FONT.body(15, 600);
  const colX = P.x + 56;
  for (const [k, v] of items) {
    ctx.fillStyle = PAL.parchEdge; ctx.fillText(k, colX, y);
    ctx.fillStyle = PAL.ink; ctx.fillText(String(v), colX + 56, y);
    y += 26;
  }
  y += 6;

  // 可选头像(复用六将立绘缩略;portrait=null 则跳过)
  if (st.portrait) {
    const img = assets.images['gen_' + st.portrait];
    if (img) {
      const ps = 64, pxR = P.x + P.w - 56 - ps, pyT = P.y + 120;
      ctx.save(); roundRect(ctx, pxR, pyT, ps, ps, 8); ctx.clip();
      const ih = ps * ((img.height / img.width) || 1.35);
      ctx.drawImage(img, pxR, pyT - ih * 0.04, ps, ih); ctx.restore();
      roundRect(ctx, pxR, pyT, ps, ps, 8); ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.parchEdge; ctx.stroke();
    }
  }

  // 统一话术声明(小字,框底上方)
  ctx.fillStyle = 'rgba(60,46,26,.72)'; ctx.font = FONT.body(12, 600); ctx.textAlign = 'center';
  ctx.fillText(DISCLAIMER, cx, P.y + P.h - BTN_H - 50);

  // 按钮
  const labels = { continue: '继续 ▶', resume: '续上次 ▶', restart: '重头开始' };
  const variants = { continue: 'gold', resume: 'jade', restart: 'wood' };
  for (const b of L.buttons) button(ctx, b, { label: labels[b.id], variant: variants[b.id] });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/storyCard.test.mjs`
Expected: `ok storyCard`

- [ ] **Step 5: 提交**

```bash
git add src/ui/storyCard.js tests/storyCard.test.mjs
git commit -m "feat(tower-defender): storyCard 开场图文故事卡(钩子+小档案+统一话术+续玩选项)"
```

---

## Task 11: levelSelect 分章分页

**Files:**
- Modify: `src/ui/levelSelect.js`(整体重写)
- Modify: `tests/levelSelect.test.mjs`(整体重写)

新 API(分章):一次只显示一章(≤10 关,COLS=5×2 行)+ 章头 + ◀上一章/下一章▶。`levelSelectLayout(view, levels, chapterIdx)` → `{ cards:[{index,x,y,w,h}], prev:{x,y,w,h}|null, next:{x,y,w,h}|null }`(index = 全局 0-based)。`hitLevelSelect(view, save, levels, chapterIdx, sx, sy)` → `{kind:'level',index}` | `{kind:'chapter',delta}` | `null`。`drawLevelSelect(ctx, view, save, levels, chapterIdx)`。

- [ ] **Step 1: 重写 levelSelect.test**

`tests/levelSelect.test.mjs` 整体替换为:

```js
// tests/levelSelect.test.mjs — [检查点A] 分章选关:命中卡→{kind:'level',index}、导航→{kind:'chapter',delta}
// 运行：node games/tower-defender/tests/levelSelect.test.mjs
import assert from 'node:assert';
import { levelSelectLayout, hitLevelSelect } from '../src/ui/levelSelect.js';
import { defaultSave } from '../src/core/save.js';

const view = { w: 1280, h: 800 };
// 构造 50 假关(5 章 × 10)
const levels = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, chapter: Math.floor(i / 10) + 1, name: 'L' + (i + 1), faction: 'wei' }));

// 第 1 章:显示 idx 0..9 共 10 卡
{
  const L = levelSelectLayout(view, levels, 0);
  assert.equal(L.cards.length, 10, '第1章 10 卡');
  assert.equal(L.cards[0].index, 0); assert.equal(L.cards[9].index, 9);
  assert.equal(L.prev, null, '首章无上一章');
  assert.ok(L.next, '首章有下一章');
}

// 第 3 章:显示 idx 20..29
{
  const L = levelSelectLayout(view, levels, 2);
  assert.equal(L.cards[0].index, 20, '第3章首卡=idx20');
  assert.ok(L.prev && L.next, '中间章有上下');
}

// 末章无下一章
{
  const L = levelSelectLayout(view, levels, 4);
  assert.ok(L.prev && !L.next, '末章无下一章');
}

// 命中已解锁卡 → {kind:'level',index}
{
  const save = defaultSave(); save.unlockedLevel = 50;
  const c = levelSelectLayout(view, levels, 0).cards[3];
  assert.deepEqual(hitLevelSelect(view, save, levels, 0, c.x + 5, c.y + 5), { kind: 'level', index: 3 }, '点第4卡 → idx3');
}

// 锁定卡 → null
{
  const save = defaultSave();   // unlockedLevel=1
  const c = levelSelectLayout(view, levels, 0).cards[3];
  assert.equal(hitLevelSelect(view, save, levels, 0, c.x + 5, c.y + 5), null, '锁定卡 → null');
}

// 命中「下一章」→ {kind:'chapter',delta:1}
{
  const save = defaultSave(); save.unlockedLevel = 50;
  const L = levelSelectLayout(view, levels, 0);
  assert.deepEqual(hitLevelSelect(view, save, levels, 0, L.next.x + 5, L.next.y + 5), { kind: 'chapter', delta: 1 }, '下一章');
}

console.log('ok levelSelect');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/levelSelect.test.mjs`
Expected: FAIL(参数签名/返回值不符)。

- [ ] **Step 3: 重写 levelSelect.js**

`src/ui/levelSelect.js` 整体替换为:

```js
// ui/levelSelect.js — [检查点A] 分章/分页选关(屏幕坐标 layout/hit/draw)= 游戏主页。
// 一次显示一章(≤10 关,5×2 网格)+ 章头 + ◀上一章/下一章▶。layout/hit 单一来源。
import { isUnlocked, nextPlayableIndex } from '../core/save.js';
import { FACTIONS } from '../data/factions.js';
import { CHAPTERS } from '../data/campaign.js';
import { backdrop, panel, title, seal, button, roundRect, FONT, PAL } from './theme.js';

const COLS = 5;
const NAV_W = 132, NAV_H = 44;

// 当前章关卡(全局 index 升序)
function chapterLevels(levels, chapterIdx) {
  const chId = CHAPTERS[chapterIdx]?.id;
  const out = [];
  for (let i = 0; i < levels.length; i++) if (levels[i].chapter === chId) out.push({ index: i, lv: levels[i] });
  return out;
}

export function levelSelectLayout(view, levels, chapterIdx) {
  const list = chapterLevels(levels, chapterIdx);
  const cols = COLS, rows = Math.max(1, Math.ceil(list.length / cols));
  const cw = Math.max(150, Math.min(220, (view.w - 120) / cols - 16));
  const ch = Math.max(92, Math.min(120, (view.h - 280) / rows - 16));
  const gap = 18;
  const gridW = cols * cw + (cols - 1) * gap;
  const x0 = (view.w - gridW) / 2, y0 = 150;
  const cards = list.map((it, k) => {
    const r = Math.floor(k / cols), c = k % cols;
    return { index: it.index, x: x0 + c * (cw + gap), y: y0 + r * (ch + gap), w: cw, h: ch };
  });
  const navY = view.h - 70;
  const prev = chapterIdx > 0 ? { x: view.w / 2 - 160 - NAV_W, y: navY, w: NAV_W, h: NAV_H } : null;
  const next = chapterIdx < CHAPTERS.length - 1 ? { x: view.w / 2 + 160, y: navY, w: NAV_W, h: NAV_H } : null;
  return { cards, prev, next };
}

export function hitLevelSelect(view, save, levels, chapterIdx, sx, sy) {
  const L = levelSelectLayout(view, levels, chapterIdx);
  for (const card of L.cards) {
    if (sx >= card.x && sx <= card.x + card.w && sy >= card.y && sy <= card.y + card.h) {
      return isUnlocked(save, card.index + 1) ? { kind: 'level', index: card.index } : null;
    }
  }
  if (L.prev && sx >= L.prev.x && sx <= L.prev.x + L.prev.w && sy >= L.prev.y && sy <= L.prev.y + L.prev.h) return { kind: 'chapter', delta: -1 };
  if (L.next && sx >= L.next.x && sx <= L.next.x + L.next.w && sy >= L.next.y && sy <= L.next.y + L.next.h) return { kind: 'chapter', delta: 1 };
  return null;
}

export function drawLevelSelect(ctx, view, save, levels, chapterIdx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(ctx, view.w, view.h);
  const chapter = CHAPTERS[chapterIdx];

  title(ctx, '成都保卫战', view.w / 2, 50, 46);
  ctx.fillStyle = PAL.gold; ctx.font = FONT.head(22); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`第 ${chapter.id} 章 · ${chapter.title}`, view.w / 2, 100);
  ctx.fillStyle = PAL.dim; ctx.font = FONT.body(13);
  ctx.fillText('蜀汉守成都 · 六将御三方 —— 选择关卡', view.w / 2, 126);

  const nextIdx = nextPlayableIndex(save, levels.length);
  const L = levelSelectLayout(view, levels, chapterIdx);
  for (const card of L.cards) {
    const lv = levels[card.index];
    const unlocked = isUnlocked(save, card.index + 1);
    const stars = save.stars[card.index + 1] || 0;
    const fac = FACTIONS[lv.faction] || FACTIONS.nanman;
    const isNext = card.index === nextIdx && unlocked;
    panel(ctx, card.x, card.y, card.w, card.h, { variant: unlocked ? 'wood' : 'ink', r: 12, glow: isNext });

    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.45;
    roundRect(ctx, card.x + 12, card.y + 12, card.w - 24, 6, 3);
    const fg = ctx.createLinearGradient(card.x, 0, card.x + card.w, 0);
    fg.addColorStop(0, fac.tint.grassA); fg.addColorStop(1, fac.tint.grassB);
    ctx.fillStyle = fg; ctx.fill();
    ctx.restore();

    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.5;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = unlocked ? PAL.gold : PAL.goldDim; ctx.font = FONT.body(12, 700);
    ctx.fillText('第 ' + (card.index + 1) + ' 关', card.x + 14, card.y + 40);
    ctx.fillStyle = unlocked ? PAL.cream : PAL.dim; ctx.font = FONT.head(17);
    ctx.fillText(lv.name, card.x + 14, card.y + 66);
    ctx.fillStyle = PAL.dim; ctx.font = FONT.body(11);
    ctx.fillText(fac.name + '军', card.x + 14, card.y + 85);
    ctx.restore();

    if (!unlocked) {
      seal(ctx, card.x + card.w - 26, card.y + card.h - 26, 15, '封', { shape: 'square' });
    } else {
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = FONT.body(15);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < stars ? PAL.goldBright : 'rgba(212,175,55,.26)';
        ctx.fillText('★', card.x + 14 + i * 18, card.y + card.h - 13);
      }
      if (isNext) {
        ctx.textAlign = 'right'; ctx.fillStyle = PAL.goldBright; ctx.font = FONT.head(14);
        ctx.fillText('▶ 续战', card.x + card.w - 12, card.y + card.h - 12);
      }
    }
  }

  // 章节导航
  if (L.prev) button(ctx, L.prev, { label: '◀ 上一章', variant: 'wood' });
  if (L.next) button(ctx, L.next, { label: '下一章 ▶', variant: 'wood' });
  ctx.fillStyle = PAL.gold; ctx.font = FONT.head(18); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${chapter.id} / ${CHAPTERS.length}`, view.w / 2, view.h - 70 + NAV_H / 2);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/levelSelect.test.mjs`
Expected: `ok levelSelect`

- [ ] **Step 5: 提交**

```bash
git add src/ui/levelSelect.js tests/levelSelect.test.mjs
git commit -m "feat(tower-defender): 选关分章分页(章头+5×2网格+◀章▶导航,适配50关)"
```

---

## Task 12: pauseMenu 加「重看故事」

**Files:**
- Modify: `src/ui/pauseMenu.js:6-12`
- Test: `tests/pauseMenu.test.mjs`(若存在则更新断言)

- [ ] **Step 1: 看现有 pauseMenu 测试是否硬编码项数**

Run: `cat tests/pauseMenu.test.mjs`
若断言了 `pauseLayout(view).length === 5` 或具体 id 列表 → 在 Step 3 同步更新为含 `'story'` 的新列表;若仅测命中某 id → 无需改。

- [ ] **Step 2: pauseMenu 加项**

`src/ui/pauseMenu.js` 的 `ITEMS` 数组(第 6-12 行)在 `{ id: 'restart', … }` 之后插入一项:

```js
  { id: 'story', label: '重看故事', variant: 'jade' },
```

(`hitPause`/`pauseLayout`/`drawPause` 无需改 — 它们遍历 ITEMS。)

- [ ] **Step 3: pauseMenu 测试加「重看故事」断言 + 跑测试**

在 `tests/pauseMenu.test.mjs` 加一条:`assert.ok(pauseLayout(view).some((b) => b.id === 'story'), '含重看故事项');`(防未来重构误删)。若 Step 1 发现硬编码项数/id 列表,同步更新为含 `'story'`。

Run: `node tests/pauseMenu.test.mjs`
Expected: `ok pauseMenu`。

- [ ] **Step 4: 提交**

```bash
git add src/ui/pauseMenu.js tests/pauseMenu.test.mjs
git commit -m "feat(tower-defender): 暂停菜单加「重看故事」入口"
```

---

## Task 13: main.js — 'story' 屏 + 续玩接线 + 章节态

**Files:**
- Modify: `src/main.js`

无独立单测(集成层),靠 Step 末的浏览器实玩 + `window.__td` 钩子验证。改动点逐处给出。

- [ ] **Step 1: import 续玩 + storyCard + CHAPTERS**

`src/main.js` 第 9 行 import save 改为:

```js
import { browserLoad, browserWrite, applyClear, isUnlocked, nextPlayableIndex, resumeSnapshot, browserWriteResume, browserLoadResume, browserClearResume } from './core/save.js';
```

第 18 行 `import { hitLevelSelect, drawLevelSelect } from './ui/levelSelect.js';` 之后插入:

```js
import { storyCardLayout, hitStoryCard, drawStoryCard } from './ui/storyCard.js';
import { CHAPTERS } from './data/campaign.js';
import { createTower } from './entities/tower.js';
import { upgradeCost } from './systems/economySystem.js';
```

- [ ] **Step 2: 屏幕态 + 故事/章节态变量**

第 34 行 `let screen = 'select';` 注释改为 `// 'select' | 'story' | 'playing'`,其后插入:

```js
let pendingLevel = -1;        // [检查点A] 故事屏待进关卡 index
let pendingResume = null;     // [检查点A] 该关 resume 快照(有则故事屏给续玩选项)
let storyReview = false;      // [检查点A] 「重看故事」复看模式(继续=回到当前对局,不重置)
let selectChapter = 0;        // [检查点A] 选关当前章 index
```

- [ ] **Step 3: 续玩应用 + invested 重算 helper**

`startLevel`/`toSelect` 附近(第 57-58 行后)插入:

```js
function investedFor(generalId, level) {
  let inv = GENERALS[generalId].cost;
  const tmp = { generalId, level: 1 };
  for (let L = 1; L < level; L++) { tmp.level = L; inv += upgradeCost(tmp); }
  return inv;
}

// 续玩:从快照恢复到「所在波的备战起点」(v1 不重建半场出兵,稳健)。
function applyResume(snap) {
  const n = LEVELS.findIndex((l) => l.id === snap.levelId);
  if (n < 0) return false;
  enterLevel(n);
  state.waveIndex = Math.max(0, Math.min(snap.waveIndex, state.level.waves.length - 1));
  state.gold = snap.gold;
  state.castleHp = Math.min(snap.castleHp, state.castleMaxHp);
  state.phase = 'prep'; state.prepTimer = BAL.PREP_SECONDS;
  state.enemies = []; state.activeSpawns = []; state.earlyRequested = false; state.allWavesEmitted = false;
  state.towers = (snap.towers || []).map((ts) => {
    const t = createTower(ts.generalId, ts.slot);
    t.level = ts.level; t.mode = ts.mode; t.totalInvested = investedFor(ts.generalId, ts.level);
    return t;
  });
  return true;
}
```

- [ ] **Step 4: 改 startLevel → 先进故事屏;加故事屏路由 helper**

第 57 行 `function startLevel(n) { return isUnlocked(save, n + 1) ? enterLevel(n) : false; }` 替换为:

```js
// [检查点A] 选关 → 故事屏(有续玩则带选项);校验解锁。
function startLevel(n) {
  if (!isUnlocked(save, n + 1)) return false;
  pendingLevel = n; storyReview = false;
  const snap = browserLoadResume();
  pendingResume = (snap && snap.levelId === LEVELS[n].id) ? snap : null;
  screen = 'story'; audio.stopBgm();
  return true;
}
// 故事屏「继续/续上次/重头」路由。
function fromStory(act) {
  if (storyReview) { screen = 'playing'; storyReview = false; if (state.paused) state.paused = false; return; }
  if (act === 'resume' && pendingResume) { applyResume(pendingResume); browserClearResume(); screen = 'playing'; audio.startBgm(); }  // 续玩成功即清档(防下次/刷新读到旧波)
  else { browserClearResume(); enterLevel(pendingLevel); }   // continue / restart 都重头
  pendingResume = null;
}
// [检查点A] 退出对局即清续玩(退到选关/大厅=放弃)。
function leaveToSelect() { browserClearResume(); toSelect(); }
```

- [ ] **Step 5: render 加故事屏分支**

第 83 行 `if (screen === 'select') { drawLevelSelect(ctx, view, save, LEVELS); return; }` 替换为:

```js
  if (screen === 'select') { drawLevelSelect(ctx, view, save, LEVELS, selectChapter); return; }
  if (screen === 'story') { drawStoryCard(ctx, view, LEVELS[pendingLevel], !!pendingResume); return; }
```

第 132-139 行 结算块内,胜利写档处(`save = applyClear(...)` 同块)追加清续玩 — 在 `recorded = true;` 之后加 `browserClearResume();`,并在 `s.phase === 'lost'` 时也清:把第 132-139 行结算块替换为:

```js
  if (s.phase === 'won' || s.phase === 'lost') {
    if (!recorded) {
      browserClearResume();                       // [检查点A] 胜/负先清续玩(防写档异常残留脏档)
      recorded = true;
      if (s.phase === 'won') { save = applyClear(save, s.level.id, s.stars); browserWrite(save); }
    }
    drawResult(ctx, view, s, LEVELS.length);
  }
```

- [ ] **Step 6: onPointerDown 加故事屏 + 选关章节导航 + 暂停重看/退出清**

第 150-154 行 选关分支替换为:

```js
  if (screen === 'select') {
    const r = hitLevelSelect(view, save, LEVELS.length ? LEVELS : [], selectChapter, sx, sy);
    if (r && r.kind === 'level') startLevel(r.index);
    else if (r && r.kind === 'chapter') selectChapter = Math.max(0, Math.min(CHAPTERS.length - 1, selectChapter + r.delta));
    return;
  }
  if (screen === 'story') {
    const act = hitStoryCard(view, !!pendingResume, sx, sy);
    if (act) fromStory(act);
    return;
  }
```

> 注:`hitLevelSelect` 第 3 参为 `levels` 数组(非 length)。修正为 `hitLevelSelect(view, save, LEVELS, selectChapter, sx, sy)`。

第 173-177 行 暂停菜单路由的 `select`/`hub` 分支改为清续玩 + 加 `story`:

```js
    if (act === 'resume') state.paused = false;
    else if (act === 'restart') { browserClearResume(); enterLevel(curIndex()); }
    else if (act === 'story') { storyReview = true; pendingLevel = curIndex(); pendingResume = null; screen = 'story'; }
    else if (act === 'select') { state.paused = false; leaveToSelect(); }
    else if (act === 'mute') { save.settings.muted = !save.settings.muted; audio.setMuted(save.settings.muted); browserWrite(save); audio.sfx('ui'); }
    else if (act === 'hub') { browserClearResume(); window.location.href = '../../index.html'; }
```

结算屏 `select` 路由(第 157-161 行)的 `else if (act === 'select') toSelect();` 改为 `else if (act === 'select') leaveToSelect();`(胜负本已清,leaveToSelect 幂等)。

- [ ] **Step 7: onKey — 故事屏忽略游戏热键(已被 `screen!=='playing'` 拦截);确认无需改**

第 201 行 `if (screen !== 'playing') return;` 已覆盖 story 屏。无需改。

- [ ] **Step 8: 中断写续玩 — visibilitychange / beforeunload**

`boot()` 内第 250 行 `document.addEventListener('visibilitychange', loop.onVisible);` 之后插入:

```js
  // [检查点A] 中断续玩:游戏中(非结算)切后台/关页 → 写快照。
  function persistResume() {
    if (screen === 'playing' && (state.phase === 'prep' || state.phase === 'combat')) {
      browserWriteResume(resumeSnapshot(state));
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) persistResume(); });
  window.addEventListener('beforeunload', persistResume);
```

- [ ] **Step 9: 扩 window.__td QA 钩子**

第 237 行 `toSelect,` 之后插入(便于浏览器实玩自动化):

```js
    showStory(n) { return startLevel(n); },
    getResume() { return browserLoadResume(); },
    fromStory,
    setChapter(i) { selectChapter = Math.max(0, Math.min(CHAPTERS.length - 1, i)); },
    get pendingResume() { return pendingResume; },
```

- [ ] **Step 10: node --check + 启动冒烟(全测试 + 关数)**

Run: `node --check src/main.js && bash scripts/check-imports.sh`
Expected: 语法 OK;`✅ 自含 import 检查通过`。

(主循环逻辑的端到端验证在 Task 16 的浏览器实玩。)

- [ ] **Step 11: 提交**

```bash
git add src/main.js
git commit -m "feat(tower-defender): main 加 story 屏 + 中断续玩接线 + 分章选关态 + 重看故事"
```

---

## Task 14: tools/balance-report.mjs — 经济/DPS/覆盖诊断器

**Files:**
- Create: `tools/balance-report.mjs`

非硬 assert(§9.3 趋势告警·带宽容带),始终 exit 0,打印逐关 PASS/WARN + 汇总。供曲线调参用。

- [ ] **Step 1: 写 balance-report.mjs**

Create `tools/balance-report.mjs`:

```js
// tools/balance-report.mjs — [检查点A·§9.3] headless 经济/DPS/覆盖诊断器(趋势告警,带宽容带,非硬 assert)。
// 用法:node tools/balance-report.mjs。始终 exit 0;打印逐关指标 + 汇总,供调曲线。
import { LEVELS } from '../src/data/levels.js';
import { ENEMIES } from '../src/data/enemies.js';
import { GENERALS, towerStats } from '../src/data/generals.js';
import { BAL } from '../src/data/balance.js';
import { upgradeCost } from '../src/systems/economySystem.js';

const CHEAP = Math.min(...Object.values(GENERALS).map((g) => g.cost));   // 最便宜建造(huang 70)

// 一座塔升到 L=lvl 的累计造价(建造 + 各级升级)
function cumulativeCost(generalId, lvl) {
  let inv = GENERALS[generalId].cost;
  const tmp = { generalId, level: 1 };
  for (let L = 1; L < lvl; L++) { tmp.level = L; inv += upgradeCost(tmp); }
  return inv;
}
const L5_COST = cumulativeCost('huang', BAL.MAX_TOWER_LEVEL);   // 代表性 L5 总价

function report(lv) {
  const scale = lv.scale;
  // 收入:起始金 + 杀敌掉金 + 清波奖励
  let killGold = 0, totalHp = 0, enemyCount = 0;
  for (const w of lv.waves) for (const s of w.spawns) {
    const def = ENEMIES[s.enemyType];
    const hpMult = s.hpMult || 1;
    killGold += Math.round(def.gold * scale) * s.count;
    totalHp += def.hp * scale * hpMult * s.count;
    enemyCount += s.count;
  }
  const income = lv.startGold + killGold + BAL.WAVE_CLEAR_BONUS * lv.waves.length;
  // 预算:覆盖塔数(slots/1.7 近似最小覆盖集)各建满 + 升 L5
  const coverTowers = Math.ceil(lv.slots.length / 1.7);
  const budget = coverTowers * L5_COST;
  const ratio = income / budget;

  // DPS 预算(全 slot 建满 L5 黄忠近似)vs 敌总血
  const l5 = towerStats(GENERALS.huang, BAL.MAX_TOWER_LEVEL);
  const dpsPerTower = l5.dmg / l5.interval;
  const dpsBudget = dpsPerTower * lv.slots.length;
  const timeToClear = totalHp / Math.max(1, dpsBudget);   // 粗估秒(忽略抗性/分散)

  const econOk = ratio >= 1.1;             // income ≥ budget×1.1
  return { id: lv.id, name: lv.name, waves: lv.waves.length, enemyCount, income, budget, ratio, totalHp: Math.round(totalHp), dpsBudget: Math.round(dpsBudget), timeToClear: Math.round(timeToClear), econOk };
}

let warn = 0;
console.log('关 | 波 | 兵 | 收入 | 预算 | income/budget | 敌总血 | DPS预算 | 粗估清场s | 经济');
for (const lv of LEVELS) {
  const r = report(lv);
  if (!r.econOk) warn++;
  console.log(`L${r.id} ${r.name} | ${r.waves} | ${r.enemyCount} | ${r.income} | ${r.budget} | ${r.ratio.toFixed(2)} | ${r.totalHp} | ${r.dpsBudget} | ${r.timeToClear} | ${r.econOk ? '✅' : '⚠ income<budget×1.1'}`);
}
console.log(`\n汇总:${LEVELS.length} 关,经济告警 ${warn} 关(income < budget×1.1)。`);
console.log('指标为趋势参考(带宽容带,非硬门禁);winnable 硬 assert 才是通关保证。');
process.exit(0);
```

- [ ] **Step 2: 跑诊断器(读趋势)**

Run: `node tools/balance-report.mjs`
Expected: 打印 50 关指标表 + 汇总,exit 0。**人工读趋势**:`income/budget` 应大体 ≥1.1、`粗估清场s` 随关递增但不爆炸。若多关经济告警,回 Task 8 调 `difficultyParams`(startGold↑)或 waveGen 掉金侧——但**不阻断**(winnable 已是硬保证)。

- [ ] **Step 3: node --check + 提交**

```bash
node --check tools/balance-report.mjs
git add tools/balance-report.mjs
git commit -m "feat(tower-defender): balance-report 经济/DPS/覆盖诊断器(趋势告警·带宽容带)"
```

---

## Task 15: tools/dump-levels.mjs — 展开关卡转 JSON

**Files:**
- Create: `tools/dump-levels.mjs`

- [ ] **Step 1: 写 dump-levels.mjs**

Create `tools/dump-levels.mjs`:

```js
// tools/dump-levels.mjs — 展开后 LEVELS → JSON(审波次/diff/定位 flaky)。
// 用法:node tools/dump-levels.mjs           # 全量摘要(每关一行)
//       node tools/dump-levels.mjs 21        # 单关完整 JSON
//       node tools/dump-levels.mjs --full     # 全量完整 JSON
import { LEVELS } from '../src/data/levels.js';

const arg = process.argv[2];

if (arg === '--full') {
  console.log(JSON.stringify(LEVELS, null, 2));
} else if (arg && /^\d+$/.test(arg)) {
  const lv = LEVELS.find((l) => l.id === +arg);
  if (!lv) { console.error(`无 L${arg}`); process.exit(1); }
  console.log(JSON.stringify(lv, null, 2));
} else {
  for (const lv of LEVELS) {
    const enemies = {};
    let bossName = '';
    for (const w of lv.waves) for (const s of w.spawns) {
      if (s.enemyType === 'boss') bossName = s.name || '?';
      else enemies[s.enemyType] = (enemies[s.enemyType] || 0) + s.count;
    }
    const types = Object.entries(enemies).map(([t, n]) => `${t}×${n}`).join(' ');
    console.log(`L${lv.id} [ch${lv.chapter} ${lv.faction}] ${lv.name} | ${lv.waves.length}波 scale=${lv.scale} 金=${lv.startGold} slots=${lv.slots.length} | boss=${bossName} | ${types}`);
  }
}
```

- [ ] **Step 2: 跑(摘要 + 单关)**

Run: `node tools/dump-levels.mjs | head -12 && echo '---' && node tools/dump-levels.mjs 21 | head -20`
Expected: 摘要每关一行(50 行);单关打印 L21 赤壁完整 JSON 片段。

- [ ] **Step 3: node --check + 提交**

```bash
node --check tools/dump-levels.mjs
git add tools/dump-levels.mjs
git commit -m "feat(tower-defender): dump-levels 工具(展开关卡→JSON,审波次/diff)"
```

---

## Task 16: scripts/test.sh + 全门禁回归 + 浏览器实玩

**Files:**
- Create: `scripts/test.sh`

- [ ] **Step 1: 写 test.sh**

Create `scripts/test.sh`:

```bash
#!/usr/bin/env bash
# [检查点A·§9.3] 串跑全部单测 + node --check + verify-levels + check-imports。
# 用法:bash scripts/test.sh。任一红即 exit 1。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== node --check src/**, tools/** =="
find src tools -name '*.mjs' -o -name '*.js' | while read -r f; do node --check "$f"; done
echo "✅ syntax ok"

echo "== 单测 tests/*.test.mjs =="
fail=0
for t in tests/*.test.mjs; do
  if node "$t"; then :; else echo "❌ FAIL: $t"; fail=1; fi
done
[ "$fail" = 0 ] || { echo "❌ 有单测失败"; exit 1; }

echo "== verify-levels(50 关 0 漏怪)=="
node tools/verify-levels.mjs

echo "== check-imports(自含铁律)=="
bash scripts/check-imports.sh

echo ""
echo "✅✅ 全部门禁通过"
```

- [ ] **Step 2: chmod + 跑全门禁**

Run: `chmod +x scripts/test.sh && bash scripts/test.sh`
Expected: `✅ syntax ok` → 每个 test `ok …` → `✅ 全部 50 关通过` → `✅ 自含 import 检查通过` → `✅✅ 全部门禁通过`,exit 0。

任一红:回到对应 Task 修复后重跑。

- [ ] **Step 3: balance-report(读趋势,非阻断)**

Run: `node tools/balance-report.mjs`
Expected: 指标表 + 汇总。记录经济告警关数(供 checkpoint C 调曲线;A 不强求全绿)。

- [ ] **Step 4: 浏览器实玩(故事屏 / 续玩 / L5 / 5 样板战)**

启动静态服务(host 侧):`cd /Users/james/Projects/game-hub && python3 -m http.server 8848`,浏览器开 `http://localhost:8848/games/tower-defender/`(或用既有 puppeteer host 冒烟脚本)。逐项核对(可借 `window.__td`):

- [ ] **故事屏**:选关点关 → 故事卡显示章名/战役名/钩子/小档案/统一话术/「继续 ▶」;点继续进关。`__td.showStory(20)` 直达 L21 赤壁故事屏。
- [ ] **分章选关**:章头显示「第 N 章」;◀上一章/下一章▶ 切章正常;50 关分 5 章各 10 卡、手机宽度(resize 窄屏)不溢出。
- [ ] **L5 升级**:进任一关,`__td.setGold(99999)`,建塔连点升级到 L5(等级 pips/「满级」按钮在 L5 出现);招牌技在 L3 已解锁(充能条/暴击)、L4/L5 继续变强但**不秒杀**(目测一发不清屏)。
- [ ] **续玩**:游戏中(combat)切到别的标签页(触发 visibilitychange)→ 回选关重点该关 → 故事屏出现「续上次/重头」;点续上次 → 金/塔/城防/所在波恢复(回该波备战起点);胜/负或退到选关后再进 → 无续玩选项(已清)。
- [ ] **重看故事**:对局中暂停 → 「重看故事」→ 故事卡 → 继续 → 回到原对局(不重置)。
- [ ] **5 样板战端到端**:L1 博望坡 / L11 长坂坡 / L21 赤壁 / L31 定军山 / L41 夷陵 —— 各进关跑几波,确认换皮(faction tint/敌名)、boss 末波出现且显名、故事卡内容正确、可推进。

- [ ] **Step 5: 提交 + 收尾**

```bash
git add scripts/test.sh
git commit -m "feat(tower-defender): scripts/test.sh 全门禁串跑器 + 检查点A 门禁全过"
```

实玩中发现的手感/教育/格式问题 → 记录交 James 与娃验收(§12 检查点 A 验收项);据反馈微调后进检查点 B。

---

## Self-Review(对 spec 核对)

**Spec 覆盖**(§12 检查点 A 逐条 → 任务):
- L5 重构全链路(§5.3)→ Task 1(towerStats/balance)+ Task 2(造价)+ Task 3(SIGNATURE 6 触点)✅
- 全 L5 单测 → Task 1(towerStats L4/L5+DPS 守)/Task 2(economy L4/L5)/Task 3(signature)✅
- 选关分章 UI → Task 11 ✅
- 'story' 屏 → Task 10(storyCard)+ Task 13(main 接线)✅
- 中断续玩 → Task 9(save 快照)+ Task 13(写/清/应用)✅
- 模板池(先 4-6 套)→ Task 4(6 套)✅
- waveGen → Task 5 ✅
- storyCard → Task 10 ✅
- 接 5 样板战端到端 → Task 7(SAMPLES)+ Task 8(展开)+ Task 16(实玩)✅
- 50 关元数据骨架 → Task 7(CAMPAIGN builder)✅
- 门禁全过 → Task 16(test.sh:node --check/全测试/verify/winnable/check-imports)+ Task 14(balance-report)✅
- 受影响测试(§9.2)→ levels-integrity(T8)/economy-upgrade(T2)/towerStats(T1)/signatureSkills(T3)/levels-winnable(T8)✅

**铁律核对**(§15):
- `core/*`·`data/*` render-free:waveGen/campaign/boardTemplates/levels 纯数据,save 经注入 storage ✅
- 不跨游戏 import:check-imports 守(Task 16)✅
- 无构建·加载期确定性:genWaves 强制 seed(throw)、seed=level.id、builder 仅 index 数学、无 Math.random/Date ✅
- 故事原创史实向不抄版权:SAMPLES 白话钩子 + storyCard 统一话术 ✅

**类型/命名一致性**:
- `BAL.SIGNATURE_LEVEL`/`BAL.MAX_TOWER_LEVEL`/`BAL.UPGRADE_DMG_MULT_SOFT`/`BAL.UPGRADE_INTERVAL_MULT_SOFT`/`BAL.UPGRADE_COST_L4`/`BAL.UPGRADE_COST_L5` 全任务一致 ✅
- `genWaves(template, params, seed)` 签名 T5 定义、T8 调用一致(boss spawn 用 `...boss` → waveSystem `s.id→bossId` 映射验证过)✅
- `TEMPLATES` 键 `twoCamp..eightCamp` T4 定义、T7 引用、T8 展开一致 ✅
- `resumeSnapshot/writeResume/loadResume/clearResume` T9 定义、T13 使用一致;`hitLevelSelect` 新签名(返回 `{kind,...}`)T11 定义、T13 消费一致 ✅
- `storyCardLayout/hitStoryCard/drawStoryCard` T10 定义、T13 使用一致 ✅

**已知风险**(spec §13 对应缓解已入计划):
- L5 数值爆炸 → towerStats 单测 DPS 守护带 [1.8,2.5](T1)+ balance-report(T14)。
- 生成波不可通关 → winnable 硬 assert 全 50 关(T8 Step 5 调参循环)。
- 单关过长 → 2x 速度保留 + 续玩(T9/T13);时长趋势 balance-report 估(T14),细收紧留检查点 C。
