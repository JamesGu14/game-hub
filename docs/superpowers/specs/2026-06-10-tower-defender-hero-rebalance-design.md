# Tower Defender · 武将重排 + 新将引入 + 按章解锁 + 形象演进 设计

> 日期:2026-06-10 · 状态:已与 James 逐节确认
> 范围:games/tower-defender(数值/解锁/UI/资产),不改敌方全局数值、不改剧情文案

## 1. 背景与目标

1. **武力排序与史诗相符**:单发伤害严格 赵云 > 关羽 > 马超 > 张飞 > 黄忠(诸葛亮谋略系不参与)。
2. **升级伤害加成调小**:硬坡 ×1.6→×1.5,软坡 ×1.35→×1.3(满级总伤 ×4.67→×3.80)。
3. **引入 6 名廉价蜀汉名将**(师门传承版+黄月英):前期用廉价将,后期换五虎;五虎+诸葛涨价。
4. **按章解锁五虎**(派生自存档,轻仪式)。
5. **形象演进**:全员 L1→L3 三阶立绘,装备逐级奢华逼近演义经典;OpenRouter(Nano Banana)生成。
6. **硬约束:保持均衡性**——全 50 关按章阵容满防可通关(门禁见 §8)。

## 2. 数值设计

### 2.1 五虎将 + 诸葛亮(涨价 +25~29%,武力重排)

| id | 武将 | 造价 | 单发伤害 | 间隔(s) | 射程 | 对空 | 改动说明 |
|---|---|---|---|---|---|---|---|
| zhao | 赵云 | 160→**200** | **48**(①) | 2.5 | 5.0 | ❌ | 仅涨价 |
| guan | 关羽 | 120→**155** | 10→**28**(②) | 1.5→**2.2** | 3.0 | ✅ | 刀沉速慢;减速 40%/2.5s 与水淹七军参数不变 |
| ma | 马超 | 140→**175** | 14→**22**(③) | 1.2→**1.4** | 3.0 | ❌ | 贯穿≤3 不变 |
| zhang | 张飞 | 110→**140** | 20→**18**(④) | 1.8 | 2.5 | ❌ | 溅射 1 格不变 |
| huang | 黄忠 | 70→**90** | **9**(⑤) | 0.7 | 3.5 | ✅ | 速射定位不变 |
| zhuge | 诸葛亮 | 150→**190** | 8/层(灼烧) | 1.4 | 3.0 | ✅ | 仅涨价 |

招牌技(L3,全部不变):百步穿杨/当阳怒吼/水淹七军/七进七出/西凉突阵/火烧藤甲。

### 2.2 新 6 将(师门传承,无 L3 招牌技——招牌技是五虎"贵的理由")

| id | 新将 | 师承 | 造价 | 单发 | 间隔 | 射程 | dmgType | targets | attack | attackParams |
|---|---|---|---|---|---|---|---|---|---|---|
| liao | 廖化 | 黄忠 | **40** | 6 | 0.8 | 3.0 | physical | both | single | `{}` |
| zhou | 周仓 | 张飞 | **55** | 11 | 2.0 | 2.5 | physical | ground | splash | `{ splash: 0.8 }` |
| madai | 马岱 | 马超 | **55** | 9 | 1.3 | 2.8 | physical | ground | charge | `{ maxHits: 2 }` |
| guanping | 关平 | 关羽 | **60** | 6 | 1.6 | 3.0 | **strategy**(承水攻,无视护甲) | both | slow | `{ slowPct: 0.25, slowDur: 2 }` |
| zhangbao | 张苞 | (重击位,对照赵云) | **65** | 16 | 1.9 | 4.0 | physical | ground | single | `{}` |
| yueying | 黄月英 | 诸葛亮 | **75** | 5/层 | 1.5 | 2.8 | fire | both | burn | `{ burnDur: 2.5 }` |

新将 `signature` 字段为 `null`(无招牌技),`color` 取师门色的浅一档(实现时定)。

设计约束:新将单发全部 ≤16(不越张飞 18);DPS/金 普遍优于同系五虎(例外:关平 0.063 < 关羽 0.082,以 25% 减速控制补偿——**廉价控制必须弱**,防前期控场白菜化);单将位天花板仅五虎的 45~60%——将位有限(14~29),后期自然换将。

### 2.3 升级曲线(balance.js)

| 常量 | 现值 | 新值 |
|---|---|---|
| UPGRADE_DMG_MULT(L1→L3) | 1.6 | **1.5** |
| UPGRADE_DMG_MULT_SOFT(L3→L5) | 1.35 | **1.3** |
| 间隔 ×0.9/×0.95、射程 +0.5/级、升级费率 1.0/1.6/2.0/2.8、SELL_REFUND 0.6 | — | 不变 |

各级伤害倍率:L1 ×1 / L2 ×1.5 / L3 ×2.25 / L4 ×2.925 / L5 ×3.80。
L5/L3 DPS 比 = (1.3/0.95)² ≈ **1.87**,仍在守护区间 [1.8, 2.5],门禁无需放宽;L5/L1 DPS 6.4×→5.2×。

## 3. 解锁系统(新增 data/unlocks.js)

- `UNLOCKS = [{ afterLevel: 10, generals: ['zhao','zhang'] }, { afterLevel: 20, generals: ['zhuge','guan'] }, { afterLevel: 30, generals: ['huang','ma'] }]`,新 6 将开局即有。
- `unlockedGenerals(save) → Set<id>`:**纯派生自现有 save.unlockedLevel,零 schema 改动、零迁移**。老存档(已通关)自动全解锁。
- 剧情呼应:通关 L10→赵云/张飞(L11 长坂坡)、L20→诸葛/关羽(L21 赤壁)、L30→黄忠/马超(L31 定军山)。
- 克制链核对:飞兵第 3 章首现(开局廖化/关平/黄月英对空,L20 添诸葛/关羽);藤甲第 4 章首现(黄月英开局、诸葛 L20)。✓
- **调用链闭合**:`newGameState(level, { unlocked })` 增可选参(缺省=全解锁,存量测试零破坏);main.js 开局/读档时注入 `state.unlocked = unlockedGenerals(save)`;`canBuild` = 金币足**且** `state.unlocked.has(id)`;buildBar 渲染与 `hitBuildBar` 均读 `state.unlocked`,锁定将命中返回 null(静默,与"买不起置灰"同范式)。

## 4. 轻仪式

main.js 在 `applyClear` 前记 `prev = save.unlockedLevel`、之后对照 `UNLOCKS` 门槛得出本次新解锁将名;`drawResult(...)` 增可选参 `{ unlockNotice }`,在按钮组上方渲染一行金字:"⚔️ 新武将来援:赵云、张飞!"。无全屏动画、无新存档字段。

## 5. 建造栏与热键(buildBar.js + main.js)

- ≤6 将可见时单行(第 1 章与现状一致,热键 1-6);>6 两行:**下排新 6 将(热键 1-6 不变,第 1 章习惯无缝延续),上排五虎+诸葛(热键 Q/W/E/R/T/Y)**,各排按价格升序。弃用 -/= 等布局敏感键(非美式键盘位置漂移,对娃不友好);main.js keydown 按 `e.key` 小写匹配,点击/触屏始终可用。
- 锁定将显示在上排:灰底+🔒+缩写解锁条件("过第10关"),点击无效(命中即 null)——给娃可见的收集目标。
- towerPanel/heroCard 对无招牌技新将隐藏 L3 技能行。

## 6. 形象演进系统(L1→L3)

### 6.1 机制

- `stage = min(level, 3)`;资产 `gen_<id>_1/2/3`(12 将 × 3 阶 = **36 张**),文件 `assets/sprites/generals/<id>_<stage>.png`,MANIFEST 全注册。
- 取图统一走 `core/assets.js` 新增 **`generalSprite(id, level)`**:`stage = min(level, 3)`,回退链 `gen_<id>_<stage>` → 逐级降阶 → 旧图 `gen_<id>` → null(调用方画色块/首字,缺图永不裂,资产不阻塞数值上线)。MANIFEST 保持扁平 KV:新增 36 键 `gen_<id>_<stage> → assets/sprites/generals/<id>_<stage>.png`,旧 6 键保留作回退,assets.js 加载逻辑零改动。
- 消费点:drawTower / towerPanel → `generalSprite(id, tower.level)`(当前阶);buildBar → `generalSprite(id, 1)`(所购即所得);heroCard → `generalSprite(id, 3)`(目标感);storyCard 不动(沿用旧 `gen_<id>` 键)。
- L3 巅峰形象与招牌技解锁同刻("神兵到手");L4/L5 沿用 3 阶。

### 6.2 生成管线(tools/gen-sprites.mjs,已有 OpenRouter 集成)

- 模型 `google/gemini-2.5-flash-image`(Nano Banana),STYLE 常量(Kingdom Rush 风)不变,debg 去底 ≤512px 管线不变。
- 锚链:全局风格锚=黄忠现图;**阶 2 以本将阶 1 为身份锚、阶 3 以阶 2 为锚**(同一个人换装,不漂移)。
- **Key 安全:OPENROUTER_API_KEY 仅运行时环境变量注入,不写入任何文件/git;每批生成完成后轮换 key。**
- 预算:36 张 + 重 roll ≈ 40-50 调用,约 $1.5。

### 6.3 形象演进表(prompt 内容基准)

| 武将 | 1 阶·寒微 | 2 阶·精进 | 3 阶·神兵天成 |
|---|---|---|---|
| 关羽 | 布衣绿巾+朴刀 | 绿袍铁甲+长柄刀 | 青龙偃月刀+赤兔马,美髯飘扬 |
| 张飞 | 屠户短打+铁矛 | 皮甲+蛇矛 | 丈八蛇矛+黑甲,豹头环眼怒目 |
| 赵云 | 白袍枪兵 | 银鳞甲长枪 | 龙胆亮银枪+白马,白袍银甲 |
| 马超 | 西凉皮甲短枪 | 兽带轻铠骑枪 | 狮盔银铠白袍白马"锦马超" |
| 黄忠 | 老猎户木弓 | 铁胎弓轻甲 | 金甲白须+宝雕大弓 |
| 诸葛亮 | 布衣书生竹扇 | 八卦道袍羽扇 | 羽扇纶巾+四轮小车(演义素舆;James 原话"独轮车",审阅时定夺) |
| 廖化 | 粗布猎弓 | 皮甲军弓 | 先锋官铁甲+令旗强弓 |
| 周仓 | 赤脚黑面柴刀 | 铁甲大刀 | 黑甲虬髯,扛青龙刀 |
| 关平 | 少年木刀 | 轻甲长刀 | 白袍小将+父传宝刀 |
| 张苞 | 少年短矛 | 皮甲蛇矛 | 虎贲铁甲+家传蛇矛 |
| 马岱 | 西凉布甲弯刀 | 轻骑皮铠 | 白袍铁甲+斩将大刀 |
| 黄月英 | 布裙小弩 | 工装机关弩 | 鹅黄裙+手持诸葛连弩+背负机关匣,火羽箭 |

**渲染约束**:塔立绘实际显示高约 1.4 格(~51px),三阶形象一律"**人形为主、武器/小道具为辅**",禁止大型载具与复杂场景;诸葛亮小车为 James 点名保留,prompt 注明"人物占主体、车体简洁"。

## 7. 实施触点

| 文件 | 改动 |
|---|---|
| src/data/generals.js | 五虎数值重排+6 新将条目 |
| src/data/balance.js | 两个曲线常量 |
| src/data/unlocks.js(新) | 解锁日程+派生函数 |
| src/core/gameState.js | newGameState 增可选 `unlocked` 参(缺省全解锁) |
| src/ui/buildBar.js | 1→2 行布局/锁定态/12 将/读 state.unlocked |
| src/main.js | 热键(1-6 + QWERTY)/state.unlocked 注入(开局+读档)/解锁跨越检测与 unlockNotice 传参 |
| src/ui/resultPanel.js | drawResult 增 `{ unlockNotice }` 可选参+提示行渲染 |
| src/ui/towerPanel.js / heroCard.js | 阶级立绘 + 无招牌技兼容 + 新 6 将 lore 文案 |
| src/render/entityRenderer.js | drawTower 改用 generalSprite(id, level) |
| src/core/assets.js | MANIFEST +36 + generalSprite(id, level) 取图函数 |
| tools/gen-sprites.mjs | 12 将 ×3 阶条目+锚链 |
| tests/*(§8) | 门禁更新 |

## 8. 门禁(改完必须全绿)

1. **towerStats.test**:更新曲线锁值;**新增排序不变量**——五虎单发严格 赵>关>马>张>黄、各徒弟单发与 DPS 低于师父(张苞无师承,对照赵云)、新将单发 ≤ 张飞;L5/L3 比守护 [1.8,2.5] 保持。
2. **levels-winnable.test 升级"按章阵容"**:每关 `defenders = [...unlockedGenerals({ unlockedLevel: level.id })]` 轮流放置(=玩家**首次遭遇**该关时的最严苛阵容),满防 L5 headless 跑,全 50 关 won(第 1 章纯新将可通关为硬门禁)。
3. economy/buildBar/heroCard 测试:新造价、12 将、锁定态。
4. **assets.test**:36 张演进图 MANIFEST 注册校验。
5. balance-report.mjs 跑趋势(CHEAP 自动变 40);puppeteer 冒烟;James+娃实玩验收。

## 9. 风险与预案

| 风险 | 预案 |
|---|---|
| L47/48/50 紧关卡,L5 总伤 -19% | 关羽/马超基础上修部分对冲;不过则优先 per-level rampMax 微调这 3 关,其次软坡回调 1.32;不动全局敌方数值 |
| 第 1 章纯新将满防不过(**高优先级——直接影响前期可玩性**) | 实施顺序前置:数值+winnable 门禁先落地验证,UI/资产后置;不过则新将整体上调 5-10% |
| 关羽重做后控制+输出双强(DPS 6.7→12.7,近黄忠 12.9) | balance-report 专项观察;过强则间隔回调 2.2→2.4 |
| 骑乘形象更宽、邻格重叠 | 渲染按高度归一已有;必要时 3 阶单独微调高度系数 |
| AI 生成风格漂移 | 锚链+单张重 roll;缺图回退链兜底 |

## 10. 范围外(YAGNI)

剧情文案不动(剧情是"历史讲述"非阵容)、levelSelect 不加阵容预览、新将不配招牌技、音频不动、L4/L5 不做新形象、敌方数值不动。
