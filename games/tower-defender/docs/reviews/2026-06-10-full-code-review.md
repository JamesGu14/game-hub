# Tower Defender 全项目代码审阅报告

> **日期**: 2026-06-10  
> **审阅范围**: `src/core/`、`src/data/`、`src/systems/`、`src/render/`、`src/ui/`、`tests/`、`tools/` 共 7 个目录  
> **审阅方式**: 4 个 Oracle subagent 并行分领域审查  
> **当前状态**: 46 个单测全部通过，verify-levels 50 关全通

---

## 一、按严重级别汇总

### �� CRITICAL（6 项）

| # | 问题 | 文件 | 后果 |
|---|------|------|------|
| **C1** | `save.js` schema 版本号硬编码为 1，**无迁移策略** | `src/core/save.js:12-30` | 任何 schema 变更（加字段、重命名）→ 全体玩家存档**静默归零** |
| **C2** | `economySystem.js` 对 `generalId` **零输入校验** | `src/systems/economySystem.js:11,22,31` | 非法 generalId → `GENERALS[undefined].cost` 抛 TypeError，**游戏循环崩溃** |
| **C3** | `waveGen.js` `chosenLanes[0]` 空数组时返回 `undefined` | `src/data/waveGen.js:56` | campId = undefined → `pathSystem` 访问 `paths[undefined]` → **运行时崩溃** |
| **C4** | `campaign.js` `story.hook` 脆弱依赖 `·` 分隔符 | `src/data/campaign.js:86` | 标题格式一改 → 45/50 关 hook 全变成相同默认值 |
| **C5** | **Retina/DPI 完全未处理** — canvas 分辨率 = 逻辑像素 | `src/main.js:114-115` | 所有 Retina 设备（Mac/iPhone）画面**模糊**，严重损害品质 |
| **C6** | **3 个核心 UI 面板零测试覆盖** | `src/ui/buildBar.js` / `towerPanel.js` / `resultPanel.js` | 建塔/升级/通关按钮的命中检测完全裸奔，layout 偏移 = **游戏不可操作** |

### 🟠 HIGH（10 项）

| # | 问题 | 文件 | 后果 |
|---|------|------|------|
| **H1** | 选关/故事屏时 rAF 循环仍在 60fps 空转 | `src/core/gameLoop.js:49-63` | 静态 UI 页面持续耗电/耗 CPU，**移动端电池杀手** |
| **H2** | 6 个事件监听器注册后**永不移除** | `src/main.js:324-338` | SPA 场景内存泄漏；`visibilitychange` **注册了两次** |
| **H3** | `eventBus` 回调闭包捕获模块级 `state`，**强制要求 `Object.assign` 不重赋值** | `src/main.js:36, 294, 321-322` | 若将来重构为 `state = newGameState(...)`，所有回调指向**旧对象** |
| **H4** | `drawBoard` 修改 `lineJoin/lineCap` 后**永不恢复** | `src/render/board.js:24` | canvas 2D 状态泄漏，后续绘制（range ring）可能产生不可预期圆角 |
| **H5** | `drawFx` 直接修改 `globalAlpha/lineWidth/strokeStyle`**无 save/restore** | `src/render/entityRenderer.js:211-225` | 若某条 path 提前 return，**整帧后续 UI 层半透明** |
| **H6** | `towerPanel` 未防御无效 `tower.generalId` | `src/ui/towerPanel.js:39` | `GENERALS[undefined]` → 升级/拆除面板**崩溃** |
| **H7** | `towerStats.test.mjs` **全部硬编码绝对值** | `tests/towerStats.test.mjs` | 调 balance.js 时测试必破，维护成本高；**DPS 约束不够强**，可能漏检渐变偏移 |
| **H8** | `levels-winnable.test.mjs` 仅验证**"无限金钱+满级"** | `tests/levels-winnable.test.mjs` | 只证明理论可达，**不保证正常收入约束下可通关** |
| **H9** | `verify-levels.mjs` 每段路径**仅报告首个漏怪** | `tools/verify-levels.mjs:100` | 同一段多个不相连空洞被 mask |
| **H10** | `pool.js` double-release **无防护** + **零测试** | `src/core/pool.js:12` | 同一对象入池两次 → 两次 acquire 返回**完全相同的引用** → 状态污染 |

### 🟡 MEDIUM（14 项）

| # | 问题 | 文件 |
|---|------|------|
| M1 | `assets.ready = true` 即使**0 张图加载成功** | `src/core/assets.js:93` |
| M2 | `writeSave`/`writeResume` **静默丢弃** localStorage 满 | `src/core/save.js:33-35, 78-79` |
| M3 | `state._acc` 不在 `newGameState()` schema 中 | `src/core/gameState.js:9-32` |
| M4 | `gameState.js` RNG 使用 `Date.now() + Math.random()`，**非确定性** | `src/core/gameState.js:13` |
| M5 | `victorySystem` 胜利判定**延迟 1 tick**（cleanup 在 victory 之后） | `src/systems/victorySystem.js:8` + `src/core/gameLoop.js:31` |
| M6 | `UP_COST_MULT[tower.level]` **无越界保护** | `src/systems/economySystem.js:32` |
| M7 | `projectileManager` 对象池**无容量上限** | `src/systems/combat/projectileManager.js` |
| M8 | `statusSystem` 无意义 `healers` 计算**每帧遍历全部敌人** | `src/systems/statusSystem.js:11` |
| M9 | `boardTemplates` 路径坐标**无网格边界校验** | `src/data/boardTemplates.js` |
| M10 | 每帧**~15-20 个新对象**分配（多个 layout 函数） | 全 UI 层 |
| M11 | 每帧**~15-20 个 CanvasGradient** 对象创建 | `src/ui/theme.js` + `buildBar.js` |
| M12 | `drawTower` 信息层用 `s=C*0.32` 定位，与**精灵实际尺寸不匹配** | `src/render/entityRenderer.js:90-107` |
| M13 | `gen-sprites.mjs` **无重试** + 无产出校验 | `tools/gen-sprites.mjs` |
| M14 | `levels-coverage.test.mjs` 与 `levels-integrity.test.mjs` **重复检查 leaks** | `tests/levels-coverage.test.mjs` |

### 🟢 LOW（7 项）

| # | 问题 | 文件 |
|---|------|------|
| L1 | 字体系列不一致（`system-ui` 直接硬编码） | `src/render/entityRenderer.js` |
| L2 | `for...in` 迭代 `paths`（原型链风险） | `src/render/board.js:25` |
| L3 | `ysort` 平级实体排序不稳定（相同 `py` 时闪烁） | `src/render/ysort.js:6` |
| L4 | `buildBar` gradient x0 恒为 0（应相对于 button 位置） | `src/ui/buildBar.js:38` |
| L5 | `test.sh` for 循环变量未引号 | `scripts/test.sh:8` |
| L6 | `audio.test.mjs` `_reset()` 不在 `finally` 中 | `tests/audio.test.mjs:104` |
| L7 | `contact-sheet.py` macOS 字体路径硬编码，fallback 不安全 | `tools/contact-sheet.py:21-23` |

---

## 二、跨领域关联问题（需协调修复）

### 关联 A: RNG 非确定性

- **引擎层** (`gameState.js:13`): `makeRng()` 无参数 → `Date.now() + Math.random()`
- **数据层** (`waveGen.js`): 使用 `makeRng(level.id)` 实现确定性波次
- **矛盾**: 波次生成是确定性的，但战斗暴击是非确定性的
- **建议**: 统一策略——要么全部确定性（传入 level.id + 战斗 tick 计数作为 seed），要么在文档中明确标注"战斗 RNG 为时间种子"

### 关联 B: `state.castleMaxHp` 的初始化与胜利判定

- **引擎层** (`gameState.js:16`): `castleMaxHp: level.castleHp` ✅ 已正确初始化
- **系统层** (`victorySystem.js:8`): 比较 `castleHp === castleMaxHp` 判 3 星
- **问题**: 判定发生在 cleanup 之前，**延迟 1 tick**
- **建议**: 将 cleanup 移到 victorySystem 之前，或改用 `enemies.every(e => !e.alive)`

### 关联 C: pool.js 双重重叠

- **引擎层** (`pool.js:12`): double-release 无防护
- **测试层**: pool 完全零测试
- **渲染层** (`projectileManager.js`): 使用 pool 但无容量上限
- **建议**: 新增 `tests/pool.test.mjs` + pool 加 `Set` 去重 + 容量上限

---

## 三、最值得优先修复的 Top 5

| 排名 | 问题 | 严重度 | 理由 | 预估工作量 |
|------|------|--------|------|-----------|
| **1** | C1 — save.js schema 无迁移 | 🔴 Critical | **运维炸弹**——任何 schema 变更 = 全体玩家进度归零。越早加迁移框架，存量用户越多 | ~4h |
| **2** | C5 — Retina/DPI 未处理 | 🔴 Critical | **影响所有用户视觉品质**。Retina Mac 用户占比高，模糊渲染是"第一眼 defect" | ~6h（涉及所有 setTransform） |
| **3** | C6 — 3 个 UI 面板零测试 | 🔴 Critical | **交互层完全裸奔**。buildBar/towerPanel/resultPanel 是玩家每秒多次操作的核心入口，命中偏移 = 游戏不可操作 | ~8h（3 个新测试文件） |
| **4** | H1 — 非游戏屏 60fps 空转 | 🟠 High | **移动端电池杀手**。选关/故事屏不应消耗 GPU/CPU | ~2h |
| **5** | H10 — pool double-release + 零测试 | 🟠 High | **隐形状态污染**——不 crash 但导致弹道/特效异常，极难排查。对象池是 projectile/fx 的底层基础设施 | ~3h（+ 新测试） |

**总预估**: ~23h（约 3 人日）

---

## 四、设计决策确认（"这不是 bug"）

以下被多个 subagent 标记但实际正确的模式，在此统一确认：

| 模式 | 位置 | 说明 |
|------|------|------|
| `makeRng()` 无参 = 时间种子 | `src/core/rng.js` | **有意为之**——波次生成确定性（seed=level.id），战斗暴击非确定性（每局不同）。注释已标注"时间种子" |
| `state.time` 不受 `state.speed` 影响 | `src/core/gameLoop.js` | **有意为之**——`state.time` 是"游戏时间"，与速度倍数解耦。加速仅增加 step 调用次数 |
| `cleanup` 在 victorySystem 之后 | `src/core/gameLoop.js` | 1 tick 延迟对胜利判定无功能影响，仅 16ms UI 延迟 |
| `towerStats` 硬编码测试值 | `tests/towerStats.test.mjs` | **有意为之**——作为 balance.js 变更的回归哨兵。调参时必须同步更新 |
| `levels-winnable` 只测满防 | `tests/levels-winnable.test.mjs` | **有意为之**——"理论可达性"测试，证明关卡天花板足够高。正常难度由 balance-report 观察 |

---

## 五、整体评价

| 维度 | 评分 | 说明 |
|------|------|------|
| **架构设计** | ⭐⭐⭐⭐ | 固定步长循环、事件总线延迟派发、资源加载容错、确定性波次生成——核心决策都对 |
| **数据一致性** | ⭐⭐⭐⭐ | balance.js 单一入口、generals.js 集中定义、levels.js 展开逻辑清晰 |
| **边界防护** | ⭐⭐⭐ | 输入校验薄弱（generalId、enemyType、slot 边界），但现有数据正确所以暂未炸 |
| **渲染质量** | ⭐⭐⭐ | ctx save/restore 基本正确，但 DPI 缺失和状态泄漏是硬伤 |
| **测试覆盖** | ⭐⭐⭐ | 核心系统覆盖良好（46 测试全绿），但**UI 交互层完全空白**、pool 零覆盖 |
| **工具链** | ⭐⭐⭐⭐ | verify-levels + balance-report 是 excellent 的工程实践 |

**最大风险**: 存档 schema 迁移缺失（C1）是一个**时间炸弹**——越早修复成本越低。UI 测试空白（C6）是**功能盲区**——任何 layout 调整都可能破坏建塔/升级/通关流程而不自知。

---

*报告生成时间: 2026-06-10*  
*审阅者: Sisyphus (4x Oracle subagent)*
