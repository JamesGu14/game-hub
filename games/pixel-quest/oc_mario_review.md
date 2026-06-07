# Pixel Quest 10 世界扩展设计 — Review

> Reviewer: Sisyphus  
> Date: 2026-06-07  
> Spec: `games/pixel-quest/docs/superpowers/specs/2026-06-07-pixel-quest-10-worlds-design.md`

---

## 一、总体评价

**需求明确度: 8/10**

这份 spec 质量很高:范围界定清楚、有明确的"做/不做"清单、技术锚点尽量使用方法名而非行号、分了可独立验证的阶段 A→D、对世界主表和怪物机制描述细致。对现有代码的核实(20 关/20 主题/ENTITY_CHARS/ENEMY 等)也做得扎实。

**但仍有若干需要补齐或澄清的地方**,主要集中在:现有关卡 ID 与 `worldOf()` 推导的暗合性、Boss 关边缘 case、对话 UI 层级、以及并行 agent 作图时的约束文档化。

---

## 二、已核实 vs 现状对照(确认正确)

我拉取了当前代码核对,spec 中的"现状"段落基本属实:

| 项 | Spec 描述 | 代码实际 | 结论 |
|---|---|---|---|
| 关卡数 | 20 关 | `LEVELS.length === 20` | ✓ |
| 主题数 | 20 套 | `Object.keys(THEMES).length === 20` | ✓ |
| 已有关卡主题分布 | 世界 1-4 各 5 关 | 1-1~1-5 与世界 1 主题表完全匹配;2-1~2-5、3-1~3-5、4-1~4-5 也匹配 | ✓ |
| 实体字符 | `@ c g k o` | `ENTITY_CHARS` 正是这 5 个 | ✓ |
| `ENEMY` 字段 | 5 个现有字段 | 属实 | ✓ |
| `_spawnEntities` | 三元 `koopa : goomba` | 属实,必须改查表 | ✓ |
| `collideTiles` 的 `opts.gravity` | 支持 | `physics.js:23-24` 已支持 | ✓ |
| 当前结局流程 | `_winGame → ending → win` | 属实,ENDING 对话接入 celebrate 收尾合理 | ✓ |

现有 20 关 `node tools/verify-levels.js` **全部 PASS**,是干净的基线。

---

## 三、需要补齐或澄清的内容

### 1. 关卡 ID 与 `worldOf()` 推导的潜在错位(建议明确)

Spec 用 `worldOf(i)=floor(i/5)+1` 推导世界号,这要求 `LEVELS` 数组是严格按世界顺序排列的。当前数组确实满足:
- indices 0-4 = 世界 1
- indices 5-9 = 世界 2
- indices 10-14 = 世界 3
- indices 15-19 = 世界 4

**注意点**:当前常量命名有些误导(如 `lvl4` 实际是 `2-5`,而 `lvlLava` 才是 `1-4`),但 `id` 字段正确,不影响 `worldOf()`。建议在阶段 C 开始**先做一次仅涉及 `id` 和常量命名的重构**,避免并行 agent 作图时搞混。

**建议补到 spec**:在阶段 A 或阶段 C 开头,增加一条"校验现有 20 关的 `id` 与世界号严格对齐"的 check。

---

### 2. 世界 3-5 与世界 4-5 的现有结局定位

当前代码中:
- `lvlAbyss` (3-5) 以 `F` 旗子结尾,是普通关。
- `lvlCelestial` (4-5) 以 `A` 城堡结尾,触发 `_winGame` / ending cutscene。

Spec 本次扩展后,最终胜利点移到 `10-5` 的 castle + Boss 击败。**需要确认**:世界 4-5 的 `A` 是否保留为"临时结局"(在世界 10 未做完前仍可通关),还是要在阶段 D 强制替换? 如果阶段 A-C 先上线,4-5 仍然是唯一城堡关,会导致"打到 4-5 就结局"与 10 世界叙事冲突。

**建议**:
- 阶段 A(剧情系统)可独立上线,但不触动关卡结构;世界 4-5 仍然可通关,win overlay 继续可用。
- 阶段 B/C 渐进补 5-9 关时,**是否暂时禁用 4-5 的 castle 触发**? 或者允许玩家在 4-5 提前看到旧版 win,等阶段 D 再统一?
- Spec 应明确:"在 10-5 上线之前,4-5 的 castle 触发是否保留作为兼容兜底"。

---

### 3. Boss 竞技场 `10-5` 的边界 case 未覆盖

Spec 对 10-5 描述很细,但缺以下几点:

#### 3a) 检查点 / 死亡续关
- `10-5` 是固定竞技场、地面满铺、无坑。玩家死亡后 `continueRun()` 会走 `loadLevel(levelIndex)` 重载本关。
- 但 spec 未写 10-5 是否放 `c`(checkpoint)。如果不放,死亡后从 `@` 重来,Boss HP 会重置(因为 `_spawnEntities(full=true)` 会重建敌人),这其实是合理的。
- **建议明确**:10-5 不放 `c`,Boss 战一命到底,符合 Boss 战仪式感。

#### 3b) 时间 `999` 与 `timeLeft` 显示
- HUD 上 `⏱ 999` 会占较宽位置,可能挤到中心关卡名。
- **建议**:Boss 关时间显示可改为 `⏱ --` 或不显示,或者在渲染层做特殊处理。Spec 不提也可,但落地时建议测一下 HUD 布局。

#### 3c) 玩家火球对 Boss 的 `addScore` 与音效
- Spec 写了火球扣 1 HP,但未写每次命中是否加分、播放什么音效。
- **建议补**:Boss 受击播放 `Sound.stomp()` 或新加 `Sound.bossHit()`,每次扣 HP 加 `200` 分(与 fireKill 对齐)。

#### 3d) Boss 击败后的时间奖励
- `_winGame` 会加 `timeLeft * SCORE.timeBonus`。`10-5 time: 999` 会导致夸张得分(近 20,000 分)。
- **建议**:Boss 关 `timeBonus` 不计算,或设置 `time: 300` 也能满足一般 Boss 战时长。Spec 应拍板。

---

### 4. 对话 UI 层级与样式细节

Spec 提出用 `#overlay-dialogue` + DOM 面板 + 内嵌 canvas 头像,但未规定:

| 缺省项 | 建议 |
|---|---|
| z-index | 对话 overlay 应在 `touch-controls` (z=400) 之上、在持久 chrome (z=9999) 之下。建议 `z-index: 500~600`。 |
| 面板宽度 | 小朋友设备上 92vw/580px 的 `.panel` 可能底部被手挡住,建议 dialogue 面板位置稍靠上(或用 `margin-top: -10vh`)。 |
| 头像放大倍数 | Spec 提到"CSS 放大如 96×96",但未写具体 `width/height` 样式。建议给出 `.dlg-portrait { width: 96px; height: 96px; image-rendering: pixelated; }`。 |
| 长文本拆分 | 规范说 `text ≤ 38 字`,但未给拆分工具或校验方式。建议加一条"所有文案节点须满足 `text.length ≤ 38`",并在 `story.js` 里用 assert/dev 检查。 |
| 拼音位 | Spec 提到"生字可在 dlg-text 旁留拼音位",但没有给出交互决策。建议直接删除这一开放性描述,改为"默认零生字,一年级高频词优先;若出现生字,统一换更简单的词"。 |

---

### 5. 新怪机制的几个模糊点

#### 5a) 飞翼怪 `v` — 退化后的落地安全
- Spec:"踩第一脚掉翅膀,退化为 Goomba 式地面巡逻"。
- 但飞行态 `y` 由正弦决定,可能在半空被踩掉翅膀。退化后立刻调用 `collideTiles`,如果此时脚下无地面会直接坠落。
- **建议明确**:关卡作者必须保证 `v` 下方是可行走的地面/平台;若被踩时下方是坑,则该敌人自己掉坑死亡(也算玩家收益,可接受)。在 `_level_kit.md` 中补充:"飞翼怪必须摆在有地面的上方"。

#### 5b) 冲刺兽 `z` — windup 动画与方向判定
- Spec 写"当玩家与其大致同一水平线(`|脚部y差|<TILE`)"触发冲刺,但未写如果玩家正好在冲刺兽正上方(踩在头顶)是否触发。
- 建议:windup/dash 只在玩家位于冲刺兽前方水平区域时触发,玩家在正上方时不触发,避免奇怪抖动。

#### 5c) 食人花 `p` — 玩家"压在管口"的判定
- Spec:"玩家压在管口正上方时不冒出(防呆)",但未给判定代码。
- 建议判定:`player.x + player.w > p.x - 4 && player.x < p.x + p.w + 4 && player.y + player.h <= p.baseY + 8`。
- 同时需要确认:食人花 `baseY` 在构造时如何计算? 是传入的 `y` 还是 `y + TILE`? Spec 里写了两种,需统一。

#### 5d) 炎魔 `m` — 敌方火球与玩家火球的视觉区分
- Spec 已提到紫色 `#c46bff`,很好。但没说玩家自己的火球在敌方火球大量存在时会不会混淆。
- 建议:敌方火球尺寸 `14×14` 略大于玩家 `12×12`,且颜色紫,足够区分。可接受。

---

### 6. `_level_kit.md` 必须同步更新

当前 `_level_kit.md` 对 agent 作图的约束与 spec 有脱节:

| 当前 kit | 需要更新 |
|---|---|
| 实体标记只有 `@ c g k o` | 新增 `v z p a m W` 的说明,并注明 `W` 仅用于 `10-5`,`p` 必须配 `M` 火花道具 |
| "NEVER place A (castle)" | 增加例外:"仅 `10-5` Boss 竞技场可放 `A`" |
| "Include exactly one F" | 增加:"`10-5` 无 F,以 castle `A` 为目标;其余关仍须恰好一个 F" |
| "6–10 enemies" | 世界 5-9 的密度建议(如世界 5 约 6-8 怪含 2-3 个 `v`,世界 9 可 10-12 怪) |
| 无主题表 | 增加§一的世界主题速查表,防止 agent 用错主题 |

**建议**:把 spec 的"世界主表"浓缩进 `_level_kit.md` 的"Assignment lookup"章节,每个 agent 开局必读。

---

### 7. 剧情文案可优化/缺漏

整体文案符合一年级口语,基调统一。但有少量可打磨处:

| 位置 | 问题 | 建议 |
|---|---|---|
| 世界 4 intro | "得到厉害的力量" | 略抽象,可改为"得到新的本领" |
| 世界 5 intro | "踩它一脚,它就掉下来啦" | 飞翼怪需要两脚才死,第一脚只掉翅膀。建议改为"踩它一脚,翅膀就掉啦,再补一脚!" |
| 世界 7 intro | "踩不到它?那我用火球" | 食人花是"踩了也伤",不是"踩不到"。建议改为"它身上有刺不能踩?那我用火球!" |
| ENDING | "封你为驸马" | 对一年级小朋友,"驸马"可能略文言。可保留(配合拼音),或改为"把公主许配给你" |

**非阻塞**,可在实现时顺手改。

---

### 8. 技术实现层面的补充建议

#### 8a) `ENEMY_CTORS` 的兜底
Spec 写 `const C = ENEMY_CTORS[e.type] || Goomba;`,这是好的退化策略。但建议在开发阶段改成抛错:
```js
const C = ENEMY_CTORS[e.type];
if (!C) throw new Error(`Unknown enemy type: ${e.type}`);
```
这样在关卡数据写错时能立刻发现,而不是静默退化成 Goomba。上线前再改回 `|| Goomba`。

#### 8b) 新实体类导入的循环依赖风险
`entities.js` 中 `Fireball.update` 要用鸭子类型检查 `e.hit`,没问题。但 `game.js` 要用 `instanceof Bowser`,需要 `entities.js` 先导出 `Bowser`。只要 `Bowser` 类定义在 `entities.js` 底部之前(即在 `Fireball` 之后也没问题,`instanceof` 是运行时),就不会循环依赖。

#### 8c) 敌方火球容器命名
`game.enemyShots` 与 `world.enemyShots` 一致,建议同步在 `render.js` 的方法也叫 `_enemyShots`,避免命名漂移。

#### 8d) `Sprites.portrait()` 的默认 fallback
Spec 写 `default: cached('portrait:mario', ...)`,建议改为 `default: cached('portrait:herald', ...)`。如果某个节点写错 portrait key,侍从出场比马里奥自言自语更自然。

---

## 四、风险与建议的缓解措施

| 风险 | 影响 | 缓解 |
|---|---|---|
| 31 个新关由并行 agent 产出,尺寸/风格不一致 | 玩家体验跳跃 | 严格先更新 `_level_kit.md`,每个 agent 必须输出验证 PASS 截图 |
| 食人花踩不死导致低龄玩家卡关 | 体验挫败 | 已在 spec 中要求配 `M` + 留躲避路径 + intro 提示,足够 |
| Boss 战 HP=5 对一年级偏长/偏短 | 节奏问题 | 建议先做 5 HP,阶段 D 真机测试后可调为 3-5 之间 |
| 对话系统阶段 A 上线后,文案未填满世界 5-10 | 空脚本自动跳过,无卡死风险 | spec 的空脚本降级已覆盖 |
| iPad 内存 | 新增 sprite 缓存 | 已约束仅 1 个新主题 + ≤58px sprite + `cached()`,风险低 |

---

## 五、Review 结论

**这份 spec 已达到可进入实现的标准**,但建议在动工前补齐以下 **5 项 high-priority 澄清/文档更新**:

1. **更新 `_level_kit.md`**:加入新实体字符说明、`10-5` 的 `A` 例外、世界主题速查表、`p` 必须配 `M` 的约束。
2. **明确 Boss 关边界 case**:10-5 无 checkpoint、Boss 受击音效/得分、时间奖励处理方式。
3. **统一食人花 `baseY` 计算**:在 spec 或代码注释中给出精确公式。
4. **规定 dialogue overlay 的 z-index 与面板尺寸**:防止与 touch-controls/持久 chrome 层级冲突。
5. **确认 4-5 城堡在世界 10 完成前的兼容性策略**:是保留旧结局,还是在阶段 C 后临时禁用?

**中低优先级**(可在实现中顺手处理):
- 校对食人花/飞翼怪的文案描述与机制一致。
- 给 `Sprites.portrait()` 选更合适的 default key。
- 开发阶段让未知 enemy type 抛错而非兜底。

整体而言,spec 的技术方案与现有引擎结合得很紧,分阶段落地策略合理,是一部可以开干的文档。

---

*Review 完成。输出文件: `oc_mario_review.md`*
