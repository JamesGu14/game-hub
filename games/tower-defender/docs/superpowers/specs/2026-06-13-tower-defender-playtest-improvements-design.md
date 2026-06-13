# 成都保卫战 · 试玩改进 10 点 — 设计文档

- 日期：2026-06-13
- 来源：James 试玩后提出的 10 条改进点
- 范围：`games/tower-defender`
- 状态：已与 James 确认方案方向，待 review 本 spec → 转 writing-plans

## 背景

James 实玩一轮后给出 10 条改进。本 spec 把每条落到代码锚点、给出实现方向、标注风险与验证方式。其中 6 条是低风险的视觉/交互改动，3 条触动现有平衡（必须用 `tools/sim-economy.mjs` 重测，守住 50/50 可通关），2 条是首页资源。

确认过的关键决策（James 拍板）：
- **波数**：加到 ~30 波（每关 +10），不是 35。
- **暴击**：先只做黄忠现有暴击的特效，不扩展到其他将、不动平衡。
- **"弓箭兵"**：指**廖化 + 黄忠**两将，都做"加射程、降攻击"。
- **背景图**：工笔国画风，和现有立绘统一。
- **升级反馈**：升级成功后弹窗消失（James 原始要求），连升需重新点选——可接受。

## 目标 / 非目标

**目标**：让后期更有爽感（满级可达 + 暴击/弹道视觉）、修好平板点击手感、首页更有氛围。

**非目标**：
- 不重做战斗/经济架构，只调参数与渲染。
- 弹道美化**不改战斗结算逻辑**（伤害仍开火瞬间结算）。
- 暴击不扩展到黄忠以外的武将。
- 不动现有 50 关的关卡内容/剧情/地形。

---

## A 组 · 纯视觉升级（低风险，仅改渲染）

### 1. 等级移到头顶 `Lv.N`
- **现状**：`src/render/entityRenderer.js:106-109`，脚下画 `t.level` 个金点（`t.py + s - 4`），最高 5 级=5 点，邻格贴近时被立绘脚部互相遮挡。
- **改法**：删掉脚下金点；在立绘头顶上方（约 `t.py - C*1.45`，立绘高 `h=C*1.42` 从脚底往上）画 `Lv.3` 金色字 + 深色描边、居中。色块回退态（无立绘）画在方块顶部 `t.py - s` 上方。
- **涉及**：`entityRenderer.js`（drawTower 信息层）。
- **验证**：快照测试 + 浏览器目检（多塔贴近时 Lv 不被遮挡）。

### 2. 升级 → 弹窗消失 + 闪光
- **现状**：`src/main.js:340-348`，升级成功后 `return` 但 `selectedTower` 保留 → 弹窗不关；已有 0.5s 金光罩（`entityRenderer.js:72-80` 读 `upgradedAt`）+ `spawnRing` + `spawnFloat('L2!')`。
- **改法**：升级成功分支内 `selectedTower = null`（弹窗消失）；强化闪光——保留金光罩，`spawnRing` 改成更醒目的向外扩散金色冲击环，飘字改 `Lv.N ↑`。
- **取舍**：连升 5 级需重新点武将；第 8 点修好命中后点选跟手，James 已接受。
- **涉及**：`main.js`（upgrade 分支）、`render/fx.js`（如需新环型）。
- **验证**：单测（升级后 selectedTower 为 null）+ 浏览器目检闪光。

### 5. 弹道箭矢化
- **现状**：`src/render/entityRenderer.js:222-225 drawProjectile`，所有攻击=一根 2.5px 粗直线，不分类型；弹道对象 `src/entities/projectile.js`（fromX/fromY/toX/toY/color/ttl），由 `src/systems/combat/projectileManager.js:spawnTracer` 在命中时生成。
- **改法**：给 projectile 加 `kind` 字段（来自武将 `attack` 类型），`drawProjectile` 按 kind 分渲染：
  - `single`（黄忠/廖化/张苞/赵云）→ **箭矢**：细长带箭头，沿 from→to 飞行
  - `splash`（张飞/周仓）→ **投石/刀光弧**
  - `slow`（关羽/关平）→ **水弹**（蓝色，带波纹）
  - `charge`（马超/马岱）→ **突进残影**
  - `burn`（诸葛/黄月英）→ **火弹拖尾**
- **关键决策**：**只升级视觉，不碰战斗逻辑**。伤害仍在开火瞬间结算（现状即如此，tracer 只是视觉）。弹道在 ttl 期间按进度从 from 插值到 to 来"飞"，纯渲染。平衡零影响。
- **涉及**：`entities/projectile.js`（加 kind）、`combat/projectileManager.js`（spawnTracer 传 kind）、`render/entityRenderer.js`（drawProjectile 分支）。
- **验证**：单测（projectile 带正确 kind）+ 浏览器目检各类型弹道。

---

## B 组 · 交互与布局

### 6. 提前出兵按钮挪到底部
- **现状**：`src/main.js:172` `EARLY_BTN = { x: view.w/2-80, y: HUD_H+8, w:160, h:32 }` → 屏幕**顶部**；渲染 `main.js:262`，命中 `main.js:353`。
- **改法**：改 `EARLY_BTN` 的 y 到底部建造栏正上方居中（建造栏在 `view.h - BH - 12 = view.h-82`，按钮放约 `view.h - 130`），拇指易够、不压建造栏。仅 `prep` 相位显示（不变）。
- **涉及**：`main.js`（EARLY_BTN 坐标）。
- **验证**：浏览器/iPad 目检按钮在底部、可点、不挡建造栏。

### 8. 平板点击命中修复（核心）
- **现状**：`src/main.js:354-359`，`screenToCell()` → `towerAt(cell)` 用脚下**单格精确匹配**。立绘画在格子上方（头/身伸出格顶），点视觉主体时坐标落在上一格 → 判为"空地" → 选不中。关弹窗时，浮空竹简弹窗（`towerPanel` 在塔上方 `sy-PH-24`）范围内点击被 `hitTowerPanel` 判为 `'panel'` 消费而不关。
- **与既有 `ipad-tap-highlight` 的区别**：那份修的是**点击蓝色高亮框**（`-webkit-tap-highlight-color`，已在 `style.css:8` 处理）；本点修的是**命中检测几何**（点不准），是不同问题。
- **改法**：选中武将改为**按棋盘像素距离取最近的塔**——把点击屏幕坐标转棋盘像素 `(bx,by)`，在所有 `towers` 中找"点击点落在立绘视觉框内 或 距脚底中心 < R"的最近塔，R≈`C*0.7`（覆盖立绘主体 + 容差）。命中优先级保持：UI 按钮 > 放大后的塔 > 空地。点准了"点空地 → 命中不到塔 → `selectedTower=null` → 关弹窗"自然变稳。
- **涉及**：`main.js`（onPointerDown 的塔命中逻辑，新增 `towerAtPixel(bx,by)` 取最近）。
- **验证**：单测（点击立绘头部坐标能命中该塔）+ iPad 真机冒烟（点头/身能选中、点空地能关）。

---

## C 组 · 平衡（高风险，必须重测）

> 通用纪律：本组每改一步，跑 `node tools/sim-economy.mjs`（真实经济模拟，确定性，模拟合格玩家）+ levels-winnable 测试，守住 **50/50 可通关**，并核对 balance-report 无新墙。

### 3. 波数 ~30 + 经济够升满级
- **现状**：`src/data/campaign.js:29` `waveCount: 20 + Math.round(p*(ch-1))` → 第1章 20 波、第5章 24 波。经济来源：击杀掉金（`enemies.js` 各兵 `gold`）+ 清波奖励 `BAL.WAVE_CLEAR_BONUS=15` + 提前出兵 ≤30。升满级总花费 `base×8.4`。痛点：20 波金币不够升满。
- **改法**：
  1. 波数公式改 `30 + Math.round(p*(ch-1))` → 全 50 关 **30~34 波**（每关 +10）。
  2. 经济**数据驱动调**：加 10 波本身多给约 50% 金币（击杀+清波），**很可能光加波就够升满级**。先只加波，用 `sim-economy` 跑出实际可升到几级；若仍不够，再微调 `WAVE_CLEAR_BONUS 15→20` 或 `UPGRADE_COST_L5 2.8→2.5`。**不预先拍数值**。
- **性能（小米 pad）**：加波是**延长**而非**加密度**，同屏峰值敌人数基本不变（仍 ~30-50）。`gameLoop` 有累加器封顶（`MAX_STEPS=3`），渲染逐帧 `sortByY` + drawTower/drawEnemy。结论：性能无忧；实现时在浏览器节流 CPU（4x throttle）下实测末波峰值帧率确认 ≥ 可玩。
- **涉及**：`campaign.js`（波数公式）、可能 `balance.js`（经济微调，视模拟结果）。
- **验证**：`sim-economy` 全 50 关跑通 + 某关实测玩家能在 30 波内把主力升到 L5；waveGen 测试更新（波数断言）。

### 10. 廖化 + 黄忠：加射程、降攻击
- **现状**：`src/data/generals.js`——廖化 `range:3.0, dmg:6`；黄忠 `range:3.5, dmg:9`。
- **改法（起点，幅度可调）**：廖化 `range 3.0→4.0, dmg 6→4`；黄忠 `range 3.5→4.5, dmg 9→6`。定位为"够远够软的消耗位"。
- **涉及**：`generals.js`（两将数值）。这俩在 sim-economy 的 loadout 优先级里，影响面较大。
- **验证**：重跑 sim-economy + winnable；balance-report 无回退。

### 4. 黄忠暴击特效
- **现状**：`src/systems/combat/damageCalc.js:7-16`，仅黄忠 L3 百步穿杨 25%×2.5 无视护甲，返回 `{ dmg, isCrit:true }`；渲染层未消费 `isCrit`。
- **改法**：命中暴击时，在被击敌人头顶弹"**暴击!**"金红大号飘字 + 敌人短暂闪红。需把 `isCrit` 信号从 sim 层（`combat/attacks.js` 调 damageCalc 处）冒泡到渲染——经 `state.fx` 或 `eventBus`（保持 sim 确定性，不在 sim 里写渲染）。
- **涉及**：`combat/attacks.js`（读 isCrit 触发 fx 事件）、`render/fx.js`（暴击飘字样式）、可能 `render/entityRenderer.js`（敌人闪红）。
- **验证**：单测（暴击命中产生暴击 fx）+ 浏览器目检黄忠 L3 暴击时敌人头上有特效。

---

## D 组 · 首页资源（独立，可并行）

### 7. 首页背景图（工笔国画风）
- **现状**：`src/ui/levelSelect.js:57` 调 `backdrop()`（`theme.js:179-183` 纯色径向渐变）；`assets/` 下无背景图。
- **改法**：用 AI（fal.ai）生成工笔国画横图——「左：成都古城墙；刘备在城墙侧(左,面右)，曹操(右,面左)，各带 3-5 战将 + 大量列阵士兵，场面壮阔」。存入 `assets/`，在 `core/assets.js` MANIFEST 注册，在 `levelSelect.js` 背景层绘制（覆盖/替换 backdrop），上叠暗角保证选关文字可读。横竖屏用 cover 居中裁切。
- **预期管理**：AI 对"精确站位/具体谁的脸"控制力有限，**生成多张候选让 James 挑**，挑最接近的，可能需几轮。
- **涉及**：`assets/`（新图）、`core/assets.js`（注册）、`ui/levelSelect.js` 或 `theme.js`（绘制）。
- **验证**：浏览器目检背景显示、文字可读、横竖屏不变形。

### 9. 首页背景音乐
- **现状**：`src/core/audio.js` 有 `startBgm`/`bgmTrackForLevel`，5 首 `assets/bgm/west-*.mp3`；选关屏（`levelSelect`）无 BGM。进关 `main.js:102` 起战斗 BGM。
- **改法**：进选关屏播一首现有曲（建议 `west-1` 雄浑开场）。在 `toSelect()`/进 select 逻辑里 `audio.startBgm(0)`。
- **浏览器自动播放限制**：首次进入若用户尚未交互，AudioContext 未解锁，声音放不出 → 首次手势（`onPointerDown` 已 `audio.init()`）后补播；从游戏返回首页时已解锁可直接响。
- **涉及**：`main.js`（进 select 起 BGM）、可能 `audio.js`（补播钩子）。
- **验证**：audio 单测（进 select 触发 startBgm）+ 浏览器目检首页有乐、首次交互后补播。

---

## 实现顺序

1. **A 组 + B 组**（1/2/5/6/8）：低风险视觉/交互，不碰平衡，先做、立竿见影。
2. **C 组**（3 → 10 → 4）：每步用 `sim-economy` + winnable 卡 50/50。3 先加波再视模拟决定经济微调；10 调两将后重测；4 纯特效。
3. **D 组**（7/9）：背景图生成可与前面并行。

## 测试与验证策略

- **单测**（`tests/*.test.mjs`，62 个现有）：新增/更新覆盖——升级后弹窗关闭、projectile kind、暴击 fx、波数公式、廖化/黄忠数值、进 select 起 BGM、towerAtPixel 命中。
- **平衡门禁**：`node tools/sim-economy.mjs` 全 50 关 + levels-winnable + balance-report，守 50/50 可通关无新墙。
- **真机冒烟**（小米 pad / iPad）：第 8 点点击命中、第 3 点末波帧率、首页背景+BGM。

## 风险与开放问题

- **R1（最大）**：第 3+10 点扰动现有平衡。缓解：sim-economy 逐关验证 + 每步可回滚（参数集中在 `campaign.js`/`balance.js`/`generals.js`）。
- **R2**：背景图可能多轮才满意——预留生成迭代。
- **R3**：第 3 点经济微调幅度待模拟结果定（spec 不预先拍死，实现时数据驱动）。
- **R4**：首页 BGM 自动播放限制导致"首次静默"，已有补播方案，需真机确认体验可接受。
