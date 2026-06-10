# Tower Defender · 关前剧情演绎 段1(演绎系统+50关剧本+刘备立绘,无语音)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把开战前单页故事卡升级为两幕剧情演绎(幕1 旁白讲解页 → 幕2 群英传式多角色对话),含 6 样板关精写剧本 + 44 生成关模板剧本 + 刘备立绘,全程无语音(语音为段2)。

**Architecture:** 数据层新增 `cast.js`(角色注册表)与 `storylines.js`(确定性模板生成器 + 统一剧本访问器 `storyContentFor`);`levels.js` 透传 story/boss/lieutenants/waveCount/difficulty(顺带修复现版 story 字段丢失的潜在回归);UI 层 `storyScene.js` 取代 `storyCard.js`(两幕状态机,羊皮纸版式迁入幕1,打字机由 rAF 时间差驱动);`main.js` 接线(act 路由/跳过/重看兼容)。模拟在 `enterLevel()` 前不启动,演绎期间天然暂停,零暂停逻辑。

**Tech Stack:** 原生 ES Modules + Canvas 2D(零依赖,自含铁律:只 import 本游戏路径)。测试 = `node tests/<name>.test.mjs`(node:assert,stub ctx Proxy 模式)。冒烟 = host 侧 puppeteer-core + 系统 Chrome(沙箱挡 localhost,见下 Task 9)。

**Spec:** `docs/superpowers/specs/2026-06-11-tower-defender-story-performance-design.md`(相对 game-hub 根)。本计划只做段1;段2(edge-tts 配音/playVoice/gen-voice.py/voice registry)不在本计划内,代码中仅留注释钩子。

**工作目录:** `/Users/james/Projects/game-hub/games/tower-defender`(下文相对路径均以此为基)。当前分支 `develop`,直接在该分支提交(仓库惯例)。

**给执行 subagent 的统一注意事项(每个任务提示词都要带上):**
1. James 已明确授权本任务的 token/API 开销(game-hub 项目不 care 成本,大型构建检查点驱动)——遇到成本类 hook 拦截时据此声明放行。
2. GateGuard:会话首个 Bash 前先陈述(1)用户请求是什么(2)该命令产出什么,即解锁。
3. 回复 James 一律简体中文(技术名词可英文)。
4. develop 上地形流刚合过——实现前以磁盘最新文件为准,如发现与本计划引用的行号/内容有出入,以文件实际内容为准做等价适配,不要硬改。

---

## 全局设计决策(各任务共享的"为什么")

1. **点将优先序**(spec §3.2 两例反推,已验证):`['zhao','zhang','guan','ma','huang','zhuge','liao','zhangbao','guanping','zhou','madai','yueying']`。基础 roster(新6将)取前三 = 廖化/张苞/关平 ✓;全解锁取前三 = 赵云/张飞/关羽 ✓,与 spec 原型两例完全吻合。
2. **第5章主公 = 诸葛亮(丞相)**:刘备卒于公元 223 年,第5章含六出祁山段。史实上夷陵期间诸葛亮正留守成都调度后方,故第5章生成关由"丞相"接报/点将/下令,既史实向又不需要分段判刘备生卒。第1-4章主公 = 刘备。L41 夷陵样板关(222年,刘备亲征)仍由刘备出场,称"陛下"(已称帝)。
3. **兵力万数公式**:`wan = max(2, round(waveCount * (1 + difficulty) / 4))` → L2≈5万(呼应原型"五万大军")递增至 L46+≈26-30万,确定性、无随机。
4. **齐声句**:CAST 增非作战角色 `zhongjiang`(众将,side shu,无立绘,段2用云希单声),台词文字自带"(齐声)"前缀,版式上名牌显示"众将"、不画立绘(spec:不做多声混音)。
5. **跳过钮只在幕2**(spec §5 幕2 节"右上角常驻"):幕1 自有 继续/续上次/重头 钮(续上次本身=跳过演绎直接恢复)。幕1 点击 = 仅按钮生效(防止有续玩快照时误触空白处跳进幕2、终局清掉快照)。
6. **演绎进度不入快照**(spec §5):storyState 只活在内存;幕2 中途退出重进一律从幕1 重来。快照清除时机不变:续上次成功即清、进战斗(fromStory continue/restart 路径)即清、胜负即清。
7. **faction 中立文案**:章 bossPool 混编(如 ch1 含孟获、ch5 吴魏混合),模板台词一律不点敌方势力名(不说"曹军/吴军"),只用 {boss}/{lt}/敌军。样板关是史实戏,可以点名。
8. **levels.js 透传**是本计划的数据基础:现版 `expand()` 返回值没有 story 字段(`LEVELS[0].story === undefined`,现版故事卡 hook/小档案实际画空,潜在回归),Task 2 补 `story/boss/lieutenants/waveCount/difficulty` 五字段,fingerprints 测试只序列化 paths+slots,不受影响。
9. **打字机**:`~24 字/s` 纯表现常量,由 `drawStoryScene(…, nowMs)` 的时间差驱动(main 传 `performance.now()`),无 setInterval、降帧不丢字;不进单测(spec §8.2)。
10. **段2 钩子**:`fromStory()` 顶部留 `// [段2] stopVoice() 在此` 注释;CAST 每个条目带 `voice: { name, rate?, pitch? }` 数据(段1 惰性,段2 直接消费)。

## File Structure(改动全景)

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/data/cast.js` | 新建 | 角色注册表 CAST(名/立绘/音色/阵营),命名规则头注释 |
| `src/data/storylines.js` | 新建 | 44 关模板生成器 + `storyContentFor(level, roster)` 统一访问器 + 点将/万数纯函数 |
| `src/data/campaign.js` | 修改 | 6 样板关 story 增 `narration` + `script`(8-12句);头注释 storyCard→storyScene |
| `src/data/levels.js` | 修改 | expand() 透传 story/boss/lieutenants/waveCount/difficulty |
| `src/ui/storyScene.js` | 新建 | 两幕状态机 + layout/hit/draw + 打字机;羊皮纸版式自 storyCard 迁入 |
| `src/ui/storyCard.js` | 删除 | 被 storyScene 吸收 |
| `src/main.js` | 修改 | story 屏接 storyScene(act 路由/跳过/重看兼容/QA 钩子) |
| `src/core/assets.js` | 修改 | MANIFEST 增 `gen_liubei` |
| `tools/gen-sprites.mjs` | 修改 | UNITS 增刘备条目(黄忠锚) |
| `tests/cast.test.mjs` | 新建 | 注册表完整性 |
| `tests/storylines.test.mjs` | 新建 | 门禁1:50关 build/确定性/who∈CAST/无占位/≤60字/点将随 roster |
| `tests/storyScene.test.mjs` | 新建 | 门禁2:layout/hit/状态机推进/stub ctx draw/save-restore 平衡 |
| `tests/storyCard.test.mjs` | 删除 | 被 storyScene.test 取代 |
| `tests/campaign.test.mjs` | 修改 | 样板关 narration/script 充实度断言 |
| `tests/levels-integrity.test.mjs` | 修改 | 透传五字段断言 |

任务依赖:T1/T2/T3 互相独立 → T4 需 T1+T2+T3 → T5 需 T4 → T6 需 T5 → T7 独立 → T8(冒烟)需 T6(+T7 尽量)。

---

### Task 1: 角色注册表 data/cast.js

**Files:**
- Create: `src/data/cast.js`
- Test: `tests/cast.test.mjs`

- [ ] **Step 1: 写失败测试 `tests/cast.test.mjs`**

```js
// tests/cast.test.mjs — 角色注册表完整性(演绎段1):覆盖面/阵营/立绘引用/音色数据
// 运行:node games/tower-defender/tests/cast.test.mjs
import assert from 'node:assert';
import { CAST } from '../src/data/cast.js';
import { GENERALS } from '../src/data/generals.js';
import { BOSSES, LIEUTENANTS } from '../src/data/bosses.js';

// 1) 我方 12 将全覆盖:side=shu、portrait 走 generalSprite(gen 字段)、名字与 GENERALS 一致
for (const id of Object.keys(GENERALS)) {
  const c = CAST[id];
  assert.ok(c, `CAST 缺我方将 ${id}`);
  assert.equal(c.side, 'shu', `${id} side=shu`);
  assert.equal(c.name, GENERALS[id].name, `${id} 名字一致`);
  assert.equal(c.portrait && c.portrait.gen, id, `${id} portrait.gen=${id}(三阶经 generalSprite 回退)`);
  assert.ok(c.voice && typeof c.voice.name === 'string' && c.voice.name.startsWith('zh-CN-'), `${id} 有音色`);
}

// 2) 敌将全覆盖(BOSSES + LIEUTENANTS):side=enemy、portrait.img=boss_<id>、共用云健
for (const id of [...Object.keys(BOSSES), ...Object.keys(LIEUTENANTS)]) {
  const c = CAST[id];
  assert.ok(c, `CAST 缺敌将 ${id}`);
  assert.equal(c.side, 'enemy', `${id} side=enemy`);
  assert.equal(c.portrait && c.portrait.img, 'boss_' + id, `${id} portrait.img`);
  assert.equal(c.voice.name, 'zh-CN-YunjianNeural', `${id} 敌将共用云健`);
  assert.equal(c.voice.pitch, '-8%', `${id} 低沉威压调参`);
}

// 3) 特殊角色:刘备(全拼 id)/旁白/众将
assert.equal(CAST.liubei.name, '刘备');
assert.equal(CAST.liubei.side, 'shu');
assert.deepEqual(CAST.liubei.portrait, { img: 'gen_liubei' }, '刘备立绘走独立 img');
assert.equal(CAST.liubei.voice.name, 'zh-CN-YunyangNeural');
assert.equal(CAST.narrator.portrait, null, '旁白无头像');
assert.equal(CAST.narrator.voice.name, 'zh-CN-XiaoxiaoNeural');
assert.equal(CAST.narrator.voice.rate, '-8%');
assert.equal(CAST.zhongjiang.name, '众将');
assert.equal(CAST.zhongjiang.side, 'shu');
assert.equal(CAST.zhongjiang.portrait, null, '众将齐声句无立绘');

// 4) 音色分配(spec §4 表):老将云健 rate-12%、黄月英晓伊、年轻我方云希
for (const id of ['huang', 'zhou', 'zhuge']) {
  assert.equal(CAST[id].voice.name, 'zh-CN-YunjianNeural', `${id} 老将云健`);
  assert.equal(CAST[id].voice.rate, '-12%', `${id} 苍劲 rate`);
}
assert.equal(CAST.yueying.voice.name, 'zh-CN-XiaoyiNeural');
for (const id of ['liao', 'guanping', 'zhangbao', 'madai', 'zhao', 'ma', 'guan', 'zhang']) {
  assert.equal(CAST[id].voice.name, 'zh-CN-YunxiNeural', `${id} 年轻我方云希`);
}

console.log('ok cast');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/cast.test.mjs`
Expected: FAIL(Cannot find module '../src/data/cast.js')

- [ ] **Step 3: 实现 `src/data/cast.js`**

```js
// data/cast.js — 剧情演绎角色注册表(演绎 spec §3.3)。CAST[who] = { name, portrait, voice, side }。
// portrait: { gen: '<generalId>' } → 渲染层经 generalSprite(id, 3) 取三阶图逐级回退;
//           { img: '<assetKey>' }  → assets.images[key];null → 无立绘(色块名牌兜底)。
// voice: edge-tts 音色与调参(段1 惰性数据,段2 gen-voice.py/playVoice 直接消费)。
// side: 'shu'(对话框左侧) | 'enemy'(右侧)。
// 【命名规则】塔将沿用 GENERALS 既有缩写 id(liao/zhou/madai…历史命名不动);
//            非作战角色用全拼 id(liubei、zhongjiang,将来如有孙尚香 = sunshangxiang)。
// 铁律:render-free、纯数据、加载期无随机。
import { GENERALS } from './generals.js';
import { BOSSES, LIEUTENANTS } from './bosses.js';

// 我方年轻将共用云希,按人微调 rate/pitch 区分(spec §4);老将(huang/zhou/zhuge)云健苍劲,与敌将靠 pitch 区分。
const SHU_VOICE = {
  liao:     { name: 'zh-CN-YunxiNeural', rate: '+4%' },                 // 干练报信人
  guanping: { name: 'zh-CN-YunxiNeural', pitch: '+6%' },                // 少年清亮
  zhangbao: { name: 'zh-CN-YunxiNeural', rate: '+2%', pitch: '+2%' },   // 虎气
  madai:    { name: 'zh-CN-YunxiNeural', rate: '-2%' },                 // 沉稳
  zhao:     { name: 'zh-CN-YunxiNeural' },                              // 清朗(基准)
  ma:       { name: 'zh-CN-YunxiNeural', pitch: '-2%' },                // 剽悍
  guan:     { name: 'zh-CN-YunxiNeural', rate: '-6%', pitch: '-4%' },   // 威严
  zhang:    { name: 'zh-CN-YunxiNeural', rate: '+6%', pitch: '-6%' },   // 粗豪
  huang:    { name: 'zh-CN-YunjianNeural', rate: '-12%' },              // 老将苍劲
  zhou:     { name: 'zh-CN-YunjianNeural', rate: '-12%' },
  zhuge:    { name: 'zh-CN-YunjianNeural', rate: '-12%' },
  yueying:  { name: 'zh-CN-XiaoyiNeural' },                             // 清亮才女
};

const ENEMY_VOICE = { name: 'zh-CN-YunjianNeural', pitch: '-8%' };       // 敌将共用,低沉威压

export const CAST = {};

// 我方 12 塔将(立绘 = 三阶最威风,经 generalSprite 回退)
for (const id of Object.keys(GENERALS)) {
  CAST[id] = { name: GENERALS[id].name, portrait: { gen: id }, voice: SHU_VOICE[id], side: 'shu' };
}
// 敌将(主将 + 副将;44 张 boss 图全有,缺图渲染层色块名牌兜底)
for (const [id, b] of [...Object.entries(BOSSES), ...Object.entries(LIEUTENANTS)]) {
  CAST[id] = { name: b.name, portrait: { img: 'boss_' + id }, voice: ENEMY_VOICE, side: 'enemy' };
}
// 非作战角色(全拼 id)
CAST.liubei = { name: '刘备', portrait: { img: 'gen_liubei' }, voice: { name: 'zh-CN-YunyangNeural' }, side: 'shu' };
CAST.narrator = { name: '旁白', portrait: null, voice: { name: 'zh-CN-XiaoxiaoNeural', rate: '-8%' }, side: 'shu' };
CAST.zhongjiang = { name: '众将', portrait: null, voice: { name: 'zh-CN-YunxiNeural' }, side: 'shu' };   // 齐声句:云希单声+文字标(齐声)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/cast.test.mjs`
Expected: `ok cast`

- [ ] **Step 5: 全量回归 + 提交**

Run: `for f in tests/*.test.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done`(应无 FAIL)

```bash
git add src/data/cast.js tests/cast.test.mjs
git commit -m "feat(tower-defender): 演绎段1·角色注册表cast.js(12将+刘备+旁白+众将+全敌将,音色数据为段2预埋)"
```

---

### Task 2: levels.js 透传 story/boss/lieutenants/waveCount/difficulty

**Files:**
- Modify: `src/data/levels.js`(expand() 返回对象,现约 63-71 行)
- Test: `tests/levels-integrity.test.mjs`(追加断言)

- [ ] **Step 1: 在 `tests/levels-integrity.test.mjs` 末尾(`console.log` 之前)追加失败断言**

先 Read 该文件找到末尾的 `console.log('ok ...')` 行,在其前插入:

```js
// [演绎段1] expand 透传:story/boss/lieutenants/waveCount/difficulty(storylines 模板变量数据源;
// 同时修复现版 story 字段丢失 → 故事屏 hook/小档案画空的潜在回归)
for (const lv of LEVELS) {
  assert.ok(lv.story && typeof lv.story.hook === 'string', `L${lv.id} story 透传(hook)`);
  assert.ok(lv.boss && typeof lv.boss.name === 'string' && lv.boss.name.length >= 2, `L${lv.id} boss.name 已解析`);
  assert.ok(Array.isArray(lv.lieutenants) && lv.lieutenants.length >= 1, `L${lv.id} lieutenants 透传`);
  for (const lt of lv.lieutenants) assert.ok(typeof lt.name === 'string' && lt.name.length >= 2, `L${lv.id} 副将有名`);
  assert.ok(Number.isFinite(lv.waveCount) && lv.waveCount >= 20, `L${lv.id} waveCount 透传`);
  assert.ok(Number.isFinite(lv.difficulty), `L${lv.id} difficulty 透传`);
}
```

(若该文件没有现成的 `LEVELS` import,按文件头部既有 import 风格补。)

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/levels-integrity.test.mjs`
Expected: FAIL(`L1 story 透传(hook)`)

- [ ] **Step 3: 修改 `src/data/levels.js` expand() 返回对象**

```js
  return {
    id: c.id, name: c.name, chapter: c.chapter, faction: c.faction,
    scale, startGold, castleHp,
    rampMax: c.rampMax,                       // 可选：覆盖 wave HP ramp 上限（缺省 → BAL.WAVE_HP_RAMP_MAX）
    cols: board.cols, rows: board.rows, castle: board.castle,
    camps, paths: board.paths, slots: board.slots, waves,
    terrain: board.terrain, terrainAt: board.terrainAt,             // [板型+地形] 展开产物(resolveBoard 已过滤孤立区)
    ...(c.disableTerrain ? { disableTerrain: c.disableTerrain } : {}),   // [段2预留] L50 大雨彩蛋透传(terrainSystem 落地前不触发)
    // [演绎段1] 剧情数据透传:story(样板关含 narration/script)+ 已解析 boss/lieutenants(带 name)
    // + waveCount/difficulty(storylines 兵力万数派生)。修复:此前 story 未透传,故事屏小档案画空。
    story: c.story, boss, lieutenants,
    waveCount: c.waveCount, difficulty: c.difficulty,
  };
```

(以磁盘最新文件为准:在现有 return 对象末尾追加最后三行,前面字段原样保留。)

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/levels-integrity.test.mjs`
Expected: PASS(原断言 + 新断言)

- [ ] **Step 5: 全量回归(重点 fingerprints/levels-winnable/resume 不受影响)+ 提交**

Run: `for f in tests/*.test.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done`

```bash
git add src/data/levels.js tests/levels-integrity.test.mjs
git commit -m "fix(tower-defender): levels展开透传story/boss/lieutenants/waveCount/difficulty(修故事屏小档案画空回归,为演绎模板供数)"
```

---

### Task 3: campaign.js 六样板关精写剧本(narration + script)

**Files:**
- Modify: `src/data/campaign.js`(SAMPLES 六关 story 字段;头注释第 7 行 storyCard.js → storyScene.js)
- Test: `tests/campaign.test.mjs`(追加样板剧本断言)

剧本铁律:原创、史实向(演义风)、一年级能懂、不抄受版权文本;单句 ≤60 中文字符(`text.length` 含标点);who 必须是 Task 1 CAST 里的 id。

- [ ] **Step 1: 在 `tests/campaign.test.mjs` 追加失败断言**

文件现有 `SAMPLE_IDS` 或等价样板判断(读文件确认,现约 42-44 行附近有样板充实断言),在该段后追加:

```js
// [演绎段1] 样板关精写剧本:narration(2-3句讲解)+ script(8-12句对话),无占位、句长≤60
const SAMPLE_IDS = [1, 11, 21, 31, 41, 50];
for (const id of SAMPLE_IDS) {
  const st = CAMPAIGN[id - 1].story;
  assert.ok(typeof st.narration === 'string' && st.narration.length >= 20, `L${id} narration 充实`);
  assert.ok(Array.isArray(st.script) && st.script.length >= 8 && st.script.length <= 12, `L${id} script 8-12 句(实际 ${st.script && st.script.length})`);
  for (const [i, line] of st.script.entries()) {
    assert.ok(typeof line.who === 'string' && line.who.length >= 2, `L${id} 句${i} who`);
    assert.ok(typeof line.text === 'string' && line.text.length > 0 && line.text.length <= 60, `L${id} 句${i} ≤60 字(实际 ${line.text && line.text.length})`);
    assert.ok(!line.text.includes('undefined') && !line.text.includes('{'), `L${id} 句${i} 无占位`);
  }
}
```

(若文件里已有同名 `SAMPLE_IDS` 常量则复用勿重复声明。)

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/campaign.test.mjs`
Expected: FAIL(`L1 narration 充实`)

- [ ] **Step 3: 修改 `src/data/campaign.js`**

3a. 头注释第 7 行 `storyCard.js` 改为 `storyScene.js`(框架声明渲染处)。

3b. 六个样板关的 `story: {...}` 对象各追加 `narration` 与 `script` 两字段(原有 hook/year/place/sides/result/idiom/portrait 字段原样保留)。完整内容如下——

**L1 博望坡(SAMPLES[1].story 追加):**

```js
    narration: '东汉末年，天下大乱。曹操派大将夏侯惇，带着十万大军杀向新野。刘备请来了聪明的军师诸葛亮，第一仗就在博望坡打响！',
    script: [
      { who: 'liao', text: '报——！主公，不好啦！夏侯惇率十万大军，直奔我们杀来啦！' },
      { who: 'liubei', text: '莫慌。军师诸葛先生足智多谋，且听他怎么说。' },
      { who: 'xiahoudun', text: '哈哈哈！刘备兵不过三千，竟敢挡我？看我一举踏平博望坡！' },
      { who: 'zhang', text: '哼！那诸葛亮年纪轻轻，一介书生，真有本事退敌吗？' },
      { who: 'guan', text: '三弟莫急，且看军师如何调兵遣将。' },
      { who: 'zhuge', text: '博望坡道路狭窄，两旁都是芦苇。待曹军进入，一把火便叫他有来无回！' },
      { who: 'liubei', text: '好计！众将听令，全凭军师调遣，不得有误！' },
      { who: 'xiahoudun', text: '传我将令：全军加速，直取新野！谁敢挡路，杀无赦！' },
      { who: 'zhang', text: '俺张飞倒要看看，这把火烧不烧得起来！' },
      { who: 'zhuge', text: '关将军、张将军埋伏两侧，见火起便杀出。请主公安心守城！' },
      { who: 'zhongjiang', text: '（齐声）得令！' },
      { who: 'liubei', text: '诸位将军，守住博望坡，让曹军有来无回！' },
    ],
```

**L11 长坂坡(SAMPLES[11].story 追加):**

```js
    narration: '曹操亲率大军南下，刘备带着百姓撤退，走到当阳长坂坡被追上了。乱军之中，刘备的小儿子阿斗不见了！大将赵云单枪匹马，杀回曹军阵中寻找。',
    script: [
      { who: 'guanping', text: '主公！曹军追上来了！先锋张辽来势凶猛，眼看就要冲散百姓啦！' },
      { who: 'liubei', text: '百姓不能丢！众将护住百姓，且战且退！' },
      { who: 'zhangliao', text: '刘备！丞相有令，今日定要将你拿下！你还往哪里逃！' },
      { who: 'zhao', text: '主公放心！小主人阿斗丢在乱军里了，赵云这就杀回去，定把他平安带回来！' },
      { who: 'liubei', text: '子龙！千军万马，你一人一骑，千万小心！' },
      { who: 'zhao', text: '看我七进七出，杀他个通透！' },
      { who: 'zhang', text: '子龙去吧！俺老张守住当阳桥，量他百万曹军，也休想过去半步！' },
      { who: 'zhangliao', text: '不好，是张飞！此人有万夫不当之勇，将士们小心！' },
      { who: 'zhang', text: '燕人张飞在此！谁敢与我决一死战！' },
      { who: 'liubei', text: '好！子龙救阿斗，翼德断后，众将护百姓，守住长坂坡！' },
    ],
```

**L21 赤壁(SAMPLES[21].story 追加):**

```js
    narration: '曹操统一北方后，带着号称八十万的大军杀到长江边，要一口气吞掉江南。刘备和东吴的孙权联起手来，在赤壁迎战。一场冬天里的大火，即将改变天下！',
    script: [
      { who: 'guan', text: '军师，曹操八十万大军在江北扎下水寨，战船密密麻麻，如何破他？' },
      { who: 'zhuge', text: '曹军都是北方人，不习水战，战船全用铁链锁在一起——这正是破敌的妙处！' },
      { who: 'caocao', text: '哈哈哈！战船连锁，如履平地。待我练好水军，便踏平江东，再无敌手！' },
      { who: 'zhang', text: '军师，船锁在一起又怎样？难道还能一把火全烧了不成？' },
      { who: 'zhuge', text: '翼德说得对，就是一把火！黄盖老将军已假意投降曹操，船里装的全是干柴火油！' },
      { who: 'liubei', text: '只是冬天刮西北风，火借风势，岂不烧到我们自己？' },
      { who: 'zhuge', text: '主公放心，亮夜观天象，三日之内，必有东南大风！' },
      { who: 'caocao', text: '报——黄盖来降了？哈哈，连东吴老将都来投我，天下唾手可得！' },
      { who: 'zhuge', text: '东风起了！传令下去，火船出发，今夜火烧赤壁！' },
      { who: 'zhongjiang', text: '（齐声）得令！火烧曹营，杀——！' },
      { who: 'liubei', text: '众将听令，守住江口，莫放曹军逃回北岸！' },
    ],
```

**L31 定军山(SAMPLES[31].story 追加):**

```js
    narration: '刘备进军汉中，曹操的大将夏侯渊在定军山扎下大营，挡住了去路。老将黄忠虽然年过七十，却主动请战，要去会一会这位曹军名将！',
    script: [
      { who: 'madai', text: '禀主公！夏侯渊在定军山扎营，居高临下，我军几次进攻都没拿下来。' },
      { who: 'huang', text: '主公！老臣黄忠愿往！定斩夏侯渊，夺下定军山！' },
      { who: 'liubei', text: '汉升老将军年过七旬，此战凶险，还需从长计议啊。' },
      { who: 'huang', text: '主公莫看我年迈！我开得硬弓，骑得烈马，斩将夺旗，何须年轻人！' },
      { who: 'xiahouyuan', text: '黄忠老儿也敢来犯？我夏侯渊镇守汉中多年，岂怕你这白发老翁！' },
      { who: 'liubei', text: '好！法正先生随军参谋，定下以逸待劳之计——敌军骄躁时，便是出击之机！' },
      { who: 'huang', text: '末将明白！先按兵不动，养精蓄锐，等夏侯渊松懈疲惫，一鼓作气冲下山去！' },
      { who: 'xiahouyuan', text: '这老儿怎么还不来攻？将士们都给我盯紧了……哼，谅他也不敢！' },
      { who: 'huang', text: '时机到了！看老夫宝刀，斩将立功，就在今日！' },
      { who: 'liubei', text: '老将军威武！众将听令，随黄老将军夺取定军山！' },
      { who: 'zhongjiang', text: '（齐声）末将在！愿随老将军出战！' },
    ],
```

**L41 夷陵(SAMPLES[41].story 追加):**

```js
    narration: '关羽、张飞先后遇害，刘备悲愤交加，亲率大军讨伐东吴，一路连下数城。东吴派出年轻的都督陆逊迎战。蜀军在山林里连着扎下七百里营寨，危险正悄悄逼近……',
    script: [
      { who: 'liao', text: '报——陛下！东吴拜陆逊为大都督，统领五万兵马，在猇亭一带挡住了我军！' },
      { who: 'liubei', text: '陆逊？一个白面书生！朕为二弟三弟报仇，岂会怕他！' },
      { who: 'luxun', text: '蜀军远来，锐气正盛，不可硬拼。传令各营，坚守不出，等他们松懈！' },
      { who: 'zhangbao', text: '陛下！吴军龟缩不出，天气又热，将士们都到林子里扎营乘凉去了。' },
      { who: 'luxun', text: '七百里连营，全在山林之中——天助我也！传令：每人带一把火，今夜火烧连营！' },
      { who: 'liao', text: '不好啦！吴军四面放火，营寨全烧起来了！陛下快走！' },
      { who: 'liubei', text: '悔不听丞相之言！众将何在，护朕突围！' },
      { who: 'zhangbao', text: '末将在！陛下莫慌，张苞拼死也要护陛下杀出去！' },
      { who: 'zhao', text: '陛下！赵云接应来了！子龙在此，吴军休得猖狂！' },
      { who: 'luxun', text: '穷寇莫追，蜀军还有后手，传令收兵。这一仗，东吴胜了！' },
      { who: 'liubei', text: '众将听令，结阵断后，守住退路，保大军平安撤回！' },
    ],
```

**L50 上方谷(SAMPLES[50].story 追加):**

```js
    narration: '诸葛亮六出祁山，北伐曹魏，对手是老谋深算的司马懿。诸葛亮设下妙计，把司马懿大军引进了葫芦形的上方谷，谷口一封，烈火熊熊烧起！眼看大功告成，天空却突然乌云密布……',
    script: [
      { who: 'madai', text: '丞相！司马懿父子果然中计，追着我军进上方谷了！' },
      { who: 'zhuge', text: '好！马岱听令：等魏军全部入谷，立刻堵住谷口，点燃干柴！' },
      { who: 'madai', text: '末将得令！这一回，定叫司马懿插翅难飞！' },
      { who: 'simayi', text: '慢着……谷中怎么堆着这么多干柴？不好！中计了！快撤——！' },
      { who: 'zhuge', text: '火起了！司马懿啊司马懿，你纵有千般算计，今日也难逃此谷！' },
      { who: 'simayi', text: '火势封路，四面都是烈焰！我父子三人，今日难道命丧于此？！' },
      { who: 'yueying', text: '夫君快看天上！乌云滚滚，只怕……只怕要下大雨了！' },
      { who: 'zhuge', text: '什么？！' },
      { who: 'simayi', text: '哈哈哈！大雨！天不亡我司马懿！将士们，趁雨突围，杀出去！' },
      { who: 'zhuge', text: '唉……谋事在人，成事在天，不可强求啊。' },
      { who: 'yueying', text: '夫君莫灰心！魏军虽然逃出谷去，还要来攻五丈原，这一仗还没完呢！' },
      { who: 'zhuge', text: '传令众将：摆开阵势，守住五丈原，与司马懿决一死战！' },
    ],
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/campaign.test.mjs`
Expected: PASS

- [ ] **Step 5: 全量回归 + 提交**

Run: `for f in tests/*.test.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done`

```bash
git add src/data/campaign.js tests/campaign.test.mjs
git commit -m "feat(tower-defender): 演绎段1·六样板关精写剧本(narration+8~12句script,演义风一年级向,史实人物生卒校验过)"
```

---

### Task 4: data/storylines.js 模板生成器 + 门禁测试

**Files:**
- Create: `src/data/storylines.js`
- Test: `tests/storylines.test.mjs`

- [ ] **Step 1: 写失败测试 `tests/storylines.test.mjs`**

```js
// tests/storylines.test.mjs — 演绎门禁1(spec §8.1):全50关 build 不抛/确定性/who∈CAST/
// 变量零 undefined·零占位/单句≤60中文字符(text.length 含标点)/点将名单随 roster 变化
// 运行:node games/tower-defender/tests/storylines.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { CAST } from '../src/data/cast.js';
import { CAMPAIGN } from '../src/data/campaign.js';
import { storyContentFor, rollcall, ROLLCALL_PRIORITY, numToCn } from '../src/data/storylines.js';

const BASE = new Set(['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying']);
const FULL = new Set([...BASE, 'zhao', 'zhang', 'guan', 'ma', 'huang', 'zhuge']);
const SAMPLE_IDS = new Set([1, 11, 21, 31, 41, 50]);

// 1) 全 50 关 × 两种 roster:build 不抛 + 结构 + 内容门禁
for (const lv of LEVELS) {
  for (const roster of [BASE, FULL]) {
    const c = storyContentFor(lv, roster);
    assert.ok(typeof c.narration === 'string' && c.narration.length >= 20, `L${lv.id} narration`);
    assert.ok(Array.isArray(c.script) && c.script.length >= 4, `L${lv.id} script ≥4 句`);
    assert.ok(c.script.length <= 12, `L${lv.id} script ≤12 句`);
    if (!SAMPLE_IDS.has(lv.id)) assert.ok(c.script.length <= 6, `生成关 L${lv.id} 压 4-6 句`);
    for (const [i, line] of c.script.entries()) {
      assert.ok(CAST[line.who], `L${lv.id} 句${i} who='${line.who}' 在 CAST`);
      assert.ok(typeof line.text === 'string' && line.text.length > 0, `L${lv.id} 句${i} 有词`);
      assert.ok(line.text.length <= 60, `L${lv.id} 句${i} ≤60 字(实际 ${line.text.length})`);
      assert.ok(!/undefined|null|\{|\}|NaN/.test(line.text), `L${lv.id} 句${i} 无占位/未替换变量: ${line.text}`);
    }
    assert.ok(!/undefined|\{|\}|NaN/.test(c.narration), `L${lv.id} narration 无占位`);
    // 确定性:同关同 roster 双调用逐字相同
    assert.deepEqual(storyContentFor(lv, roster), c, `L${lv.id} 确定性`);
  }
}

// 2) 样板关直通:campaign 手写内容原样返回
const l1 = storyContentFor(LEVELS[0], BASE);
assert.equal(l1.narration, CAMPAIGN[0].story.narration, '样板关 narration 直通');
assert.deepEqual(l1.script, CAMPAIGN[0].story.script, '样板关 script 直通');

// 3) 点将名单随 roster(spec 原型两例)
assert.deepEqual(rollcall(BASE), ['liao', 'zhangbao', 'guanping'], '基础阵容 → 廖化/张苞/关平');
assert.deepEqual(rollcall(FULL), ['zhao', 'zhang', 'guan'], '全解锁 → 赵云/张飞/关羽');
assert.equal(ROLLCALL_PRIORITY.length, 12, '优先序覆盖 12 将');

// 4) 生成关剧本里点将三人组真实生效(取一个非样板关,如 L2)
const l2base = storyContentFor(LEVELS[1], BASE);
const l2full = storyContentFor(LEVELS[1], FULL);
const joined = (c) => c.script.map((s) => s.text).join('');
assert.ok(joined(l2base).includes('廖化') && joined(l2base).includes('关平'), 'L2 基础 roster 点将入词');
assert.ok(joined(l2full).includes('赵云') && joined(l2full).includes('关羽'), 'L2 全 roster 点将入词');
assert.notDeepEqual(l2base.script, l2full.script, '点将随 roster 变化');

// 5) 变量注入:敌主将名/首营城名出现在文案;第5章主公=诸葛亮(丞相),1-4章=刘备
assert.ok(joined(l2base).includes(LEVELS[1].boss.name), 'L2 敌主将名入词');
assert.ok((l2base.narration + joined(l2base)).includes(LEVELS[1].camps[0].cityName), 'L2 首营城名入词');
for (const lv of LEVELS) {
  if (SAMPLE_IDS.has(lv.id)) continue;
  const whos = new Set(storyContentFor(lv, FULL).script.map((s) => s.who));
  if (lv.chapter <= 4) assert.ok(whos.has('liubei') && !whos.has('zhuge'), `L${lv.id} 1-4章主公=刘备`);
  else assert.ok(whos.has('zhuge') && !whos.has('liubei'), `L${lv.id} 5章主公=诸葛丞相(刘备已故,史实向)`);
}

// 6) numToCn 抽查
assert.equal(numToCn(5), '五'); assert.equal(numToCn(10), '十');
assert.equal(numToCn(13), '十三'); assert.equal(numToCn(26), '二十六');

console.log('ok storylines(50关×2roster 门禁全过)');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/storylines.test.mjs`
Expected: FAIL(Cannot find module storylines.js)

- [ ] **Step 3: 实现 `src/data/storylines.js`**

```js
// data/storylines.js — 44 生成关剧本模板(演绎 spec §3.2)+ 统一访问器 storyContentFor。
// storyContentFor(level, roster) → { narration, script }:纯函数、确定性(同关同 roster 同输出),
// 加载期/调用期零随机零 Date。样板关(story.script 手写)直通;生成关按章模板 + seed=level.id 轮替。
// 模板变量:{boss}=敌主将名 {lt}=首副将名 {city}=首营城名 {wan}=兵力万数(波数/难度派生)
//          {g1}{g2}{g3}=点将三人组(unlockedGenerals 阵容按优先序前三,剧情随解锁进度生长)。
// 主公:第1-4章=刘备;第5章=诸葛丞相(刘备卒于223年,史实向;夷陵期间诸葛亮留守成都调度,自洽)。
// 文案铁律:原创、一年级能懂、faction 中立(章 bossPool 吴魏混编,不点敌方势力名)、单句≤60字。
import { CAST } from './cast.js';

// 点将优先序(spec 原型两例反推:基础6将→廖化/张苞/关平;全解锁→赵云/张飞/关羽)
export const ROLLCALL_PRIORITY = ['zhao', 'zhang', 'guan', 'ma', 'huang', 'zhuge', 'liao', 'zhangbao', 'guanping', 'zhou', 'madai', 'yueying'];

// roster(Set<generalId>) → 点将三人组 id(优先序内取前三;BASE_ROSTER 恒 6 人,必有 3)
export function rollcall(roster) {
  return ROLLCALL_PRIORITY.filter((id) => roster.has(id)).slice(0, 3);
}

// 1..99 → 中文数字(兵力万数用)
const D = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function numToCn(n) {
  if (n < 10) return D[n];
  const t = Math.floor(n / 10), o = n % 10;
  return (t > 1 ? D[t] : '') + '十' + (o ? D[o] : '');
}

// 兵力万数:波数×(1+难度)/4,L2≈5万(呼应原型"五万大军")→ 终章≈26-30万,恒≥2
function wanOf(level) {
  return Math.max(2, Math.round(level.waveCount * (1 + level.difficulty) / 4));
}

// —— 旁白模板(每章 2 套,{} 变量同上)——
const NARR = {
  1: [
    '东汉末年，天下大乱，群雄四起。{boss}带着{wan}万大军，杀向{city}。蜀汉的将士们立下誓言：一定要守住家园！',
    '烽火连天的乱世里，百姓只盼着平安。可是{boss}的{wan}万兵马，已经兵临{city}城下。勇敢的将军们，拿起武器吧！',
  ],
  2: [
    '官渡之战，以弱胜强，天下震动。如今{boss}又率{wan}万大军卷土重来，{city}危在旦夕。这一次，还能以少胜多吗？',
    '河北兵强马壮，{boss}领着{wan}万人马直扑{city}。蜀汉将士虽然人少，却个个以一当十，毫不畏惧！',
  ],
  3: [
    '长江滚滚，战船如云。{boss}率{wan}万大军顺江而来，要一举拿下{city}。赤壁的火光还没熄灭，新的大战又开始了！',
    '江风阵阵，杀气腾腾。{boss}的{wan}万水陆大军已经围住{city}。将军们要在江边列阵，寸土不让！',
  ],
  4: [
    '蜀道难，难于上青天！可是{boss}的{wan}万大军，偏偏翻山越岭杀向{city}。高山挡不住敌人，就让将军们来挡！',
    '汉中是蜀地的大门，{city}是必经之路。{boss}率{wan}万兵马来势汹汹，一场山地大战一触即发！',
  ],
  5: [
    '关张二位将军的仇、夷陵的大火，蜀汉将士都记在心里。如今{boss}又率{wan}万大军杀向{city}，新的恶战就在眼前！',
    '蜀汉的旗帜依然高高飘扬。{boss}带着{wan}万人马直逼{city}，丞相摇着羽扇，早已成竹在胸。将士们，听令出战！',
  ],
};

// —— 对话模板(每章 3 套,seed=level.id 轮替;结构循 James 原型:报信→主公反应→敌将叫阵→点将→齐声→出征令)——
// 行格式 [who, text]:who 里 'g1'/'g2'/'g3'/'lt'/'boss' 是占位角色,展开时换成真实 cast id。
const SCRIPTS = {
  1: [
    [
      ['g1', '报——主公！{boss}率{wan}万大军，直奔{city}杀来啦！'],
      ['liubei', '什么？！{boss}来得好快！诸位莫慌，且随我守住城池！'],
      ['boss', '哈哈哈！小小{city}，弹指可破！识相的早早开城投降！'],
      ['liubei', '{g1}、{g2}、{g3}听令！'],
      ['zhongjiang', '（齐声）末将在！'],
      ['liubei', '务必守住{city}，生擒{boss}！'],
    ],
    [
      ['g1', '主公！探马来报，{boss}带着副将{lt}，领{wan}万兵马围住{city}了！'],
      ['boss', '{lt}听令，给我猛攻城门！今日不破{city}，誓不收兵！'],
      ['lt', '末将得令！弟兄们，跟我冲！'],
      ['liubei', '贼军势大，更要沉住气。{g1}、{g2}、{g3}，随我上城迎敌！'],
      ['zhongjiang', '（齐声）末将在！誓与{city}共存亡！'],
    ],
    [
      ['g1', '主公，{boss}的{wan}万大军已到{city}城外，旌旗遮天蔽日！'],
      ['liubei', '乱世之中，百姓最苦。这一仗，是为身后的百姓而战！'],
      ['boss', '城里的听着！我{boss}天下无敌，降者免死！'],
      ['g2', '主公放心！量他兵马再多，末将们也叫他有来无回！'],
      ['liubei', '好！{g1}、{g2}、{g3}，各守要道，让{boss}知道我们的厉害！'],
      ['zhongjiang', '（齐声）得令！'],
    ],
  ],
  2: [
    [
      ['g1', '报——主公！名将{boss}，率{wan}万精兵杀向{city}！'],
      ['liubei', '敌兵多将广，我们兵少，只能智取，不可硬拼！'],
      ['boss', '我军战无不胜！{city}小城，一鼓可下！'],
      ['liubei', '{g1}、{g2}、{g3}听令！深沟高垒，以弱胜强，就看今日！'],
      ['zhongjiang', '（齐声）末将在！'],
    ],
    [
      ['g1', '主公！{boss}与副将{lt}兵分两路，{wan}万人马直扑{city}而来！'],
      ['boss', '{lt}，你攻东门，我攻西门，看他首尾如何相顾！'],
      ['lt', '得令！主将放心，末将定第一个登上城头！'],
      ['liubei', '兵来将挡，水来土掩。{g1}、{g2}、{g3}，分头守住各路要道！'],
      ['zhongjiang', '（齐声）末将在！人在城在！'],
      ['liubei', '好！让来犯之敌见识见识，什么叫众志成城！'],
    ],
    [
      ['g1', '主公，{boss}的{wan}万大军在{city}外扎下连营，一眼望不到头！'],
      ['liubei', '当年官渡一战，两万人马胜了十万。兵不在多，在乎齐心！'],
      ['boss', '哼，凭你们这点人马也想守城？真是螳臂当车！'],
      ['g3', '主公，末将愿打头阵，挫挫他的锐气！'],
      ['liubei', '{g1}、{g2}、{g3}听令！守住{city}，叫他乘兴而来，败兴而归！'],
      ['zhongjiang', '（齐声）得令！'],
    ],
  ],
  3: [
    [
      ['g1', '报——主公！{boss}率{wan}万兵马，战船顺江而下，直逼{city}！'],
      ['liubei', '水路来敌，行军极快。众将随我即刻布防，不得迟疑！'],
      ['boss', '哈哈哈！我军船坚兵利，{city}转眼便是囊中之物！'],
      ['liubei', '{g1}、{g2}、{g3}听令！'],
      ['zhongjiang', '（齐声）末将在！'],
      ['liubei', '守住渡口要道，一只船也不许靠岸！'],
    ],
    [
      ['g1', '主公！{boss}与{lt}率{wan}万水陆大军，在{city}外安营扎寨了！'],
      ['boss', '{lt}，今夜趁着江雾，悄悄摸到城下，打他个措手不及！'],
      ['lt', '妙计！末将这就点齐兵马！'],
      ['liubei', '敌军惯用偷袭，须得日夜提防。{g1}、{g2}、{g3}，轮流值守，不可松懈！'],
      ['zhongjiang', '（齐声）末将在！'],
    ],
    [
      ['g1', '主公，{boss}带{wan}万大军杀向{city}，扬言三日破城！'],
      ['liubei', '三日？当年赤壁一把火，八十万大军灰飞烟灭。兵贵在精，不在多！'],
      ['boss', '城头的守军听着，我{boss}纵横江上，从无敌手！'],
      ['g2', '主公，江边浅滩水流缓慢，正好阻敌，末将有把握！'],
      ['liubei', '好！{g1}、{g2}、{g3}各就各位，叫他三日破城变成三日大败！'],
      ['zhongjiang', '（齐声）得令！'],
    ],
  ],
  4: [
    [
      ['g1', '报——主公！{boss}率{wan}万大军翻山越岭，杀向{city}！'],
      ['liubei', '蜀道艰险，敌军远来疲惫，这正是我们的机会！'],
      ['boss', '哼！山高路远算什么！拿下{city}，蜀中大门便开了！'],
      ['liubei', '{g1}、{g2}、{g3}听令！'],
      ['zhongjiang', '（齐声）末将在！'],
      ['liubei', '占住高处要道，以逸待劳，守住{city}！'],
    ],
    [
      ['g1', '主公！{boss}命副将{lt}为先锋，{wan}万人马已过山口，直逼{city}！'],
      ['lt', '主将有令，午时之前必须攻到城下！弟兄们，加快脚步！'],
      ['boss', '{lt}是员猛将，有他开路，{city}指日可下！'],
      ['liubei', '敌将骄横，必有破绽。{g1}、{g2}、{g3}，各守险要，挫其锐气！'],
      ['zhongjiang', '（齐声）末将在！'],
    ],
    [
      ['g1', '主公，{boss}的{wan}万大军在{city}外的山谷里扎营，连绵十里！'],
      ['liubei', '定军山一战，黄老将军以逸待劳，阵斩敌将。今日我们也用此计！'],
      ['boss', '传我将令：明日一早，全军攻城！我倒要看看谁敢挡路！'],
      ['g3', '主公，末将已探明地形，山道狭窄，正好设伏！'],
      ['liubei', '好！{g1}、{g2}、{g3}听令，守住{city}，再立新功！'],
      ['zhongjiang', '（齐声）得令！'],
    ],
  ],
  5: [
    [
      ['g1', '报——丞相！{boss}率{wan}万大军，杀向{city}！'],
      ['zhuge', '来得正好。亮已在此等候多时，岂容他猖狂！'],
      ['boss', '诸葛亮！今日我{boss}亲自领兵，定叫你有去无回！'],
      ['zhuge', '{g1}、{g2}、{g3}听令！'],
      ['zhongjiang', '（齐声）末将在！'],
      ['zhuge', '依计行事，守住{city}，挫败{boss}！'],
    ],
    [
      ['g1', '丞相！{boss}派副将{lt}打头阵，{wan}万兵马已到{city}城外！'],
      ['lt', '弟兄们，建功立业就在今日，随我攻城！'],
      ['boss', '{lt}虽勇，还需小心诸葛亮的计谋……传令各营，步步为营！'],
      ['zhuge', '敌将谨慎，我们便诱他深入。{g1}、{g2}、{g3}，按八阵图方位布防！'],
      ['zhongjiang', '（齐声）末将在！'],
    ],
    [
      ['g1', '丞相，{boss}率{wan}万大军直逼{city}，来势汹汹！'],
      ['zhuge', '兵者，诡道也。他要速战，我偏要他寸步难行。'],
      ['boss', '众将士听令！蜀军粮草不多，拖不起！给我全力攻城！'],
      ['g2', '丞相放心，末将们早已严阵以待！'],
      ['zhuge', '好！{g1}、{g2}、{g3}各守要冲，叫敌军知道，蜀中无懈可击！'],
      ['zhongjiang', '（齐声）得令！'],
    ],
  ],
};

// 变量替换:text 模板 + 角色占位({g1..}/{lt}/{boss} 在 who 位与 text 位都可能出现)
function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
}

// 统一访问器:样板关(story.script 手写)直通;生成关按章模板展开。
// level = levels.js 展开后的关卡(含 boss.name/lieutenants/camps[0].cityName/waveCount/difficulty/story);
// roster = unlockedGenerals(save) 的 Set。
export function storyContentFor(level, roster) {
  const st = level.story || {};
  if (st.script && st.narration) return { narration: st.narration, script: st.script };

  const [g1, g2, g3] = rollcall(roster);
  const ltId = level.lieutenants[0].id;
  const vars = {
    boss: level.boss.name,
    lt: level.lieutenants[0].name,
    city: level.camps[0].cityName,
    wan: numToCn(wanOf(level)),
    g1: CAST[g1].name, g2: CAST[g2].name, g3: CAST[g3].name,
  };
  const whoMap = { g1, g2, g3, lt: ltId, boss: level.boss.id };

  const narrTmpl = NARR[level.chapter][level.id % 2];
  const scriptTmpl = SCRIPTS[level.chapter][level.id % 3];
  return {
    narration: fill(narrTmpl, vars),
    script: scriptTmpl.map(([who, text]) => ({ who: whoMap[who] || who, text: fill(text, vars) })),
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/storylines.test.mjs`
Expected: `ok storylines(50关×2roster 门禁全过)`

注意:若某句因变量替换后超 60 字(长 boss 名/城名组合),按测试报错微调该模板措辞(缩短即可,语义不变),不放宽门禁。

- [ ] **Step 5: 全量回归 + 提交**

Run: `for f in tests/*.test.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done`

```bash
git add src/data/storylines.js tests/storylines.test.mjs
git commit -m "feat(tower-defender): 演绎段1·storylines生成器(5章×3对话+2旁白模板,seed=关号轮替,点将随roster生长,门禁50关×2roster全过)"
```

---

### Task 5: ui/storyScene.js 两幕状态机(吸收并删除 storyCard)

**Files:**
- Create: `src/ui/storyScene.js`
- Delete: `src/ui/storyCard.js`、`tests/storyCard.test.mjs`
- Test: `tests/storyScene.test.mjs`

注意:本任务删除 storyCard 后 `src/main.js` 仍 import 它 → main.js 会临时 broken;Task 6 立刻接线修复。两任务必须连续执行、中间不发版;若希望每个 commit 都可运行,把本任务 Step 6 的提交推迟到 Task 6 一起提交也可(执行者二选一,默认分开提交、注明 WIP 配对)。

- [ ] **Step 1: 写失败测试 `tests/storyScene.test.mjs`**

```js
// tests/storyScene.test.mjs — 演绎门禁2(spec §8.2):两幕 layout/hit/状态机推进 + stub ctx draw 不抛
// + save/restore 平衡。打字机速度是纯表现常量(rAF 时间驱动),不测速率,只测"未显完→全显→下一句→done"语义。
// 运行:node games/tower-defender/tests/storyScene.test.mjs
import assert from 'node:assert';
import { newStoryState, storySceneLayout, hitStoryScene, toDialogue, advanceDialogue, drawStoryScene } from '../src/ui/storyScene.js';
import { storyContentFor } from '../src/data/storylines.js';
import { LEVELS } from '../src/data/levels.js';

const view = { w: 1280, h: 800 };
const BASE = new Set(['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying']);
const mkContent = () => ({ narration: '测试旁白讲解两句话。第二句。', script: [
  { who: 'liao', text: '报告主公，敌军来了！' },
  { who: 'liubei', text: '好。' },
  { who: 'zhongjiang', text: '（齐声）末将在！' },
] });

// 1) 初态 + 幕1 layout/hit:无续玩单继续钮;有续玩续上次+重头;review 单继续
{
  const st = newStoryState(mkContent(), { hasResume: false, review: false });
  assert.equal(st.act, 'narration'); assert.equal(st.lineIdx, 0);
  const L = storySceneLayout(view, st);
  assert.equal(L.buttons.length, 1); assert.equal(L.buttons[0].id, 'continue');
  const b = L.buttons[0];
  assert.equal(hitStoryScene(view, st, b.x + 2, b.y + 2), 'continue', '命中继续');
  assert.equal(hitStoryScene(view, st, 1, 1), null, '幕1 空白点击不消费(防误触,按钮制)');
}
{
  const st = newStoryState(mkContent(), { hasResume: true, review: false });
  const ids = storySceneLayout(view, st).buttons.map((b) => b.id).sort();
  assert.deepEqual(ids, ['restart', 'resume'], '续上次/重头');
  const r = storySceneLayout(view, st).buttons.find((b) => b.id === 'resume');
  assert.equal(hitStoryScene(view, st, r.x + 2, r.y + 2), 'resume');
}
{
  const st = newStoryState(mkContent(), { hasResume: true, review: true });
  const L = storySceneLayout(view, st);
  assert.equal(L.buttons.length, 1, 'review 模式忽略续玩,单继续钮');
}

// 2) 幕2 layout/hit:跳过钮命中;其余区域=tap;跳过钮不与 fs ⛶(右上 w-56..w-20)重叠
{
  const st = newStoryState(mkContent(), { hasResume: false, review: false });
  toDialogue(st, 1000);
  assert.equal(st.act, 'dialogue');
  const L = storySceneLayout(view, st);
  assert.ok(L.skip && L.box, '幕2 有跳过钮与对话框几何');
  assert.ok(L.skip.x + L.skip.w < view.w - 56, '跳过钮避让右上 ⛶');
  assert.equal(hitStoryScene(view, st, L.skip.x + 2, L.skip.y + 2), 'skip');
  assert.equal(hitStoryScene(view, st, view.w / 2, view.h / 2), 'tap');
}

// 3) 状态机推进:未显完 tap=全显(reveal)→ 已显完 tap=下一句(next)→ 末句已显完=done
{
  const st = newStoryState(mkContent(), { hasResume: false, review: false });
  toDialogue(st, 1000);
  assert.equal(advanceDialogue(st, 1050), 'reveal', '打字中 → 全显');   // 50ms 仅 ~1 字
  assert.equal(st.revealAll, true);
  assert.equal(advanceDialogue(st, 1100), 'next', '全显后 → 下一句');
  assert.equal(st.lineIdx, 1); assert.equal(st.revealAll, false);
  assert.equal(advanceDialogue(st, 99000), 'next', '句2"好。"自然显完 → 下一句(时间驱动,无需先 reveal)');
  assert.equal(st.lineIdx, 2);
  assert.equal(advanceDialogue(st, 999000), 'done', '末句显完 → done');
  assert.equal(advanceDialogue(st, 999100), 'done', 'done 幂等');
}

// 4) stub ctx draw 不抛 + save/restore 平衡:两幕 × 样板关(L1)/生成关(L2) × 多行号/时刻
{
  let depth = 0, maxNeg = 0;
  const ctx = new Proxy({
    save() { depth++; }, restore() { depth--; if (depth < 0) maxNeg++; },
    measureText(t) { return { width: (t ? String(t).length : 0) * 8 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, closePath() {},
    fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {}, clip() {},
    setTransform() {}, ellipse() {}, rect() {}, setLineDash() {}, drawImage() {},
  }, { get(t, p) { return p in t ? t[p] : () => {}; }, set() { return true; } });

  for (const lv of [LEVELS[0], LEVELS[1]]) {
    const content = storyContentFor(lv, BASE);
    for (const hasResume of [false, true]) {
      const st = newStoryState(content, { hasResume, review: false });
      drawStoryScene(ctx, view, st, lv, 16.7);                       // 幕1
      toDialogue(st, 1000);
      drawStoryScene(ctx, view, st, lv, 1050);                       // 幕2 打字中
      advanceDialogue(st, 1050);
      drawStoryScene(ctx, view, st, lv, 2000);                       // 幕2 全显(▼ 闪烁分支)
      while (advanceDialogue(st, 9e6) !== 'done') drawStoryScene(ctx, view, st, lv, 9e6);   // 逐句到末句
      drawStoryScene(ctx, view, st, lv, 9e6);
    }
  }
  assert.equal(depth, 0, 'save/restore 平衡');
  assert.equal(maxNeg, 0, '无多余 restore');
}

// 5) 小窗布局不炸(iPad 横屏类):几何均有限数
{
  const small = { w: 1024, h: 640 };
  const st = newStoryState(mkContent(), { hasResume: false, review: false });
  toDialogue(st, 0);
  const L = storySceneLayout(small, st);
  for (const r of [L.box, L.skip, L.portraits.left, L.portraits.right]) {
    for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isFinite(r[k]), `小窗 ${k} 有限`);
  }
  assert.ok(L.portraits.left.y > 0, '小窗立绘不越上沿');
}

console.log('ok storyScene');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/storyScene.test.mjs`
Expected: FAIL(Cannot find module storyScene.js)

- [ ] **Step 3: 实现 `src/ui/storyScene.js`**

```js
// ui/storyScene.js — [演绎段1] 关前两幕剧情演绎(屏幕坐标 layout/hit/draw + 状态机)。
// 幕1 旁白讲解页(羊皮纸大卡,版式自 storyCard.js 迁入):章名/战役名/narration 楷体/小档案/声明/按钮。
// 幕2 对话演绎(群英传式):底部羊皮纸对话框 + 180×220 立绘(蜀左敌右,说话人全亮非说话人压暗0.45)
//   + 金底楷体名牌 + 打字机逐字(~24字/s,由 nowMs 时间差驱动,rAF 渲染即推进,无 setInterval,降帧不丢字)
//   + 点击①全显/点击②下一句 + ▼ 闪烁 + 右上「跳过演绎 ▶」。
// 状态由 main.js 持有(newStoryState 创建);本模块 render-only + 纯状态推进函数,不触 audio/save。
// [段2] 语音接线点:toDialogue/advanceDialogue 调用处(main.js)切句播 mp3;fromStory 进战斗前 stopVoice。
// copy-and-own theme.js;立绘经 generalSprite(三阶回退)/assets.images,缺图色块名牌兜底。
import { backdrop, panel, title, button, roundRect, FONT, PAL } from './theme.js';
import { assets, generalSprite } from '../core/assets.js';
import { CHAPTERS } from '../data/campaign.js';
import { CAST } from '../data/cast.js';

const PW = 560, PH = 540, BTN_W = 200, BTN_H = 52, GAP = 20;   // 幕1 羊皮纸卡(PH 较 storyCard +80:narration 多行)
const PORT_W = 180, PORT_H = 220;                               // 幕2 立绘框(spec:180×220 顶对齐)
const CHARS_PER_S = 24;                                         // 打字机速度(纯表现常量,不进单测)
const DIM = 0.45;                                               // 非说话人压暗
const SKIP_W = 132, SKIP_H = 28;

// 统一话术(内容铁律:避免误导孩子把"守成都"当史实)
const DISCLAIMER = '历史上这是真实的大战；游戏里，我们想象蜀汉众将来守护这片战场。';

// —— 状态 ——
// content = storyContentFor(level, roster) 产物;review=重看故事(末了回对局,幕1 单继续钮)
export function newStoryState(content, { hasResume = false, review = false } = {}) {
  return { act: 'narration', lineIdx: 0, lineStart: 0, revealAll: false, content, hasResume, review };
}

export function toDialogue(st, nowMs) {
  st.act = 'dialogue'; st.lineIdx = 0; st.lineStart = nowMs; st.revealAll = false;
}

// 当前句显示字数(时间驱动;revealAll 短路)
function shownChars(st, nowMs) {
  const text = st.content.script[st.lineIdx].text;
  if (st.revealAll) return text.length;
  return Math.min(text.length, Math.floor(Math.max(0, nowMs - st.lineStart) / 1000 * CHARS_PER_S));
}

// 幕2 点击推进:打字中→全显('reveal');已显完→下一句('next');末句显完→'done'(幂等)
export function advanceDialogue(st, nowMs) {
  const script = st.content.script;
  if (st.lineIdx >= script.length - 1 && shownChars(st, nowMs) >= script[st.lineIdx].text.length) return 'done';
  if (shownChars(st, nowMs) < script[st.lineIdx].text.length) { st.revealAll = true; return 'reveal'; }
  st.lineIdx++; st.lineStart = nowMs; st.revealAll = false;
  return 'next';
}

// —— layout(hit 与 draw 共用单一来源)——
export function storySceneLayout(view, st) {
  if (st.act === 'narration') {
    const x = (view.w - PW) / 2, y = (view.h - PH) / 2;
    const by = y + PH - BTN_H - 28;
    let buttons;
    if (st.hasResume && !st.review) {
      const totalW = BTN_W * 2 + GAP, bx = (view.w - totalW) / 2;
      buttons = [
        { id: 'resume', x: bx, y: by, w: BTN_W, h: BTN_H },
        { id: 'restart', x: bx + BTN_W + GAP, y: by, w: BTN_W, h: BTN_H },
      ];
    } else {
      buttons = [{ id: 'continue', x: (view.w - BTN_W) / 2, y: by, w: BTN_W, h: BTN_H }];
    }
    return { panel: { x, y, w: PW, h: PH }, buttons };
  }
  // 幕2:底部 ~1/3 高对话框;立绘立于框上沿;跳过钮避让右上 ⛶(hud fs 钮 x≈view.w-56)
  const bh = Math.max(200, Math.min(300, Math.round(view.h * 0.32)));
  const box = { x: 24, y: view.h - bh - 16, w: view.w - 48, h: bh };
  return {
    box,
    skip: { x: view.w - 56 - 8 - SKIP_W, y: 13, w: SKIP_W, h: SKIP_H },
    portraits: {
      left: { x: box.x + 40, y: box.y - PORT_H, w: PORT_W, h: PORT_H },
      right: { x: box.x + box.w - 40 - PORT_W, y: box.y - PORT_H, w: PORT_W, h: PORT_H },
    },
  };
}

const inRect = (r, sx, sy) => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;

// 命中:幕1 → 'continue'|'resume'|'restart'|null(按钮制,空白不消费防误触);
//      幕2 → 'skip'|'tap'(全屏任意处推进,kid-friendly)
export function hitStoryScene(view, st, sx, sy) {
  const L = storySceneLayout(view, st);
  if (st.act === 'narration') {
    for (const b of L.buttons) if (inRect(b, sx, sy)) return b.id;
    return null;
  }
  if (inRect(L.skip, sx, sy)) return 'skip';
  return 'tap';
}

// —— 文本换行(measureText 驱动,stub ctx 下宽=len*8 同样工作)——
function wrapLines(ctx, text, maxW) {
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

// —— draw ——
export function drawStoryScene(ctx, view, st, level, nowMs) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(ctx, view.w, view.h);
  if (st.act === 'narration') drawNarration(ctx, view, st, level);
  else drawDialogue(ctx, view, st, level, nowMs);
}

// 幕1 · 旁白讲解页(羊皮纸版式,storyCard 迁入:narration 替代 hook,其余沿用)
function drawNarration(ctx, view, st, level) {
  const L = storySceneLayout(view, st);
  const P = L.panel;
  panel(ctx, P.x, P.y, P.w, P.h, { variant: 'parch', r: 16 });

  const chapter = CHAPTERS.find((c) => c.id === level.chapter);
  const cx = view.w / 2;
  let y = P.y + 46;

  ctx.fillStyle = PAL.parchEdge; ctx.font = FONT.body(14, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`第 ${level.chapter} 章 · ${chapter ? chapter.title : ''}`, cx, y); y += 30;
  title(ctx, level.name, cx, y + 8, 38); y += 52;

  // 旁白讲解词(楷体,自动换行,至多 4 行)。[段2] 进页自动播旁白 mp3,点击打断。
  ctx.fillStyle = '#7a3a12'; ctx.font = FONT.head(19);
  const narr = (st.content && st.content.narration) || (level.story && level.story.hook) || '';
  for (const line of wrapLines(ctx, narr, PW - 104).slice(0, 4)) { ctx.fillText(line, cx, y); y += 30; }
  y += 10;

  // 小档案(左对齐两列;字段沿用 storyCard)
  const s = level.story || {};
  const items = [['年代', s.year], ['地点', s.place], ['双方', s.sides], ['结果', s.result], ['成语', s.idiom]].filter(([, v]) => v);
  ctx.textAlign = 'left'; ctx.font = FONT.body(15, 600);
  const colX = P.x + 56;
  for (const [k, v] of items) {
    ctx.fillStyle = PAL.parchEdge; ctx.fillText(k, colX, y);
    ctx.fillStyle = PAL.ink; ctx.fillText(String(v), colX + 56, y);
    y += 26;
  }

  // 可选头像(沿用 storyCard:story.portrait → gen_<id> 缩略)
  if (s.portrait) {
    const img = generalSprite(s.portrait, 3);
    if (img) {
      const ps = 64, pxR = P.x + P.w - 56 - ps, pyT = P.y + 132;
      ctx.save(); roundRect(ctx, pxR, pyT, ps, ps, 8); ctx.clip();
      const ih = ps * ((img.height / img.width) || 1.35);
      ctx.drawImage(img, pxR, pyT, ps, ih); ctx.restore();
      roundRect(ctx, pxR, pyT, ps, ps, 8); ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.parchEdge; ctx.stroke();
    }
  }

  ctx.fillStyle = 'rgba(60,46,26,.72)'; ctx.font = FONT.body(12, 600); ctx.textAlign = 'center';
  ctx.fillText(DISCLAIMER, cx, P.y + P.h - BTN_H - 50);

  const labels = { continue: '继续 ▶', resume: '续上次 ▶', restart: '重头开始' };
  const variants = { continue: 'gold', resume: 'jade', restart: 'wood' };
  for (const b of L.buttons) button(ctx, b, { label: labels[b.id], variant: variants[b.id] });
}

// 立绘解析:CAST.portrait → Image|null(我方走 generalSprite 三阶回退;敌将/刘备走 assets.images)
function portraitOf(who) {
  const c = CAST[who];
  if (!c || !c.portrait) return null;
  if (c.portrait.gen) return generalSprite(c.portrait.gen, 3);
  return assets.images[c.portrait.img] || null;
}

// 站位推导(无额外状态):截至当前句,每侧最后一个"有立绘"的说话人
function sideSpeakers(script, lineIdx) {
  const out = { shu: null, enemy: null };
  for (let i = 0; i <= lineIdx; i++) {
    const c = CAST[script[i].who];
    if (c && c.portrait && (c.side === 'shu' || c.side === 'enemy')) out[c.side] = script[i].who;
  }
  return out;
}

// 立绘:按宽 contain 缩放、顶部对齐(头部安全区齐平,骑乘图顶即人头),超框底裁掉;缺图色块+名首字
function drawPortrait(ctx, r, who, bright) {
  ctx.save();
  ctx.globalAlpha = bright ? 1 : DIM;
  roundRect(ctx, r.x, r.y, r.w, r.h, 10); ctx.clip();
  const img = portraitOf(who);
  if (img && img.width) {
    const scale = r.w / img.width;
    ctx.drawImage(img, r.x, r.y, r.w, img.height * scale);
  } else {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, PAL.woodA); g.addColorStop(1, PAL.woodB);
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = PAL.cream; ctx.font = FONT.head(64); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((CAST[who] ? CAST[who].name : '?').slice(0, 1), r.x + r.w / 2, r.y + r.h / 2);
  }
  ctx.restore();
  if (bright) { roundRect(ctx, r.x, r.y, r.w, r.h, 10); ctx.lineWidth = 2; ctx.strokeStyle = PAL.gold; ctx.stroke(); }
}

// 金底楷体名牌
function drawNamePlate(ctx, cx, cy, name, bright) {
  const w = Math.max(96, name.length * 22 + 36), h = 34;
  ctx.save();
  if (!bright) ctx.globalAlpha = 0.6;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 8);
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0, bright ? '#f0cf72' : '#caa44a'); g.addColorStop(1, bright ? '#bd9540' : '#9a782e');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#5e4716'; ctx.stroke();
  ctx.fillStyle = '#2b1d08'; ctx.font = FONT.head(18); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name, cx, cy + 1);
  ctx.restore();
}

// 幕2 · 对话演绎
function drawDialogue(ctx, view, st, level, nowMs) {
  const L = storySceneLayout(view, st);
  const script = st.content.script;
  const line = script[st.lineIdx];
  const cur = CAST[line.who] || { name: line.who, side: 'shu', portrait: null };

  // 战役名小标题(顶部居中,给娃上下文)
  title(ctx, level.name, view.w / 2, 64, 30);

  // 双侧立绘(蜀左敌右;当前说话人全亮,另一侧压暗;齐声/无立绘角色不顶替立绘位)
  const sp = sideSpeakers(script, st.lineIdx);
  if (sp.shu) drawPortrait(ctx, L.portraits.left, sp.shu, cur.side === 'shu' && sp.shu === line.who);
  if (sp.enemy) drawPortrait(ctx, L.portraits.right, sp.enemy, cur.side === 'enemy' && sp.enemy === line.who);

  // 对话框(羊皮纸)
  panel(ctx, L.box.x, L.box.y, L.box.w, L.box.h, { variant: 'parch', r: 14 });

  // 当前说话人名牌(骑框上沿,按阵营靠左/右;旁白居中)
  const plateY = L.box.y;
  const plateX = cur.side === 'enemy' ? L.portraits.right.x + PORT_W / 2 : (cur.side === 'shu' ? L.portraits.left.x + PORT_W / 2 : view.w / 2);
  drawNamePlate(ctx, plateX, plateY, cur.name, true);

  // 台词:打字机逐字(时间差驱动),楷体大字自动换行
  const text = line.text.slice(0, shownChars(st, nowMs));
  ctx.fillStyle = PAL.ink; ctx.font = FONT.head(22); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let ty = L.box.y + 64;
  for (const l of wrapLines(ctx, text, L.box.w - 96)) { ctx.fillText(l, L.box.x + 48, ty); ty += 36; }

  // 整句显完 → 右下 ▼ 闪烁(提示点击下一句);未显完不画(点击=全显)
  if (shownChars(st, nowMs) >= line.text.length) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(nowMs / 280);
    ctx.fillStyle = PAL.parchEdge; ctx.font = FONT.body(18, 700); ctx.textAlign = 'center';
    ctx.fillText('▼', L.box.x + L.box.w - 36, L.box.y + L.box.h - 26);
    ctx.restore();
  }

  // 句序(右上小字,如 3/11)+ 跳过钮(常驻)
  ctx.fillStyle = 'rgba(243,234,212,.5)'; ctx.font = FONT.body(12, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(`${st.lineIdx + 1} / ${script.length}`, L.box.x + L.box.w - 14, L.box.y - 14);
  button(ctx, L.skip, { label: '跳过演绎 ▶', variant: 'ghost' });
}
```

- [ ] **Step 4: 删除旧文件**

```bash
git rm src/ui/storyCard.js tests/storyCard.test.mjs
```

- [ ] **Step 5: 跑测试确认通过**

Run: `node tests/storyScene.test.mjs`
Expected: `ok storyScene`

- [ ] **Step 6: 全量回归(此时 main.js import storyCard 会失败?——main.js 不在测试矩阵内,tests 全绿即可)+ 提交**

Run: `for f in tests/*.test.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done`(应无 FAIL;storyCard.test 已删)

```bash
git add -A
git commit -m "feat(tower-defender): 演绎段1·storyScene两幕状态机(羊皮纸幕1+群英传幕2/打字机时间驱动/立绘顶对齐蜀左敌右/跳过钮,WIP与下个commit配对接线main)"
```

---

### Task 6: main.js 接线(act 路由/跳过/重看兼容/QA 钩子)

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: 改 import(现 22 行附近)**

```js
// 删:
import { hitStoryCard, drawStoryCard } from './ui/storyCard.js';
// 增:
import { newStoryState, hitStoryScene, drawStoryScene, toDialogue, advanceDialogue, storySceneLayout } from './ui/storyScene.js';
import { storyContentFor } from './data/storylines.js';
```

- [ ] **Step 2: 状态与创建助手(状态声明区,`storyReview` 行后)**

```js
let storyState = null;         // [演绎] 两幕演绎状态(仅内存,演绎进度不入任何快照;中途退出重进从幕1重来)
// [演绎] 进故事屏统一建态(选关入口/重看入口共用;roster 实时取,点将随解锁进度生长)
function makeStoryState(n, { hasResume, review }) {
  return newStoryState(storyContentFor(LEVELS[n], unlockedGenerals(save)), { hasResume, review });
}
```

- [ ] **Step 3: startLevel 建态(现 70-77 行)**

`screen = 'story'; audio.stopBgm();` 前插一行:

```js
  storyState = makeStoryState(n, { hasResume: !!pendingResume, review: false });
```

(放在 `pendingResume = ...` 赋值之后。)

- [ ] **Step 4: fromStory 注释补段2钩子(函数体逻辑不变,现 105-111 行)**

函数首行前加注释:

```js
// 故事屏「继续/续上次/重头」终路由(演绎两幕走完/跳过后也汇于此)。[段2] 进战斗前在此 stopVoice()。
```

- [ ] **Step 5: render 的 story 分支(现 157 行)**

```js
// 旧:
  if (screen === 'story') { drawStoryCard(ctx, view, LEVELS[pendingLevel], !!pendingResume); drawFsButton(); return; }
// 新:
  if (screen === 'story') { drawStoryScene(ctx, view, storyState, LEVELS[pendingLevel], performance.now()); drawFsButton(); return; }
```

- [ ] **Step 6: onPointerDown 的 story 分支(现 251-255 行)**

```js
// 旧:
  if (screen === 'story') {
    const act = hitStoryCard(view, !!pendingResume, sx, sy);
    if (act) fromStory(act);
    return;
  }
// 新:
  if (screen === 'story') {
    const act = hitStoryScene(view, storyState, sx, sy);
    if (act === 'resume') fromStory('resume');                                    // 续上次=跳过演绎直接恢复(spec §5)
    else if (act === 'continue' || act === 'restart') toDialogue(storyState, performance.now());   // 幕1→幕2(重头的快照在进战斗时清)
    else if (act === 'skip') fromStory('continue');                               // 跳过演绎→直接开战/回对局(review)
    else if (act === 'tap') { if (advanceDialogue(storyState, performance.now()) === 'done') fromStory('continue'); }   // 末句点击→开战
    if (act) audio.sfx('ui');
    return;
  }
```

- [ ] **Step 7: 暂停菜单「重看故事」建态(现 275 行)**

```js
// 旧:
    else if (act === 'story') { storyReview = true; pendingLevel = curIndex(); pendingResume = null; screen = 'story'; }
// 新:
    else if (act === 'story') { storyReview = true; pendingLevel = curIndex(); pendingResume = null; storyState = makeStoryState(curIndex(), { hasResume: false, review: true }); screen = 'story'; }
```

- [ ] **Step 8: __td QA 钩子(boot 内 window.__td,`fromStory` 行附近增删)**

```js
    fromStory,
    // [演绎] 冒烟/QA:读演绎态、取布局矩形(算点击坐标)、模拟推进、写续玩快照、重看入口
    get storyState() { return storyState; },
    storyLayout() { return storySceneLayout(view, storyState); },
    persistResume() { if (screen === 'playing' && (state.phase === 'prep' || state.phase === 'combat')) browserWriteResume(resumeSnapshot(state)); },
    reviewStory() { storyReview = true; pendingLevel = curIndex(); pendingResume = null; storyState = makeStoryState(curIndex(), { hasResume: false, review: true }); screen = 'story'; },
```

(`persistResume` 与 boot 末段同名局部函数语义一致;直接调用已有局部函数亦可——以实际代码结构为准,保证 __td.persistResume() 可用即可。)

- [ ] **Step 9: 全量回归 + 手动语法检查**

Run: `for f in tests/*.test.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done`
Run: `node --check src/main.js && echo "main.js 语法 OK"`
Expected: 无 FAIL + 语法 OK

- [ ] **Step 10: 提交**

```bash
git add src/main.js
git commit -m "feat(tower-defender): 演绎段1·main接线两幕路由(幕1按钮/幕2 tap推进+skip/续上次跳演绎/重看回对局,__td演绎QA钩子)"
```

---

### Task 7: 刘备立绘(gen-sprites 条目 + MANIFEST 注册 + 可选生成)

**Files:**
- Modify: `tools/gen-sprites.mjs`(UNITS 数组)
- Modify: `src/core/assets.js`(MANIFEST)

- [ ] **Step 1: `tools/gen-sprites.mjs` UNITS 数组追加(放 v1 蜀汉 6 将块末尾、南蛮敌兵之前)**

```js
  { cat: 'generals', id: 'liubei', desc: '三国蜀汉之主·刘备（我方主公，剧情立绘）：仁德宽厚的君主，双耳垂肩，面容仁厚带笑，黑色长须，头戴金边冠冕，身穿皇叔金纹黄袍配轻金甲，手按腰间宝剑，气度雍容温暖，体型端正。' },
```

- [ ] **Step 2: `src/core/assets.js` MANIFEST 蜀汉十二将块后追加**

```js
  // —— [演绎段1] 剧情角色(非塔将):刘备(幕2 对话立绘;缺图 → storyScene 色块名牌兜底)——
  gen_liubei: 'assets/sprites/generals/liubei.png',
```

- [ ] **Step 3: 生成(条件执行)**

检查 `OPENROUTER_API_KEY`:
- **有 key**:`OPENROUTER_API_KEY=$OPENROUTER_API_KEY node tools/gen-sprites.mjs liubei`,确认 `assets/sprites/generals/liubei.png` 生成(黄忠锚自动复用,>30KB 合理),`git add` 该 png。
- **无 key**(当前会话状态):跳过生成,在任务汇报里给 James 留一行命令:`cd games/tower-defender && OPENROUTER_API_KEY=sk-or-... node tools/gen-sprites.mjs liubei`。缺图时幕2 自动色块名牌兜底,不阻塞。

- [ ] **Step 4: 回归(assets.test 等)+ 提交**

Run: `node tests/assets.test.mjs && for f in tests/*.test.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done`

```bash
git add tools/gen-sprites.mjs src/core/assets.js
# 若已生成立绘: git add assets/sprites/generals/liubei.png
git commit -m "feat(tower-defender): 演绎段1·刘备立绘条目(gen-sprites黄忠锚+MANIFEST注册gen_liubei,缺图色块兜底)"
```

---

### Task 8: 浏览器冒烟(两幕走通/跳过/续玩/重看/骑乘立绘裁切目检)

**Files:**
- Create: `tools/smoke-story.mjs`(常驻工具,入库)

环境(见记忆 boom-worms-smoke-test-setup,沙箱挡 localhost → host 侧跑):
1. `npm install --prefix /tmp/bw-pup puppeteer-core`(已装则跳过)
2. `cp tools/smoke-story.mjs /tmp/bw-pup/`(ESM 裸 import 只在该目录解析)
3. 单次 Bash(禁代理):`cd <repo根> && python3 -m http.server 8851 --directory . & sleep 1.5; node /tmp/bw-pup/smoke-story.mjs; kill %1`

- [ ] **Step 1: 写 `tools/smoke-story.mjs`**

```js
// tools/smoke-story.mjs — [演绎段1] 故事演绎冒烟(spec §8.4):L1 两幕完整走→开战/跳过/续玩/重看/
// L2 生成关模板可见/骑乘立绘(关羽/赵云/马超)裁切目检截图。零 JS 错误为过线。
// 运行见文件头注释(host 侧 python http.server + puppeteer-core,同 smoke-shots.mjs)。
import puppeteer from 'puppeteer-core';

const URL = 'http://localhost:8851/games/tower-defender/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.env.OUT_PREFIX || '/tmp/td-story';
const errors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--no-proxy-server', '--proxy-bypass-list=*'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle2' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const td = (fn, ...args) => page.evaluate(fn, ...args);
const shot = async (name) => { await page.screenshot({ path: `${OUT}-${name}.png` }); console.log(`shot → ${OUT}-${name}.png`); };
const clickBtn = async (id) => {
  const b = await td(() => { const L = window.__td.storyLayout(); return (L.buttons || []).find((x) => x.id === arguments[0]) || null; }, id)
    || await td((bid) => (window.__td.storyLayout().buttons || []).find((x) => x.id === bid), id);
  if (!b) throw new Error('幕1 按钮缺失: ' + id);
  await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
};

// ① L1 两幕完整走 → 开战
await td(() => window.__td.showStory(0));
await sleep(400); await shot('L1-act1');
await clickBtn('continue'); await sleep(600); await shot('L1-act2-typing');        // 幕2 打字中
let guard = 0;
while ((await td(() => window.__td.screen)) === 'story' && guard++ < 40) {          // 点击①全显/②下一句直至 done→开战
  await page.mouse.click(640, 500); await sleep(120);
}
if ((await td(() => window.__td.screen)) !== 'playing') errors.push('两幕走完未进战斗');
await shot('L1-battle');

// ② 跳过路径(L2 生成关:模板文案+点将名单可见)
await td(() => { window.__td.toSelect(); window.__td.showStory(1); });
await sleep(300); await shot('L2-act1');
await clickBtn('continue'); await sleep(2500); await shot('L2-act2-template');     // 模板句已显出
const skip = await td(() => window.__td.storyLayout().skip);
await page.mouse.click(skip.x + skip.w / 2, skip.y + skip.h / 2); await sleep(300);
if ((await td(() => window.__td.screen)) !== 'playing') errors.push('跳过未进战斗');

// ③ 续玩路径:造快照 → 重进 L1 幕1 应有 续上次/重头 → 续上次直接恢复(跳过演绎)
await td(() => { window.__td.loadLevel(0); window.__td.state.waveIndex = 3; window.__td.persistResume(); window.__td.toSelect(); window.__td.showStory(0); });
await sleep(300);
const ids = await td(() => window.__td.storyLayout().buttons.map((b) => b.id).sort());
if (JSON.stringify(ids) !== JSON.stringify(['restart', 'resume'])) errors.push('续玩双钮缺失: ' + ids);
await shot('L1-act1-resume');
await clickBtn('resume'); await sleep(400);
const rw = await td(() => ({ screen: window.__td.screen, wave: window.__td.state.waveIndex }));
if (rw.screen !== 'playing' || rw.wave !== 3) errors.push('续上次未恢复到波3: ' + JSON.stringify(rw));

// ④ 重看故事:回对局不重置(金币/波次原样)
const before = await td(() => ({ gold: window.__td.state.gold, wave: window.__td.state.waveIndex }));
await td(() => window.__td.reviewStory()); await sleep(300); await shot('L1-review-act1');
await clickBtn('continue'); await sleep(300);
const skip2 = await td(() => window.__td.storyLayout().skip);
await page.mouse.click(skip2.x + skip2.w / 2, skip2.y + skip2.h / 2); await sleep(300);
const after = await td(() => ({ screen: window.__td.screen, gold: window.__td.state.gold, wave: window.__td.state.waveIndex, paused: window.__td.state.paused }));
if (after.screen !== 'playing' || after.wave !== before.wave) errors.push('重看未回对局原样: ' + JSON.stringify({ before, after }));

// ⑤ 骑乘立绘裁切目检:注入测试剧本(关羽/赵云/马超 三阶骑乘图 180×220 顶对齐)
await td(() => { window.__td.toSelect(); window.__td.showStory(0); });
await td(() => { const st = window.__td.storyState; st.content = { narration: 'x', script: [
  { who: 'guan', text: '关羽立绘裁切目检' }, { who: 'zhao', text: '赵云立绘裁切目检' }, { who: 'ma', text: '马超立绘裁切目检' },
] }; });
await clickBtn('continue'); await sleep(2200); await shot('crop-guan');
await page.mouse.click(640, 500); await sleep(100); await page.mouse.click(640, 500); await sleep(2200); await shot('crop-zhao');
await page.mouse.click(640, 500); await sleep(100); await page.mouse.click(640, 500); await sleep(2200); await shot('crop-ma');

await browser.close();
if (errors.length) { console.error('❌ 冒烟失败:\n' + errors.join('\n')); process.exit(1); }
console.log('ok smoke-story(两幕/跳过/续玩/重看/裁切目检 全过,无 JS 错误)');
```

(注:`clickBtn` 里第一行兜底写法若执行报错,保留第二个 `td((bid)=>…)` 形式即可——以能跑通为准,实现者可简化。)

- [ ] **Step 2: 跑冒烟**

```bash
npm ls --prefix /tmp/bw-pup puppeteer-core >/dev/null 2>&1 || npm install --prefix /tmp/bw-pup puppeteer-core
cp tools/smoke-story.mjs /tmp/bw-pup/
cd /Users/james/Projects/game-hub && python3 -m http.server 8851 --directory . >/dev/null 2>&1 & sleep 1.5; node /tmp/bw-pup/smoke-story.mjs; kill %1
```

Expected: `ok smoke-story(...)`,9 张截图落 /tmp/td-story-*.png

- [ ] **Step 3: 主对话(本会话)目检截图**

执行完后由主会话 Read 全部截图逐张目检:幕1 narration 换行不溢出、幕2 立绘左右站位与压暗、名牌、打字机中间态、▼、模板关点将名单(廖化/张苞/关平)、骑乘三图头部齐平不裁脸。发现问题回修(微调 storyScene 常量)再跑。

- [ ] **Step 4: 提交**

```bash
git add tools/smoke-story.mjs
git commit -m "feat(tower-defender): 演绎段1·smoke-story冒烟工具(两幕/跳过/续玩/重看/骑乘裁切五路径,host侧puppeteer)"
```

---

### Task 9: 终验

- [ ] **Step 1: 全量测试**

```bash
cd /Users/james/Projects/game-hub/games/tower-defender
for f in tests/*.test.mjs; do node "$f" || exit 1; done && echo "ALL GREEN"
```

- [ ] **Step 2: 既有工具回归**

```bash
node tools/verify-levels.mjs && node tools/dump-levels.mjs >/dev/null && echo "tools OK"
```

(verify-levels 若因新透传字段报错则属意外,回查 Task 2。)

- [ ] **Step 3: git log 复核 + 汇报**

`git log --oneline develop -12` 应含本计划 8 个 commit。汇报 James:段1 完成清单、冒烟截图路径(/tmp/td-story-*.png)、刘备立绘是否已生成(无 key 则附生成命令)、待 James+娃实玩项(语速/字号/模板重样感,spec §8.5)、段2(配音)入口就绪点。

---

## Self-Review(已执行)

1. **Spec 覆盖**:§3.1 样板 story 扩展(T3)✓ §3.2 storylineFor 纯函数/确定性/变量五项/点将随 roster(T4)✓ §3.3 CAST 注册表+命名规则(T1)✓ §5 幕1 版式迁移/幕2 对话框+立绘 180×220 顶对齐+蜀左敌右+压暗 0.45+名牌+打字机 24字/s 时间驱动+点击①②+▼+跳过常驻+无倒计时(T5)✓ 状态机 act 路由/续上次跳演绎/重头走两幕/演绎不入快照/重看回对局(T5/T6)✓ §7 触点表全落(audio.js/gen-voice 属段2,明确不做;storyCard 删除迁移 ✓;tests 改名扩两幕 ✓)§8 门禁1/2 落 T4/T5,门禁4 冒烟落 T8(含骑乘裁切目检),门禁3/5 属段2/James 实玩 ✓ §10 范围外全部未做 ✓ 边缘行为:①stopVoice 注释钩子 ②幕1 单击单语义(按钮制,注释说明)③muted 不影响流程(段1 无语音天然满足)✓
2. **占位符扫描**:全部代码/剧本/模板/测试均为完整内容,无 TBD/TODO/省略;唯 Task 2/6 引用现有文件行号处注明"以磁盘最新为准做等价适配" ✓
3. **类型/签名一致性**:`newStoryState(content,{hasResume,review})`/`toDialogue(st,nowMs)`/`advanceDialogue(st,nowMs)→'reveal'|'next'|'done'`/`hitStoryScene(view,st,sx,sy)→'continue'|'resume'|'restart'|'skip'|'tap'|null`/`storySceneLayout(view,st)`/`drawStoryScene(ctx,view,st,level,nowMs)` 在 T5 定义、T5 测试与 T6 main/T8 冒烟引用处签名一致 ✓;`storyContentFor(level,roster)`/`rollcall(roster)`/`numToCn(n)` T4 定义与 T4 测试/T5 测试/T6 main 一致 ✓;CAST.portrait 形状 `{gen}|{img}|null` T1 定义与 T5 portraitOf 一致 ✓;levels 透传五字段 T2 与 T4 消费一致 ✓
