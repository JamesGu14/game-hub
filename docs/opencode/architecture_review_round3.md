# 《成都保卫战》技术架构第三轮评审报告

**评审对象**: `/Users/james/Projects/game-hub/.claude/plans/chengdu-tower-defense-architecture.plan.md` (182 行, 含新增 §A 架构评审闭环)  
**上轮评审**: `docs/opencode/architecture_review_compound.md`  
**评审方式**: 单审 (基于 compound review 逐项核对修复状态)

---

## 一、总体结论

### Verdict: **CONDITIONAL APPROVE → 接近定稿，仅剩 2.5 个可闭合问题**

本轮更新**高质量地闭合了上轮 compound review 中的 14/16 项问题**，新增的 §A 附录（架构评审闭环）直接把 P0/P1/P2 逐项落到了具体文件和规则上。特别是：

- **3 个 P0 全部进入正文**：accumulator cap、deferred event queue、phase guard 都已在 Game Loop / Data Flow 段落成为正式设计，不再是附录待办。
- **8 个 P1 全部有落点**：level.scale 工厂、司马懿 BOSS 专用 `bossSystem.js`、灼烧蔓延完整规则、hitscan 弹道、combatSystem 拆分、entityRenderer 接口、edge-case 清单全部明确。
- **7 个 P2 中 6 个已闭合**：check-imports.sh、音效布线、Pointer Events 触屏、hub 注册、gameLoop.test、L8 空间验证都有说法。

**剩余问题**:
1. **P1-6 gameState 只读**被有意软化为"约定级"（作者的理由是性能）。这是一个可接受的权衡，但需要记录为**已知风险**。
2. **P2-5 对象池**仍未明确分配到模块。
3. **新发现 P1**：deferred event queue 与 victorySystem 的时序存在**隐性矛盾**——可能导致成都 HP=0 后 combat/targeting 仍在同一 tick 内执行。
4. **新发现 P2**：新增的 `bossSystem.js` 在 game loop 中的执行顺序未指定。

---

## 二、上轮问题修复状态对照

### 🔴 P0 项 — 3/3 已修复并入正文

| # | 上轮问题 | 修复状态 | 所在行/段落 |
|---|---|---|---|
| P0-1 | gameLoop 螺旋死亡 | **已修复** | §Game Loop 第 2 段: `累加器封顶 FIXED_DT×3` + `visibilitychange` 重置 |
| P0-2 | EventBus 同步重入 | **已修复** | §Data Flow: `emit() 只入队, gameLoop 每步末统一 flushEvents()` |
| P0-3 | HP=0 后同 tick 继续执行 | **已修复** | §Game Loop: `相位机 prep→combat→won/lost`, 各 system 入口 phase guard |

### 🟡 P1 项 — 8/8 已有落点（其中 1 项为软化处理）

| # | 上轮问题 | 修复状态 | 所在行/段落 | 备注 |
|---|---|---|---|---|
| P1-1 | level.scale 应用 | **已修复** | §A: `entities/enemy.js` 工厂 `createEnemy(type, scale)`, waveSystem 传入; HP/掉金 = 基值×scale | 推荐位置合理 |
| P1-2 | 司马懿 BOSS AI | **已修复** | §A: 新增 `systems/bossSystem.js`, 召唤/震慑双技; 余 BOSS `abilities=[]` | 好设计 |
| P1-3 | 灼烧蔓延规则 | **已修复** | §A: 命中施灼烧 4/s·3s; 施加瞬间向 1.5 格内最多 2 未燃敌蔓延一次; 链上限 3; 蔓延产物不再二次蔓延; 叠加上限 3 层 | 规则完整 |
| P1-4 | 弹道机制 | **已修复** | §A: v1 即时命中(hitscan); `projectileManager.js` 只产纯表现轨迹 | 最小路径 |
| P1-5 | combatSystem 拆分 | **已修复** | §目录树: `systems/combatSystem.js` 仅编排 + `systems/combat/` 4 子模块 | 已模块化 |
| P1-6 | gameState 只读强制 | **软化闭合** | §A: "约定+只读 accessor+可选 dev freeze; 不做热循环硬冻结(Object.freeze 性能代价)" | **记录为已知风险** |
| P1-7 | 渲染契约形式化 | **已修复** | §目录树: 新增 `render/entityRenderer.js` 定义 `drawTower/drawEnemy/drawProjectile/drawCastle/drawCamp` | 接口稳定 |
| P1-8 | Edge-case 契约 | **已修复** | §A 列出 5 条: 同 tick 多敌到城、击杀与到城同 tick、中途拆光塔、0 秒提前出兵、关内退出/刷新 | 清单完整 |

### 🟢 P2 项 — 6/7 已修复

| # | 上轮问题 | 修复状态 | 所在行/段落 |
|---|---|---|---|
| P2-1 | check-imports.sh | **已修复** | §A: `scripts/check-imports.sh`, grep 相对 import, 非空即 fail |
| P2-2 | 音效布线 | **已修复** | §A: `audio/audio.js` 订阅 `towerFired/enemyKilled/bossSpawned/levelWon\|Lost` |
| P2-3 | 触屏支持 | **已修复** | §A: 统一 Pointer Events, `pointerdown` 复用鼠标处理, 命中区放大 |
| P2-4 | hub 注册 | **已修复** | §A: 完整卡片参数(id/title/subtitle/accent/路径) |
| P2-5 | 对象池分配 | **未修复** | 仅 §Render 中一句"对象池复用精灵/弹道", 无模块归属 |
| P2-6 | gameLoop.test.mjs | **已修复** | §目录树: `tests/gameLoop/... .test.mjs` + §A 明确测试范围 |
| P2-7 | L8 空间可行性 | **已修复** | §A: Phase 0 末纸面排布, 若挤则放大到 ~18×13 |

---

## 三、新发现的问题

### 🟡 新问题 N1：Deferred Event Queue + VictorySystem 存在时序矛盾（P1）

**问题描述**:

当前设计同时声明了两件事：
1. `eventBus.emit()` **只入队**，`gameLoop` 每步末 `flushEvents()` 才派发
2. `pathSystem` 中敌人到达成都时 **emit `castleDamaged`**
3. `victorySystem` 订阅 `castleDamaged` 并处理"扣城/判负"
4. 系统执行顺序：1.wave → 2.path → 3.targeting → 4.combat → 5.economy → 6.victory

**矛盾**：
- pathSystem 在步骤 2 中将 `castleDamaged` 事件入队
- 步骤 3–6 继续执行（targeting/combat/economy/victory）
- victorySystem 在步骤 6 中**无法处理本 tick 入队的 `castleDamaged`**，因为 flush 在每步末（即步骤 6 之后）才发生
- 结果：即使成都 HP 在本 tick 归零，targeting/combat 仍会在归零后继续执行，phase guard 也无法生效——因为 `phase` 还没被 victorySystem 改成 `lost`

**验证**:
```
tick start, phase='combat'
  step1 waveSystem runs
  step2 pathSystem: enemy reaches castle → gameState.castleHp -= 1, emit castleDamaged (queued)
  step3 targetingSystem: phase is still 'combat' → runs ✓
  step4 combatSystem: phase is still 'combat' → runs ✓  (可能继续击杀敌人、加钱)
  step5 economySystem: phase is still 'combat' → runs ✓
  step6 victorySystem: checks event queue? No, queue not flushed yet.
                    OR checks gameState.castleHp directly? If so, transitions to lost here.
  flushEvents() → castleDamaged delivered to victorySystem, but phase already changed?
                 Or if victorySystem only listens to events, it misses it entirely.
```

**建议修复方案（三选一）**:

**方案 A（推荐）**：将事件分为两类
- **状态变更事件**（`castleDamaged`、`enemyKilled` 中影响状态的部分）：直接同步处理或写入 gameState，不入队
- **通知事件**（HUD/音效刷新）：deferred flush

具体来说：
- `pathSystem` 直接修改 `gameState.castleHp`（单一真相源）
- `pathSystem` 同时 emit `castleDamaged` 作为**纯通知**（供 HUD/audio）
- `victorySystem` 在步骤 6 中**直接读取 `gameState.castleHp`** 判定输赢，不依赖事件

**方案 B**：调整 flush 时机
- 系统执行顺序改为：1.wave → 2.path → **flushEvents()** → 3.targeting → 4.combat → 5.economy → 6.victory
- 这样 victorySystem 在步骤 6 时已经收到了本 tick 的 `castleDamaged`
- 缺点：flush 后 combatSystem 仍可能 emit 新事件，需要多次 flush 或限制 combat 阶段不再 emit 状态变更事件

**方案 C**：victorySystem 在 flush 之后运行
- 系统步骤只列 1–5，victorySystem 在 **flushEvents() 之后**执行
- 这样 victorySystem 可以看到本 tick 的所有事件
- 但需要明确 `phase` 变更后 targeting/combat/economy 已经执行过了，是否允许？phase guard 只能防止下一 tick，不能回溯本 tick

**综合建议**：采用 **方案 A**。把 `gameState` 作为唯一状态源，事件仅用于通知。这是计划正文自己已经声明的原则（"单一真相源 = gameState; 事件只通知, 不绕过 state 改数据"），但 Data Flow 图中 `castleDamaged → victorySystem(扣城/判负)` 的表述与此矛盾。应更新为：

```
pathSystem 敌到成都 → 直接修改 gameState.castleHp
                    → emit castleDamaged{dmg} (纯通知, 供 HUD/audio)
victorySystem 步骤中 → 读取 gameState.castleHp, 判定 phase 转换
```

---

### 🟢 新问题 N2：BossSystem 在 game loop 中的执行顺序未指定（P2）

**问题描述**:

新增 `systems/bossSystem.js`（P1-2 修复），但 §Game Loop 的 6 步系统顺序中**没有它的位置**：

```
1. waveSystem
2. pathSystem
3. targetingSystem
4. combatSystem
5. economySystem
6. victorySystem
```

Boss 的两个能力：
- **召唤魏卒** → 相当于向场上注入新敌人，需要在 `pathSystem` 之前或之后运行
- **震慑将塔** → 使塔停火 2s，需要在 `targetingSystem` 之前运行（否则塔已经选好目标开火了）

**建议**：明确 bossSystem 在步骤 1.5（waveSystem 之后、pathSystem 之前）运行：

```
1. waveSystem
1.5 bossSystem   // 处理 BOSS 计时器: 召唤→注入 enemies[], 震慑→设置 towers[i].stunned
2. pathSystem
3. targetingSystem  // 被震慑的塔直接 skip
4. combatSystem
5. economySystem
6. victorySystem
```

并在 targetingSystem/combatSystem 的 phase guard 基础上，增加 tower-level guard：
```js
if (tower.stunnedTimer > 0) continue;
```

---

### 🟢 新问题 N3：灼烧蔓延规则的一处潜在歧义（P2）

**问题描述**:

§A 中 P1-3 灼烧蔓延规则：
> "施加瞬间向 1.5 格内最多 2 个未燃敌蔓延一次, 整条链上限 3、**蔓延产生的不再二次蔓延**; 叠加上限 3 层、各自计时"

"整条链上限 3" 与 "蔓延产生的不再二次蔓延" 放在一起有两种理解：
1. **严格理解**：只有原始诸葛亮火源可以蔓延一次，被蔓延者完全不能再次蔓延。链长 = 2（源 + 1 次蔓延）。
2. **链长理解**：链上限 3 表示火源→A→B 共 3 个敌人，A 可以蔓延给 B，但 B 不能继续蔓延。

文档写的是"最多 2 个未燃敌蔓延一次" + "链上限 3"，倾向于理解 2（即源 + 2 蔓延 = 链 3）。但"蔓延产生的不再二次蔓延"又暗示 1 次。需要明确计数方式。

**建议**：直接给出公式化定义：
> 诸葛灼烧施加时，从火源向 1.5 格内最多 2 个未燃敌人各传播 1 层。传播后的灼烧**不能再继续传播**。因此一次诸葛出手最多点燃 3 个敌人（源目标 + 2 个被传播者）。

这样"链上限 3" = "源 + 2 被传播者"，"不再二次蔓延" = 被传播者不能继续传播，语义一致。

---

### 🟢 新问题 N4：同 tick "击杀与到城"处理顺序的具体实现（P2）

**问题描述**:

§A edge case 2b：
> "击杀与到城同 tick: **先结算到城**(扣城/消失), 已到城者不计击杀掉金"

这需要在 system 顺序中明确体现：pathSystem（到城）必须在 combatSystem（击杀）之前运行。当前顺序已经满足（2.path → 4.combat）。

但还有一个细节：如果 combatSystem 的溅射伤害同时杀死了另一个敌人，而这个敌人恰好在同 tick 也到达了成都（但 pathSystem 已经处理过完），这个死亡是否掉金？答案是"掉金"，因为它死于 combat，而非到城。文档没有区分这两种情况。

**建议**：在 edge-case 清单中补充：
> 2b.1 到城敌人：pathSystem 中直接扣城、移除、**不掉金**  
> 2b.2 死于 combat 的敌人（无论是否本 tick 即将到城）：正常掉金

---

## 四、剩余未闭合问题清单

| 优先级 | 问题 | 状态 | 建议动作 |
|---|---|---|---|
| P1 | **Deferred event queue + victorySystem 时序矛盾** | 新发现 | 采用方案 A：状态变更直接写 gameState，事件纯通知；更新 Data Flow 图 |
| P2 | **bossSystem.js 在 game loop 中的顺序未指定** | 新发现 | 加入步骤 1.5，在 waveSystem 之后、pathSystem 之前 |
| P2 | **对象池未分配至模块** | 上轮遗留 | `spriteRenderer.js` 内部实现精灵池；`combat/projectileManager.js` 管理弹道表现对象池 |
| P2 | **灼烧蔓延"链上限 3"的精确语义** | 新发现 | 补充公式化定义：源 + 最多 2 传播者 = 共 3，传播者不再传播 |
| P2 | **击杀与到城的掉金边界** | 新发现 | 补充 2b.1/2b.2 区分 |
| 已接受 | gameState 只读软化为约定级 | 上轮软化 | 无需修改，但建议用代码注释标注为"architectural risk accepted" |

---

## 五、最终建议

### 5.1 通过条件（比之前更宽松）

**建议：CONDITIONAL APPROVE — 只需修复/澄清 N1 即可进入 Phase 0**

N1（deferred event queue + victorySystem 时序矛盾）是唯一可能导致架构层面运行时 bug 的问题。其余 N2–N5 是文档精度问题，可在 Phase 0 顺手补齐。

必须修复：
1. **N1**: 明确 `castleDamaged` 等状态变更事件直接修改 `gameState`，事件仅作通知；或调整 flush 顺序使 victorySystem 能在本 tick 内响应
2. 更新 Data Flow 段落，使其与"单一真相源 = gameState"原则一致

强烈建议顺手修复：
3. **N2**: 在 game loop 顺序中加入 `bossSystem` 步骤
4. **P2-5**: 明确对象池归属（一行字即可）
5. **N3**: 灼烧蔓延公式化定义
6. **N4/N5**: edge-case 清单小补充

### 5.2 修复后的定稿建议

修复 N1 后，该架构计划可直接作为 **Phase 0 定稿**。原因：
- P0 全部在正文中实施
- P1 全部有模块归属和规则定义
- P2 除对象池外全部闭合
- 新增 N1 是 deferred queue 设计的自然推论，修复后不改变整体架构
- 风险章节与验收标准已足够清晰

### 5.3 对 Opus 4.8 本轮更新的评价

**高质量迭代**。本轮更新不是简单地把问题放进 TODO，而是：
- 把 P0 直接改进了 Game Loop 和 Data Flow 的核心段落
- 把 P1 映射到了新增/拆分的文件（bossSystem.js、combat/ 子模块、entityRenderer.js）
- 给出了可执行的规则（灼烧蔓延公式、hitscan 弹道、edge-case 清单）
- 对 P1-6 的软化有明确的工程理由（性能）而非回避

这种响应方式说明设计者对上一轮 review 的理解是准确的。修复 N1 后，该计划是我近期看过的**最扎实的浏览器游戏架构骨架之一**。

---

*Review generated after comparing updated plan against compound review findings.*
*Remaining actionable items: 1 P1 + 4 P2.*
