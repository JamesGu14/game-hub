# 《群雄逐鹿·孟德篇》audio-presentation — 设计稿（待审）

> 原创致敬作。BGM/SFX **全程序化合成（WebAudio）或轻量原创音轨**，
> 五声音阶（宫商角徵羽）古风风味，**不使用任何受版权音乐、采样或第三方音轨**。
> 演出规格沿用既有设计语料：5 维（攻/精/防/爆/士）、计略 `kind`(damage/heal/buff/debuff/control)×`element`(fire/thunder/water/dark)、
> 天气(晴/雨/雪/雾/阴)、单挑(duel)、等距锁定相机 + 关键运镜。
> 状态：**待 James 审阅**。

- **日期**：2026-06-04
- **作者**：James（顾嘉晟）+ Claude
- **项目**：game-hub / `games/caocao-zhuan/`
- **对接模块**：`src/audio/audio.js`、`src/render3d/{camera,fx,sceneManager}.js`、`src/ui/duelView.js`、`src/story/{scenarioRunner,dialogue}.js`、`src/main.js`
- **范围**：音频（BGM 方案 + SFX 清单）+ 演出（计略/单挑/必杀动画规格、章节过场、镜头语言）。仅设计，不实现。

---

## 0. 现状盘点（已落地，本稿在其上扩展，不推翻）

| 文件 | 已有能力 | 本稿要扩的 |
|---|---|---|
| `audio/audio.js` | `sfx.{select,move,attack,hit,heal,win,lose,setMuted,resume,isMuted}`；惰性 `AudioContext`、`blip/noiseBurst/arpeggio` 三个合成原语；`master` 增益总线 | **新增 BGM 子系统 + 扩 SFX 清单**（计略/各系/单挑/UI），复用同一 ctx/master/静音约定 |
| `render3d/camera.js` | `makeCamera`→`{setIso,cinematic({focus,zoom}),reset,update,setAspect}`，指数 lerp 平滑 | **运镜预设库**（push/shake/orbit-lite/letterbox 配合），不改签名 |
| `render3d/fx.js` | `moveAlong/hitFlash/floatText/setFxScene/castFx(kind,element,worldPos,aoeCells)`；粒子 `burst/ring/aoeTint/bolt/swirl`；`ELEMENT_COLOR/KIND_COLOR` | **必杀/单挑特效层、飘字分级、运镜震屏钩子、过场程序化 CG 帮手** |
| `ui/duelView.js` | 单挑电影化覆盖层（letterbox/立绘/HP/lunge/verdict），`run(duel,{sceneManager,camera,fx,audio})` | **单挑专属 BGM 切换 + 招式飘字分级 + 必杀演出接入** |
| `story/scenarioRunner.js` | step：`narrate/say/choice/camera/setFlag/duel`；`bus` emit `scenario:done` 等 | **新增 step：`bgm` / `sfx` / `cg` / `shake`**（向前兼容，未知 step 已被忽略） |
| `main.js` | 已绑 `sfx.*` 到选择/移动/攻击/计略/胜负；`setFxScene`；`bus.on('camera:cinematic')` 运镜 | **绑 BGM 状态机到战斗相位 + bus 事件**；过场 step 透传 |

**bus 现有事件**（演出可挂载，无需改逻辑层）：
`turn:changed` `unit:moved` `unit:attacked` `unit:died` `unit:skill` `status:tick`
`duel:start` `duel:end` `battle:win` `battle:lose` `camera:cinematic` `scenario:done`。

---

## 1. 音频总体架构（在现有 audio.js 上加 BGM 子系统）

### 1.1 设计准则
1. **全程序化**：BGM 与 SFX 都用 WebAudio 振荡器/噪声/包络现场合成；**零音频文件**（与 §2 离线、无版权一致）。可选「轻量原创音轨」仅作 §1.6 的降级/备选，**默认不启用**。
2. **复用现有总线**：所有声音仍走 `audio.js` 的单一 `ctx` + `master` 增益；静音 = `master.gain→0`（已实现）。BGM 挂到 master 之下的 **`musicBus`** 子增益，SFX 挂 **`sfxBus`** 子增益，便于分别调音量（见 §1.5）。
3. **不阻塞、不依赖 three**：`audio.js` 继续只依赖 WebAudio + `game`，不 import three（与现状一致）。
4. **可复现**：BGM 用确定性的乐句序列（固定音阶 + 固定节奏型 + 轻随机装饰），不影响战斗 `rng`（战斗随机仍走 `core/rng.js`，音乐自带独立 Math.random 装饰即可，不参与存档/校验）。

### 1.2 模块切分
保持 `audio/audio.js` 为门面，内部新增（或拆子文件，二选一，建议拆以控体积）：
```
src/audio/
  audio.js        # 门面：导出 sfx（扩清单）+ music（新）+ setMuted/resume 统一
  music.js        # （新）程序化 BGM 引擎：曲目状态机 + 五声乐句生成器
  sfxLib.js       # （可选）把扩展后的大 SFX 清单从 audio.js 拆出，audio.js re-export
```
> 若不想拆文件，可全部留在 `audio.js`；本稿按「逻辑分区」描述，文件落点在实现 plan 定。

### 1.3 程序化 BGM 引擎（`music.js`）契约
```js
export const music = {
  // 播放/切换曲目，crossfade 过渡（默认 1.2s）。track 见 §1.4 表。
  play(trackId, { fadeMs = 1200, intensity = 0 } = {}),
  stop({ fadeMs = 800 } = {}),          // 渐隐停
  duck(amount = 0.4, ms = 200),         // 临时压低（单挑入场/旁白时给 SFX 让路）
  unduck(ms = 400),
  setIntensity(level),                  // 0..1，战斗紧张度（残血/敌多→升），驱动配器层叠
  current(),                            // -> trackId | null
  // 静音/恢复由 audio.js 门面统一转发（与 sfx 共用 master 静音）。
};
```
**内部实现要点**
- **音阶**：宫=C 的五声（C D E G A，外加八度），章节可整体移调（变宫调式给悲怆/紧张感）。
- **声部**：用现有 `blip` 原语扩展为 3 层——
  1. *旋律层*（triangle/sine，主乐句，4/8 小节循环 + 轻装饰音）；
  2. *和声/低音层*（sine 长音/五度叠置，营造宫廷/苍凉底色）；
  3. *节奏层*（短 noiseBurst 拟鼓点/木鱼，行军/战斗才进）。
- **`intensity`** 决定层叠：0=只旋律+低音（行军/剧情）；0.5=进鼓点；1=加密集装饰 + 升 BPM 5~10%（残局/Boss）。`setIntensity` 平滑过渡，避免突变。
- **乐句生成**：每曲一个 `{ scaleShift, bpm, melodyMotif:[scaleDegrees+时值], bassPattern, percEnabled }` 配置；生成器把度数映射成频率（五声查表）+ 时值排程到 `ctx.currentTime`，循环调度（前瞻 scheduler，提前 ~200ms 排下一小节，避免卡顿）。
- **crossfade**：`play` 新曲时旧曲 musicBus 子增益 ramp→0、新曲 0→目标，互不打断已排音符（双 bus 或单 bus 内分轨）。

### 1.4 曲目表（原创古风，按情境）
| trackId | 情境 | 调式/情绪 | 配器倾向 | 触发点 |
|---|---|---|---|---|
| `title` | 标题/主菜单 | 宫调式·大气 | 旋律+低音长音 | `menus` 进标题 |
| `chapter` | 章节开场过场 | 徵调式·苍茫 | 旋律+疏落鼓 | 章节 intro `cg`/过场开始 |
| `march` | 关间整军/行军 | 商调式·从容 | 旋律+低音，无密鼓 | `intermission` 打开 |
| `battle` | 战斗常态（玩家相位） | 角调式·进取 | 全三层，intensity≈0.4 | `turn:changed`→player 相位 |
| `tension` | 紧张（残血/敌优势/守关倒计时） | 羽调式·紧迫 | 加密鼓 + 升 BPM，intensity→0.8 | 战况评估（§1.7）触发升级，**不换曲只升 intensity**；或显式切 `tension` |
| `duel` | 单挑 | 半音装饰·肃杀 | 旋律突出 + 重低音心跳 | `duel:start` |
| `victory` | 胜利结算 | 宫调式·号角 | 上行号角动机（复用 `sfx.win` 动机扩写） | `battle:win` |
| `defeat` | 失败 | 羽调式·哀沉 | 下行长音 | `battle:lose` |
| `story_calm` | 平静剧情对白 | 商调式·清雅 | 旋律弱 + 低音垫，duck 给念白 | `say/narrate` 密集段（可选） |
| `story_grave` | 沉重剧情（如焚洛阳、章末挫败） | 变宫·悲怆 | 低音 + 稀疏旋律 | 剧本 `bgm` step 指定 |

> 第一章先做：`title/march/battle/tension(=intensity)/duel/victory/defeat/chapter` 八条；`story_*` 用 `bgm` step 按需指定，缺省沿用当前曲。

### 1.5 音量/分轨/静音
- `master`(0.5) → `musicBus`(默认 0.32) + `sfxBus`(默认 0.6)。BGM 比 SFX 低，避免盖过提示音。
- `setMuted` 仍只动 `master`（已实现，BGM/SFX 一起静）；额外提供 `music.setVolume / sfx.setVolume`（关间「设置」可调，存 `settings.musicVol/sfxVol`，扩 `gameState.settings`）。
- **autoplay 合规**：BGM 同样要等首次用户手势（`sfx.resume()` 已在 main.js 多处调用）；`music.play` 在 ctx 未解锁时排队，`resume` 后补播当前应播曲目。

### 1.6 备选：轻量原创音轨（默认关）
若程序化 BGM 听感不足，预留「短 loop 原创音轨」通道：自录/自制的 8~16 小节 ogg（**必须原创**），`music.js` 用 `<audio loop>` 或 `AudioBufferSourceNode` 播放并接 musicBus。**本期不做**，仅留接口位（`track.src?`）；默认走程序化，保证零文件、离线、无版权。

### 1.7 战况紧张度联动（intensity 自动驱动）
`main.js` 在相位/事件回调里算一个 0..1 紧张度并 `music.setIntensity(x)`：
- 输入：玩家存活比、敌我兵力差、主将(曹操)HP%、守关剩余回合、Boss 是否登场。
- 规则（示意，数值实现期调）：曹操 HP<40% +0.3；敌单位数 > 我 +0.2；倒计时 ≤3 回合 +0.3；Boss(吕布/华雄)在场 +0.2；clamp[0,1]。
- 不新建逻辑：读 `controller.units` / `victory` 现有状态即可；纯演出层。

---

## 2. SFX 清单（程序化合成，扩 `sfx`）

> 复用现有 `blip/noiseBurst/arpeggio` 三原语；新增按需补 `chord()`(多音叠)、`sweep()`(扫频)。
> 已有：`select/move/attack/hit/heal/win/lose`。下表 **加粗** = 新增；其余为已存在（保持/微调）。

### 2.1 UI / 操作
| key | 用途 | 合成草案 |
|---|---|---|
| `select` | 选中单位/确认目标 | （现）三角波 660→880 上扬 |
| `move` | 移动 | （现）低柔双踏步 |
| **`cursor`** | 光标在格/菜单间移动 | 极短 sine 520，gain 0.08（克制，不烦） |
| **`menuOpen`** | 打开行动菜单/整军面板 | sine 440→660 + 轻 noise，0.12s |
| **`menuClose` / `cancel`** | 取消/Esc/右键 | sawtooth 360→220 下滑，0.1s |
| **`confirm`** | 重要确认（出击/转职授印） | triangle 三连上行短和弦 |
| **`error`** | 非法操作（不可走/射程外） | square 200，0.08s，钝闷 |
| **`page`** | 翻页/切档案卡 | sine 700，0.06s |

### 2.2 战斗物理
| key | 用途 | 合成草案 |
|---|---|---|
| `attack` | 出手（近战挥击） | （现）锯齿 420→180 + 轻噪 |
| `hit` | 命中（金石） | （现）噪爆 1500 + 低顿 90 |
| **`miss`** | 闪避/落空 | 短 sweep 风声 noise，无金属感 |
| **`crit` / 致命一击** | 爆/士衍生暴击 | hit + 高频金属泛音 chord（2200/3300）+ 轻屏震钩子 |
| **`combo`** | 连击追加 | 两段急促 hit，间隔 70ms |
| **`bowShot`** | 弓/弩/连弩放箭 | sweep 1200→400 弦响 + 风噪 |
| **`charge` / 突击** | 骑兵冲锋附伤 | 低频上升轰鸣 80→180，0.2s + 蹄声 noise |
| **`counter`** | 反击触发 | hit 变体，叠一记 clank 高音 |
| **`block` / 钢铁壁** | 防御/减伤生效 | 闷重 noiseBurst 300，短 |
| **`death`** | 单位阵亡 | 下行 sawtooth 240→60 + 闷噪散场 |

### 2.3 计略（按 `kind`×`element`，与 fx.castFx 一一对应）
> 触发点：`main.js` 计略结算处已有 `sfx.attack/hit/heal/select` 粗分派；本表细化为 `sfx.cast(kind, element)` 统一入口，内部分派到下列音色，**与 `castFx` 同帧播放**。
| 分类 | element | 音色草案 |
|---|---|---|
| **`cast.fire`** | fire（火计/火阵/爆焰/朱雀） | 低频轰 + 上升 noise「呼」+ 噼啪高频颗粒；朱雀(超大)更长更厚 |
| **`cast.thunder`** | thunder（落雷/青龙） | 极短爆裂白噪 + 高频 4000 闪 + 低频余震 |
| **`cast.water`** | water（水攻/浊流） | 蓝色「哗」扫频 600→200 + 气泡颗粒 |
| **`cast.wind`** | （风系免天气：旋风/沙暴） | 长 sweep 风声 noise 带通扫动，无金属 |
| **`cast.earth`** | （落石/山岚） | 低频闷砸 + 碎石高频 noise 群 |
| **`cast.dark`** | dark（妖术/玄武/暗系） | 反向包络（淡入）阴冷 sine 低音 + 紫调金属泛音 |
| **`cast.heal`** | （小补给/大补给/白虎群疗） | （现 heal 扩写）温润上行三~五音，群疗更长 |
| **`cast.buff`** | （鼓舞/坚固/霸气/气合） | 明亮上行小号动机 + 光晕「叮」 |
| **`cast.debuff`** | （弱体/妖术降智/钝兵） | 下行半音 + 闷塞 lowpass |
| **`cast.control`** | （混乱/定身/晕眩/封咒） | confuse=旋转扫频忽高忽低；immobilize=骤停顿音「锵—静」；stun=耳鸣高频衰减 |
| **`cast.status`** | poison 中毒每回合 | `status:tick` 时极短「嘶」噪，gain 极低 |

### 2.4 单挑 / 必杀
| key | 用途 | 合成草案 |
|---|---|---|
| **`duelEnter`** | 单挑入场（letterbox 落下） | 低沉鼓 + 金属拔刀 sweep，肃杀；同时 `music.play('duel')` |
| **`duelClash`** | 回合互击峰值 | 重 hit + 双方兵刃 clank chord |
| **`duelFinish`** | 单挑分胜负 | 胜→`win` 动机短版；负→闷重 `death`；撤退→`cancel` 变体 |
| **`ultimate` / 必杀** | 武将必杀/招牌（如方天画戟连带、倚天反击无双、霸气） | 蓄力上升轰鸣(0.5s) → 爆发 hit+crit 叠加 + 余响；配 §3.3 必杀运镜 |

### 2.5 系统/演出
| key | 用途 |
|---|---|
| **`turnPlayer` / `turnEnemy`** | 相位切换轻提示（玩家=明亮短和弦；敌=低沉单音） |
| **`levelUp`** | 关末成长演出每条属性跳动「叮」逐级 + 完成上扬 |
| **`itemGet` / 宝物入手** | 璀璨上行琶音（比 levelUp 更华丽，配宝物入手 CG） |
| **`weatherChange`** | 天气切换（雨起/风动）渐入环境噪，3~5s 淡入淡出 |
| **`win` / `lose`** | （现）胜负号角；并触发 `music.play('victory'/'defeat')` |

> **环境氛围层（可选，挂 musicBus 之外的 `ambBus`）**：雨/风天气下叠极低音量循环噪（雨声=持续带通白噪、风=缓慢扫频），随 `map.weather` 起停。第一章可后置。

---

## 3. 演出规格：计略 / 单挑 / 必杀

### 3.1 计略演出（在 `castFx` 之上补「运镜 + 飘字 + 音画同步」）
现有 `castFx(kind, element, worldPos, aoeCells)` 已覆盖火/雷/水/暗/疗/增益/弱体/控场粒子。补：
- **音画同步**：施法瞬间 `sfx.cast(kind,element)` 与 `castFx` 同帧；AOE 大招（朱雀/玄武/白虎/沙暴）额外 `camera.cinematic({focus:中心, zoom:1.7})` 0.8s 后 `reset()`，配 §3.4 轻微震屏。
- **飘字分级**（扩 `fx.floatText` 用法，不改签名，约定颜色/字号语义）：
  | 类型 | 颜色 | 文本样例 |
  |---|---|---|
  | 普通伤害 | `#ff5b5b` | `28` |
  | 暴击/必杀 | `#ffd95e` 加大字号(前缀「!」) | `!52` |
  | 治疗 | `#6fe39a` | `+22` |
  | 增益/减益 | 金/紫 | `攻↑` `防↓` |
  | 状态 | 对应元素色 | `中毒` `混乱` `定身` |
  | miss | 灰 `#9aa3b2` | `闪` |
  > 实现：`fx.floatText` 增可选第 5 参 `{ size, bold, prefix }`（向后兼容默认）。或新增 `fx.floatBadge(ctx,pos,kind,value)` 包一层语义。
- **元素↔天气呼应**（演出层，规则在天气系统 spec）：被天气增强(晴+火)时特效更亮/更大、SFX 更厚；被压制(雨×火)时特效暗淡 + 一声「噗」哑火 SFX，呼应 powerMod。

### 3.2 单挑演出（duelView 已具雏形，补音乐 + 招式 + 必杀）
现有：letterbox + 双立绘 + HP + lunge 互冲 + verdict。补：
1. **入场**：`duel:start` → `sfx.duelEnter` + `music.play('duel')` + `music.duck` 给入场音让路；letterbox 落下、字幕「⚔ 单挑」（已有）。
2. **每回合**：`duel.step` 的 `RoundResult` 决定演出强度——普通互击 `sfx.duelClash`；若该回合判定为「必杀/重击」（duel 逻辑给标记或按伤害阈值），升级为 §3.3 必杀演出 + `sfx.ultimate`。
3. **招式飘字**：在立绘旁/单位头顶飘出招式名（若 `RoundResult.moveName` 存在）+ 伤害（分级见 §3.1）。
4. **收尾**：`finishDuel` → `sfx.duelFinish` + 胜者高亮（已有 hitFlash 金光）→ `music` 切回 `battle`（或回 `march` 视上下文）→ `camera.reset()`（已有）。
5. **三英战吕布**（虎牢关 showcase）：连续三场单挑（关/张/刘）用同一 duelView 链式播放，中间不收 letterbox，仅切换立绘 + 一句旁白，强化「车轮战」气势；BGM 持续 `duel` 且 `intensity` 渐升。

### 3.3 必杀（ultimate）演出规格
触发：武将专属必杀（宝物解锁，如方天画戟连带、倚天反击无双、君主霸气）或单挑重击判定。
- **运镜**：`camera.cinematic({focus:施法者, zoom:2.1})` 推近(0.4s)→蓄力定格(0.3s)→爆发瞬间 §3.4 震屏 + 闪白(短)→ 命中后 `reset()`(0.5s)。
- **VFX**（fx.js 加 `ultimateFx(kind, worldPos)` 或复用 `bolt+burst+ring` 组合放大版）：蓄力光球(向中心收束的反向 burst) → 爆发(大 burst + 双 ring + 元素色 bolt)。
- **飘字**：金色加大 `!XX`（§3.1 暴击级）。
- **音**：`sfx.ultimate`（蓄力轰鸣→爆发）。
- **letterbox**：可选短暂上下黑边(复用 duelView 的 `.ccz-letterbox` 样式提取为通用 `fx.letterbox(on/off)`)，单挑外的关键必杀也能用。

### 3.4 震屏 / 闪白（新增轻量演出帮手）
- `render3d/fx.js` 新增 `shake(intensity=0.2, ms=240)`：在 `camera.update` 的目标位上叠加随相位衰减的小幅偏移（或对 `sceneManager` 渲染容器做 CSS transform 抖动，二选一；建议改相机偏移以保持 3D 一致）。`main.js`/`duelView` 在暴击/必杀/落雷/Boss 登场时调。
- `fx.flashScreen(color='#fff', ms=120)`：DOM 覆盖层全屏快闪一层半透明色（雷/必杀/爆焰瞬间）。
- 二者均纯演出、可被静音无关（视觉），但要尊重「减少动态」无障碍开关（§6）。

---

## 4. 章节开场 / 结局过场（cutscene）

### 4.1 形式（程序化 CG + 字幕/旁白，无外部图）
不做位图 CG；用「程序化 CG」= 现有手段组合：
- **底图**：纯色/渐变国风背景（朱/金/墨）+ 程序化纹理（卷轴、水墨晕染用 canvas/CSS gradient + noise），或在 3D 场景里摆一个象征性布景（旗、城门、火光）用 `sceneManager` 渲染 + 运镜。
- **前景**：`portrait.js` 程序化立绘（已有）淡入淡出；`dialogue.js` 旁白条（已有 `narrate`）逐句打字。
- **运镜**：缓慢推拉/横移（`camera.cinematic` + 自定义慢 lerp，或对 CG DOM 做 CSS 平移），配 `music.play('chapter')`。

### 4.2 过场脚本：scenarioRunner 新增 step 类型
向 `scenarioRunner` 加（未知 step 当前已被忽略 → 完全向前兼容）：
```js
{ type:'bgm',  track:'chapter', fadeMs:1200 }          // 切 BGM
{ type:'bgm',  action:'duck'|'unduck'|'stop' }         // 控 BGM
{ type:'sfx',  key:'itemGet' }                          // 触发一次性 SFX
{ type:'cg',   bg:'scroll'|'gradient'|'cityGate'|...,   // 程序化 CG 背景
               fg?:{ portrait:'caocao', enter:'left' }, // 可选前景立绘
               text?:'...', hold?:1800, fade?:600 }     // 字幕 + 停留 + 淡入淡出
{ type:'shake', intensity:0.3, ms:300 }                 // 震屏
{ type:'flash', color:'#fff', ms:120 }                  // 闪白
```
- `cg` 由新 `story/cutscene.js`（或 dialogue 扩展）渲染一个全屏 `#cutscene` 覆盖层，承载程序化背景 + 立绘 + 字幕；`hold` 后 `fade` 退出，await 完成再走下一步。可叠多张 `cg` 串成「连环画式」开场。
- 这些 step 与 `narrate/say/choice/camera` 自由混排，剧本作者可编出电影感开场/结局。

### 4.3 第一章过场清单（呼应 §4.2 主设计的 5 战）
| 时机 | 过场内容（原创旁白，公有领域史/演义事件） | 音画 |
|---|---|---|
| **第一章开场** | 卷轴展开「中平末年，汉室倾颓…」→ 焚书/乱世意象 → 曹操献刀离京、陈留散财起兵 | `bgm:chapter`(苍茫)，cg 连环画 3~4 张 + 旁白打字，慢推镜 |
| 陈留起兵·胜 | 义旗初举短结 | `victory` 动机短版 + cg 一张 |
| 汜水关·华雄段 | 「温酒斩华雄」作**友军事件**旁白过场（关羽斩华雄，曹军侧翼推进） | `tension`→`victory`，闪光 + itemGet(明光铠) |
| 虎牢关·三英战吕布 | 入场字幕「人中吕布，马中赤兔」→ 三连单挑(§3.2) → 吕布退 | `duel` 全程 + intensity 渐升 + 缴获(方天画戟/爪黄飞电)itemGet |
| **第一章结局** | 荥阳追击中伏、虽败犹荣；曹操立志独力图之，留第二章引子 | `bgm:story_grave`(悲怆)，cg 火光洛阳 + 残军 + 旁白；定格曹操立绘淡出 |

> 后续章节各配开场/结局过场，沿用同一 cg/bgm step 体系，**加内容不改引擎**（与主设计「引擎/内容分离」一致）。

---

## 5. 镜头语言（在已有 camera.cinematic 上的运镜规范）

现有：等距锁定 `setIso`，运镜 `cinematic({focus,zoom})`，平滑 `update` lerp。**不改签名**，约定一组「运镜预设」供剧本/演出调用：

| 预设 | 参数 | 用途 |
|---|---|---|
| `iso`（默认） | setIso | 战棋常态俯视锁定 |
| `focus(unit)` | cinematic focus=单位, zoom≈1.6 | 回合开始 trigger（已用）、对话聚焦说话者 |
| `push(target)` | cinematic zoom≈2.0~2.2 | 必杀/单挑入场推近 |
| `clash(a,b)` | focus=两单位中点, zoom≈1.9 | 单挑框双方（duelView 已用） |
| `sweep(from→to)` | 连续两次 cinematic + 慢 lerp | 过场横移展示战场/援军登场 |
| `reset` | reset/setIso | 演出收尾回沙盘（已用） |

- **letterbox**：从 duelView 的 `.ccz-letterbox` 提取为通用 `fx.letterbox(on)`，必杀/章节过场/重要剧情也能上下黑边强化电影感。
- **节制原则**：运镜只在「单挑/必杀/Boss 登场/章节过场/关键剧情触发」用；常规回合保持等距锁定，避免眩晕与节奏拖沓（致敬原作的克制运镜）。
- **援军/Boss 登场**：`sweep` 横移到登场点 + `focus` 定格 + `sfx`(低沉号角/turnEnemy) + 一句旁白，复用现有 `camera:cinematic` bus 流程（trigger→scenarioRunner）。

---

## 6. 无障碍 / 设置
- **静音**：沿用 `sfx.setMuted`（master→0），hub 静音按钮已接（main.js）。
- **分轨音量**：关间「设置」加 BGM/SFX 滑块 → `settings.musicVol/sfxVol`（存档）。
- **减少动态（reduce motion）**：尊重 `prefers-reduced-motion` 或设置开关 → 关闭 `shake/flashScreen`、缩短运镜、过场可「一键跳过」(`cg` step 支持点击/Esc 快进，与 dialogue 推进一致)。
- **文本速度**：dialogue 已读 `settings.textSpeed`；过场字幕复用。

---

## 7. 实现要点（并入实现 plan，可分阶段）
1. **`audio/music.js`**（新）：程序化 BGM 引擎（§1.3/1.4）+ 五声乐句生成 + crossfade + intensity 层叠 + 前瞻 scheduler。
2. **`audio/audio.js`**：加 `musicBus/sfxBus` 子增益；扩 SFX 清单（§2，新增 `chord/sweep` 原语 + `sfx.cast(kind,element)` 统一入口 + UI/物理/单挑/系统音）；门面 re-export `music`；`setVolume`。
3. **`render3d/fx.js`**：`shake/flashScreen/letterbox/ultimateFx/floatBadge`（或扩 `floatText` 第 5 参）。
4. **`render3d/camera.js`**：无需改签名；运镜预设以「调用约定」落在 main.js/scenarioRunner（必要时加 `push/sweep` 便利包装）。
5. **`story/scenarioRunner.js`**：新增 step `bgm/sfx/cg/shake/flash`（向前兼容）；`story/cutscene.js`（新）渲染 `#cutscene` 程序化 CG 覆盖层。
6. **`ui/duelView.js`**：入场切 `music('duel')`+`duelEnter`、回合 `duelClash`、必杀升级演出、收尾切回；招式飘字。
7. **`main.js`**：BGM 状态机绑相位/`bus` 事件（title/march/battle/victory/defeat/duel）；`music.setIntensity` 紧张度联动（§1.7）；计略 `sfx.cast` 细分；必杀/暴击触发 `shake/flash/ultimate`；首手势 `music` 补播。
8. **`core/gameState.js`**：`settings` 加 `musicVol/sfxVol/reduceMotion`（默认值 + 存档）。
9. **测试**：纯逻辑可测部分——五声度数→频率映射表、intensity 规则函数、`sfx.cast` 的 kind/element→音色分派表（不出声、只断言选路）；BGM 调度/听感靠实玩走查（与现状音频不做音质单测一致）。
10. **index.html / 内容**：无新依赖（全程序化）；过场内容写进各战 `*.story.js`（加 cg/bgm/sfx step）。

### 阶段化（建议）
- **A · 音频地基**：music.js BGM 引擎 + 八条曲目 + 分轨/音量/静音 + 战斗相位绑定。
- **B · SFX 扩充 + 计略音画同步**：扩 sfx 清单 + `sfx.cast` 接 castFx + 飘字分级 + 震屏/闪白。
- **C · 演出强化**：单挑 BGM/招式/必杀演出 + ultimateFx + letterbox 通用化。
- **D · 过场系统**：scenarioRunner 新 step + cutscene.js + 第一章开场/结局过场内容。
- **E · 无障碍/设置**：分轨音量 UI、reduce-motion、过场跳过、环境氛围层（可后置）。

---

## 8. 范围边界（v1 / 第一章）
- **做**：程序化 BGM 八条 + 战况 intensity；扩 SFX（UI/物理/计略/单挑/系统）；计略音画同步 + 飘字分级；单挑 BGM/招式/必杀演出；震屏/闪白/letterbox 通用化；第一章开场+结局+关键节点过场。
- **后置/留接口**：轻量原创音轨备选通道(§1.6)；环境氛围噪层(§2.5)；雪/阴天气音画(随青龙/玄武计略解锁补)；完整必杀动画库(逐武将专属，先做 2~3 个代表)；手柄/震动反馈。

---

## 9. 待确认
1. **BGM 实现路线**：纯程序化（默认，零文件）vs 允许少量**原创**短 loop 音轨备选(§1.6)？是否接受程序化古风的「合成味」？
2. **音乐子文件**：BGM 引擎拆出 `audio/music.js`（建议）还是全塞 `audio.js`？体积/可维护性取舍。
3. **intensity 自动化**：紧张度自动驱动(§1.7) vs 只在剧本/关卡显式切 `tension`？自动规则的具体阈值。
4. **过场强度**：章节开场用「程序化连环画 CG（DOM 覆盖层）」还是「3D 场景内布景 + 运镜」？还是两者混用（成本更高）？
5. **必杀范围**：第一章先做哪几个必杀演出（建议：方天画戟连带、倚天反击无双、君主霸气，约 3 个）？其余走通用计略/单挑演出即可？
6. **新 step 命名**：`cg/bgm/sfx/shake/flash` 是否合适？是否并入 `camera` step 还是独立（建议独立，语义清晰）。
7. **音量默认**：master0.5 / music0.32 / sfx0.6 是否合适？是否默认给 BGM 开还是默认静音（移动端/办公室场景）？
8. **减少动态**：是否提供独立设置开关，还是只读系统 `prefers-reduced-motion`？
9. **环境氛围噪层**：第一章是否要（雨/风），还是后置到天气系统全量实装时一起做？
