# 成都保卫战 · 试玩改进 10 点 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 James 试玩反馈的 10 点改进（等级头顶/升级反馈/弹道/暴击特效/波数+经济/弓箭数值/按钮位置/点击修复/首页背景图+BGM），守住现有 50/50 可通关平衡。

**Architecture:** 纯参数+渲染改动，不动战斗/经济架构。弹道与暴击只升级视觉、伤害仍开火瞬间结算。平衡组（波数/数值）每步用 `tools/sim-economy.mjs` 真实经济模拟重测。任务串行编排以规避 `main.js`/`attacks.js`/`entityRenderer.js` 的多点重叠。

**Tech Stack:** 原生 ES modules + Canvas 2D，`node:test` 单测，`bash scripts/test.sh` 全门禁，确定性 RNG（加载期零 random）。

**Spec:** `docs/superpowers/specs/2026-06-13-tower-defender-playtest-improvements-design.md`

---

## 文件结构（涉及文件与职责）

| 文件 | 职责 | 被哪些任务改 |
|------|------|------------|
| `src/render/entityRenderer.js` | 塔/敌/弹道/特效绘制 | T1(等级头顶)、T5(弹道分类)、T6(敌人闪红) |
| `src/main.js` | 屏幕状态机+输入+渲染装配 | T2(升级)、T3(按钮)、T4(点击命中)、T9(首页BGM) |
| `src/entities/projectile.js` | 弹道对象（对象池） | T5(加 kind 字段) |
| `src/systems/combat/projectileManager.js` | 弹道生成/老化 | T5(spawnTracer 透传 kind) |
| `src/systems/combat/attacks.js` | 五种攻击派发 | T5(传 g.attack)、T6(解构 isCrit) |
| `src/render/fx.js` | 飘字/光圈产生 | T6(暴击飘字 size，按需) |
| `src/data/generals.js` | 武将数值 | T7(廖化/黄忠 range+dmg) |
| `src/data/campaign.js` | 波数/难度曲线 | T8(波数 20→30) |
| `src/data/balance.js` | 平衡常量 | T8(经济微调，视模拟结果) |
| `src/core/assets.js` | 资源 MANIFEST | T10(注册背景图) |
| `src/ui/levelSelect.js` | 选关屏绘制 | T10(背景图绘制) |
| `assets/bg/` | 背景图资源（新建） | T10 |

**执行顺序（串行）：** T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10。A/B 组（T1-T5）先做、零平衡风险；C 组（T6-T8）每步门禁；D 组（T9-T10）最后，T10 需 James 挑图。

**通用收尾纪律：** 每个任务最后跑 `bash scripts/test.sh`（node --check 全文件 + 全单测 + verify-levels 0 漏怪 + check-imports），全绿才 commit。C 组额外平衡门禁见各任务。

---

## A/B 组 · 视觉与交互（低风险，不碰平衡）

### Task 1: 武将等级移到头顶 `Lv.N`

**Files:**
- Modify: `src/render/entityRenderer.js:104-109`（drawTower 信息层，删脚下金点、加头顶 Lv 文字）
- Test: `tests/entityRenderer.test.mjs`（仿现有 mock-ctx 模式）

**现状**（`entityRenderer.js:105-109`）：脚下画 `t.level` 个金点：
```js
// 等级 pips（L1-3 金点）
for (let i = 0; i < t.level; i++) {
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath(); ctx.arc(t.px - s + 4 + i * 6, t.py + s - 4, 2.2, 0, Math.PI * 2); ctx.fill();
}
```
其中 `s = C * 0.32`（drawTower 顶部定义）；立绘高 `h = C*1.42`，头顶在 `t.py - h + footPad ≈ t.py - C*1.32`。信息层屏幕直绘（不随 bob/pop）。

- [ ] **Step 1: 读现有 test 模式**

Read `tests/entityRenderer.test.mjs` 看它如何 mock `ctx`（记录 fillText/arc 调用）。后续断言仿此。

- [ ] **Step 2: 写失败测试**

在 `tests/entityRenderer.test.mjs` 加：用 mock ctx 调 `drawTower(ctx, {generalId:'liao', px:100, py:100, level:3, mode:'first', ...minimalTower}, 0)`，断言：
```js
// 头顶画了 'Lv.3'
assert.ok(ctx._texts.some(t => t.str === 'Lv.3'), '应在头顶画 Lv.3');
// 不再画脚下金点（arc 半径 2.2 的金点应消失）—— 断言金点 arc 调用数为 0
assert.equal(ctx._arcs.filter(a => a.r === 2.2).length, 0, '脚下金点应删除');
```
（依实际 mock 字段名调整 `_texts`/`_arcs`。）

- [ ] **Step 3: 跑测试确认失败**

Run: `node tests/entityRenderer.test.mjs`
Expected: FAIL（'Lv.3' 未画 / 金点仍在）

- [ ] **Step 4: 实现**

把 `entityRenderer.js:105-109` 的金点循环替换为头顶 Lv 文字。有立绘时画在 `t.py - C*1.45`，色块回退态画在 `t.py - s - 8`（`s=C*0.32`）：
```js
// 等级（头顶 Lv.N，深描边金字；屏幕直绘，邻格贴近也不被脚部遮挡）
{
  const lvY = img ? t.py - C * 1.45 : t.py - s - 8;
  ctx.font = `bold ${C * 0.3}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(20,12,4,.85)';
  ctx.strokeText('Lv.' + t.level, t.px, lvY);
  ctx.fillStyle = '#ffe08a'; ctx.fillText('Lv.' + t.level, t.px, lvY);
}
```
注意 `img` 变量在 drawTower 上文已定义（立绘存在判定）；若信息层作用域取不到 `img`，用 `generalSprite(t.generalId, t.level)` 重取或提升变量。

- [ ] **Step 5: 跑测试确认通过 + 全门禁**

Run: `node tests/entityRenderer.test.mjs` → PASS
Run: `bash scripts/test.sh` → 全绿

- [ ] **Step 6: Commit**

```bash
git add src/render/entityRenderer.js tests/entityRenderer.test.mjs
git commit -m "feat(tower-defender): 等级移到武将头顶 Lv.N（脚下金点改头顶描边金字，邻格贴近不再被遮挡）"
```

---

### Task 2: 升级武将 → 弹窗消失 + 强化闪光

**Files:**
- Modify: `src/main.js:341-347`（onPointerDown 的 upgrade 成功分支）
- Test: `tests/main-input.test.mjs` 或新建（依现有测试组织）

**现状**（`main.js:340-348`）：
```js
if (act === 'upgrade') {
  if (tryUpgrade(state, selectedTower)) {
    audio.sfx('upgrade');
    selectedTower.upgradedAt = state.time;   // 0.5s 金光弹跳
    spawnRing(state, selectedTower.px, selectedTower.py, '#ffd24d', C * 0.95, 0.5);
    spawnFloat(state, selectedTower.px, selectedTower.py - C * 1.3, 'L' + selectedTower.level + '!', '#ffd24d');
  }
  return;
}
```

- [ ] **Step 1: 写失败测试**

升级逻辑在 main.js 内联，难直接单测。改为断言「升级后行为」的最小可测点——若现有测试基础设施不易测 main.js 内联分支，跳过单测、靠冒烟（在 Step 4 后浏览器目检）。若有 `tests/` 能注入 state 的入口，断言升级成功后 `selectedTower` 被置 null。否则本任务以浏览器冒烟为验收，**在 plan 勾选时注明「视觉任务，冒烟验收」**。

- [ ] **Step 2: 实现**

把 upgrade 分支改为（升级成功后关弹窗 + 双层环 + 新飘字格式）：
```js
if (act === 'upgrade') {
  if (tryUpgrade(state, selectedTower)) {
    const t = selectedTower;
    audio.sfx('upgrade');
    t.upgradedAt = state.time;                                  // 金光罩（entityRenderer 读）
    spawnRing(state, t.px, t.py, '#ffd24d', C * 0.95, 0.5);     // 内环
    spawnRing(state, t.px, t.py, '#ffe9a8', C * 1.35, 0.7);     // 外环（更大更慢，扩张感）
    spawnFloat(state, t.px, t.py - C * 1.3, 'Lv.' + t.level + ' ↑', '#ffd24d');
    selectedTower = null;                                       // 弹窗消失（James 要求）
  }
  return;
}
```

- [ ] **Step 3: 全门禁**

Run: `bash scripts/test.sh` → 全绿（确认无语法/导入错误）

- [ ] **Step 4: 浏览器冒烟**

启动游戏（见 README/index.html，本地起静态服务），进一关建塔→点塔→点升级：确认①弹窗立即消失 ②武将身上金光+双层扩散环 ③头顶飘 `Lv.N ↑`。

- [ ] **Step 5: Commit**

```bash
git add src/main.js tests/
git commit -m "feat(tower-defender): 升级后弹窗消失+强化闪光（双层金环+Lv.N↑飘字，连升需重新点选）"
```

---

### Task 3: 提前出兵按钮挪到屏幕下方

**Files:**
- Modify: `src/main.js:172`（EARLY_BTN 工厂函数体）
- Test: 几何断言可单测（EARLY_BTN() 返回的 y 在底部）

**现状**（`main.js:172`，工厂函数）：
```js
const EARLY_BTN = () => ({ x: view.w / 2 - 80, y: HUD_H + 8, w: 160, h: 32 });
```
建造栏在 `view.h - BH - 12 = view.h - 82`（BH=70，见 buildBar.js:17）。按钮要放建造栏正上方、不重叠。

- [ ] **Step 1: 写失败测试**

若有能 import main 内部的测试入口则断言；EARLY_BTN 是模块内 const 不导出，改为「在 Step 2 实现后用几何常识验收」。本任务以实现+冒烟为主。

- [ ] **Step 2: 实现**

改函数体内 y（x/w 不变），放到建造栏上方约 40px：
```js
const EARLY_BTN = () => ({ x: view.w / 2 - 80, y: view.h - 82 - 40, w: 160, h: 32 });
```
（`view.h - 122`：建造栏顶 `view.h-82` 再上抬 40，留 8px 呼吸。）

- [ ] **Step 3: 全门禁 + 冒烟**

Run: `bash scripts/test.sh` → 全绿
浏览器：进一关备战阶段，确认「⚔ 提前出兵」按钮在底部建造栏上方、可点、不挡建造栏；点击触发提前出兵（`state.earlyRequested`）。iPad 竖屏也确认不与建造栏重叠。

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat(tower-defender): 提前出兵按钮从顶部挪到底部建造栏上方（拇指易够）"
```

---

### Task 4: 平板点击命中修复（按像素取最近塔）

**Files:**
- Modify: `src/main.js:59-61`（towerAt → 新增 towerAtPixel）、`main.js:354-356`（onPointerDown 塔命中）
- Test: `tests/` 新增 towerAtPixel 命中测试

**现状**：`towerAt(cell)`（`main.js:59-61`）按脚下单格精确匹配：
```js
function towerAt(cell) {
  return state.towers.find((t) => t.slot.x === cell.x && t.slot.y === cell.y) || null;
}
```
onPointerDown（`main.js:354-356`）：
```js
const cell = screenToCell(sx, sy);
const t = towerAt(cell);
if (t) { selectedTower = t; return; }
```
问题：立绘画在格子上方，点头/身坐标落上一格 → towerAt 找不到。

- [ ] **Step 1: 写失败测试**

新建 `tests/tower-hit.test.mjs`。导出 `towerAtPixel` 后测：塔在棋盘像素 `(px,py)`，点击落在头部上方（`py - C*0.8`，即视觉主体内但脚下格之上），应命中该塔。
```js
import assert from 'node:assert';
import { towerAtPixel } from '../src/main.js';  // 若 main.js 不便导出，见 Step 2 备选
const C = 36;
const towers = [{ px: 100, py: 100, slot:{x:2,y:2} }];
// 点头部（脚上方 0.8 格），应命中
assert.equal(towerAtPixel(towers, 100, 100 - C*0.8), towers[0]);
// 点 1.5 格外，不命中
assert.equal(towerAtPixel(towers, 100 + C*1.5, 100), null);
```
**备选**：main.js 是装配入口、不宜导出测试符号 → 把 `towerAtPixel(towers, bx, by)` 抽到 `src/systems/targetingSystem.js` 或新 `src/core/hit.js`（纯函数易测），main.js import 使用。推荐抽纯函数。

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/tower-hit.test.mjs` → FAIL（towerAtPixel 未定义）

- [ ] **Step 3: 实现纯函数**

在 `src/core/hit.js`（新建）：
```js
// 按棋盘像素距离取最近塔（命中盒覆盖立绘视觉主体，修"点头选不中"）。
// bx,by = 棋盘像素坐标（= (screenX-view.ox)/view.scale，screenToCell 的中间量）。
import { BAL } from '../data/balance.js';
const C = BAL.CELL;
const HIT_R = C * 0.7;                       // 命中半径（覆盖立绘主体+容差）
export function towerAtPixel(towers, bx, by) {
  let best = null, bestD2 = HIT_R * HIT_R;
  for (const t of towers) {
    // 以脚底上方 0.5 格为视觉中心（立绘主体居中处），更贴合手感
    const cx = t.px, cy = t.py - C * 0.5;
    const dx = bx - cx, dy = by - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) { bestD2 = d2; best = t; }
  }
  return best;
}
```

- [ ] **Step 4: 接入 main.js**

`main.js` 顶部 import：`import { towerAtPixel } from './core/hit.js';`
把 onPointerDown 的塔命中（`main.js:354-356`）改为用棋盘像素：
```js
const bx = (sx - view.ox) / view.scale, by = (sy - view.oy) / view.scale;
const t = towerAtPixel(state.towers, bx, by);
if (t) { selectedTower = t; return; }
selectedTower = null;
const cell = screenToCell(sx, sy);
const slot = slotAt(cell);
if (slot && tryBuild(state, slot, selected)) audio.sfx('build');
```
（保留原 `screenToCell`/`slotAt`/建塔逻辑；只把"选塔"换成像素命中。点空地命中不到塔 → selectedTower=null → 弹窗关，自然变稳。）

- [ ] **Step 5: 跑测试 + 全门禁**

Run: `node tests/tower-hit.test.mjs` → PASS
Run: `bash scripts/test.sh` → 全绿

- [ ] **Step 6: iPad/平板冒烟**

真机或 DevTools 触摸模拟：点武将头/身能稳定选中、点空地能稳定关弹窗、建塔仍正常。

- [ ] **Step 7: Commit**

```bash
git add src/core/hit.js src/main.js tests/tower-hit.test.mjs
git commit -m "fix(tower-defender): 平板点击命中盒改按像素取最近塔（修立绘头/身点不中，关弹窗随之变稳）"
```

---

### Task 5: 攻击弹道按类型箭矢化（纯视觉）

**Files:**
- Modify: `src/entities/projectile.js`（加 kind 字段）、`src/systems/combat/projectileManager.js:7-9`（spawnTracer 透传 kind）、`src/systems/combat/attacks.js:19,101,111`（3 处调用传 g.attack）、`src/render/entityRenderer.js:222-225`（drawProjectile 按 kind 分支）
- Test: `tests/projectile.test.mjs` + `node tools/smoke-shots.mjs`

**现状**：
- `projectile.js`：`{ fromX, fromY, toX, toY, color, ttl }`
- `projectileManager.js:7`：`spawnTracer(state, tower, enemy, color)`
- `attacks.js` 三处调用：`:19`（hitOnce）、`:101`（attackCharge）、`:111`（attackBurn），调用处都持有 `g`
- `entityRenderer.js:222`：`drawProjectile` 一根 2.5px 直线

- [ ] **Step 1: 写失败测试**

`tests/projectile.test.mjs`：
```js
import assert from 'node:assert';
import { newProjectile, resetProjectile } from '../src/entities/projectile.js';
const p = resetProjectile(newProjectile(), 0,0, 10,10, '#fff', 0.12, 'single');
assert.equal(p.kind, 'single', 'projectile 应带 kind');
const d = newProjectile();
assert.equal(d.kind, 'single', '默认 kind=single');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/projectile.test.mjs` → FAIL（kind undefined）

- [ ] **Step 3: 加 kind 字段**

`src/entities/projectile.js`：
```js
export function newProjectile() {
  return { fromX: 0, fromY: 0, toX: 0, toY: 0, color: '#fff', ttl: 0, kind: 'single' };
}
export function resetProjectile(p, fromX, fromY, toX, toY, color, ttl = 0.12, kind = 'single') {
  p.fromX = fromX; p.fromY = fromY; p.toX = toX; p.toY = toY; p.color = color; p.ttl = ttl; p.kind = kind;
  return p;
}
```

- [ ] **Step 4: spawnTracer 透传 kind**

`src/systems/combat/projectileManager.js`：
```js
export function spawnTracer(state, tower, enemy, color, kind = 'single') {
  state.projectiles.push(pool.acquire(tower.px, tower.py, enemy.px, enemy.py, color, 0.12, kind));
}
```
确认 `pool.acquire` 把所有参数透传给 `resetProjectile`（makePool 约定）；若 acquire 签名固定，按其约定补 ttl/kind 位。

- [ ] **Step 5: attacks.js 三处调用传 g.attack**

- `attacks.js:19`（hitOnce）：`spawnTracer(state, tower, enemy, g.color, g.attack);`
- `attacks.js:101`（attackCharge）：`spawnTracer(state, tower, primary, g.color, g.attack);`
- `attacks.js:111`（attackBurn）：`spawnTracer(state, tower, primary, g.color, g.attack);`

- [ ] **Step 6: drawProjectile 按 kind 分支**

`src/render/entityRenderer.js:222-225` 替换。伤害仍开火瞬间结算（不变），弹道在 ttl 内从 from 飞向 to：
```js
export function drawProjectile(ctx, p) {
  const dx = p.toX - p.fromX, dy = p.toY - p.fromY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  ctx.save();
  ctx.lineCap = 'round';
  if (p.kind === 'single') {                         // 箭矢：细杆+箭头
    ctx.strokeStyle = p.color; ctx.lineWidth = 2;
    const tailX = p.toX - ux * 14, tailY = p.toY - uy * 14;
    ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(p.toX, p.toY); ctx.stroke();
    const a = 4;                                      // 箭头
    ctx.fillStyle = p.color; ctx.beginPath();
    ctx.moveTo(p.toX, p.toY);
    ctx.lineTo(p.toX - ux*7 - uy*a, p.toY - uy*7 + ux*a);
    ctx.lineTo(p.toX - ux*7 + uy*a, p.toY - uy*7 - ux*a);
    ctx.closePath(); ctx.fill();
  } else if (p.kind === 'burn') {                     // 火弹：橙红圆+拖尾
    const g = ctx.createLinearGradient(p.fromX,p.fromY,p.toX,p.toY);
    g.addColorStop(0,'rgba(255,120,40,0)'); g.addColorStop(1,p.color);
    ctx.strokeStyle = g; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.fromX,p.fromY); ctx.lineTo(p.toX,p.toY); ctx.stroke();
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.toX,p.toY,3.5,0,Math.PI*2); ctx.fill();
  } else if (p.kind === 'slow') {                     // 水弹：蓝色圆+波纹
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.toX,p.toY,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(p.toX,p.toY,6,0,Math.PI*2); ctx.stroke();
  } else {                                            // splash/charge：保留粗线（刀光/突进）
    ctx.strokeStyle = p.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.fromX,p.fromY); ctx.lineTo(p.toX,p.toY); ctx.stroke();
  }
  ctx.restore();
}
```

- [ ] **Step 7: 跑测试 + 冒烟 + 全门禁**

Run: `node tests/projectile.test.mjs` → PASS
Run: `node tools/smoke-shots.mjs` → 无报错（弹道冒烟）
Run: `bash scripts/test.sh` → 全绿
浏览器：黄忠/廖化看到箭矢、诸葛/黄月英看到火弹、关羽看到水弹、张飞/马超粗线刀光。

- [ ] **Step 8: Commit**

```bash
git add src/entities/projectile.js src/systems/combat/projectileManager.js src/systems/combat/attacks.js src/render/entityRenderer.js tests/projectile.test.mjs
git commit -m "feat(tower-defender): 弹道按攻击类型分渲染（箭矢/火弹/水弹/刀光，纯视觉·伤害仍开火瞬间结算）"
```

---

## C 组 · 平衡（高风险，每步平衡门禁）

> **C 组平衡门禁（每个任务收尾必跑）：**
> ```bash
> node tools/sim-economy.mjs          # 真实经济模拟，全 50 关，看胜负/剩余城防
> node tools/verify-levels.mjs        # 50 关 0 漏怪
> node tools/balance-report.mjs       # 威胁基，确认无新墙（已知 L41 哨戒位）
> ```
> 目标：守 50/50 可通关。任一关从「可通关」掉到「墙」即回滚该步、调整再试。

### Task 6: 黄忠暴击特效（敌人头顶「暴击!」+ 闪红）

**Files:**
- Modify: `src/systems/combat/attacks.js:15-22`（hitOnce 解构 isCrit + 触发 fx/标记）、`src/render/entityRenderer.js`（drawEnemy 读 critFlashAt 闪红）、`src/render/fx.js`（可选：float 加 size）
- Test: `tests/attacks.test.mjs`（暴击命中产生 float + 置 critFlashAt）

**现状**（`attacks.js:14-22`，🔴 GLM：只解构 dmg、丢 isCrit）：
```js
function hitOnce(state, tower, g, enemy, rng) {
  const { dmg } = calcDamage(tower, g, enemy, rng);
  enemy.hp -= dmg;
  enemy.lastHitAt = state.time;
  spawnTracer(state, tower, enemy, g.color);
  if (enemy.hp <= 0) return killEnemy(state, enemy);
  return false;
}
```
`attacks.js:10` 已 `import { spawnRing } from '../../render/fx.js'`——同模块加 import `spawnFloat`。`damageCalc.js:7-16` 仅黄忠 L3 返回 `isCrit:true`。

- [ ] **Step 1: 写失败测试**

`tests/attacks.test.mjs`（或现有暴击测试文件）加：构造黄忠 L3 塔 + 一个敌人，强制暴击（注入返回 isCrit 的 rng 或直接调 calcDamage 验证链路），断言命中后 `state.fx` 含一个 `text:'暴击!'` 的 float、且 `enemy.critFlashAt === state.time`：
```js
// 黄忠 L3 + 必暴 rng（rng()<0.25 恒真 → 用 () => 0）
const enemy = mkEnemy({ hp: 999 });
hitOnceForTest(state, huangL3Tower, GENERALS.huang, enemy, () => 0);
assert.ok(state.fx.some(f => f.text === '暴击!'), '暴击应弹飘字');
assert.equal(enemy.critFlashAt, state.time, '暴击应置 critFlashAt');
```
（`hitOnce` 非导出 → 通过 `runAttack`（导出）走 attackSingle 间接触发，或临时导出 hitOnce 供测试。推荐经 runAttack 测，更贴近真实路径。）

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/attacks.test.mjs` → FAIL

- [ ] **Step 3: 实现 hitOnce**

`attacks.js` 顶部 import 改：`import { spawnRing, spawnFloat } from '../../render/fx.js';`
`hitOnce` 改（C 取 `BAL.CELL`，文件已有 `const CELL = BAL.CELL`）：
```js
function hitOnce(state, tower, g, enemy, rng) {
  const { dmg, isCrit } = calcDamage(tower, g, enemy, rng);
  enemy.hp -= dmg;
  enemy.lastHitAt = state.time;
  if (isCrit) {
    enemy.critFlashAt = state.time;                                   // entityRenderer 读此叠红
    spawnFloat(state, enemy.px, enemy.py - CELL * 0.6, '暴击!', '#ff5a3a');
  }
  spawnTracer(state, tower, enemy, g.color, g.attack);                // kind 已在 T5 接入
  if (enemy.hp <= 0) return killEnemy(state, enemy);
  return false;
}
```
（若 T5 已合并，spawnTracer 第 5 参 g.attack 已就位；本任务在 T5 之后，保持一致。）

- [ ] **Step 4: drawEnemy 闪红**

Read `entityRenderer.js` 的 `drawEnemy`，找现有 `lastHitAt` 受击闪白逻辑，仿照加暴击闪红（更强、更长）：
```js
// 暴击闪红（类比 lastHitAt 闪白，更醒目）
const critAge = now - (e.critFlashAt || -9);
if (critAge >= 0 && critAge < 0.25) {
  ctx.save();
  ctx.globalAlpha = (1 - critAge / 0.25) * 0.6;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#ff3a2a';
  // 覆盖敌人 sprite 区域（用与受击闪白同样的矩形/形状）
  ctx.restore();
}
```
按 drawEnemy 现有结构落实（敌人绘制区的坐标/尺寸沿用闪白处变量）。

- [ ] **Step 5: 跑测试 + 全门禁 + 平衡门禁**

Run: `node tests/attacks.test.mjs` → PASS
Run: `bash scripts/test.sh` → 全绿
Run: C 组平衡门禁三连 → 50/50 不变（纯特效，数值零改，应无影响）
浏览器：黄忠升 L3，对敌暴击时看到头顶「暴击!」+ 敌人闪红。

- [ ] **Step 6: Commit**

```bash
git add src/systems/combat/attacks.js src/render/entityRenderer.js tests/attacks.test.mjs
git commit -m "feat(tower-defender): 黄忠暴击特效（敌头顶暴击!飘字+闪红，修hitOnce丢弃isCrit的链路·数值零改）"
```

---

### Task 7: 廖化 + 黄忠 加射程降攻击

**Files:**
- Modify: `src/data/generals.js:58-65`（廖化）、`:9-16`（黄忠）
- Test: `tests/generals.test.mjs`（数值断言）+ C 组平衡门禁

**现状**：廖化 `range:3.0, dmg:6`（`generals.js:60`）；黄忠 `range:3.5, dmg:9`（`generals.js:11`）。

- [ ] **Step 1: 写失败测试**

`tests/generals.test.mjs` 加/改：
```js
import { GENERALS } from '../src/data/generals.js';
assert.equal(GENERALS.liao.range, 4.0); assert.equal(GENERALS.liao.dmg, 4);
assert.equal(GENERALS.huang.range, 4.5); assert.equal(GENERALS.huang.dmg, 6);
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/generals.test.mjs` → FAIL

- [ ] **Step 3: 改数值**

`generals.js`：廖化 `range: 3.0 → 4.0`、`dmg: 6 → 4`；黄忠 `range: 3.5 → 4.5`、`dmg: 9 → 6`。（只改这两个字段，其余不动。）

- [ ] **Step 4: 跑测试 + 平衡门禁**

Run: `node tests/generals.test.mjs` → PASS
Run: `bash scripts/test.sh` → 全绿
Run: C 组平衡门禁三连。
**决策点**：若 sim-economy 出现某关从「可通关」掉到「墙」（廖化/黄忠是常用主力，降攻击可能削整体输出）→ 微调幅度（如 dmg 只降 1 而非降到 4/6，或 range 多给 0.5 补偿），重跑直到 50/50。记录最终数值。

- [ ] **Step 5: Commit**

```bash
git add src/data/generals.js tests/generals.test.mjs
git commit -m "feat(tower-defender): 廖化/黄忠改远程消耗位（廖化3→4射程·6→4攻；黄忠3.5→4.5·9→6；sim-economy守50/50）"
```

---

### Task 8: 波数 20→30 + 经济够升满级

**Files:**
- Modify: `src/data/campaign.js:29`（波数公式）；可能 `src/data/balance.js:10,24-25`（经济微调，视模拟结果）
- Test: `tests/campaign.test.mjs` 或 `tests/waveGen.test.mjs`（波数断言）+ C 组平衡门禁

**现状**（`campaign.js:29`）：`waveCount: 20 + Math.round(p * (ch - 1))` → 第1章 20、第5章 24。

- [ ] **Step 1: 写失败测试**

`tests/campaign.test.mjs`（或新建）断言波数：
```js
import { CAMPAIGN } from '../src/data/campaign.js';
assert.equal(CAMPAIGN[0].waveCount, 30, '第1关 30 波');   // ch1 k0
assert.equal(CAMPAIGN[49].waveCount, 34, '第50关 34 波');  // ch5 k9: 30+round(1*4)=34
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/campaign.test.mjs` → FAIL（现在是 20/24）

- [ ] **Step 3: 改波数公式**

`campaign.js:29`：`waveCount: 30 + Math.round(p * (ch - 1)),`

- [ ] **Step 4: 跑测试 + 平衡门禁（核心决策步）**

Run: `node tests/campaign.test.mjs` → PASS
Run: `node tools/sim-economy.mjs`（看每关玩家能把主力升到几级 + 50 关胜负）
**决策树**：
- 若 50/50 仍可通关 **且** 主力能升到 L5 → 完成，经济不动。
- 若可通关但仍升不满 L5 → 微调经济（优先 `BAL.WAVE_CLEAR_BONUS 15→20`；不够再 `UPGRADE_COST_L5 2.8→2.5`），重跑 sim-economy。
- 若因曲线摊平变太简单（spec ⚠️ 平衡副作用）→ 上调对应章 `difficulty`（campaign.js `diffLo/diffHi`），不靠"少给钱"卡。
Run: `node tools/verify-levels.mjs` + `node tools/balance-report.mjs` → 0 漏怪、无新墙。
记录最终采用的经济参数。

- [ ] **Step 5: 性能冒烟（小米 pad 担忧）**

浏览器 DevTools → Performance，4x CPU throttle，打到某关末波（峰值同屏 ~30-50 单位），确认帧率可玩（≥30fps）。spec 已论证末波峰值与波数无关（intensity 归一化），此步是实测确认。

- [ ] **Step 6: Commit**

```bash
git add src/data/campaign.js src/data/balance.js tests/campaign.test.mjs
git commit -m "feat(tower-defender): 波数20→30每关+10（满级可达），经济按sim-economy数据驱动微调，守50/50可通关"
```

---

## D 组 · 首页资源（最后做，T10 需 James 参与挑图）

### Task 9: 首页背景音乐

**Files:**
- Modify: `src/main.js:116`（toSelect 起 BGM）、`main.js:283-285`（onPointerDown 首次手势补播）
- Test: `tests/` 断言 toSelect 触发 startBgm（若 audio 可 mock）

**现状**：`toSelect()`（`main.js:116`）= `screen='select'; selectedTower=null; audio.stopBgm();`——进选关**停**了 BGM。`audio.startBgm(track)` 现成（`main.js:102` 用法），5 首 `west-*.mp3`。选关曲用 track 0（west-1）。

- [ ] **Step 1: 实现 toSelect 起选关 BGM**

`main.js:116`：
```js
const SELECT_BGM_TRACK = 0;   // 选关屏固定用 west-1（雄浑开场）
function toSelect() { screen = 'select'; selectedTower = null; audio.startBgm(SELECT_BGM_TRACK); }
```

- [ ] **Step 2: 首次进入补播（自动播放限制）**

boot 首次 `screen='select'`（main.js:43）不经 toSelect，且首次手势前 AudioContext 未解锁。在 onPointerDown 的 `audio.init()`（`main.js:284`）之后补一句：选关屏且 BGM 未在放则补播。
```js
function onPointerDown(ev) {
  audio.init();
  if (screen === 'select') audio.startBgm(SELECT_BGM_TRACK);   // 首次手势解锁后补播（startBgm 幂等：已在放则不重启）
  ...
}
```
**确认 `audio.startBgm` 幂等**：读 `src/core/audio.js` 的 startBgm，若重复调用会重启同轨 → 加「同轨已播则跳过」守卫；若已幂等则无需改。

- [ ] **Step 3: 测试 + 全门禁**

若 audio 可注入 mock：断言 toSelect 调 startBgm(0)。否则靠冒烟。
Run: `bash scripts/test.sh` → 全绿

- [ ] **Step 4: 冒烟**

浏览器：①从游戏返回选关（leaveToSelect→toSelect）→ 立即响 west-1；②刷新直接进首页 → 首次点击后响。进关后切到战斗 BGM（不被选关曲干扰）。

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/core/audio.js tests/
git commit -m "feat(tower-defender): 首页选关屏背景音乐（west-1，首次手势后补播绕过自动播放限制）"
```

---

### Task 10: 首页背景图（工笔国画·曹刘对阵）

**Files:**
- Create: `assets/bg/select-bg.webp`（AI 生成，James 挑定）
- Modify: `src/core/assets.js`（MANIFEST 注册）、`src/ui/levelSelect.js:55-57`（绘制背景图替代/叠加 backdrop）
- Test: 冒烟为主（资源加载 + 绘制不崩）

> ⚠️ 本任务需 James 参与挑图，不可全自动完成。

- [ ] **Step 1: 生成候选图（James 挑）**

用 fal.ai（`ecc:fal-ai-media` skill 或等价图像生成）生成工笔国画横图，prompt 要点：
> 中国传统工笔重彩国画，横构图。左侧古成都城墙巍峨，城门大开；城墙下左侧刘备（仁厚长者、面向右）率三五战将与列阵士兵，右侧曹操（枭雄、面向左）率战将与大军对峙；旌旗蔽日、场面壮阔；暖褐金色调，与游戏立绘统一。无文字。16:9。
生成 3-4 张 → 给 James 挑选最接近的 1 张。
- 尺寸：覆盖横竖屏用，建议 ≥1920×1080；导出 webp 控制体积（与现有 sprites 一致策略）。
- 存 `assets/bg/select-bg.webp`。

- [ ] **Step 2: 注册到 MANIFEST**

Read `src/core/assets.js` 看现有图片注册格式（sprites 怎么登记/preload），仿照加背景图条目（key 如 `selectBg`）。确保 preload 覆盖它。

- [ ] **Step 3: levelSelect 绘制背景图**

`src/ui/levelSelect.js:55-57`，把 `backdrop(ctx, view.w, view.h)` 改为：先 cover 居中铺背景图，再叠暗角保证文字可读。
```js
const bg = assetImage('selectBg');   // 按 assets.js 取图 API
if (bg) {
  // cover 居中裁切
  const scale = Math.max(view.w / bg.width, view.h / bg.height);
  const dw = bg.width * scale, dh = bg.height * scale;
  ctx.drawImage(bg, (view.w - dw)/2, (view.h - dh)/2, dw, dh);
  // 暗角/压暗，保证选关卡片与文字可读
  ctx.fillStyle = 'rgba(13,8,5,.42)'; ctx.fillRect(0, 0, view.w, view.h);
} else {
  backdrop(ctx, view.w, view.h);   // 图未就绪兜底（GROUND_THEMES 同款回滚思路）
}
```

- [ ] **Step 4: 全门禁 + 冒烟**

Run: `bash scripts/test.sh` → 全绿（含 node --check；图加载是运行期，单测不碰）
浏览器：首页显示背景图、选关卡片/章节标题清晰可读、横竖屏不变形、图缺失时回退渐变不崩。

- [ ] **Step 5: Commit**

```bash
git add assets/bg/select-bg.webp src/core/assets.js src/ui/levelSelect.js
git commit -m "feat(tower-defender): 首页工笔国画背景图（成都城墙·曹刘对阵），缺图回退渐变"
```

---

## 收尾

全部 10 任务完成后：
- [ ] 跑一次完整 `bash scripts/test.sh` + C 组平衡门禁三连，确认全绿、50/50。
- [ ] iPad/小米 pad 真机整体冒烟（点击手感、末波帧率、首页背景+BGM、各项视觉）。
- [ ] 用 `superpowers:finishing-a-development-branch` 决定合并/PR（develop 分支，push 须 `dangerouslyDisableSandbox`）。
- [ ] 更新 memory 的 tower-defender 条目（本轮 10 点改进 ship）。

## Self-Review（plan 对照 spec）

**Spec 覆盖：** 10 点 ↔ T1(等级)/T2(升级)/T5(弹道)/T6(暴击)/T3(按钮)/T4(点击)/T8(波数)/T7(廖化黄忠)/T7+(黄忠在T7)/T9(BGM)/T10(背景) — 全覆盖。GLM 加固项已落任务：hitOnce 解构 isCrit(T6 Step3)、spawnTracer kind 三调用点(T5 Step5)、EARLY_BTN 工厂函数(T3 Step2)、飘字 Lv.N↑+双环(T2)、state.fx 路线(T6)。

**类型/签名一致：** `towerAtPixel(towers,bx,by)`(T4 定义=接入一致)；`spawnTracer(...,kind)` / `resetProjectile(...,kind)`(T5 定义=调用一致)；`enemy.critFlashAt`(T6 写=drawEnemy 读一致)；`SELECT_BGM_TRACK`(T9 定义=两处用一致)。

**占位符：** 无 TBD。数据驱动的经济微调(T8 Step4 决策树)与廖化黄忠幅度(T7 Step4)是**显式决策点**配判据，非占位。渲染类(drawEnemy 闪红/assets API)给了「读现有 X 模式仿照」的明确指示 + 骨架代码。
