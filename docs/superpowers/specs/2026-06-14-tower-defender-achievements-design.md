# 成都保卫战 · 成就系统设计（武将图鉴 + 挑战成就）

- 日期：2026-06-14
- 项目：game-hub / games/tower-defender
- 分支：develop
- 状态：设计已与 James 确认，待写实现计划（writing-plans）

## 1. 目标与动机

给三国塔防加一个**成就中心**，承载长期收集与成就感，但**绝不改动任何游戏数值**（保护已调好的 50/50 winnable 平衡）。两块内容：

1. **武将图鉴**：44 张武将卡，覆盖我方与敌方"将"。我方卡随累计击杀升段位；敌方卡出场且被击败后点亮。
2. **挑战成就**：15 条离散成就，达成弹小横幅祝贺。

入口：首页（选关屏）左上角「🏆 图鉴」按钮 → 成就中心页（顶部两标签切换）。

## 2. 范围

### 收录（44 张武将卡）
| 分区 | 数量 | 数据源 |
|---|---|---|
| 我方武将 | 12 | `data/generals.js` `GENERALS` |
| 敌方名将 | 20 | `data/bosses.js` `BOSSES` |
| 敌方副将 | 12 | `data/bosses.js` `LIEUTENANTS` |

### 不收录（明确排除）
- 普通兵种（步卒/狼骑/藤甲/飞兵/方士/骑兵/重甲）——它们是"兵"不是"将"。
- 三势力换皮名（蛮兵/吴卒/魏卒等）——只是显示层皮肤。

## 3. 已确认决策（Decision Log）

1. **范围**：图鉴 **+** 挑战成就列表（两块都做）。
2. **段位**：仅我方 12 将有段位，6 段 = 青铜(0)→白银(50)→黄金(150)→钻石(400)→荣耀(1000)→王者(2500)，按**累计击杀**升段；门槛取"标准"档（常量表，日后可调）。
3. **敌将解锁**：出场**并被击败**才点亮；只打输（见过未击败）仍是剪影，留收集悬念。
4. **灼烧记功**：诸葛/黄月英的灼烧（DoT）致死，归因到放火的武将（需小改战斗代码）。
5. **入口**：首页左上角图标钮「🏆 图鉴」（与右上角静音/全屏对称）。
6. **卡面风格**：流光/宝石风（整卡渐变流光 + 光晕 + 星点，段位越高越闪，王者带 👑）。
7. **成就性质**：纯荣誉，**零游戏数值影响**；达成弹小横幅。

## 4. 架构总览

新增一个**独立、render-free、注入式纯函数**的成就模块，照搬 `core/save.js` 既有范式（可单测、与渲染解耦）。事件驱动击杀归因，复用现有 `enemyKilled` 事件总线。UI 照搬 `levelSelect.js` 的 layout/hit/draw 单一来源范式。

```
[战斗系统] --killEnemy(state, enemy, killerId)--> bus.emit('enemyKilled', {enemy, killerId})
                                                       |
[main.js 监听] --累加--> state.runKills(本局) + ach(内存) --结算/切后台/退出--> achievements.write(localStorage)
                                                       |
[codexScreen] <--读 save(解锁/星) + ach(击杀/seen/earned)-- 渲染图鉴 & 成就页
```

## 5. 数据与存档

### 5.1 新模块 `src/core/achievements.js`
- localStorage 键：`save_td_ach_v1`（独立于进度档 `save_td_v1`）。
- 自带 `CURRENT_VERSION`、`MIGRATIONS`、`_applyMigrations`、`defaultAch()`、`loadAch(storage)`、`writeAch(storage, ach)`、`browserLoadAch/browserWriteAch`——与 save.js 同构。
- `loadAch` 末段做字段归一化（脏值兜底），与 save.js 一致。

### 5.2 Schema（version 1）
```js
{
  version: 1,
  kills: { [generalId]: number },   // 我方累计击杀 → 段位来源
  seen:  { [enemyId]: true },       // 敌将"被击败过"集合 → 图鉴点亮（key = boss/副将 id）
  namedDefeats: number,             // 累计击败敌将次数（成就「名将收割」）
  earned: { [achId]: true },        // 已解锁成就
}
```
- `defaultAch()` = `{ version:1, kills:{}, seen:{}, namedDefeats:0, earned:{} }`。

### 5.3 为什么独立键（而非并进 save_td_v1）
- 收集数据与核心进度解耦，blast radius 小、可独立演进与单测。
- 作弊面板「重置真实进度」默认**不动**成就（成就是跨周目荣誉）；若要"重置成就"可另加按钮（本期可选，不阻塞）。

### 5.4 落盘时机（避免每次击杀都写 localStorage）
- 本局击杀累加在内存（`ach` 对象）与 `state.runKills`（单局分将计数）。
- **落盘**发生在：关卡结算（won/lost）、退出到选关、`visibilitychange`(隐藏)/`beforeunload`——复用 main.js 既有 `persistResume` 同款时机。
- 强退丢失最后一局未结算的增量 = 可接受（与 resume 快照同等"尽力而为"）。

## 6. 击杀归因

### 6.1 改 `killEnemy` 签名
`combat/kill.js`：`killEnemy(state, enemy, killerId = null)`，`bus.emit('enemyKilled', { enemy, killerId })`。

### 6.2 调用点传参
| 调用点 | killerId |
|---|---|
| `combat/attacks.js` `hitOnce` | `tower.generalId` |
| `combat/signatureSkills.js` | `tower.generalId` |
| `systems/statusSystem.js`（灼烧 DoT 致死） | 该敌当前灼烧栈中**最后点火**的将 |
| `systems/terrainSystem.js`（落石/火谷环境致死） | `null`（环境击杀不记功） |

### 6.3 灼烧来源追踪
- `combat/statusEffects.js` `applyBurn(enemy, dps, dur, now, src)` 给每层栈记 `src=generalId`。
- 致死时取**灼烧栈数组末元素**（最近一次施加的那层）的 `src` 作为 killerId（确定性、单测可锁）；该层若 `src` 缺失则回退栈内其余有 src 的层、再无则 `null`。环境灼烧 `envBurn` 无 src → 不记功。
- 兼容：`src` 缺省为 `null`，旧调用不破。

### 6.4 main.js 监听处理
```
on('enemyKilled', ({enemy, killerId}) => {
  if (killerId && GENERALS[killerId]) { ach.kills[killerId]++; state.runKills[killerId]++; checkTierUp + check万人敌; }
  const eid = enemy.bossId;                       // 敌将 id（名将/副将）
  if (eid && (BOSSES[eid] || LIEUTENANTS[eid])) { if(!ach.seen[eid]) ach.seen[eid]=true（弹"图鉴+1"）; ach.namedDefeats++; }
  // 现有逻辑保留：spawnFloat('+gold') + sfx('kill')
})
```
> **实现检查点**：需核验名将/副将出场时 `enemy.bossId` 已被赋值（`createEnemy` 接受 `opts.bossId`；确认 `levels.js`/waveGen 对**副将**也透传 id）。若副将未带 id，需在生成处补传。

## 7. 段位

```js
export const TIERS = [
  { key:'bronze',  name:'青铜', min:0 },
  { key:'silver',  name:'白银', min:50 },
  { key:'gold',    name:'黄金', min:150 },
  { key:'diamond', name:'钻石', min:400 },
  { key:'glory',   name:'荣耀', min:1000 },
  { key:'king',    name:'王者', min:2500 },
];
export function tierIndex(kills){ let t=0; for(let i=0;i<TIERS.length;i++) if(kills>=TIERS[i].min) t=i; return t; }
```
- 升段在击杀累加后检测跨阈值 → 弹横幅「⚔️ 关羽 晋升 黄金!」。

## 8. 图鉴点亮规则

- **我方卡**：解锁 = `unlockedGenerals(save).has(id)`（复用 `data/unlocks.js`）；未解锁=剪影。段位 = `tierIndex(ach.kills[id]||0)`。
- **敌方卡**：点亮 = `!!ach.seen[id]`；未点亮=剪影、无段位。

## 9. 挑战成就（15 条）

`data/achievements.js` 定义；纯函数 `evaluate(ach, save, runCtx)` 返回"当前已达成"id 集，与 `ach.earned` 求差 → 新解锁 → 弹横幅 + 落盘。

| id | 名称 | 类 | 条件 | 数据源 / 触发 |
|---|---|---|---|---|
| first_blood | 初战告捷 | 进度 | 通关第 1 关 | `save.stars[1]` / 结算 |
| pacify_region | 一方平定 | 进度 | 任一章 10 关全通关 | `CHAPTERS`+`save.stars` / 结算 |
| three_kingdoms | 三分天下 | 进度 | 全 50 关通关 | `save.stars` 全 / 结算 |
| gather_heroes | 群英荟萃 | 进度 | 12 将全解锁 | `unlockedLevel>30` / 结算 |
| five_tigers | 五虎上将 | 收集 | 关张赵马黄全解锁 | `unlockedGenerals` / 结算 |
| know_enemy | 知己知彼 | 收集 | 20 名将全点亮 | `ach.seen` / 击杀落盘 |
| martial_temple | 武庙立像 | 收集 | 44 卡全亮 | `unlocked`+`ach.seen` / 落盘 |
| dazzling | 流光溢彩 | 收集 | 任一将达钻石(≥400) | `ach.kills` / 击杀 |
| pinnacle | 登峰造极 | 收集 | 任一将达王者(≥2500) | `ach.kills` / 击杀 |
| slayer | 万人敌 | 壮举 | 单局某将击杀≥50 | `state.runKills` / 战斗实时 |
| impregnable | 固若金汤 | 壮举 | 满血通关任意关 | `won && castleHp==castleMaxHp` / 结算 |
| perfect_battle | 完美战役 | 壮举 | 任一关 3 星 | `stars==3` / 结算 |
| masterstroke | 运筹帷幄 | 壮举 | 某章全 3 星 | `CHAPTERS`+`save.stars` / 结算 |
| slaughter | 杀敌如麻 | 累计 | 累计击杀≥1000 | `Σ ach.kills` / 击杀 |
| reaper | 名将收割 | 累计 | 累计击败敌将≥100 | `ach.namedDefeats` / 击杀 |

- `runCtx` = `{ runKills, castleHpFull, stars, levelId }`，结算时由 main.js 组装传入。
- `evaluate` 幂等：已在 `earned` 的不重复弹。

## 10. UI / 页面

### 10.1 路由
- `main.js` `screen` 状态机加 `'codex'`。
- 选关屏画左上角「🏆 图鉴」钮（几何与右上角 mute/fs 对称，draw/hit 共用）；点击 → `screen='codex'`。
- codex 屏有「◀ 返回」回选关。

### 10.2 新文件 `src/ui/codexScreen.js`
照搬 `levelSelect.js` 范式：`codexLayout(view, tab, ...)` / `hitCodex(view, ...)` / `drawCodex(ctx, view, save, ach, tab, detailId)`，layout/hit 单一来源。
- 顶部标签：`武将图鉴` / `挑战成就`。
- **图鉴标签**：三分区网格（我方12 / 名将20 / 副将12），每格小卡（解锁=流光按段位上色 + 立绘缩略；未解锁=斜纹剪影）。点卡 → 大卡详情浮层。
- **大卡详情**：立绘（`generalSprite`/`boss_<id>`）+ 名 + 生平/特性（我方复用 `heroCard.js` 的 `HERO_LORE`；敌将用简短名牌）+ 段位徽记 + 累计击杀；流光/宝石风。
- **成就标签**：四分类列表，已解锁=亮（图标+名+描述+绿勾），未解锁=灰 + 进度（如「47 / 50」）。

### 10.3 解锁横幅
复用结算/飘字同款木牌提示风（`spawnFloat` 或 resultPanel 风格的临时 banner），文案如「🏆 解锁成就：万人敌」「⚔️ 赵云 晋升 王者!」。

## 11. 美术复用
- 我方：`generalSprite(id, level)`（3 阶图，已有）。
- 敌将：`assets.images['boss_'+id]`（多数已有）。
- **缺图自动回退色块 + 名牌**（全游戏既有兜底，副将部分缺图照常显示）。
- **本期零新增美术硬需求**；James 日后可用 `gen-sprites` 给副将补图，掉进图鉴零改代码。

## 12. 测试策略

### 单测（注入假 storage / 假 save，render-free）
- `achievements.js`：`defaultAch`、`loadAch` 归一化脏档、迁移链、`writeAch`。
- `tierIndex` 段位边界（0/49/50/399/400/2499/2500）。
- 击杀累加 + `seen`/`namedDefeats` 记录。
- 灼烧归因：DoT 致死归最后点火将；环境灼烧不记功；地形/逃城不记功。
- `evaluate` 全 15 条：未达/刚达/已 earned 幂等；`runCtx` 驱动的壮举类。
- killerId 透传：四个调用点签名与参数。

### 冒烟（puppeteer / 浏览器）
- 进图鉴页、切两标签、点卡看详情、返回。
- 一局内击杀累加 → 触发「万人敌」横幅；结算触发进度类成就。

## 13. 不做（YAGNI / 非目标）
- 不给任何战斗增益/数值奖励（护平衡）。
- 不强制新增美术（缺图回退既有）。
- 不每次击杀写 localStorage（内存累加，定点落盘）。
- 本期不做"重置成就"按钮（可后续加）。
- 不做云同步 / 跨设备（localStorage 本地即可）。

## 14. 文件清单

### 新增
- `src/core/achievements.js`——存档模块（schema/load/write/迁移）+ 段位表 + 记录/查询纯函数。
- `src/data/achievements.js`——15 条成就定义 + `evaluate` + 文案。
- `src/ui/codexScreen.js`——成就中心 layout/hit/draw。

### 改动
- `src/systems/combat/kill.js`——`killEnemy` 加 killerId + 事件带 killerId。
- `src/systems/combat/attacks.js`、`src/systems/combat/signatureSkills.js`——传 `tower.generalId`。
- `src/systems/combat/statusEffects.js`——`applyBurn` 记 `src`。
- `src/systems/statusSystem.js`——灼烧致死传最后点火将。
- `src/systems/terrainSystem.js`——环境致死传 `null`。
- `src/ui/levelSelect.js`——左上角「🏆 图鉴」入口钮（draw/hit）。
- `src/main.js`——`screen='codex'` 路由、`enemyKilled` 监听累加/记录/横幅、结算 `evaluate`、定点落盘、`state.runKills` 复位。
- `src/core/gameState.js`——`newGameState` 加 `runKills:{}` 字段（每关复位）。

## 15. 风险与检查点
- **副将 id 透传**：实现首步核验名将/副将出场带 `enemy.bossId`；缺则补传（见 §6.4）。
- **灼烧归因边界**：多将同时灼烧同一敌——归"最后点火"是简化但合理；单测锁定行为。
- **存档双键一致性**：成就档与进度档独立；codex 同时读两者，注意 boot 时都已加载。
- **成本/性能**：每击杀仅内存 ++ 与几个阈值比较，无 GC 压力；落盘节流到定点。
