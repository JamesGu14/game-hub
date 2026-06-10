# Tower Defender · 关前剧情演绎系统(旁白配音 + 多角色对话)设计

> 日期:2026-06-11 · 状态:已与 James 逐节确认
> 范围:games/tower-defender(故事屏改造/剧本数据/配音管线),不碰玩法数值与模拟

## 1. 背景与目标

每关开战前的大弹窗剧情演绎,还原(演义风)历史剧情,给 1-3 年级孩子讲故事:

1. **幕1 旁白讲解**:简短剧情讲解(2-3 句,娃能听懂),配女声朗读
2. **幕2 多角色对话**:三国群英传式对话框(头像+名牌),结合当关剧情有来有回(James 原型:廖化报信"主公不好啦,吕布率五万大军直奔我军而来!"→刘备震惊→吕布叫阵"势必拿下成都!"→刘备点将"廖化、张苞、关平听令!"→众将"末将在!"→"务必守住成都,生擒贼将!")
3. 对话**逐句配音、人声各异**;**点击推进,无倒计时**;演绎期间游戏未开战;演毕入场

## 2. 已定决策

| 决策点 | 结论 |
|---|---|
| 配音方案 | **预生成 edge-tts**(James 机上已装,免费多中文音色);缺音频静默降级,字幕流程不受影响 |
| 与现有故事卡关系 | **一段式吸收**:故事屏改两幕连播(幕1=现有卡升级为讲解页,幕2=对话演绎),小档案/成语/历史声明保留 |
| 50 关剧本来源 | **6 样板关精写**(8-12 句)+ **44 生成关模板**(每章 3 套 × seed=关号轮替,4-6 句) |
| 交付节奏 | **两段**:段1=系统+50关剧本+刘备立绘(无语音);段2=剧本定稿后 edge-tts 批量配音+接线(先出 L1 样片定音色) |

## 3. 数据设计

### 3.1 样板关(campaign.js story 扩展)

```js
story: {
  ...现有字段(year/place/sides/result/idiom/portrait 保留),
  narration: '讲解词 2-3 句(替代 hook 在幕1 的位置;hook 字段保留供选关卡片等复用)',
  script: [ { who: 'liao', text: '主公!不好啦!…' }, { who: 'liubei', text: '…' }, … ],
}
```

### 3.2 生成关剧本(新建 data/storylines.js)

- `storylineFor(level, roster) → { narration, script }`:纯函数、确定性(同关同输出、加载期无随机)
- 每章 **3 套对话模板**,`seed = level.id` 轮替;模板结构循 James 原型:报信→主公反应→敌将叫阵→点将→齐声听令→出征令
- 变量:**敌主将名/副将名**(level.boss/lieutenants)、**首营城名**(camps[0].cityName)、**兵力万数**(由波数/敌量派生)、**点将名单 = unlockedGenerals(save) 阵容前三**(第1章"廖化、张苞、关平听令!"→后期自动"赵云、张飞、关羽听令!",剧情随解锁进度生长)
- narration 模板同理(每章 2 套)

### 3.3 角色注册表(data/cast.js)

`CAST[who] = { name, portrait, voice, side }`:
- 我方 12 将 → `gen_<id>_3`(三阶最威风,经 generalSprite 回退);**刘备 → 新增 `gen_liubei`**(立绘 ×1,gen-sprites 黄忠锚);旁白 narrator 无头像
- 敌将 → `boss_<id>`(44 张全有,缺图回退色块名牌)
- `side: 'shu' | 'enemy'` 决定对话框左右站位
- **命名规则**:塔将沿用 GENERALS 既有缩写 id(liao/zhou/madai…历史命名不动);非作战角色用全拼 id(`liubei`,将来如有孙尚香=`sunshangxiang`);规则写入 cast.js 头注释

## 4. 配音设计(段2)

| 角色 | edge-tts 音色 | 调参 |
|---|---|---|
| 旁白 | zh-CN-XiaoxiaoNeural | 讲故事语气,rate -8% |
| 刘备 | zh-CN-YunyangNeural | 端正沉稳 |
| 敌将(共用) | zh-CN-YunjianNeural | pitch -8%(低沉威压) |
| 年轻我方将(廖化/关平/张苞/马岱/赵云/马超/关羽/张飞) | zh-CN-YunxiNeural | 按人微调 rate/pitch 区分 |
| 老将(黄忠/周仓/诸葛亮) | zh-CN-YunjianNeural | rate -12%(苍劲,与敌将靠 pitch 区分) |
| 黄月英 | zh-CN-XiaoyiNeural | 清亮 |

- **文件名 = 剧本句内容 hash**(`assets/voice/<sha1 前12>.mp3`,32kbps mono):剧本微调只重生成改动句,不全量重跑
- "末将在!"齐声句:云希单声 + 文字标"(齐声)"(不做多声混音,YAGNI)
- `core/audio.js` 增 `playVoice(src)/stopVoice()`:HTMLAudio 单实例,切句即停旧播新;**复用 save.settings.muted 静音**;无文件/加载失败静默
- **加载策略**:即点即播(本地 mp3 单句 20-50KB,HTMLAudio 自带流式,无感延迟);进 story 屏时 `preload='auto'` 预热旁白与幕2 首句,每次推进预热下一句;不做整关批量预载管理(YAGNI)
- 生成工具 `tools/gen-voice.py`:遍历 50 关剧本(样板 script + storylines 展开)→ edge-tts 批量;输出 registry 清单供校验;**启动时 `edge-tts --list-voices` 校验音色存在**,CAST 音色经集中别名映射表(微软更名/下线时改一处全局生效)

## 5. UI 设计(ui/storyScene.js,改造自 storyCard)

### 幕1 · 旁白讲解页

羊皮纸大卡(沿用现版式):章名/战役名/`narration` 楷体大字/小档案(年/地/双方/结果/成语)/历史声明/继续(或 续上次+重头)。段2 起进页自动播旁白语音,点击随时打断进幕2。

### 幕2 · 对话演绎

- 底部 ~1/3 高羊皮纸对话框;**说话者立绘框 180×220px(宽×高)**立于框上沿,**蜀汉靠左、敌方靠右**;当前说话人全亮,非说话人压暗 0.45;立绘旁金底楷体**名牌**
- **立绘裁切规则**:按宽 contain 缩放、**顶部对齐**(统一头部安全区,各将头位齐平;骑乘图顶部即人头,天然取上身),超出框底裁掉;冒烟目检关羽/赵云/马超三张骑乘图
- 文本**打字机逐字 ~24 字/s**(由 rAF 渲染循环按时间差驱动,无 setInterval;低端设备降帧不丢字);**点击①=整句全显,点击②=下一句**;右下"▼"闪烁提示;无倒计时无自动推进
- 右上角常驻「**跳过演绎 ▶**」→ 直接开战
- 段2:每句切换播对应 mp3
- **边缘行为**:①跳过/末句进战斗前**先 `stopVoice()` 再 `enterLevel()`**(防语音与 BGM 叠音);②幕1 点击=打断旁白语音**并**进幕2(单击单语义,不做"仅打断");③`muted=true` 时不播任何语音但**流程完全不变**(字幕仍逐句点击,静音≠跳过)

### 流程状态机

`screen='story'` 内加 `act: 'narration' | 'dialogue'`:选关 → 幕1 → 点击 → 幕2 逐句 → 末句点击/跳过 → `enterLevel()` 开战。**演绎全程在 enterLevel 之前,模拟未启动——"演绎中游戏暂停"天然满足,零暂停逻辑**。BGM 在 story 屏已停(现状),语音独占。

- 续玩快照存在:幕1 给"继续上次/重头"——**续上次跳过演绎**直接恢复,重头走完整两幕
- **演绎进度不入任何快照**:幕2 中途退出(切后台/关页/返回选关)重进一律从幕1 重来——30 秒演绎不做断点续播;"续上次"仅指**战斗快照**(恢复到所在波备战起点),与演绎无关
- 暂停菜单"重看故事":重播两幕,不重置对局(storyReview 机制兼容,重看末句返回对局而非 enterLevel)

## 6. 6 样板关剧本大纲(实现期精写,每关 8-12 句)

| 关 | 场面 |
|---|---|
| L1 博望坡 | 夏侯惇来犯,诸葛初出茅庐定火计,关张半信半疑,刘备力挺军师 |
| L11 长坂坡 | 曹军追至,赵云怀抱阿斗七进七出,张飞当阳桥断喝 |
| L21 赤壁 | 曹操八十万大军压境,诸葛借东风,黄盖诈降,火攻定计 |
| L31 定军山 | 夏侯渊扎营定军山,老黄忠请战,法正定"以逸待劳"之计 |
| L41 夷陵 | 陆逊火烧连营,刘备败退,众将誓死护主退守 |
| L50 上方谷 | 司马懿入谷,火起,天降大雨,诸葛叹"谋事在人成事在天",决战 |

(文风=James 原型;史实向、一年级能懂、不抄受版权文本;历史声明照旧)

## 7. 实施触点(路径均相对 `games/tower-defender/`)

| 文件 | 改动 |
|---|---|
| src/data/campaign.js | 6 样板关 story 增 narration+script |
| src/data/storylines.js(新) | 44 关模板生成器 |
| src/data/cast.js(新) | 角色注册表(名/头像/音色/阵营) |
| src/ui/storyScene.js(新) | 两幕状态机+对话框渲染+命中;**storyCard.js 删除**,其羊皮纸版式代码迁入幕1;tests/storyCard.test.mjs 改名 storyScene.test.mjs 并扩两幕用例 |
| src/main.js | story 屏接 storyScene(act 路由/跳过/重看兼容) |
| src/core/audio.js | playVoice/stopVoice(段2) |
| tools/gen-sprites.mjs | 刘备条目 |
| tools/gen-voice.py(新,段2) | edge-tts 批量+registry |
| src/core/assets.js | gen_liubei 注册(+段2 voice 不进 MANIFEST,HTMLAudio 直取) |
| tests/* | storylines/storyScene/cast 单测 |

## 8. 门禁

1. **storylines.test**:全 50 关 build 不抛、确定性、who 全在 CAST、变量零 undefined/占位符、单句 ≤60 **中文字符(text.length,含标点)**、点将名单随 roster 变化正确
2. **storyScene.test**:layout/hit(幕切换/点击推进/全显再推进/跳过命中)、stub ctx(=CanvasRenderingContext2D 代理,沿用 heroCard.test 模式)draw 不抛、save/restore 平衡;打字机速度为纯表现常量(rAF 时间驱动),不进单测
3. 段2:**voice registry 校验**(每句有 mp3,缺失列清单,exit 1)
4. 冒烟:L1 两幕完整走→开战;跳过路径;续玩路径;重看故事;骑乘立绘裁切目检
5. James+娃实玩:语速/字号/音色违和度/模板重样感

## 9. 风险与预案

| 风险 | 预案 |
|---|---|
| 娃嫌每关都演太长 | 跳过钮常驻;模板关压 4-6 句(~30s);若仍烦→后续加"本章已看过自动跳过"开关 |
| edge-tts 联网依赖 | 仅生成期;产物本地 mp3,游戏离线可玩 |
| 音频体积(~350 条) | 32kbps mono ≈12-18MB;超 20MB 则降 24kbps |
| 剧本改动音频失效 | 内容 hash 命名,增量重生成 |
| 骑乘图裁半身效果差 | 裁切锚点头部 1/3+目检;不行单独配站姿参数 |

## 10. 范围外(YAGNI)

立绘动画/口型、剧情分支选项、敌将逐人配音建模(共用云健变调)、对话背景场景图(沿用 backdrop)、多语言、自动播放模式、旧 storyCard 的 hook 字段删除(选关页可能引用,保留)。
