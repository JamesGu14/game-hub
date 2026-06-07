# 成都保卫战 — 50 关三国战役 + 剧情教育系统 设计稿

- **日期**: 2026-06-07
- **状态**: Draft（待 OpenCode review + James 审阅）
- **游戏**: game-hub / `games/tower-defender`（成都保卫战 · 三国塔防）
- **前置**: Phase 1-6 已完成（8 关战役、存档选关、UI 三国主题、sprite 美术 + 程序音效，均 commit develop）

---

## 1. 愿景 / Summary

把现有"8 关三国塔防"扩成 **50 关、按真实三国战役编年命名、每关开场用图文故事卡讲历史背景的教育向战役 TD**。受众是作者的一年级孩子：**用塔防当载体，让孩子在玩中认识三国时期的著名战役、人物与成语**。游戏玩法框架不变（指挥蜀汉六将守成都），每关换皮敌人/主题/故事。

纯内容 + 系统扩展，不重写引擎；平衡靠"生成即自检"的客观门禁保证，而非手调 50 关。

## 2. 已锁决策（来自交互确认）

| 维度 | 决策 |
|---|---|
| 关卡数 | 8 → **50 关** |
| 每关波次 | 20-30 波（经济更厚 → 可升 L5 + 建更多塔） |
| 关卡来源 | **板型模板池（手工 8-12 套，过 verify）+ 参数化波次生成器** |
| 升级上限 | **L3 → L5**（招牌技仍 L3 解锁，L4/L5 续缩放、不加新技） |
| 剧情形式 | **中文图文故事卡 · 混合式**（故事钩子 + 小档案：年/双方/结果/成语） |
| 编排 | **编年体 · 分章**（~5 章 × 10 战役） |
| 框架 | **蜀汉六将守成都不变**，每关换皮敌人/主题/故事 |
| 受众 | 一年级孩子，教育优先 |

## 3. 目标 / 非目标

**目标**
- 50 关编年战役，每关 20-30 波，难度顺滑单调递增。
- 每关开场故事卡，原创史实向、适龄、含成语记忆点。
- 塔可升 L5，长局有成长感。
- 关卡由"模板 + 生成器"产出，自动过"无漏怪 + 可通关 + 难度带内"门禁。

**非目标（YAGNI）**
- 不做多势力可玩阵营（始终蜀汉守城；换皮 ≠ 换阵营）。
- 不加新塔/新招牌技/新敌种机制（复用现有 6 将 + 6 敌种 + boss）。
- 不做逐帧动画、多段对白过场、配音。
- 不做关卡编辑器；模板池手工维护。
- v1 不强求东吴/曹魏全套新美术（缺图回退色块，照常可玩）。

## 4. 框架对齐（重要）

50 个真实战役里很多与蜀汉无关（如官渡=曹操 vs 袁绍）。本设计的取舍：

- **玩法是恒定装置**：你始终指挥蜀汉六将（黄忠/张飞/关羽/赵云/马超/诸葛亮）守"成都"据点。
- **每关的"战役"体现在 名字 + 故事卡 + 敌人换皮 + 地形主题**；故事卡讲真实历史，玩法是稳定 TD。
- 这样避免给每个势力做新武将/新美术（会失控），同时保住教育内核（故事教真史）。

## 5. 架构

### 5.1 生成方式（选定：运行时确定性生成）

`campaign.js`（紧凑战役谱）→ `levels.js` 在模块加载时用 板型模板 + `waveGen` **确定性展开**成 `LEVELS`。

- 确定性：每关用固定种子（如 `seed = level.id`）驱动 `core/rng.js`；**加载期不得用 `Math.random`/`Date`**。
- DRY + 零构建：不引入生成步骤/产物文件；`LEVELS` 对外接口与现状一致 → 渲染 / 存档 / `verify-levels` / `winnable` 全复用、零改动。
- **展开拼装**：板型提供 `cols/rows/castle/camps/paths/slots`；`difficulty`（+ 章号）派生 `scale`（敌 HP/掉金）、`startGold`、`castleHp`；`waveGen` 产 `waves` → 合成与现 `LEVELS[i]` **完全同形**的关卡对象（id/name/faction/scale/startGold/castleHp/cols/rows/castle/camps/paths/slots/waves）。下游零感知。

> 备选（未采用）：构建时生成 `levels.generated.js` 提交。运行时零成本但多生成步骤 + 大产物 + 双份维护，违"无构建"精神。

### 5.2 模块

| 文件 | 类型 | 职责 |
|---|---|---|
| `data/campaign.js` | 新 | `CHAPTERS`（5 章）+ 战役谱（每条见 §6 schema）+ 故事文本 |
| `data/boardTemplates.js` | 新 | 8-12 套布局（cols/castle/camps/paths/slots，各过 verify），含现 8 关布局作种子，按地形主题分类 |
| `data/waveGen.js` | 新·纯函数·确定性 | `genWaves(template, params, seed)` → 递增波次（密度/混编升级、末波 boss、经济够 L5） |
| `data/levels.js` | 改 | `LEVELS = CHAPTERS.flatMap(展开)`（套模板 + waveGen）；对外接口不变 |
| `ui/storyCard.js` | 新 | 开场故事卡 layout/hit/draw（copy-and-own `ui/theme.js`） |
| `src/main.js` | 改 | 新屏幕态 `'story'`：startLevel → 故事卡 → 进关；"重看故事"入口 |
| `data/balance.js` | 改 | `MAX_TOWER_LEVEL=5` + 新增 `SIGNATURE_LEVEL=3` + L4/L5 造价 |
| combat/render/ui 若干 | 改 | 招牌技解锁判断 `>=MAX_TOWER_LEVEL` → `>=SIGNATURE_LEVEL`（6 处） |
| `tools/balance-report.mjs` | 新 | 真实经济 headless 诊断器（见 §9） |

铁律：`core/*` render-free、自包含（不跨游戏 import）、无构建。

## 6. 数据模型

### 6.1 战役记录（campaign.js）

```js
{
  id: 14,                       // 1-based 全局关号（解锁/存档键）
  chapter: 3,                   // 章号（选关页分组）
  name: '赤壁之战',
  faction: 'wu',                // 换皮：敌人 name/color（复用 factions.js）
  templateId: 'river',          // 引用 boardTemplates
  waveCount: 24,                // 20-30
  difficulty: 1.6,             // → 敌 HP/掉金 scale + 波密度
  enemyTiers: ['footman','wolf','heavy','flyer'],  // 本关解锁敌池（按章渐增）
  boss: { id:'caocao', name:'曹操', hpMult:1.3 },   // 末波 boss（art v2/回退）
  story: {
    hook: '借着东风，一把火烧退了曹操八十万大军！',  // 1 句钩子（原创）
    year: '公元208年',
    sides: '孙刘联军 vs 曹操',
    result: '曹操大败，三分天下成形',
    idiom: '火烧赤壁',
    portrait: 'guan',          // 可选：复用 generals 头像或留空
  },
}
```

### 6.2 章节（编年体）

| 章 | 主题 | 教学引入 |
|---|---|---|
| 一 · 群雄逐鹿 | 讨董 / 早期混战 | 步卒 / 狼骑（基础） |
| 二 · 官渡之争 | 曹袁相争 | + 重甲（抗物理 → 张飞溅射/谋略） |
| 三 · 赤壁鼎立 | 孙刘抗曹·水战 | + 飞兵（防空：黄忠/诸葛）+ 方士（点杀） |
| 四 · 三分天下 | 取蜀 / 汉中 | 混合压力 + 藤甲（火克：诸葛） |
| 五 · 后期攻防 | 夷陵 / 北伐六出祁山 | 全敌种 + 多 boss + 司马懿终局 |

敌种按章渐解锁 = 天然教学曲线，复用现有 6 敌种换皮，不新增机制。

### 6.3 检查点 A 样板 5 战（端到端先做）

博望坡 → 长坂坡 → 赤壁 → 定军山 → 夷陵（跨章、覆盖不同模板/敌池/boss，验证管线 + 故事格式）。

## 7. 剧情开场屏

- **流程**：`select` → 点关 → 新屏幕态 `'story'`（故事卡）→ 继续 → `'playing'`。
- **故事卡内容**（混合式）：章·战役名（title）+ 故事钩子（1 句，楷体）+ 小档案（年 / 双方 / 结果 / 成语）+ 可选武将头像 + 「继续 ▶」。
- **组件**：`ui/storyCard.js`（layout/hit/draw，copy-and-own theme.js 的 panel/title/button）。
- **入口**：选关或暂停菜单加"重看故事"。
- **内容铁律**：故事文本**原创、史实向、一年级能懂**；不抄《三国演义》原文或教材段落；成语取公共常识。

## 8. 波次生成与难度模型（waveGen）

- 入参：`{ waveCount, difficulty, enemyTiers, boss }` + 模板（路数/营数）+ seed。
- 产出：`waveCount` 波，沿 difficulty 曲线**递增**（每波敌数/混编种类/spawn 密度按 wave 序与 difficulty 升），中段穿插小高潮，**末波 = boss + 护卫**。
- **经济保证**：总掉金 + 清波奖励要足够 把若干塔升到 L5 + 建满关键将位（balance-report 校验，见 §9）。
- **无漏怪**：波次只决定"出什么"，路径/将位覆盖由模板保证（模板已过 `verify-levels`）。

## 9. 验证 / 测试

### 9.1 新单测
- `waveGen`：确定性（同 seed 同输出）、波数正确、难度单调递增、末波含 boss、经济够 L5。
- `campaign`：每战役字段齐全、story 五要素完整、templateId/boss 合法、id 连续唯一。
- `storyCard`：stub ctx 不抛、layout/hit 自洽、save/restore 平衡。
- L5 重构：`towerStats` L4/L5 续缩放正确、招牌技在 L3 解锁（不再绑 MAX_TOWER_LEVEL）、升级造价曲线。

### 9.2 客观门禁（每检查点全过）
```
node --check src tools
全 tests 绿（含上述新测 + 现 32 测不回归）
node tools/verify-levels.mjs          # 50 关 0 漏怪
node tests/levels-winnable.test.mjs   # 50 关满防可通关
node tools/balance-report.mjs         # 真实经济：胜/剩余城防(星)/金币压力/难度单调/估时长 → 难度带内
bash scripts/check-imports.sh
浏览器实玩（含故事屏、L5 升级、样板 5 战）
```

### 9.3 balance-report（新诊断器）
headless 用**真实经济**（startGold + 实际掉金，贪心建/升策略）跑每关，报告：能否赢、剩余城防→星级、金币时间线（是否被卡/过剩）、难度是否随关号单调、单关估时长（照顾娃注意力）。用作 curate 工具，非硬 assert（band 外告警）。

## 10. 进度 / 奖励

- 沿用现有 **3★ + 线性解锁**（存档 schema 扩到 50；`save.js` 无需结构改，unlockedLevel/stars 已通用）。
- 章作选关页**分组**（5 章分页/分段）。
- 可选教育钩子（轻量、记设计后做）：通关累计"已学战役 / 已得成语"小收藏页。

## 11. 给孩子的节奏

- 20-30 波单关偏长；缓解：保留 2x 速度、前期波节奏更松、balance-report 估时长，检查点 C 据此调每波间隔。
- 故事卡短（1 句钩子 + 4 行档案），不打断节奏。

## 12. 检查点路线

- **A · 系统 + 5 样板战（首交付）**：L5 重构 + 模板池（先 3-4 套）+ waveGen + storyCard + 接 5 样板战役端到端。门禁全过 + 浏览器实玩 + **James 与娃验故事格式/教育感/手感**。
- **B · 铺到 50**：5 章 × ~10，分章批量写故事 + 生成 + verify + curate。
- **C · 收尾**：50 关 balance-report 调曲线 + browser-qa + 故事审校 + 注册确认 + ship。

## 13. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 50 关 scope 失控 | M | H | 先样板 5 关验格式再批量；检查点门禁 |
| L5 重构碰坏战斗/招牌技 | M | M | `SIGNATURE_LEVEL` 解耦 + 全战斗测试守；小步改 |
| 生成波次不可通关/太易 | M | M | 生成后必跑 winnable + balance-report 自动 curate |
| 故事适龄/格式不对→返工 | M | M | 样板 5 关先验、娃实测再批量 |
| 板型太少显重复 | L | M | 8-12 套 + faction/主题换皮 + 故事差异化辨识度 |
| 单关 20-30 波对娃过长 | M | L | 2x 速度 + 前松后紧 + 估时长调间隔 |

## 14. 待定（实现/批量阶段细化）

- 完整 50 战役清单与逐关 difficulty/templateId/boss 映射（检查点 B 定稿）。
- boss roster：50 关 boss 名将映射 + 美术策略（南蛮基底 + 势力 tint 复用 vs 新生成，v2）。
- 奖励"收藏页"是否纳入 v1。
- 故事卡是否配每战役专属插画（v1 先复用武将头像/留空）。

## 15. 自包含 / 铁律核对

- `core/*`、`data/*`（gameState/gameLoop）保持 render-free、不触 DOM。
- 不跨游戏 import（check-imports 守）。
- 无构建步骤；运行时确定性生成（无 `Math.random`/`Date` 于加载期）。
- 故事内容原创、史实向、不复制受版权文本。
