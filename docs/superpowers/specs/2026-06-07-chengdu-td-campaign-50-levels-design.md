# 成都保卫战 — 50 关三国战役 + 剧情教育系统 设计稿

- **日期**: 2026-06-07
- **状态**: Draft **v2**（已并入 OpenCode review 修订；待 James 终审 → writing-plans）
- **游戏**: game-hub / `games/tower-defender`（成都保卫战 · 三国塔防）
- **前置**: Phase 1-6 已完成（8 关战役、存档选关、UI 三国主题、sprite 美术 + 程序音效，commit develop）

## 0. v2 修订记录（OpenCode review 接受项）
确定性强制 seed、模板必带 slots（+路数子集差异化）、L5 数值防爆（分段软倍率）、SIGNATURE_LEVEL 与 MAX_TOWER_LEVEL 分清、选关分章 UI 提前到检查点 A、**中断续玩**新子系统、经济可验证不等式、difficulty→关参数公式、boss 名册扩 15-20、受影响测试逐条列出（修正"下游零改动"误述）、B 拆三小批。两处碰需求的取舍已由 James 定：**单关 ≥20 波 + 中断续玩 + 前松后紧**；**v1 直接 50 关，保留缩到 25 的退路**。

---

## 1. 愿景

把现有 8 关三国塔防扩成 **50 关、按真实三国战役编年命名、每关开场用图文故事卡讲历史背景**的教育向战役 TD，受众是作者的一年级孩子：**用塔防当载体，让孩子在玩中认识三国著名战役、人物与成语**。玩法框架不变（指挥蜀汉六将守成都），每关换皮敌人/主题/故事。纯内容 + 系统扩展，不重写引擎；平衡靠"生成即自检"的客观门禁保证。

## 2. 已锁决策

| 维度 | 决策 |
|---|---|
| 关卡数 | 8 → **50 关**（保留"太长则先 ship 25、其余作更新"退路） |
| 每关波次 | **≥20 波（20-30）**，章内前松后紧；早章近 20、后章近 30 |
| 关卡来源 | **板型模板池（12-16 套，过 verify）+ 路数子集 + 确定性波次生成器** |
| 升级上限 | **L3 → L5**（招牌技仍 L3 解锁；L4/L5 用**软倍率**续缩放、不加新技） |
| 剧情形式 | **中文图文故事卡 · 混合式**（故事钩子 + 小档案：年/地点/双方/结果/成语） |
| 编排 | **编年体 · 分章**（5 章 × ~10，每章带童化标题） |
| 续玩 | **中断续玩**：中途退出存当前波/金/塔，可续 |
| 框架 | 蜀汉六将守成都不变，每关换皮 + 故事卡统一话术声明"史实 vs 游戏想象" |
| 受众 | 一年级孩子，教育优先 |

## 3. 目标 / 非目标

**目标**：50 关编年战役（每关 ≥20 波、章内难度单调）；每关原创史实向故事卡；塔升 L5 有成长感**且不破坏平衡**；关卡由模板+生成器产出、自动过"无漏怪+可通关+难度带内"门禁；娃可中断续玩。

**非目标（YAGNI）**：不做多势力可玩阵营；不加新塔/招牌技/敌种机制；不做逐帧/配音/对白过场；不做关卡编辑器；v1 不强求东吴/曹魏全套新美术（缺图回退色块）；不做成语收藏页（v1 略）；不做每关专属插画（portrait 复用六将头像或留空）。

## 4. 框架对齐

50 个真实战役多与蜀汉无关（官渡=曹 vs 袁）。取舍：**玩法恒定**（始终蜀汉六将守"成都"据点）；**战役体现在 名字+故事卡+换皮+地形主题**。故事卡加**统一话术**避免误导孩子把"守成都"当史实，例："历史上这是真实的大战；游戏里，我们想象蜀汉六将来守护这片战场。"

## 5. 架构

### 5.1 生成方式（运行时确定性生成）
`campaign.js`（紧凑战役谱）→ `levels.js` 加载时用 板型模板 + `waveGen` **确定性展开**成 `LEVELS`。
- **强制 seed**：`waveGen` 的 `seed` 为 required number，`seed==null` 即 throw（堵住 `core/rng.js` 的 `Date.now()^Math.random()` fallback 非确定性分支）。每关 `seed = level.id`。加载期禁用 `Math.random`/`Date`。
- **展开拼装**：板型提供 `cols/rows/castle/camps/paths/slots`；`difficulty`（+章号）按公式派生 `scale/startGold/castleHp`；`waveGen` 产 `waves` → 合成与现 `LEVELS[i]` **完全同形**的关卡对象。下游（渲染/存档/verify/winnable）零感知。
- **difficulty 公式（起点，balance-report 可调）**：`scale = 1 + difficulty*0.5`；`startGold = 300 + difficulty*150`；`castleHp = 20`（固定，后期可微调）。difficulty 沿 50 关单调升（约 0→4）。
- 不采用构建时生成（违"无构建"铁律）。

### 5.2 模块
| 文件 | 类型 | 职责 |
|---|---|---|
| `data/campaign.js` | 新 | `CHAPTERS`（5 章，含童化标题）+ 战役谱（§6 schema）+ 故事文本 |
| `data/boardTemplates.js` | 新 | **12-16 套**布局（各过 verify、**必带 slots**、按地形主题分类，含现 8 关布局作种子） |
| `data/waveGen.js` | 新·纯函数·确定性 | `genWaves(template, params, seed)` → 前松后紧、章内递增、末波 boss、经济够 L5 |
| `data/levels.js` | 改 | `LEVELS = CHAPTERS 展开`；对外接口不变 |
| `data/bosses.js` | 改 | 扩到 **15-20** 条名将 boss（每战役一位历史主将；美术 v1 fallback 色块+名） |
| `ui/storyCard.js` | 新 | 开场故事卡 layout/hit/draw（copy-and-own theme.js） |
| `ui/levelSelect.js` | 改 | **分章/分页**（现 COLS=4 对 50 关 13 行、手机放不下）——**检查点 A 必做** |
| `src/main.js` | 改 | 新屏幕态 `'story'`：startLevel → 故事卡 → 进关；续玩入口；"重看故事" |
| `core/save.js` | 改 | 续玩存档（§5.4）+ stars/unlock 扩到 50（schema 无需重构） |
| `data/balance.js` | 改 | `MAX_TOWER_LEVEL=5` + 新增 `SIGNATURE_LEVEL=3` + `UPGRADE_COST_L4/L5` + 软倍率参数 |
| 招牌技解锁 6 点 | 改 | `>=MAX_TOWER_LEVEL` → `>=SIGNATURE_LEVEL`（见 §5.3） |
| `tools/balance-report.mjs` | 新 | 真实经济 headless 诊断器（§9.3） |
| `tools/dump-levels.mjs` | 新 | 展开后 LEVELS → JSON，便于审波次/diff/定位 flaky |
| `scripts/test.sh` | 新 | 串跑全部 *.test.mjs（替代逐个 node） |

铁律：`core/*` render-free、自包含、无构建。

### 5.3 升级上限 L3→L5（重构，防数值爆炸）
- `balance.js`：`MAX_TOWER_LEVEL=5`、`SIGNATURE_LEVEL=3`、`UPGRADE_COST_L4/L5`。
- **改 `>=SIGNATURE_LEVEL`（招牌技解锁/充能）**：`combatSystem.js`(冷却技释放)、`combat/attacks.js`(赵云连射/马超击退/诸葛火烧藤甲)、`combat/damageCalc.js`(黄忠暴击)、`combat/signatureSkills.js`、`render/entityRenderer.js`(招牌充能条)、`ui/towerPanel.js`(招牌技行)。
- **仍用 `MAX_TOWER_LEVEL`（升级封顶/满级）**：`economySystem.js`(upgradeCost/canUpgrade 的满级判定)、`towerPanel.js`("满级"按钮)。**不可全改**。
- **防爆**：现曲线 L5 DPS≈10×L1≈3.2×L3（远超敌 scale≤~3.5×）→ L5 变秒杀按钮。改 `towerStats` 为**分段倍率**：L1→L3 维持现 dmg×1.6/interval×0.9；**L3→L5 用软倍率**（dmg≈×1.3、interval≈×0.95），目标 **L5≈2-2.5×L3 DPS**，确值由 balance-report 量化。

### 5.4 中断续玩（新子系统）
- 退出游戏中（非结算）→ 存 `{ levelId, waveIndex, gold, castleHp, phase, prepTimer, towers:[{generalId,slot,level,mode}], seed }` 到 localStorage（key `save_td_resume_v1`）。
- 重进该关 → 若有 resume 记录，故事屏后给"续上次/重头"选项；胜/负/退到选关即清除。
- 纯 state 快照恢复（无新玩法）；`save.js` 加 `writeResume/loadResume/clearResume`，可单测（注入假 storage）。

## 6. 数据模型

### 6.1 战役记录（campaign.js）
```js
{
  id: 14, chapter: 3,
  name: '赤壁之战',
  faction: 'wu',                 // 换皮：敌 name/color（factions.js）
  templateId: 'river', pathSubset: ['a','b','c'],  // 同模板只开部分路 → 差异化
  waveCount: 24,                 // ≥20
  difficulty: 1.6,               // → scale/startGold/castleHp（§5.1 公式）
  enemyTiers: ['footman','wolf','heavy','flyer'],  // 本关解锁敌池（按章渐增）
  boss: { id:'caocao', name:'曹操', hpMult:1.3 },   // 末波 boss（bosses.js 必有此条）
  story: {
    hook: '借东风一把火，烧退曹操八十万大军！',     // ≤25 字白话钩子（原创）
    year: '公元208年', place: '长江赤壁',
    sides: '孙刘联军 vs 曹操', result: '曹操大败，三分天下',
    idiom: '火烧赤壁',
    portrait: null,              // null=不画头像（主角非六将时）；或复用六将 id
  },
}
```
boss 末波生成沿用现 `levels.js` 风格 `{ ...BOSSES[boss.id], hpMult }` → createEnemy（透传 bossId/name/hpMult）。

### 6.2 章节（编年体，童化标题）
| 章 | 童化标题（示例） | 教学引入 | 大致 faction |
|---|---|---|---|
| 一 | 天下大乱·诸侯并起 | 步卒/狼骑 | 混 nanman/wei 皮 |
| 二 | 官渡之争·以弱胜强 | +重甲 | wei 为主 |
| 三 | 火烧赤壁·三分天下 | +飞兵/方士·水战 | wu 为主 |
| 四 | 进取西川·汉中之战 | +藤甲（火克） | 混 |
| 五 | 夷陵之火·六出祁山 | 全敌种+多 boss·司马懿终局 | wu/wei |

敌种按章渐解锁=天然教学曲线（复用现 6 敌种换皮）；章内 faction 可混编增辨识度。

### 6.3 检查点 A 样板 5 战
博望坡 → 长坂坡 → 赤壁 → 定军山 → 夷陵（跨章、覆盖不同模板/敌池/boss/故事，端到端验管线+格式）。

## 7. 剧情开场屏
- **流程**：`select` → 点关 → `'story'`（故事卡）→ 继续 → `'playing'`（有续玩则插"续上次/重头"）。
- **内容**（混合式）：章·战役名 + 故事钩子（≤25 字白话，楷体）+ 小档案（年/地点/双方/结果/成语）+ 统一话术声明 + 可选头像 + 「继续 ▶」。
- **组件**：`ui/storyCard.js`（copy-and-own theme.js panel/title/button）。**重看故事**入口在选关/暂停菜单。
- **内容铁律**：原创、史实向、一年级能懂；不抄受版权文本；成语取公共常识。

## 8. 波次生成与难度（waveGen）
- 入参：`{ waveCount, difficulty, enemyTiers, boss }` + 模板（按 `pathSubset` 取路）+ **required seed**。
- 产出：`waveCount` 波，**前松后紧**（早波低密度/单一兵种当教学，后波密度/混编/spawn 升）+ 章内随 difficulty 升 + **末波=boss+护卫**。
- **无漏怪**：波只决定"出什么"；路径/将位覆盖由模板保证（模板已过 verify-levels）。
- **经济**：满足 §9.3 不等式。

## 9. 验证 / 测试

### 9.1 新单测
- `waveGen`：确定性（同 seed 同输出）、波数正确、章内单调、末波含 boss、前松后紧、经济够 L5。
- `campaign`：字段齐全、story 六要素完整、templateId/pathSubset/boss.id 合法、id 连续唯一。
- `storyCard`：stub ctx 不抛、layout/hit 自洽、save/restore 平衡。
- `save.js` 续玩：写/读/清快照（注入假 storage）。
- **L5 重构**：`towerStats` L4/L5 软倍率值正确、招牌技在 `SIGNATURE_LEVEL` 解锁（与 MAX 解耦）、`UPGRADE_COST_L4/L5`。

### 9.2 受影响的现有测试（必须改——"下游零改动"是 v1 误述）
- `tests/levels-integrity.test.mjs`：写死 `LEVELS.length===8` → 改 50（或 ≥ CHAPTERS 合计）。
- `tests/economy-upgrade.test.mjs`：硬编码 L2=70/L3=112/L3 满级 → 从 BAL 动态读 + 加 L4/L5 断言。
- `tests/towerStats.test.mjs`：只到 L3 → 加 L4/L5 断言（守 DPS 不爆）。
- `tests/signatureSkills.test.mjs`：`t.level=3` → `BAL.SIGNATURE_LEVEL`。
- `tests/levels-winnable.test.mjs`：只升 2 次 → 循环升到 `MAX_TOWER_LEVEL`；`guard` 由定值改 `Math.max(400000, waves.length*20000)`。

### 9.3 客观门禁（每检查点全过）
```
node --check src tools；bash scripts/test.sh（全测试绿，含上列改动）
node tools/verify-levels.mjs          # 50 关 0 漏怪（硬 assert）
node tests/levels-winnable.test.mjs   # 50 关满防可通关（硬 assert）
node tools/balance-report.mjs         # 趋势告警（带宽容带）
bash scripts/check-imports.sh；浏览器实玩（故事屏/续玩/L5/样板 5 战）
```
**balance-report 指标**（带宽容带、非硬 assert）：
- 经济不等式：`income ≥ budget×1.1`，其中 `income = startGold + Σ(enemy.gold×count) + WAVE_CLEAR_BONUS×waveCount(+提前出兵期望)`，`budget = Σ(建满 slots 最低造价) + 目标 L5 数×(L2..L5 累计造价)`。
- 过程指标：`dpsBudget`(全 slot L5 理论 DPS×时长) vs `enemyHpBudget`(全波总血)；`coverageRatio`(被覆盖 path 长/总 path 长)。
- 数值带：满防胜率 ≥95%；正常打法 70-90%；剩余城防 ≥50%→2★；单关时长 8-15min@1x。

## 10. 进度 / 奖励
- 沿用 **3★ + 线性解锁**（扩到 50；`save.js` schema 无需重构）。
- **选关页分章/分页**（检查点 A 必做，见 §5.2）。
- 教育钩子"已学战役/成语收藏页"——v1 略，记 §14。

## 11. 给孩子的节奏
单关 ≥20 波偏长（20 波≈12-18min）；缓解三连：**波内前松后紧** + **中断续玩** + 保留 2x 速度；balance-report 估时长，检查点 C 据 `WAVE_BASE_DELAY`/waveGen 输出的 `startDelay` 收紧波间隔。

## 12. 检查点路线
- **A · 系统 + 5 样板战（首交付）**：L5 重构**全链路**（§5.3）+ **全 L5 单测** + 选关**分章 UI** + `'story'` 屏 + 中断续玩 + 模板池（先 4-6 套）+ waveGen + storyCard + 接 5 样板战端到端 + **产出 50 关元数据骨架**（id/name/chapter/faction/templateId/difficulty/enemyTiers/boss，story 先 5 个）。门禁全过 + 浏览器实玩 + **James 与娃验格式/教育感/手感**。
- **B · 铺到 50（拆三小批）**：B1(关 1-15)/B2(16-35)/B3(36-50)，每批写故事+生成+verify+winnable+balance-report 再进下批。含 15-20 boss 记录、50 条 story（6 字段）、逐关 difficulty/template/boss 映射。
- **C · 收尾**：50 关 balance-report 调曲线（含时长/波间隔）+ browser-qa + 故事审校 + 注册确认 + ship。

## 13. 风险与缓解
| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 50 关 scope 失控 | M | H | 样板 5 关先验；B 拆三小批每批门禁；留 25 退路 |
| L5 数值爆炸（秒杀） | **M** | **H** | 分段软倍率 + towerStats 单测守 + balance-report 量化 L5≤2.5×L3 |
| L5 重构漏改/误改 | M | M | SIGNATURE_LEVEL 仅招牌技、MAX 仍管封顶；全战斗测试守；小步改 |
| 生成波次不可通关/太易 | M | M | winnable 硬 assert + balance-report 不等式 curate |
| 模板太少显重复 | M | M | 12-16 套 + pathSubset + faction 混编 + 故事辨识度 |
| 单关过长伤娃注意力 | M | M | 前松后紧 + 中断续玩 + 2x + 估时长调间隔 |
| 故事适龄/格式不对 | M | M | 样板 5 关先验、娃实测再批量 |

## 14. 待定（实现/批量阶段细化）
- 完整 50 战役清单与逐关 difficulty/templateId/pathSubset/boss 映射（A 出骨架、B 定稿）。
- 15-20 boss 名册 + 美术策略（南蛮基底+势力 tint vs 新生成，v2）。
- 续玩 UI 文案/位置细节。
- 是否纳入"收藏页"（v1 略）。
- 每关专属插画（v1 用 portrait=null/六将头像）。

## 15. 自包含 / 铁律核对
- `core/*`、`data/*` render-free、不触 DOM；续玩经 `save.js` 守 localStorage。
- 不跨游戏 import（check-imports 守）。
- 无构建；运行时**确定性**生成（强制 seed、加载期无 `Math.random`/`Date`）。
- 故事内容原创、史实向、不复制受版权文本。
