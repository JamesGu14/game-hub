# 成都保卫战 — 技术架构综合评审报告

**评审对象**: `/Users/james/Projects/game-hub/.claude/plans/chengdu-tower-defense-architecture.plan.md`  
**参考文档**:
- `docs/superpowers/specs/2026-06-06-tower-defender-design.md` (GDD §12 + §17)
- `docs/opencode/req_review.md` (第一轮需求评审)
- `docs/opencode/req_review_round2.md` (第二轮需求评审)

**评审方式**: 3 个 Oracle agent 并行 review，分别聚焦：
1. **Agent A** — 需求→架构映射 (requirements-to-architecture mapping)
2. **Agent B** — 架构模式、耦合与技术风险
3. **Agent C** — 边界 case、可测试性与实现可行性

**生成时间**: 2026-06-06

---

## 一、总体结论 (Executive Summary)

###  verdict: **GO with fixes** — 架构可进入 Phase 0，但必须在骨架阶段修复 3 个 P0 级问题

三个独立 reviewer 一致认为：该架构计划**结构正确、模块划分合理、与 GDD 高度对齐**。`eventBus.js` 和 `rng.js` 是对 §17.8 事件解耦与 §13 可测性的必要补充，并非过度设计。依赖方向 `data → entities → systems → core` 合理，render/ui 只读约定方向正确。

**但存在三类必须处理的问题**：
1. **运行时稳定性风险** (P0): game loop 无 accumulator 上限，低帧率下会螺旋死亡；同步 eventBus 存在重入状态损坏风险；同一 tick 内成都 HP 归零后后续系统仍会继续执行。
2. **实现歧义与架构空缺** (P1): `level.scale` 应用、`司马懿` BOSS AI、灼烧蔓延规则、弹道机制、combatSystem 大单体化等 8 项未在计划中闭合。
3. **工程纪律与验证** (P2): copy-and-own 策略无自动化检查、gameState 只读无强制、音效事件布线未描述等。

**修复工作量估计**: P0 项约 1–2 小时；P1 项约 4–6 小时（主要在文档补充 + 架构拆分）；P2 项约 2 小时。全部完成后，架构计划可作为 Phase 0 定稿。

---

## 二、Agent 审阅结果汇总

### 2.1 Agent A — 需求→架构映射

**核心结论**: 模块结构覆盖 GDD §12 与 §17 的显式模块；`eventBus.js`/`rng.js` 补充合理。发现 **4 个 P1 + 4 个 P2 共 8 个 gaps**。

| # | Gap | 来源 | 建议归属 | 严重度 |
|---|---|---|---|---|
| A1 | `level.scale` 应用逻辑未分配至模块 | GDD §17.5 | `waveSystem.js` 出兵时缩放 HP / `combatSystem.js` 击杀时缩放掉金 | P1 |
| A2 | 司马懿 BOSS 特殊 AI 未显式设计 | GDD §17.3 | `data/bosses.js`(AI 脚本) + `combatSystem.js`(震慑) + `waveSystem.js`(召唤注入) | P1 |
| A3 | 灼烧蔓延规则仍不完整 | 复审第二轮 §B | `combatSystem.js` + `data/balance.js`(蔓延参数) | P1 |
| A4 | 弹道速度/即时命中未决策 | 复审第二轮 §F | `combatSystem.js` + `entities/projectile.js` | P1 |
| A5 | 对象池未分配至具体模块 | 计划 Render 段 | `render/spriteRenderer.js`(精灵池) + `entities/projectile.js`(弹道池) | P2 |
| A6 | 音效事件布线未描述 | GDD §10 | `audio/audio.js` 订阅 eventBus 事件 | P2 |
| A7 | 触屏支持未明确 | GDD §9 | `main.js` 或 `ui/` pointer 事件 | P2 |
| A8 | hub 注册卡片细节未列 | GDD §12 | `js/games.js` 注册项(id/title/subtitle/主题色) | P2 |

**Agent A 关键建议**:
- 明确弹道机制为**即时命中**（伤害立即结算，弹道只做视觉），这是最小实现路径。
- `level.scale` 推荐由 `data/levels.js` 导出 `applyScale(enemyDef, scale)` 工具函数，在 `waveSystem` spawn 时统一调用。
- 司马懿的召唤应通过 `waveSystem.spawnEnemy()` 注入，而非直接 emit 事件。

---

### 2.2 Agent B — 架构模式、耦合与技术风险

**核心结论**: 架构方向正确，但**存在 3 个关键运行时风险**和 1 个工程纪律缺口。

| 风险 | 严重度 | 说明 | 来源 |
|---|---|---|---|
| **固定步长螺旋死亡** | **P0** | gameLoop 累加器无上限。若单帧 >16.67ms，会追帧运行多步，每步耗时使下一帧更慢 → CPU 100% 冻结 | 计划 gameLoop 段 |
| **同步 EventBus 重入** | **P1** | `emit('enemyKilled')` 同步触发 economySystem → `emit('goldChanged')` → 若某订阅者同步调用其他 system，会在 combatSystem 迭代中途修改 `gameState`，造成逻辑损坏 | `core/eventBus.js` 设计 |
| **gameState 只读无强制** | **P1** | render/ui "只读 gameState" 是约定而非约束。`render/` 中一行 `gameState.enemies.push(...)` 会静默破坏逻辑 | 计划数据流段 |
| copy-and-own 无自动化 | P2 | 仅靠 code review，无脚本/CI/hook 强制检查 | 计划 架构铁律 |
| y-sort 细节缺失 | P2 | 未说明多格实体(成都 2×2)、同 y  tiebreak、动态插入处理 | 计划 Render 段 |
| Canvas 2D 性能天花板未验证 | P2 | L8 最坏情况 40+ 敌人 + 18 塔 + 弹道 + FX，移动端表现未知 | 计划 Render 段 |
| 缺少 `gameLoop.test.mjs` | P2 | 时间最关键的组件没有测试 | 计划测试策略 |

**Agent B 关键建议**:
1. ** accumulator cap**: `MAX_ACCUMULATOR = FIXED_DT * 3`，且 `dt > 100ms` 时重置 accumulator（tab 后台切回）。
2. **Deferred event flush**: `bus.emit()` 只入队，gameLoop 每步结束后统一 flush，彻底消除重入。
3. **gameState 只读强制**: 传递给 render 前用 `Object.freeze(structuredClone(gameState))` 或 Proxy 拦截写入。
4. **CI 脚本**: `scripts/check-cross-game-imports.sh`，一行 `grep` 即可。

---

### 2.3 Agent C — 边界 case、可测试性与可行性

**核心结论**: `combatSystem` 将成长为 500+ 行大单体；5 个具体 edge case 未定义；渲染抽象未形式化。可行性 verdict：**Go with fixes**。

#### Edge Cases 表

| # | Scenario | 涉及系统 | 当前缺口 |
|---|---|---|---|
| C1 | 塔被出售时其弹道仍在飞行 | combatSystem / projectile.js / economySystem | 无孤儿弹道策略：应完成飞行、取消、还是抛出？ |
| C2 | 弹道飞行中目标敌人提前死亡 | combatSystem / projectile.js | 无重目标/清理规则。赵云远程箭射 BOSS，BOSS 先被黄忠击杀，弹道如何处理？ |
| C3 | `campFallen` 触发时机：波次清光 vs 敌人死光 | waveSystem / pathSystem / victorySystem | 若"清光"指所有敌人死亡，每个 `enemy.js` 必须携带 `campId`，计划未定义 |
| C4 | 同 tick 多敌人同时到达成都，扣城至 0 | pathSystem / victorySystem / combatSystem | 系统顺序 path → targeting → combat，成都 HP=0 后 targeting/combat 仍会执行 |
| C5 | 塔升级 mid-cooldown（L2 冷却中升到 L3） | economySystem / combatSystem | 冷却是按原比例继承、重置为 L3 全冷却、还是按旧速率继续？ |

#### 额外架构级发现

| 发现 | 严重度 | 说明 |
|---|---|---|
| `combatSystem` 大单体 | P1 | 同时负责：伤害计算、抗性矩阵、状态机、招牌技、弹道生成。应拆分为子模块 |
| 渲染抽象未形式化 | P1 | M1→M6 色块换 sprite 需要稳定的 `drawTower(ctx, tower, assets)` 等接口契约 |
| Path 在中心汇聚重叠 | P2 | 8 条路终点相同，最后 3 个 waypoints 必然重合或相邻，`pathSystem` 需明确无碰撞设计 |
| 16×11 格 L8 可行性 | P2/P3 | 第二轮 review 已指出，需在 M3 关卡设计前用纸面验证 |

**Agent C 关键建议**:
1. **拆分 combatSystem**:
   - `src/systems/combat/damageCalc.js`
   - `src/systems/combat/statusEffects.js`
   - `src/systems/combat/projectileManager.js`
   - `src/systems/combat/signatureSkills.js`
   - 顶层 `combatSystem.js` 仅编排调用顺序
2. **形式化渲染契约**: `src/render/entityRenderer.js` 提供 `drawTower/enemy/projectile(ctx, entity, assets)`，内部判断 `assets.getImage(key)` 是否为 null 决定 fallback。
3. **所有实体携带 `campId`**: 用于精确触发 `campFallen`。
4. **gameLoop phase guard**: 每个 system 入口检查 `if (gameState.phase !== 'combat') return;`。
5. **弹道生命周期契约**（v1 简化版）:
   - 塔被卖：弹道继续飞行至命中
   - 目标死亡：弹道取消（v1 无重目标；有溅射的按最后位置结算）
   - 不追踪/不转向

---

## 三、综合问题清单（按优先级）

### 🔴 P0 — 必须在 Phase 0 解决（阻塞稳定性）

| # | 问题 | 牵头 Agent | 最小修复动作 |
|---|---|---|---|
| P0-1 | gameLoop 螺旋死亡风险 | B | `accumulator = Math.min(accumulator, FIXED_DT * 3)`；`dt > 100ms` 时 `accumulator = 0` |
| P0-2 | 同步 EventBus 重入损坏 | B | 改为 deferred event queue：`emit()` 入队，gameLoop 每步后 `flushEvents()` |
| P0-3 | levelLost 后同 tick 继续执行 | C | 每个 system 入口加 `if (gameState.phase !== 'combat') return;`；`castleDamaged` 处理检查 `castleHp > 0` |

### 🟡 P1 — 在 M1/M2 前解决（阻塞实现歧义）

| # | 问题 | 牵头 Agent | 最小修复动作 |
|---|---|---|---|
| P1-1 | `level.scale` 应用模块未分配 | A | `data/levels.js` 导出 `applyScale(enemyDef, scale)`；`waveSystem` 出兵、`combatSystem` 掉金时调用 |
| P1-2 | 司马懿 BOSS AI 未显式设计 | A, C | `data/bosses.js` 定义 AI 脚本；`combatSystem` 每步检查 BOSS 计时器；召唤走 `waveSystem.spawnEnemy()` |
| P1-3 | 灼烧蔓延规则不完整 | A | GDD 补充蔓延条件/范围/次数/层数继承；`combatSystem` 职责描述更新 |
| P1-4 | 弹道速度/即时命中未决策 | A, C | 明确 v1 采用**即时命中**，`projectile.js` 仅视觉飞行；更新 `combatSystem` 描述 |
| P1-5 | `combatSystem` 大单体 | C | 拆分为 4 个子模块 (damageCalc/statusEffects/projectileManager/signatureSkills) |
| P1-6 | gameState 只读无强制 | B | render 调用前传入冻结副本；或 Proxy 拦截写入 |
| P1-7 | 渲染抽象契约未形式化 | C | 新增 `render/entityRenderer.js`，定义稳定的 `drawTower/drawEnemy/drawProjectile` 接口 |
| P1-8 | 5 个 edge cases 无契约 | C | 文档化孤儿弹道、目标死亡、campId 追踪、cooldown 继承规则 |

### 🟢 P2 — 可延后，但建议 Phase 0/1 顺手完成

| # | 问题 | 牵头 Agent | 最小修复动作 |
|---|---|---|---|
| P2-1 | copy-and-own 无自动化检查 | B, C | 新增 `scripts/check-cross-game-imports.sh`，加入 acceptance criteria |
| P2-2 | 音效事件布线未描述 | A | `audio/audio.js` 订阅 `enemyKilled/towerFired/waveStarted/bossSpawned` 等事件 |
| P2-3 | 触屏支持未明确 | A | `main.js` 职责描述增加 "pointer/keyboard input" |
| P2-4 | hub 注册卡片细节未列 | A | `js/games.js` 注册项(id/title/subtitle/蜀汉红金主题色) |
| P2-5 | 对象池未分配 | A | `spriteRenderer.js` 负责精灵池，`projectile.js` 负责弹道池 |
| P2-6 | 缺少 `gameLoop.test.mjs` | B | 测试 accumulator cap、暂停恢复、速度倍率、边界 dt |
| P2-7 | 16×11 格 L8 空间可行性 | C | M3 前用纸面/程序验证 8 path + 18 slot 是否放得下 |

---

## 四、修正后的架构蓝图建议

基于三个 agent 的共识，建议在架构计划中做以下模块调整：

```
games/tower-defender/
  src/
    core/
      gameLoop.js        ← 增加 accumulator cap + deferred event flush
      gameState.js       ← 提供 createGameState(levelConfig) 工厂
      save.js            ← 注入 storage 纯函数
      eventBus.js        ← 改为 deferred queue（或增加重入守卫）
      rng.js             ← 可注入随机
      assets.js          ← 预加载 + getImage(key) → null fallback
    data/
      generals.js enemies.js factions.js bosses.js levels.js balance.js
    entities/
      tower.js enemy.js projectile.js
      # enemy 必须携带: id, type, campId, pathId, hp, progress, statuses, damageTaken
    systems/
      waveSystem.js      ← 调用 applyScale(); 提供 spawnEnemy() 给 BOSS 召唤
      pathSystem.js      ← 敌沿 waypoint; 飞兵直线; 敌人带 campId
      targetingSystem.js ← 4 种模式
      combatSystem.js    ← 仅编排，调用以下 4 子模块:
        combat/damageCalc.js
        combat/statusEffects.js
        combat/projectileManager.js
        combat/signatureSkills.js
      economySystem.js   ← 订阅 enemyKilled; 处理 build/upgrade/sell
      victorySystem.js   ← 监听 castleDamaged/campFallen/lastWaveCleared
    render/
      board.js
      entityRenderer.js  ← 新增: drawTower/drawEnemy/drawProjectile 接口契约
      spriteRenderer.js  ← y-sort + 精灵池
      fx.js              ← 开火/招牌技/灼烧/金币飘字
      hud.js
    ui/
      menus.js levelSelect.js buildBar.js towerPanel.js
    audio/
      audio.js           ← 订阅 eventBus 事件触发 SFX
  tests/
    gameLoop.test.mjs    ← 新增
    combat/*.test.mjs    ← 对应 combat/ 子模块
    ...
  scripts/
    check-imports.sh     ← 新增: 防止跨游戏 import
```

---

## 五、最终建议与下一步

### 5.1 对架构计划的通过条件

**建议：CONDITIONAL APPROVE — 通过，但 P0-1/2/3 必须进入 Phase 0 骨架**

通过标准：
1. 在 `gameLoop.js` 中实现 accumulator cap (P0-1)
2. 将 `eventBus.js` 改为 deferred queue 或增加 re-entrant guard (P0-2)
3. 为所有 system 增加 phase guard (P0-3)
4. 将 P1-1~P1-8 写入 GDD / 计划补充，作为 M1/M2 开工前置条件
5. 新增 `scripts/check-imports.sh` 并通过一次验证 (P2-1)

### 5.2 推荐执行顺序

| 阶段 | 动作 | 预估时间 |
|---|---|---|
| Phase 0 (现在) | 修复 P0-1/2/3 + P2-1；拆分 combatSystem 子模块 (P1-5) | 4–6h |
| Phase 0 收尾 | 补充 GDD §17：灼烧蔓延、弹道机制、司马懿 AI、level.scale 应用 (P1-1/2/3/4) | 2–3h |
| Phase 1 (M1) | 搭骨架：gameLoop, gameState, save, eventBus, rng, assets, pathSystem, render (entityRenderer + 色块占位) | 按原计划 |
| Phase 2 (M2) | 填充 combat/ 子模块、targetingSystem、economySystem、victorySystem | 按原计划 |

### 5.3 对 Opus 4.8 架构计划的整体评价

**高质量骨架**。它准确吸收了 GDD §17 的硬参数，合理扩展了 `eventBus` 和 `rng`，坚持了 game-hub 的 copy-and-own 原则，并给出了清晰的系统执行顺序。主要问题不是"架构错误"，而是**"架构约定未强制 + GDD 遗留歧义未在计划中显式闭合"**。这些问题都在 1 天内可修复。修复后，该计划可以作为成都保卫战项目的 Phase 0 定稿。

---

*Report compiled from 3 parallel Oracle agent reviews.*
*Agents: Agent A (requirements mapping), Agent B (patterns & risks), Agent C (edge cases & feasibility).*
