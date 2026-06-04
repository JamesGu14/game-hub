# 《群雄逐鹿·孟德篇》economy-shop — 设计稿（待审）

> 原创致敬作。沿用原版《三国志曹操传》的**经济体系结构与「关间商店」体验框架**（事实性设定）：
> 战后按主公等级折算军资、关间商店买卖装备/消耗品/印绶。
> **公式、物价、库存表、平衡曲线均为本作自定**，不照搬任何商业游戏的数值表/文本。
> 与设计语料一致：沿用 5 维（攻/精/防/爆/士）、11 系职业、印绶 Lv15/30 转职、装备 3 槽（武器/防具/饰品）+ 皮/铜/钢三档、
> 消耗品原版命名（恢复用豆/米/桃、神秘水/酒、解毒药/膏药/止咳药、兴奋剂、印绶）、宝物公有领域名物 + 本作自定效果、果子系统暂缓（仅留钩子）。
>
> - **日期**：2026-06-04 ｜ **作者**：James + Claude ｜ **状态**：设计待 review
> - **项目**：game-hub / `games/caocao-zhuan/` ｜ **代号**：`caocao-zhuan`

---

## 0. 范围与定位

经济与商店是「关间养成层」（master §3.11）的资源闭环：**打仗 → 得军资/战利品 → 关间商店补给/升级 → 再上阵**。本稿覆盖：

1. **货币（军资 / 金钱）** —— `gameState.money` 单一数值池（全军共享，非按人）。
2. **战后结算** —— 军资公式（量级参照「主公等级×100 + 700」，本作自定）+ 战利品（缴获/拾取）。
3. **关间商店** —— 买 / 卖：装备（三档）· 消耗品（原版命名）· 印绶；与整军界面同屏一个 tab。
4. **卖装备 → 「果子练装」接口** —— 果子系统已暂缓，仅在卖出路径留 hook（不实装产出）。
5. **物价与经济平衡曲线** —— 价格表锚点、收入/支出预算、防通胀/防囤积。
6. **数据结构** —— per-chapter shop inventory、价格规则、`gameState.money`、存档字段。
7. **与 `ui/intermission` 的对接** —— 触点、事件、UX。

> 设计层产物，不含实现。大件标注 phaseable。术语/字段名复用既有语料（见 item-system / class-system / damage-preview 等）。

---

## 1. 货币模型：军资（money）

### 1.1 命名与单位
- 文案名：**「军资」**（也可称「金」「钱」）。单一整数池，单位为「金」。
- 全局共享一池（君主调度全军用度），**不按武将分账**。与原版「关间统一商店」体验一致。
- 不设上限硬截断（实际受经济曲线自然封顶，见 §5）；显示用千分位（如 `2,400`）。

### 1.2 gameState 字段（core/gameState.js）
在 `defaultState()` 增 `money`，并入序列化/反序列化与默认值兜底：

```js
function defaultState() {
  return {
    chapter: 1,
    battleIndex: 0,
    roster: [],
    inventory: [],
    money: 0,            // ← 新增：军资池（整数，≥0）
    shopState: {},       // ← 新增（可选）：已购/已售记录，用于限量库存（见 §4.3）
    storyFlags: {},
    settings: defaultSettings(),
  };
}
```

- `save()` 快照加 `money: this.state.money | 0` 与 `shopState`。
- `load()` 加 `money: typeof data.money === 'number' ? Math.max(0, data.money | 0) : 0`（旧档缺字段→0，向后兼容）。
- `newGame()` 沿用 `defaultState()`（含 `money:0`）。**起步注资见 §2.4**（新游戏开局给一笔启动军资）。
- 提供薄封装（避免各处直接 `state.money++` 出现负数/小数）：
  ```js
  game.addMoney(n)   // n 可正可负；内部 clamp ≥0，返回新值；触发 'money:changed'
  game.spendMoney(n) // 仅当 money>=n 才扣，返回 bool（true=成功）
  game.canAfford(n)  // money>=n
  ```
- **不 import three / 不触碰 DOM**（沿用 gameState 现有约束）；变更通过现有 `eventBus` 发 `money:changed`（HUD/商店监听刷新）。

---

## 2. 战后结算：军资公式 + 战利品

### 2.1 军资基础公式（量级参照「主公等级×100 + 700」，本作自定）
每场胜利结算一笔**基础军资**，挂在章节循环胜利分支（main.js §runChapter，`win===true` 之后、`applyJoins` 前后均可）：

```
baseReward = LORD_BASE + lordLevel * LORD_PER_LV
  LORD_BASE  = 700          // 底盘
  LORD_PER_LV = 100         // 主公(曹操)每级增量
  lordLevel  = 曹操(roster 中 classId==='leader' 的主公)的当前等级；缺失时取全军最高等级
```

> 例：曹操 Lv8 → base = 700 + 800 = **1500**。Lv15（章末）→ 700 + 1500 = **2200**。
> 锚定「主公等级×100+700」量级但参数集中在 `data/economy.js` 常量，便于调参。

### 2.2 表现/难度/达成修正（乘法系数，叠在 base 上）
```
reward = round( baseReward
                * difficultyMul          // easy 1.2 / normal 1.0 / hard 0.8（settings.difficulty）
                * objectiveMul )         // 战役额外目标达成奖励（见下）
       + lootCash                        // 战利品里的现金项（§2.3）
```
- `objectiveMul`：每关数据可声明 `rewardObjectives`（可选）：
  - 全员存活（无我方阵亡）：×1.15
  - 回合数 ≤ 目标回合（速通）：×1.1
  - 占领全部据点 / 击破指定敌将：×1.1
  - 多项可叠乘，封顶 ×1.5（防滚雪球）。
- 难度系数影响经济宽裕度，是平衡旋钮之一（hard 更紧、逼迫取舍）。

### 2.3 战利品（loot）：现金项 + 实物项
战利品分两类，均在战役数据声明（数据驱动，不改引擎）：

1. **现金战利品 `lootCash`**：固定额，叠进 §2.2 的 `reward`（如「焚营缴获辎重 +400」）。
2. **实物战利品 `lootItems`**：itemId 列表，结算后进 `gameState.inventory`（与现有装备/兵书入库同口径）。
   - **必得**（`drop:'always'`）：剧情/必拾（如关键宝物，与 item-system §4「获得关卡」一致——宝物走剧情/必得，不进随机池）。
   - **概率**（`drop:{ p:0.5 }`）：杂兵掉落消耗品/低档装备，用 `core/rng.js`（可种子，保证可复现/可测）。
   - **击杀掉落**（可选，phaseable）：特定敌将携带物，击破后入库（如华雄→明光铠）。本期可先用必得式 `lootItems` 简化表达，击杀掉落作二期。

战役数据增字段（`data/chapters/chXX/<battle>.js`，可选）：
```js
reward: {
  lootCash: 0,                                  // 现金战利品
  lootItems: [                                  // 实物战利品
    { itemId: 'heal_rice', drop: 'always', qty: 2 },
    { itemId: 'iron_armor', drop: { p: 0.4 } },
  ],
  objectives: [                                 // 表现奖励条件（评估函数 id + 系数）
    { id: 'noLoss', mul: 1.15 },
    { id: 'turnsUnder', arg: 12, mul: 1.1 },
  ],
}
```

### 2.4 起步注资 & 结算演出
- **新游戏开局**：`newGame()` 后给 `STARTER_MONEY`（建议 **800**，约一关 base 的一半，足以买几瓶恢复用豆/米但买不起好装备，建立「先攒后买」节奏）。
- **结算屏**（复用 `ui/menus.js` 胜利结算 / `ccz-result-banner`）在升级演出旁加一栏「军资 +N（战利品：…）」与「现存军资」。实物战利品列入库清单。

---

## 3. 关间商店（shop）

### 3.1 形态与入口
- 商店是**整军界面（`ui/intermission`）内的一个分页/tab**，不另开场景：整军主体（点将/装备/学计略/印绶/存档/出征）+ 「**军市**」tab。
- 文案名：**「军市」/「商旅」**（关间随军商队）。在卷轴顶部 `ti` 旁加 tab 切换（「整军 ｜ 军市」），沿用现有 `.ccz-int-*` 卷轴国风样式与 `--gold/--vermilion` 变量。
- 顶部恒显**军资余额**（金色数字，监听 `money:changed` 实时刷新）。

### 3.2 商品类目（三类，与 item-system 完全对齐）
| 类目 | 内容 | 买 | 卖 |
|---|---|---|---|
| **装备** | 普通装备 皮/铜/钢三档（武器/防具/饰品），按兵种限制 | ✓ 按章库存（§4） | ✓ 见 §3.4 |
| **消耗品** | 原版命名：恢复用豆/米/桃、神秘水/酒、解毒药、膏药、止咳药、兴奋剂 | ✓ 常驻无限量 | ✓（半价回收，少用） |
| **印绶** | `seal`（Lv15/30 转职用） | ✓ 限量/高价（§4.4） | ✗（不可卖，防套现） |
| **宝物** | 公有领域名物（item-system §4） | ✗ **不卖给玩家**（仅剧情/战利品获得） | ✗ 不可卖（无价之宝，防误删） |

- 宝物**不进商店买卖**：保持「靠剧情/缴获」的稀有感与叙事绑定（与 item-system「获得关卡」一致）。

### 3.3 买（buy）
- 列出当前章库存（§4）。每行：名称 + 类目标签（兵器/防具/饰品/道具/印绶）+ 效果摘要（复用 intermission 的 `bonusText` / `note`）+ **价格** + 「购买」按钮。
- 兵种限制提示：装备行显示「适用：骑兵/弓骑兵」等（来自 `Item.classes`），买入即进 `inventory`（装到具体武将仍在整军 tab 完成，沿用现有 equip 流程）。
- 购买流程：`game.canAfford(price)` → 不足则禁用按钮 + toast「军资不足」；成功 `game.spendMoney(price)` + push 到 `inventory` + `shopState` 记一笔（限量品扣库存）+ toast「购入「X」（-price）」。
- 可选「批量买」消耗品（长按/数量步进），phaseable。

### 3.4 卖（sell）& 与「果子练装」的接口（hook only）
- 卖出来源：武将**未装备**的 `inventory` 物品 + （可选）从某武将**卸下后**的物品。
- **卖价公式**：`sellPrice = floor(buyPrice * SELL_RATE)`，`SELL_RATE = 0.5`（半价回收，常见防刷曲线）。无 `price` 的物品（如旧档自带）按档位兜底估价（皮/铜/钢 → 见 §5 锚点）。
- **印绶/宝物不可卖**（§3.2）。已装备物品不在卖列表（需先卸下，防误卖正穿装备）。
- **果子练装 hook（暂缓，仅留接口）**：item-system §5 的「果子/压级练果」本期不实装。在卖出装备的代码路径预留一个**纯函数钩子**，默认 no-op：
  ```js
  // data/economy.js（或 battle/economy.js）
  // 装备被卖出/销毁时调用；当前返回 null（无果子）。
  // 未来果子系统实装：依装备「练级进度(0~99exp/三档)」返回对应果子 itemId（武力/统率/智力/敏捷/好运/经验果）。
  export function fruitOnSell(item /*, growthProgress */) {
    return null; // TODO(果子系统): 见 item-system §5；本期不产出果子
  }
  ```
  - 调用点：sell 确认后 `const fruit = fruitOnSell(item); if (fruit) inventory.push(fruit);`（当前恒 null，不影响行为）。
  - 这样果子系统落地时**只改 `fruitOnSell` 与果子道具定义 + 装备练级进度追踪**，不动商店/卖出 UI 主干。
- 卖出确认：>= 某价值阈值（如宝物——虽不可卖——或高档装备）弹二次确认，防误操作。

---

## 4. 数据结构：per-chapter shop inventory + 经济常量

### 4.1 新模块 `data/economy.js`（纯数据/纯函数，不 import three / 不碰 DOM）
集中所有经济旋钮与价格规则，便于调参与单测：

```js
// data/economy.js
export const ECON = {
  STARTER_MONEY: 800,
  LORD_BASE: 700,
  LORD_PER_LV: 100,
  SELL_RATE: 0.5,
  DIFFICULTY_MUL: { easy: 1.2, normal: 1.0, hard: 0.8 },
  OBJECTIVE_CAP: 1.5,
};

// 物价锚点：装备按 槽×档 定基价；消耗品按效果量级定价；印绶高价（§5）。
export const PRICE = {
  tierBase: { weapon: { hide: 120, bronze: 320, steel: 720 },   // 皮/铜/钢
              armor:  { hide: 100, bronze: 280, steel: 640 },
              accessory: { hide: 90, bronze: 240, steel: 560 } },
  consumable: {
    heal_bean: 30, heal_rice: 90, heal_peach: 220,
    mp_water: 80, mp_wine: 200,
    antidote: 40, plaster: 40, cough_med: 60, stimulant: 120,
  },
  seal: 2000,                                   // 印绶（限量、高价；见 §5）
};
```

### 4.2 单件装备价（`Item.price` 优先，否则按档兜底）
- item-system 已规定 `Item = { id, name, slot, classes, stats, special?, tier, price }`。**`price` 字段为权威**。
- 商店/卖出取价：`item.price ?? PRICE.tierBase[item.slot][item.tier]`（带 special 的可在 data 里手填溢价，如稀有词条 +30%）。
- `tier` 取值与 item-system 对齐：`'hide'|'bronze'|'steel'`（皮/铜/钢；谋士系防具的布/皮/道服映射到同三档键）。

### 4.3 per-chapter 商店库存（数据驱动，每章一份）
每章在 `data/chapters/chXX/shop.js` 声明本章「军市」库存（**装备按剧情进度逐章解锁更高档**，体现成长曲线）：

```js
// data/chapters/ch01/shop.js
export const SHOP_CH01 = {
  // 消耗品：常驻无限量（present 才上架；价格走 PRICE.consumable）
  consumables: ['heal_bean', 'heal_rice', 'antidote', 'plaster', 'mp_water'],

  // 装备：本章上架的普通装备 itemId（来自 data/items.js）。
  // 第一章以 皮/铜 为主，钢档仅末期或不售（逼玩家靠战利品/宝物）。
  equipment: [
    { itemId: 'sword_hide',  unlockBattle: 0 },   // 从第几战后上架（battleIndex）
    { itemId: 'spear_bronze', unlockBattle: 1 },
    { itemId: 'bow_hide',    unlockBattle: 1 },
    { itemId: 'armor_bronze', unlockBattle: 2 },
  ],

  // 印绶：限量（本章可买几枚，配合转职节奏；见 §4.4 / §5）
  seals: { stock: 1, unlockBattle: 2 },           // 第一章末才解锁、限购 1 枚
};
```

- **上架时机** `unlockBattle`：`battleIndex >= unlockBattle` 才显示（随章节推进解锁更强商品），与 main.js 章节循环的 `battleIndex` 直接对应。
- **限量库存**：`seals.stock` 等限量项，已购数记在 `gameState.shopState[chapterKey]`（如 `{ 'ch01': { seals: 1 } }`），售罄即禁用，**跨整军会话持久**（存档保存）。无限量消耗品不记。
- 章切换不清零 `shopState`（玩家本章没买的限量品视为「商队已离去」，下章新库存）；新章用新 key。

### 4.4 印绶供给（与转职节奏绑定）
- 印绶是经济**主要金钱去向**之一（高价 + 限量），抑制「攒钱无处花 → 通胀」。
- 供给曲线锚定 class-system 的 Lv15/30 转职：第一章末（曹操约 Lv12–15）放出**第 1 枚**印绶（够给主力一人转中级）；后续章节按「主公等级/N」节奏增量放出（同 item-system 宝物的「曹操等级/4+1」式渐进，本作自定 N）。
- 印绶 `price` 高（PRICE.seal=2000 量级，约 1–1.5 关 base），是「攒一章买一枚」的目标感来源。
- 也可由战利品/剧情直接给印绶（数据声明），商店是**保底补充渠道**。

### 4.5 存档影响（gameState）
- 新增持久化字段：`money`、`shopState`（§1.2 / §4.3）。`inventory` 已存在（战利品/购入入此）。
- 旧档兼容：`load()` 对缺失字段兜底（money→0、shopState→{}）；不破坏现有 `save_caocao_v1_slotN` 结构（只增字段）。
- 版本号沿用 `SAVE_VERSION=1`（增字段且向后兼容，无需迁移）；若未来字段语义变更再升版。

---

## 5. 物价与经济平衡曲线

### 5.1 收入侧（每关现金流入）
- 主收入 = §2 `reward`（base 随主公等级线性升：第一章约 1300→2200/关）。
- 第一章 5 战累计基础军资 ≈ **1300+1500+1700+1900+2200 ≈ 8600**（含起步 800 ≈ **9400**），外加战利品现金/实物。

### 5.2 支出侧 & 物价锚点（设计意图）
| 项 | 价位 | 设计意图 |
|---|---|---|
| 恢复用豆（小回血） | 30 | 随手补给，开局也买得起；鼓励高频消耗 |
| 恢复用米（中回血） | 90 | 主力补给品；一关收入可买 10+ 瓶 |
| 恢复用桃（大回血） | 220 | 应急高价，舍不得乱用 |
| 神秘水/酒（回精） | 80 / 200 | 计略系续航；按章解锁 |
| 解毒/膏药/止咳 | 40–60 | 状态对策，便宜常备 |
| 兴奋剂（临时强化） | 120 | 攻坚一次性投入 |
| 皮档装备 | 90–120 | 开局负担得起的入门升级 |
| 铜档装备 | 240–320 | 一关收入的核心去向 |
| 钢档装备 | 560–720 | 攒两关或留到后章；制造「取舍」 |
| **印绶** | 2000 | 章目标级支出，攒一章买一枚；金钱主沉淀 |

- **设计准则**：单关收入 ≈ 可买 1 件铜档装备 + 一批消耗品，**但买不齐全军**；逼玩家做「给谁先升级」的取舍 → 这是养成乐趣核心。
- **防通胀**：高价沉淀池（印绶 2000、钢档 700）+ 限量供给 + 卖价仅半价（卖装备回血有限，不能刷）。
- **防囤积无意义**：印绶/宝物不可卖、装备半价回收，使「攒钱」始终指向「下一枚印绶 / 下一档装备」这一明确目标。

### 5.3 难度旋钮
- `DIFFICULTY_MUL`（§2.2）整体缩放收入：hard 0.8 让经济更紧、取舍更痛；easy 1.2 更宽裕。
- 所有数字集中在 `data/economy.js` + 各章 `shop.js` + `items.js` 的 `price`，**调参不动逻辑**（与 master「数值集中在 data/ 便于调参」一致）。

### 5.4 平衡校验（单测 / 实玩走查）
- 单测：`baseReward(lv)`、`sellPrice(item)`、`priceOf(item)`、`objectiveMul` 上限钳制、`spendMoney` 不越负、`shopState` 限量扣减的纯逻辑。
- 模拟脚本（可选）：跑第一章 5 关「理想/保守」两条消费路径，验证「攒一章 ≈ 一枚印绶 + 若干补给」的目标曲线，避免过松/过紧。

---

## 6. 与 ui/intermission 的对接（触点清单）

> 现状：`intermission.js` 内置了一份**轻量 `ITEM_CATALOG`**（无独立 `data/items.js`），且**无价格/无货币/无商店 tab**。经济-商店接入需如下改动（设计层，列触点，不实现）：

1. **数据源统一**：商店与整军共用 `data/items.js`（item-system 定义的权威 `Item`，含 `price/tier/classes/slot`）。整军现内置的 `ITEM_CATALOG` 收敛到 `data/items.js`（避免两份目录漂移）。本稿的价格逻辑依赖该权威源。
2. **顶部军资条**：在 `.ccz-int-head` 区加「军资 N」金色显示，监听 `eventBus` 的 `money:changed` 刷新（与现有 `--gold` 风格一致）。
3. **新增「军市」tab**：在标题处加 整军 ｜ 军市 切换；军市面板复用 `.ccz-li` 行样式、`.ccz-mini` 按钮、`.ccz-toast` 提示。
   - 买：列章库存（§4.3，按 `battleIndex` 与 `shopState` 过滤）；按钮「购买」→ `spendMoney`。
   - 卖：列 `inventory` 中可卖物（排除印绶/宝物/已装备）；按钮「卖出（半价）」→ `addMoney`，并调 `fruitOnSell`（当前 no-op）。
4. **`ctx` 扩展**：`intermission.run(ctx)` 的 `ctx` 增 `chapterKey`（如 `'ch01'`）与 `battleIndex`（已有），供商店挑库存表 `SHOP_CH01` + 计算 `unlockBattle`。
5. **结算屏对接**（`ui/menus.js` 胜利结算）：显示「军资 +N」「战利品：…」并把实物入 `inventory`、现金入 `money`（在 main.js 胜利分支调用 §2 的结算函数 `settleRewards(battle)`）。
6. **HUD（可选）**：战斗内不显示军资（战时无消费）；仅整军/结算/标题显示。

### main.js 触点（章节循环）
- 胜利分支（`win===true`）后、`applyJoins` 附近调用新函数 `settleRewards(battle)`（在 `battle/economy.js` 或 `data/economy.js`）：计算 `reward` → `game.addMoney(reward)` → 处理 `lootItems` 入 `inventory` → 返回结算明细给结算屏展示。
- `intermission.run` 调用处补 `chapterKey`。
- 自动存档时机不变（`money/shopState` 已随 `save()` 落盘）。

### 模块清单（新增/改动）
| 模块 | 动作 | 说明 |
|---|---|---|
| `core/gameState.js` | 改 | 加 `money`/`shopState` 字段 + `addMoney/spendMoney/canAfford`；序列化/读档兜底 |
| `data/economy.js` | 新增 | `ECON` 常量、`PRICE` 表、`baseReward/priceOf/sellPrice/objectiveMul/fruitOnSell` 纯函数 |
| `data/items.js` | 新增/收敛 | item-system 权威 `Item`（含 `price/tier`）；整军内置目录并入此 |
| `data/chapters/chXX/shop.js` | 新增（每章） | per-chapter 库存（consumables/equipment/seals + `unlockBattle`） |
| `battle/economy.js`（或并入 data） | 新增 | `settleRewards(battle, state)`：算 reward + 派发战利品（用 `core/rng`） |
| `ui/intermission.js` | 改 | 军资条 + 「军市」tab（买/卖）+ 接 `fruitOnSell` hook |
| `ui/menus.js` | 改 | 胜利结算屏加「军资 +N / 战利品」栏 |
| `src/main.js` | 改 | 胜利分支调 `settleRewards`；`intermission.run` 传 `chapterKey` |
| `tests/` | 新增 | economy 纯逻辑单测（§5.4） |

---

## 7. 范围与 phase 建议

- **Phase 1（最小闭环）**：`money` 字段 + `addMoney/spendMoney`；战后 base 军资（§2.1，先不含 objectiveMul）；整军「军市」买消耗品 + 买/卖装备（皮/铜档）；存档落盘。→ 形成「打仗得钱、关间补给」闭环。
- **Phase 2**：印绶上架（限量 + `shopState`）；实物/现金战利品 `lootItems/lootCash`；表现奖励 `objectiveMul`；结算屏军资栏。
- **Phase 3（后置/暂缓）**：果子练装（实装 `fruitOnSell` + 果子道具 + 装备练级进度，见 item-system §5）；批量购买；击杀掉落；hard/easy 经济精调；多章库存表铺开。

---

## 8. 待确认

1. **货币命名**：用「军资」还是「金/钱」？是否需要文言别称（如「赀」「军赀」）？
2. **公式参数**：`LORD_BASE=700 / LORD_PER_LV=100 / STARTER_MONEY=800` 量级是否合适？以曹操等级为锚是否符合「主公视角」预期（vs 全军最高等级）？
3. **印绶定价/供给**：2000/枚 + 第一章末限购 1 枚的节奏是否过紧或过松？是否允许商店买印绶（还是只靠剧情/战利品给）？
4. **卖装备半价**（SELL_RATE 0.5）是否合适？宝物/印绶「不可卖」是否同意（防误删 + 防套现）？
5. **宝物不进商店买**（仅剧情/缈获）是否同意？这是稀有感与叙事绑定的关键决定。
6. **果子 hook**：本期仅留 `fruitOnSell` no-op 钩子、不实装（与 item-system §5 暂缓一致），确认？
7. **商店形态**：作为整军内 tab（本稿方案）还是独立「商队」场景？后者更隆重但更重。
8. **难度对经济**：difficultyMul（easy1.2/normal1.0/hard0.8）影响收入，是否作为难度的一部分（vs 只影响敌方强度）？
9. **战利品随机**：杂兵概率掉落是否需要（增随机性但削弱可复现/平衡感），还是第一章全用「必得」式简化？
