# 塔防美化三件套 — 设计稿

> 日期：2026-06-13 ｜ 项目：game-hub/games/tower-defender（成都保卫战·三国塔防）
> 状态：设计待 review → 转 writing-plans

## 1. 背景与目标

实玩反馈三处观感短板，本 spec 一并解决：

1. **武将形象只有前 3 级独立绘制**（L4/L5 复用 L3 图）→ 扩到 5 级，每级一张独立立绘。
2. **地图装饰元素**（树/草/花/帐篷…）观感偏平 → 精修细节，提升质感。
3. **特殊地形辨识度低 + 缺增益类型**：高台看不出是高台 → 加「山」字标 + 美化；新增 **营**（+攻击）与 **塔**（+攻速）两种可建增益地形。

### 设计原则
- 复用现有架构，不另起炉灶（plateau 加成模型、sprite 锚链管线、ground painter 注册表）。
- 平衡敏感改动走客观门禁（`tools/sim-economy.mjs` + winnable 50/50）。
- 中间态可实玩、可独立 SHIP（呼应"大型开发分段检查点"惯例）。

## 2. 范围与分段

| 段 | 内容 | 外部依赖 | 独立 SHIP |
|---|---|---|---|
| **Seg A（纯代码）** | Task 2 地图元素美化 + Task 3 地形全套 | 无 | ✅ 可先发 |
| **Seg B（需跑生成）** | Task 1 武将 L4/L5 封神立绘 | `OPENROUTER_API_KEY`（James 跑生成命令） | 代码先落（缺图自动回退 L3），图生成后接线验收 |

两段解耦：Seg B 的接线代码（manifest + `generalSprite` 封顶）可安全先落地，缺图时逐级回退到 L3，零崩溃。

### 非目标（YAGNI）
- 不重画现有 L1–L3 立绘（James 已认可）。
- 不改 UI 选将卡立绘（本任务针对**战场塔随等级换阶**形象）。
- 不新增地形玩法机制（落石/浅滩/火谷等不动）；营/塔仅静态增益，语义同 plateau。
- 不做动画过场/新音效。

---

## 3. Seg A · Task 2：地图元素美化

**文件**：`src/render/ground.js`（painter 注册表）。布点纯函数（`computeGroundLayout` 及其子函数）**不动** → 现有 `groundLayout.test.mjs` 等布点测试不受影响。

### 3.1 手法（关键约束）
- 保持现有《Kingdom Rush》半卡通风，只增层次，不改风格。
- **明暗用 alpha 叠加实现**（低透明度黑/白罩 + 既有色），**不新增 `theme.colors` 键** → 5 章自动适配，遵守 "取色只准经 colors" 铁律。仅当确需新色相时，才给 5 章 `chapterThemes.js` 统一补键（需同步 `chapterThemes.test.mjs`）。
- 维持烘焙护栏：单关烘焙一次（`bakeGround`，≤30ms 预算），富画只增一次性成本；保留 `blurOk` 旧 iPad（Safari <17.4）软边退化路径——凡用 `ctx.filter` 处必带退化分支。

### 3.2 精修清单（James 点名的树/草/花/帐篷优先）

| 元素 | 现状 | 精修方向 |
|---|---|---|
| 树（`treeAt` / `grove` / `mapleWood`） | 单色圆冠 + 单点高光 | 2–3 簇分层冠（明暗瓣）+ 冠底 AO 暗影 + 树干受光面 |
| 松（`pineAt` / `pineWood` / `lonePine`） | 单三角冠 | 2–3 层叠三角（深→浅）+ 树干阴影 |
| 草丛（`tuft` / `meadow` / `dryField`→`dryGrass`） | 三笔草 / 纯色瓣 | 多叶片带尖端高光、轻微色差；草甸瓣加受光高光斑 |
| 花（`flowerAt` / `flowerField`） | 4 点花瓣 | 5 瓣 + 花心 + 偶发异色（确定性，非随机）|
| 帐篷（`tent` 地标） | 纯三角 + 小旗 | 加脊缝线、撑杆、坡面受光/背光、地钉绳、旗影 |
| 杂项（`haystack`/`stone`/`lotus`/`reedAt`/`bamboo`/`rockAt`） | 平涂 | 各加一层高光或加深描边，统一质感 |

> 验收以真机观感为准；painter 无单测（依赖 canvas），靠浏览器冒烟核对。

---

## 4. Seg A · Task 3：地形（高台美化 + 营/塔新增）

**文件**：`src/render/board.js`（渲染）、`src/systems/terrainSystem.js`（加成查询）、`src/data/generals.js`（`effectiveStats`）、`src/entities/tower.js`（字段）、`src/systems/economySystem.js` & `src/main.js`（建塔/续玩写入）、`src/data/baseBoards.js`（铺设）、`src/data/boardVariants.js`（不过滤白名单）、`src/data/balance.js`（常量）。

### 4.1 三种"可建增益地形"统一模型

与现有 plateau 同族：地形区**压在将位（slot）上**，建塔即生效；加成为静态字段，建塔/续玩时按 slot 落点写入。

| 内部 id | 角标 | 角标位置 | 效果 | 常量（`BAL`） |
|---|---|---|---|---|
| `plateau`（高台，现有） | 「山」 | 左下 | 射程 +0.5 | `PLATEAU_RANGE_BONUS=0.5` |
| `barracks`（营寨，**新**） | 「营」 | 右下 | 攻击 ×1.25 | `BARRACKS_DMG_MULT=1.25` |
| `archtower`（箭楼，**新**） | 「塔」 | 右下 | 攻速 ×1.25（间隔 ×0.8） | `ARCHTOWER_INTERVAL_MULT=0.8` |

> 内部 id 用 `barracks`/`archtower`，避开 `level.camps`（敌方出兵营，独立字段）与"将塔"命名冲突；玩家可见角标仍是 营/塔。

### 4.2 加成接线（顺手归一化清理）

**现状**：plateau 的 `+ tower.rangeBonus` 散落多处（targeting/combat/attacks/main/towerPanel），dmg/interval 无加成入口。

**改法**：在 `generals.js` 新增 `effectiveStats(tower)`，包一层 `towerStats`，统一应用三加成：

```js
// generals.js
export function effectiveStats(tower) {
  const g = GENERALS[tower.generalId];
  const s = towerStats(g, tower.level);
  return {
    dmg: s.dmg * (tower.dmgMult || 1),            // 营
    range: s.range + (tower.rangeBonus || 0),     // 高台（收口原散落 +rangeBonus）
    interval: s.interval * (tower.intervalMult || 1), // 塔
  };
}
```

**迁移调用点**（`towerStats(g, tower.level)` → `effectiveStats(tower)`，均已有 `tower` 在作用域）：
- `systems/targetingSystem.js:11` — 删 `+ (tower.rangeBonus||0)`，改用 `effectiveStats(tower).range`
- `systems/combatSystem.js:24,26` — 同上
- `systems/combat/attacks.js:34,35` — 同上；**注意 `:110 let dps = stats.dmg`**：`stats` 改为 `effectiveStats(tower)` 后，诸葛灼烧 DoT 自动继承营 ×1.25（语义一致，营加成作用于全部伤害含 DoT）
- `systems/combat/damageCalc.js:8` — `effectiveStats(tower).dmg`（营加成生效于常规命中）
- `systems/combat/signatureSkills.js:26` — `effectiveStats(tower).dmg * (p.dmgMult||1)`（营加成生效于招牌技伤害）
- `ui/towerPanel.js:64` — 改用 `effectiveStats(tower)`，面板"攻击/射程/攻速"即反映三地形加成；并按现有 `⛰` 范式补 营/塔 角标
- `main.js:232`（选中塔射程光圈）— `effectiveStats(selectedTower).range`

> `main.js:224`（**空将位**建造预览光圈）保留 `rangeBonusFor`（无塔实例，仅需射程预览）。

### 4.3 字段与写入

`entities/tower.js` 新增两字段（紧随现有 `rangeBonus`）：
```js
dmgMult: 1,       // [地形] 营·攻击加成
intervalMult: 1,  // [地形] 塔·攻速加成（间隔乘子，<1 更快）
```

`systems/terrainSystem.js` 把 `rangeBonusFor` 升级为 `terrainBonuses(level, slot)`（保留 `rangeBonusFor` 或内联）：
```js
export function terrainBonuses(level, slot) {
  const t = terrainTypeAt(level, slot.x, slot.y);
  return {
    rangeBonus: t === 'plateau' ? BAL.PLATEAU_RANGE_BONUS : 0,
    dmgMult: t === 'barracks' ? BAL.BARRACKS_DMG_MULT : 1,
    intervalMult: t === 'archtower' ? BAL.ARCHTOWER_INTERVAL_MULT : 1,
  };
}
```
- 建塔：`economySystem.js tryBuild` 写入三字段（替换现 `t.rangeBonus = rangeBonusFor(...)`）。
- 续玩：`main.js:140 applyResume` 同样按 slot 重算三字段 → **存档零迁移**（快照不存加成，载入即重算，沿用现有语义）。

### 4.4 高台美化 +「山」字 & 营/塔 渲染

`render/board.js`：
- `TERRAIN_FILL` 加 `barracks`（暖营色，如 `#b07a3c`）、`archtower`（石青灰，如 `#7c8a9c`）。
- **plateau 美化**：现黄土台描边 → 加更强顶亮/底暗的"立体台阶"边（双层 bevel），凸显抬升感。
- **角标 helper**：`drawTerrainGlyph(ctx, zone, corner, char)` —— 取 zone cells 包围盒，在指定角（左下/右下）画小号字（≈`C*0.3`）+ 深色半透圆角底板，保证压在地形上可读。每 zone 画一次（非每格，避免 2×2 重复）。
  - plateau → 左下「山」；barracks → 右下「营」；archtower → 右下「塔」。
  - 画在 `drawTerrainBase`（实体层之下）；角标取左下/右下贴近将位脚部，最小化被立绘头部遮挡。

### 4.5 铺设（全量 10 基板）

`data/baseBoards.js`：每块基板补 `{ type:'barracks', rects:[...] }` 与 `{ type:'archtower', rects:[...] }` 各 ~1 处（2×2），压在交战口将位上（参照现有 plateau 注释式选点），镜像+变体感知（rects 在 boardVariants 自动镜像）。选点须落在某 slot variant 的将位格上才有意义。

`data/boardVariants.js`：把 `barracks`/`archtower` 加入"永不过滤"白名单（现 `plateau/river/mountain` 永不过滤；不压路的增益区否则会被按路径覆盖过滤掉）。slot 可达性放宽（line 159–161）仅 plateau 需要（带 +range），营/塔 无射程加成走基础 `SLOT_MAX_DIST`，**不**纳入放宽。

### 4.6 平衡门禁

地形为玩家增益 → winnable 不会被打破（玩家只会更易通关），重点防"过强使关卡变水"。改完：
1. 跑 `node tools/sim-economy.mjs`（真实经济模拟器）复验 50 关仍 winnable 50/50。
2. 跑 balance-report，确认 +25% 增益未使难度坍塌（哨戒位威胁基不应大幅跌穿地板）。
3. 若任一关变水：调低该常量或减该基板铺设，再复验。

---

## 5. Seg B · Task 1：武将 L4/L5 封神立绘

**文件**：`tools/gen-sprites.mjs`（prompt + 循环上限）、`src/core/assets.js`（MANIFEST + `generalSprite` 封顶）。

### 5.1 生成管线（沿用现有锚链）
- `gen-sprites.mjs` 的 `STAGED` 数组：12 将各 `stages` 由 3 条扩到 5 条；`--stages` 循环 `s <= 3` → `s <= 5`。
- 锚链续接：L4 锚 L3、L5 锚 L4（`PERSON` 约束"同一人只升装备"），保整套画风 + 人物一致。
- **L5 白底铁律**：封神效果（金光/神兵能量/光晕）**画在角色身上、维持纯白背景**，不画背景场景 —— 兼容 `debg` 去白底管线（产图后跑 `tools/debg-*.py` 去白）。
- 执行：`OPENROUTER_API_KEY=sk-or-... node tools/gen-sprites.mjs --stages`（仅生成 12 将 = 24 张新图；James 跑）。

### 5.2 L4/L5 概念表（per-general，尊重人设；待 review）

阶段语义：**L4 = 名将统帅**（功成名就、独当一面）；**L5 = 神将封神**（武圣/神威，金光加身）。已骑乘者（关/赵/马 L3 已有马）升级坐骑装备；文官/匠人（诸葛/黄月英）走器物与道法，不强塞战马。

| 将 | L4 名将统帅 | L5 神将封神 |
|---|---|---|
| 黄忠 huang | 定军山主帅：花白长须，金鳞重铠披风，乘战马，背帅旗，宝雕大弓 | 老将武神：金光罩体，神弓拉满、箭化流光，光晕环身 |
| 张飞 zhang | 万人敌统帅：黑金重铠，乘乌骓马，背战旗，丈八蛇矛（蛇形曲刃） | 当阳怒吼神威：雷怒金光，蛇矛缠黑龙气，环眼如电 |
| 关羽 guan | 威震华夏：赤兔披重甲挂饰，绿金帅袍，背帅旗，青龙偃月刀 | 武圣关公：金光罩体，青龙绕刀身，丹凤眼神光 |
| 赵云 zhao | 常胜将军：白马银铠加披风战裙，背帅旗，龙胆亮银枪 | 龙威银辉：银光龙气绕枪，白马生辉，白盔神缨 |
| 马超 ma | 西凉大都督：白马兽面重铠，锦帅旗，长枪 | 神威天将军：兽神金光，枪罡破空，狮盔生辉 |
| 诸葛 zhuge | 蜀汉丞相：更华贵八卦鹤氅，羽扇纶巾，持节，精致素舆（不加马） | 卧龙封神：八卦光阵环身，星气流转，羽扇生辉（道法仙气，人形为主） |
| 廖化 liao | 先锋大将：铁甲令旗插背，乘战马，军用强弓 | 老将神射：金光强弓，箭雨之气，果敢神色 |
| 周仓 zhou | 关营都督：黑金重铠，乘战马，肩扛青龙偃月刀 | 神力护刀：金光绕刀，虬髯怒发，威猛逼人 |
| 马岱 madai | 西凉骑帅：锦铠白袍，乘战马，背旗，斩将寒光刀 | 寒光神刀：刀身寒芒罡气，沉决冷峻 |
| 关平 guanping | 少年将军：白马银铠红披风，背旗，父传宝刀 | 龙子神威：金光绕刀，英气光晕，少年武魂 |
| 张苞 zhangbao | 虎贲将军：乘战马，虎贲金铠，背旗，丈八蛇矛（蛇形曲刃） | 乃父之风：蛇矛缠黑气金光，怒目神威 |
| 黄月英 yueying | 巧匠大师：升级机关连弩 + 随身小型器械阵，工坊旗（不加马） | 机关神匠：诸葛连弩流光，机关光阵，火羽箭辉（人形为主，不要大型机械） |

### 5.3 接线（代码先落，缺图安全回退）
- `assets.js` MANIFEST：12 将各加 `gen_<id>_4`、`gen_<id>_5`（共 24 行）。
- `generalSprite(id, level)` 封顶 `Math.min(level, 3)` → `Math.min(level, 5)`；逐级回退链不变（缺 L5 → L4 → L3 → … → `gen_<id>` → null 画色块）。
- 渲染层 `entityRenderer.drawTower` 已按高度归一通吃任意立绘（含骑乘），**无需改动**。

---

## 6. 数据/常量变更清单

`src/data/balance.js`：
```js
BARRACKS_DMG_MULT: 1.25,      // 营·攻击加成
ARCHTOWER_INTERVAL_MULT: 0.8, // 塔·攻速加成（间隔乘子=攻速×1.25）
```

## 7. 测试与验收

### 新增/扩展单测
- `tests/towerStats.test.mjs`：`effectiveStats` 三加成正确（单项 & 叠加；缺字段默认 1/0）。
- `tests/terrainSystem.test.mjs`（或 `plateau.test.mjs` 镜像）：`terrainBonuses` 对 plateau/barracks/archtower/无地形 返回值正确。
- `tests/assets.test.mjs`：`generalSprite` 封顶 5 + 回退链（L5 缺 → L4 → L3）。
- `tests/baseBoards.test.mjs` / `boardVariants.test.mjs` / `levels-integrity.test.mjs`：新增 barracks/archtower rects 后结构校验仍绿（按需更新断言）。

### 门禁
- `node --test tests/` 全绿。
- Seg A：`tools/sim-economy.mjs` + balance-report 复验 winnable 50/50、难度未坍塌。
- 浏览器冒烟：在 营/塔/高台 各建塔 → 升 L4/L5 → 确认①立绘换阶 ②加成生效（面板数值 + 实战）③角标渲染可读（含 iPad 触屏）。

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| L4/L5 生成画风与 L3 漂移 | 锚链 L4←L3、L5←L4 + `PERSON` 约束；逐将检视，不满意重生成 |
| L5 金光特效带出背景/黑底，debg 失效 | prompt 强约束"效果画在角色身上、纯白背景"；产图后 debg + 抽检 |
| 营/塔 角标被立绘头部遮挡 | 取左下/右下贴脚部角；冒烟核对，必要时微调位置/底板 |
| +25% 增益使个别关变水 | sim 门禁；超标则降常量或减铺设 |
| `effectiveStats` 迁移漏改某调用点 | 全量 grep `towerStats(` 核对（仅 8 处）；combat 单测覆盖伤害/射程 |
| 命名冲突（营 vs 敌营 camps、塔 vs 将塔） | 内部 id 用 barracks/archtower，与 `level.camps` 字段、将塔概念物理隔离 |

## 9. 实施顺序（建议）

1. **Seg A-1 地形机制**：常量 + tower 字段 + `terrainBonuses` + `effectiveStats` + 迁移 8 调用点 + 续玩重算 → 单测绿。
2. **Seg A-2 地形渲染**：plateau 美化 + 营/塔 fill + 角标 helper。
3. **Seg A-3 铺设**：10 基板补 rects + boardVariants 白名单 → 结构测试绿。
4. **Seg A-4 平衡门禁**：sim + balance-report 复验。
5. **Seg A-5 元素美化**：ground.js painter 精修 → 浏览器冒烟。
6. **Seg B-1 接线**：MANIFEST + `generalSprite` 封顶（缺图回退）→ 测试绿（可先于生成落地）。
7. **Seg B-2 生成 prompt**：`gen-sprites.mjs` 补 L4/L5 12×2 描述 + 循环上限。
8. **Seg B-3 生成 & 去底**：James 跑生成 → debg → 抽检。
9. **Seg B-4 接线验收**：浏览器冒烟确认换阶。

Seg A（步骤 1–5）可独立 SHIP；Seg B（6–9）随后。
