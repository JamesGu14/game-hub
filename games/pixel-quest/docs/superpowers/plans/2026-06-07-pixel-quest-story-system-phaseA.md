# Pixel Quest 剧情系统(阶段 A)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 像素冒险 PIXEL QUEST 加一套像素头像对话弹窗剧情系统,并给现有 20 关接上开场 / 每世界 intro / 每世界 outro / 结局,且不改动任何关卡几何。

**Architecture:** 新建纯数据模块 `src/story.js`(对话数据 + `worldOf` 推导,世界 5-10 留空表安全降级);`sprites.js` 加 4 个像素头像 + `portrait()` 访问器;`index.html`/`style.css` 加一个 `#overlay-dialogue` 弹窗;`game.js` 加一个通用 `dialogue` 状态 + 运行器(`startDialogue/advanceDialogue/currentDialogueNode`),并在 `beginAfterStory`/`nextLevel`(世界边界)/`_updateEnding`(结局收尾)三处触发;`main.js` 把弹窗接进 overlays/确认通道/逐节点刷新。

**Tech Stack:** 原生 ES6 module + Canvas2D(无框架、无测试框架)。验证用 `node --check`、`node tools/verify-levels.js`、`node tools/_story_test.mjs`(本计划新建的纯逻辑断言)、以及浏览器真机手测。

**重要约定:**
- 只提交 `games/pixel-quest/` 下本计划涉及的文件(仓库里有其它会话的 tower-defender 改动,**不要** `git add -A`)。
- 当前分支 `develop`(非 main),直接在其上提交即可。
- 提交信息末尾保留 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- 剧情**零生字、不加拼音**;`speaker` 用中文名,`portrait` 用英文 key(`king|mario|princess|bowser|herald`);每句 `text.length ≤ 38`。
- 本阶段**不**新增怪物/世界5-10/Boss(那是阶段 B-D)。结局用"占位版"(救出+婚礼,不含 Boss 战台词),阶段 D 再替换为 spec §五 完整版。

**Spec:** `games/pixel-quest/docs/superpowers/specs/2026-06-07-pixel-quest-10-worlds-design.md`(§四 剧情系统架构、§五 文案、§九 修订)。

---

## File Structure(本阶段)

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/story.js` | 对话数据 + `worldOf/introFor/outroFor/isWorldFirstLevel/isWorldLastLevel` 推导 + 开发期校验 | **新建** |
| `tools/_story_test.mjs` | `story.js` 纯逻辑的 node 断言 | **新建** |
| `src/sprites.js` | 4 个像素头像 `drawKingHead/drawMarioHead/drawBowserHead/drawHeraldHead` + `portrait(key)` 访问器 | 改 |
| `index.html` | `#overlay-dialogue` 弹窗标记 | 改 |
| `style.css` | 弹窗布局(z-index:550、头像 96px pixelated、面板上移) | 改 |
| `src/game.js` | `dialogue` 状态 + 运行器方法 + `beginAfterStory`/`nextLevel`/`_updateEnding`/`confirm` 接入 | 改 |
| `src/main.js` | overlays 注册 + 点击/确认推进 + `syncOverlays` 逐节点刷新 | 改 |

---

## Task 1: 新建 `src/story.js`(数据 + 推导函数)+ node 断言测试

**Files:**
- Create: `games/pixel-quest/src/story.js`
- Create (test): `games/pixel-quest/tools/_story_test.mjs`

- [ ] **Step 1: 先写失败测试 `tools/_story_test.mjs`**

```js
// 纯逻辑断言:story.js 的推导函数 + 数据完整性。Run: node tools/_story_test.mjs
import {
  OPENING, ENDING, WORLD_INTRO, WORLD_OUTRO,
  worldOf, isWorldFirstLevel, isWorldLastLevel, introFor, outroFor,
} from '../src/story.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log('FAIL: ' + msg); fails++; } };

// worldOf: 每 5 关一个世界,1-based
ok(worldOf(0) === 1, 'worldOf(0)=1');
ok(worldOf(4) === 1, 'worldOf(4)=1');
ok(worldOf(5) === 2, 'worldOf(5)=2');
ok(worldOf(19) === 4, 'worldOf(19)=4');
ok(worldOf(45) === 10, 'worldOf(45)=10');

// 世界边界
ok(isWorldFirstLevel(0) === true && isWorldFirstLevel(5) === true, 'first-of-world');
ok(isWorldFirstLevel(4) === false, 'mid not first');
ok(isWorldLastLevel(4) === true && isWorldLastLevel(9) === true, 'last-of-world');
ok(isWorldLastLevel(3) === false, 'mid not last');

// 世界 1-4 有 intro/outro;世界 5-10 空脚本安全降级为 []
ok(Array.isArray(introFor(0)) && introFor(0).length > 0, 'world1 intro filled');
ok(introFor(15).length > 0, 'world4 intro filled (idx15)');
ok(introFor(20).length === 0, 'world5 intro empty -> [] (idx20)');
ok(outroFor(0).length > 0, 'world1 outro filled');
ok(outroFor(20).length === 0, 'world5 outro empty -> [] (idx20)');

// 数据完整性 + 长度约束(零生字短句)
const PORTRAITS = new Set(['king', 'mario', 'princess', 'bowser', 'herald']);
const all = [OPENING, ENDING, ...Object.values(WORLD_INTRO), ...Object.values(WORLD_OUTRO)].flat();
ok(all.length > 0, 'has beats');
for (const b of all) {
  ok(b && typeof b.speaker === 'string' && b.speaker.length > 0, 'beat has speaker: ' + JSON.stringify(b));
  ok(b && PORTRAITS.has(b.portrait), 'beat portrait valid: ' + JSON.stringify(b));
  ok(b && typeof b.text === 'string' && b.text.length > 0 && b.text.length <= 38, 'beat text 1..38: ' + JSON.stringify(b));
}

if (fails) { console.log(`\n${fails} FAIL`); process.exit(1); }
console.log('story.js: ALL PASS (' + all.length + ' beats)');
```

- [ ] **Step 2: 运行,确认失败(模块还不存在)**

Run: `cd games/pixel-quest && node tools/_story_test.mjs`
Expected: 报错 `Cannot find module '../src/story.js'`(或导入失败)。

- [ ] **Step 3: 新建 `src/story.js`(数据 + 函数)**

```js
// 剧情数据 + 世界推导。零生字、短句(每句 ≤38 字)。speaker=中文名,portrait=英文 key。
// 世界 5-10 故意留空(阶段 B-D 再填):空脚本 → introFor/outroFor 返回 [],运行器立即 onDone,不卡死。

export const OPENING = [
  { speaker: '国王', portrait: 'king',   text: '不好啦!桃花公主被酷霸王抓走了!' },
  { speaker: '国王', portrait: 'king',   text: '谁能把公主救回来,我就把他招为驸马!' },
  { speaker: '侍从', portrait: 'herald', text: '可是……能去的勇士,都被酷霸王打败了。' },
  { speaker: '侍从', portrait: 'herald', text: '现在没人敢去啦,呜呜。' },
  { speaker: '马里奥', portrait: 'mario', text: '别怕!交给我!' },
  { speaker: '马里奥', portrait: 'mario', text: '我去把公主救回来!出发啦!' },
];

export const WORLD_INTRO = {
  1: [
    { speaker: '侍从', portrait: 'herald', text: '勇士,先穿过这片蘑菇平原吧!' },
    { speaker: '马里奥', portrait: 'mario', text: '草地、山洞、天空,还有热熔岩和冷雪地。' },
    { speaker: '马里奥', portrait: 'mario', text: '我顺着酷霸王的脚印,一路追上去!' },
  ],
  2: [
    { speaker: '侍从', portrait: 'herald', text: '这里是失落边境:沙漠、森林、海边,还有黑夜。' },
    { speaker: '侍从', portrait: 'herald', text: '那座城堡是坏蛋的小基地。' },
    { speaker: '马里奥', portrait: 'mario', text: '我把它攻下来,找到公主的下落!' },
  ],
  3: [
    { speaker: '侍从', portrait: 'herald', text: '哇……这里是魔界裂隙,好可怕。' },
    { speaker: '马里奥', portrait: 'mario', text: '毒沼、水晶矿、打雷的山。' },
    { speaker: '马里奥', portrait: 'mario', text: '越走越吓人,但我不怕!继续往里冲!' },
  ],
  4: [
    { speaker: '侍从', portrait: 'herald', text: '这里是天空回廊,飘在云上面。' },
    { speaker: '马里奥', portrait: 'mario', text: '樱花、神殿、大蘑菇,还有星空。' },
    { speaker: '马里奥', portrait: 'mario', text: '闯过这些考验,就能得到新的本领!我试一试!' },
  ],
};

export const WORLD_OUTRO = {
  1: [
    { speaker: '马里奥', portrait: 'mario', text: '耶!平原闯过来啦!' },
    { speaker: '马里奥', portrait: 'mario', text: '前面是陌生的边境……公主,我来了!' },
  ],
  2: [
    { speaker: '马里奥', portrait: 'mario', text: '前哨,攻破!' },
    { speaker: '侍从', portrait: 'herald', text: '马里奥!公主被带去更深的地方了,小心呀!' },
    { speaker: '马里奥', portrait: 'mario', text: '知道啦!我继续追!' },
  ],
  3: [
    { speaker: '马里奥', portrait: 'mario', text: '呼……魔界裂隙,走完啦!' },
    { speaker: '马里奥', portrait: 'mario', text: '我好像越来越有劲了!继续前进!' },
  ],
  4: [
    { speaker: '马里奥', portrait: 'mario', text: '考验通过!我浑身都是劲儿!' },
    { speaker: '马里奥', portrait: 'mario', text: '有了新本领,坏蛋们等着吧!' },
  ],
};

// 阶段 A 占位结局(救出 + 婚礼,不含 Boss 战台词);阶段 D 用 spec §五 完整版替换。
export const ENDING = [
  { speaker: '桃花公主', portrait: 'princess', text: '马里奥!你真的来救我了!' },
  { speaker: '马里奥', portrait: 'mario', text: '我说过的,再难也挡不住我!' },
  { speaker: '桃花公主', portrait: 'princess', text: '我们回家吧,回到我们的王国!' },
  { speaker: '国王', portrait: 'king', text: '勇士啊!你救回了我的女儿,了不起!' },
  { speaker: '国王', portrait: 'king', text: '我说话算话——封你为驸马!全国一起庆祝!' },
  { speaker: '侍从', portrait: 'herald', text: '大家快来呀,王国要办大喜事啦!' },
  { speaker: '马里奥', portrait: 'mario', text: '公主,我答应过一定带你回家!' },
];

// ---- 世界推导(每 5 关一个世界;levelIndex 0-based)----
export function worldOf(i) { return Math.floor(i / 5) + 1; }
export function isWorldFirstLevel(i) { return i % 5 === 0; }
export function isWorldLastLevel(i) { return i % 5 === 4; }
export function introFor(i) { return WORLD_INTRO[worldOf(i)] || []; }
export function outroFor(i) { return WORLD_OUTRO[worldOf(i)] || []; }

// 开发期自检:节点结构 + 句长(不抛错,只告警,避免影响线上)
(() => {
  const all = [OPENING, ENDING, ...Object.values(WORLD_INTRO), ...Object.values(WORLD_OUTRO)].flat();
  for (const b of all) {
    if (!b || !b.speaker || !b.portrait || typeof b.text !== 'string') { console.warn('story: 坏节点', b); continue; }
    if (b.text.length > 38) console.warn('story: 文案过长(>38)', b.text);
  }
})();
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `cd games/pixel-quest && node tools/_story_test.mjs`
Expected: `story.js: ALL PASS (NN beats)`,exit 0。

- [ ] **Step 5: 语法检查 + 提交**

Run: `cd games/pixel-quest && node --check src/story.js && echo OK`
Expected: `OK`

```bash
cd /Users/james/Projects/game-hub
git add games/pixel-quest/src/story.js games/pixel-quest/tools/_story_test.mjs
git commit -m "feat(pixel-quest): story.js dialogue data + world derivation (phase A)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `sprites.js` 像素头像 + `portrait()` 访问器

**Files:**
- Modify: `games/pixel-quest/src/sprites.js`(在 `const cache = new Map();` 之前加 4 个 draw 函数;在 `Sprites` 对象里、`princess()` 访问器附近加 `portrait()`)

- [ ] **Step 1: 加 4 个头像绘制函数**

在 `src/sprites.js` 中,找到 `const cache = new Map();` 这一行,在它**之前**插入(这些函数用文件已有的 `mk/r/E` 辅助):

```js
// ---- portraits (对话头像,逻辑尺寸 ~32px,blit 时放大;卡通不吓人) -------------
function drawKingHead() {
  const o = mk(32, 32), x = o.cx;
  x.fillStyle = '#fcc08a'; E(x, 16, 19, 9, 8.5);                 // 脸
  x.fillStyle = '#ffd23f'; r(x, 6, 6, 20, 5);                    // 皇冠底
  x.beginPath(); x.moveTo(6, 6); x.lineTo(9, 1); x.lineTo(12, 6);
  x.lineTo(16, 1); x.lineTo(20, 6); x.lineTo(23, 1); x.lineTo(26, 6); x.closePath(); x.fill();
  x.fillStyle = '#e8362b'; r(x, 14, 7, 4, 3);                    // 宝石
  x.fillStyle = '#23314a'; E(x, 12, 18, 1.4, 1.8); E(x, 20, 18, 1.4, 1.8); // 眼
  x.fillStyle = '#f4f4f4'; x.beginPath(); x.moveTo(8, 22); x.lineTo(24, 22);
  x.lineTo(20, 31); x.lineTo(12, 31); x.closePath(); x.fill();   // 胡子
  x.fillStyle = '#f4f4f4'; E(x, 13, 23, 3, 1.4); E(x, 19, 23, 3, 1.4);
  return o;
}
function drawMarioHead() {
  const o = mk(32, 32), x = o.cx;
  x.fillStyle = '#fcc08a'; E(x, 16, 19, 9, 8.5);
  x.fillStyle = '#e8362b'; x.beginPath(); x.ellipse(16, 11, 11, 8, 0, Math.PI, 0); x.fill(); r(x, 5, 10, 22, 3);
  x.fillStyle = '#fff'; E(x, 16, 9, 3, 3); x.fillStyle = '#e8362b'; E(x, 16, 9, 1.2, 1.2);
  x.fillStyle = '#23314a'; E(x, 12, 18, 1.4, 2); E(x, 20, 18, 1.4, 2);
  x.fillStyle = '#f3a86a'; E(x, 16, 21, 2.2, 2);                 // 鼻
  x.fillStyle = '#5a3413'; E(x, 12, 23, 3, 1.6); E(x, 20, 23, 3, 1.6); r(x, 14, 22, 4, 1.4); // 胡子
  return o;
}
function drawBowserHead() {
  const o = mk(34, 32), x = o.cx;
  x.fillStyle = '#5aa83f'; E(x, 17, 19, 11, 9);                  // 绿头
  x.fillStyle = '#e0c060'; E(x, 17, 24, 7, 4);                   // 口鼻
  x.fillStyle = '#f4f0e0';                                       // 角
  x.beginPath(); x.moveTo(7, 10); x.lineTo(10, 3); x.lineTo(12, 11); x.fill();
  x.beginPath(); x.moveTo(27, 10); x.lineTo(24, 3); x.lineTo(22, 11); x.fill();
  x.fillStyle = '#e87a1a'; r(x, 11, 6, 12, 4);                   // 橙发
  x.fillStyle = '#fff'; E(x, 13, 16, 2.4, 2.6); E(x, 21, 16, 2.4, 2.6);
  x.fillStyle = '#23314a'; E(x, 13.5, 16.5, 1.1, 1.4); E(x, 20.5, 16.5, 1.1, 1.4);
  x.fillStyle = '#fff'; r(x, 13, 26, 2, 2); r(x, 19, 26, 2, 2);  // 小牙(友好)
  return o;
}
function drawHeraldHead() {
  const o = mk(32, 32), x = o.cx;
  x.fillStyle = '#fcc08a'; E(x, 16, 19, 8.5, 8);
  x.fillStyle = '#2fa85a'; x.beginPath(); x.ellipse(16, 10, 10, 5, 0, Math.PI, 0); x.fill(); r(x, 6, 9, 20, 2);
  x.fillStyle = '#ffd23f'; x.beginPath(); x.moveTo(24, 9); x.lineTo(30, 4); x.lineTo(26, 11); x.fill(); // 羽毛
  x.fillStyle = '#23314a'; E(x, 12, 19, 1.3, 1.7); E(x, 20, 19, 1.3, 1.7);
  x.strokeStyle = '#a23b2b'; x.lineWidth = 1.2; x.beginPath(); x.arc(16, 22, 3, 0.2, Math.PI - 0.2); x.stroke();
  return o;
}
```

- [ ] **Step 2: 加 `portrait()` 访问器**

在 `Sprites` 对象里,找到 `princess() { return cached('princess', () => drawPrincess()).cv; },` 这一行,在它**之后**插入:

```js
  portrait(key) {
    switch (key) {
      case 'princess': return Sprites.princess();
      case 'king':     return cached('portrait:king',   () => drawKingHead()).cv;
      case 'mario':    return cached('portrait:mario',  () => drawMarioHead()).cv;
      case 'bowser':   return cached('portrait:bowser', () => drawBowserHead()).cv;
      case 'herald':   return cached('portrait:herald', () => drawHeraldHead()).cv;
      default:         return cached('portrait:herald', () => drawHeraldHead()).cv;
    }
  },
```

- [ ] **Step 3: 语法检查**

Run: `cd games/pixel-quest && node --check src/sprites.js && echo OK`
Expected: `OK`

- [ ] **Step 4: 提交**

```bash
cd /Users/james/Projects/game-hub
git add games/pixel-quest/src/sprites.js
git commit -m "feat(pixel-quest): pixel portrait heads + Sprites.portrait() (phase A)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 对话弹窗 `#overlay-dialogue`(HTML + CSS)

**Files:**
- Modify: `games/pixel-quest/index.html`(在 `#overlay-win` 的 `</div>` 之后、`<!-- ===== On-screen touch controls ===== -->` 之前插入)
- Modify: `games/pixel-quest/style.css`(在 `#btn-fullscreen:hover { ... }` 规则之后追加)

- [ ] **Step 1: 加弹窗标记到 `index.html`**

在 `index.html` 中找到 Win overlay 结尾(`<!-- ===== On-screen touch controls ===== -->` 注释那一行),在该注释**之前**插入:

```html
  <!-- ===== Dialogue (story popups) ===== -->
  <div id="overlay-dialogue" class="overlay">
    <div class="panel dialogue-panel">
      <div class="dlg-row">
        <canvas id="dlg-portrait" width="40" height="40"></canvas>
        <div class="dlg-body">
          <div id="dlg-speaker" class="dlg-speaker"></div>
          <div id="dlg-text" class="dlg-text"></div>
        </div>
      </div>
      <div id="btn-dlg-next" class="big-btn" role="button">▶ 继续</div>
      <p class="tiny">按 跳 / 手柄✕ 继续</p>
    </div>
  </div>
```

- [ ] **Step 2: 加样式到 `style.css`**

在 `style.css` 末尾(或 `#btn-fullscreen:hover {...}` 之后)追加:

```css
/* ---- Dialogue popups ---------------------------------------------------- */
#overlay-dialogue { z-index: 550; } /* 在 touch-controls(z=400) 之上、持久按钮(9999) 之下 */
.dialogue-panel { margin-top: -8vh; max-width: 560px; }
.dlg-row { display: flex; align-items: center; gap: 16px; text-align: left; margin-bottom: 14px; }
#dlg-portrait {
  width: 96px; height: 96px; image-rendering: pixelated;
  background: rgba(0, 0, 0, 0.25); border-radius: 10px; flex: 0 0 auto;
}
.dlg-body { flex: 1 1 auto; }
.dlg-speaker { font-weight: 700; color: #ffd23f; font-size: 18px; margin-bottom: 6px; }
.dlg-text { color: #fff; font-size: 20px; line-height: 1.5; }
```

- [ ] **Step 3: 手动确认结构(浏览器暂不接线,先看标记无误)**

Run: `cd games/pixel-quest && grep -n "overlay-dialogue\|dlg-portrait\|dlg-speaker\|dlg-text\|btn-dlg-next" index.html`
Expected: 5 个 id 都出现各一次。

- [ ] **Step 4: 提交**

```bash
cd /Users/james/Projects/game-hub
git add games/pixel-quest/index.html games/pixel-quest/style.css
git commit -m "feat(pixel-quest): dialogue overlay markup + styles (phase A)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `game.js` —— `dialogue` 状态 + 运行器方法

**Files:**
- Modify: `games/pixel-quest/src/game.js`(顶部 import;constructor 加字段;加 3 个方法;`confirm()` 加分支)

- [ ] **Step 1: 顶部加 story.js 导入**

在 `game.js` 顶部 `import { LEVELS, parseLevel } from './levels.js';` 之后插入:

```js
import {
  OPENING, ENDING, introFor, outroFor, isWorldFirstLevel, isWorldLastLevel,
} from './story.js';
```

- [ ] **Step 2: constructor 加字段**

在 constructor 中,找到 `this.winTimer = 0;` 这一行,在它之后插入:

```js
    this.dialogue = null; // { script, index, onDone } 进行中的对话
```

- [ ] **Step 3: 加运行器方法**

在 `confirm()` 方法**之前**(即 `// ---- input-driven actions ----` 注释附近)插入这三个方法:

```js
  // 播放一段对话;播完调 onDone(由 onDone 决定 state 去向)。空脚本直接 onDone。
  startDialogue(script, onDone) {
    if (!script || script.length === 0) { if (onDone) onDone(); return; }
    this.dialogue = { script, index: 0, onDone: onDone || null };
    this.state = 'dialogue';
    Sound.stopMusic();
    Sound.ui();
  }
  advanceDialogue() {
    const d = this.dialogue;
    if (!d) return;
    d.index += 1;
    if (d.index >= d.script.length) {
      const done = d.onDone;
      this.dialogue = null;
      if (done) done();
      return;
    }
    Sound.ui();
  }
  currentDialogueNode() {
    const d = this.dialogue;
    return d ? d.script[d.index] : null;
  }
```

- [ ] **Step 4: `confirm()` 加 dialogue 分支**

在 `confirm()` 的 `switch (this.state)` 里,找到 `case 'win': this.state = 'menu'; break;`,在它之前加一行:

```js
      case 'dialogue': this.advanceDialogue(); break;
```

- [ ] **Step 5: 语法检查**

Run: `cd games/pixel-quest && node --check src/game.js && echo OK`
Expected: `OK`

- [ ] **Step 6: 提交**

```bash
cd /Users/james/Projects/game-hub
git add games/pixel-quest/src/game.js
git commit -m "feat(pixel-quest): dialogue state + runner in Game (phase A)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `game.js` —— 在开场 / 世界边界 / 结局三处触发对话

**Files:**
- Modify: `games/pixel-quest/src/game.js`(`beginAfterStory`、`nextLevel`、`_updateEnding` celebrate 分支)

- [ ] **Step 1: 改 `beginAfterStory`(开场 → 世界1 intro → 进 1-1)**

把现有:

```js
  beginAfterStory() {
    this.loadLevel(0);
  }
```

替换为:

```js
  beginAfterStory() {
    // 点"开始冒险"→ 开场对话 → 世界1 intro → 进第一关。
    this.startDialogue(OPENING, () => this.startDialogue(introFor(0), () => this.loadLevel(0)));
  }
```

- [ ] **Step 2: 改 `nextLevel`(通关世界最后一关 → outro;进入新世界第一关 → intro)**

把现有:

```js
  nextLevel() {
    const next = this.levelIndex + 1;
    if (next >= LEVELS.length) { this.state = 'win'; this._saveBest(); Sound.win(); return; }
    this.loadLevel(next);
  }
```

替换为:

```js
  nextLevel() {
    const justFinished = this.levelIndex;
    const next = justFinished + 1;
    if (next >= LEVELS.length) { this.state = 'win'; this._saveBest(); Sound.win(); return; }
    const afterOutro = () => {
      if (isWorldFirstLevel(next)) this.startDialogue(introFor(next), () => this.loadLevel(next));
      else this.loadLevel(next);
    };
    if (isWorldLastLevel(justFinished)) this.startDialogue(outroFor(justFinished), afterOutro);
    else afterOutro();
  }
```

- [ ] **Step 3: 改 `_updateEnding` 的 celebrate 收尾(撒花后接 ENDING 对话)**

在 `_updateEnding(dt)` 里找到 celebrate 分支:

```js
    if (e.phase === 'celebrate') {
      e.confettiT -= dt;
      if (e.confettiT <= 0) { this._spawnConfetti(); e.confettiT = 0.04; }
      if (e.t > 2.8) this.state = 'win';
      return;
    }
```

替换为:

```js
    if (e.phase === 'celebrate') {
      e.confettiT -= dt;
      if (e.confettiT <= 0) { this._spawnConfetti(); e.confettiT = 0.04; }
      if (e.t > 2.8) { this.ending = null; this.startDialogue(ENDING, () => { this.state = 'win'; }); }
      return;
    }
```

> 注:阶段 A 里 `4-5` 仍以城堡 `A` 结尾,走 `_winGame`→撒花→ENDING,**不经 `nextLevel`**,所以 `WORLD_OUTRO[4]`(世界4 outro)本阶段**不会显示**——这是预期(它为阶段 C/D 把 4-5 改旗杆后准备,届时才会触发)。手测时不必期待世界4 outro。

- [ ] **Step 4: 语法检查 + 关卡回归(几何未动,应全 PASS)**

Run:
```bash
cd games/pixel-quest && node --check src/game.js && node tools/verify-levels.js >/dev/null && echo "CHECK+VERIFY OK"
```
Expected: `CHECK+VERIFY OK`(verify-levels.js 退出 0)。

- [ ] **Step 5: 提交**

```bash
cd /Users/james/Projects/game-hub
git add games/pixel-quest/src/game.js
git commit -m "feat(pixel-quest): trigger dialogue at opening/world-boundaries/ending (phase A)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `main.js` —— 接入弹窗(注册 / 推进 / 逐节点刷新)

**Files:**
- Modify: `games/pixel-quest/src/main.js`(overlays map;`_lastDlgNode` 变量;点击推进;`handleConfirm`;`syncOverlays` 刷新块)

> `Sprites` 已在本会话早前于 `main.js` 顶部导入(`import { Sprites } from './sprites.js';`)。若发现没有,则在顶部其它 import 后补这一行。

- [ ] **Step 1: overlays map 注册 dialogue**

在 `const overlays = { ... };` 对象里,找到 `win: el('overlay-win'),`,在它之后加一行:

```js
  dialogue: el('overlay-dialogue'),
```

- [ ] **Step 2: 加模块级脏标记变量**

在 `let lastState = null;`(`syncOverlays` 上方)之后加:

```js
let _lastDlgNode = null; // 对话当前节点的脏标记(state 不变但 index 变时需刷新)
```

- [ ] **Step 3: 点击弹窗任意处推进(覆盖 ▶按钮 + 点空白 + 触摸)**

在 `// ---- Overlay buttons ----` 区域,找到 `el('btn-win-menu').addEventListener(...)` 那一行附近,追加:

```js
// 对话:点击弹窗任意处(含 ▶ 按钮,事件冒泡)推进一句。
el('overlay-dialogue').addEventListener('click', () => game.advanceDialogue());
```

> 注意:只在 `#overlay-dialogue` 容器上挂这一个监听。`#btn-dlg-next` 是 `<div role="button">`(非真实 `<button>`),点它会冒泡到这里推进一次;同时它不会在聚焦时被空格"合成点击",所以键盘走全局确认通道、鼠标/触摸走这个冒泡通道,**不会双推进**。不要再给 `#btn-dlg-next` 单独挂监听。

- [ ] **Step 4: `handleConfirm` 加 dialogue 分支(键盘跳 / 手柄✕)**

在 `handleConfirm()` 的 `switch` 里,找到 `case 'levelclear':`,在它之前加:

```js
    case 'dialogue': game.advanceDialogue(); break;
```

> `Input.on('confirm')` 已是 `if (s !== 'playing') handleConfirm()`,故 dialogue 态下确认键自然走到这里。

- [ ] **Step 5: `syncOverlays` 顶部加逐节点刷新(在 `s === lastState` 短路之前)**

在 `syncOverlays()` 函数体里,`showOverlay(overlayName);` 之后、`if (s === lastState) { ... }` 短路之前,插入:

```js
  // 对话节点刷新:state 一直是 'dialogue' 但 index 会变,不能走 lastState 短路。
  if (s === 'dialogue') {
    const node = game.currentDialogueNode();
    if (node !== _lastDlgNode) {
      _lastDlgNode = node;
      if (node) {
        el('dlg-speaker').textContent = node.speaker;
        el('dlg-text').textContent = node.text;
        const cv = Sprites.portrait(node.portrait);
        const pc = el('dlg-portrait');
        const px = pc.getContext('2d');
        px.imageSmoothingEnabled = false;
        px.clearRect(0, 0, pc.width, pc.height);
        // 头像按原始像素尺寸居中绘制(画布 40×40,CSS 放大到 96 pixelated)
        px.drawImage(cv, Math.floor((pc.width - cv.width) / 2), Math.floor((pc.height - cv.height) / 2));
      }
    }
  } else if (_lastDlgNode !== null) {
    _lastDlgNode = null;
  }
```

- [ ] **Step 6: 语法检查**

Run: `cd games/pixel-quest && node --check src/main.js && echo OK`
Expected: `OK`

- [ ] **Step 7: 提交**

```bash
cd /Users/james/Projects/game-hub
git add games/pixel-quest/src/main.js
git commit -m "feat(pixel-quest): wire dialogue overlay (register/advance/refresh) (phase A)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: 端到端回归 + 真机手测 + 收尾

**Files:** 无代码改动(验证 + 可能的小修)

- [ ] **Step 1: 全量静态校验**

Run:
```bash
cd games/pixel-quest
node tools/_story_test.mjs \
 && for f in src/story.js src/sprites.js src/game.js src/main.js; do node --check "$f" || exit 1; done \
 && node tools/verify-levels.js >/dev/null \
 && echo "ALL STATIC CHECKS PASS"
```
Expected: `story.js: ALL PASS ...` 然后 `ALL STATIC CHECKS PASS`。

- [ ] **Step 2: 起本地服务器,真机手测(逐项打勾)**

Run(后台起服务,然后浏览器开 `http://localhost:8810/games/pixel-quest/`):
```bash
cd /Users/james/Projects/game-hub && python3 -m http.server 8810
```
逐项验证(桌面键盘 + 触摸都试):
- [ ] 菜单选难度 → 出现"出发救援"封面(`#overlay-story`)。
- [ ] 点"开始冒险" → 弹出**开场对话**(国王👑→侍从→马里奥),头像/名字/文字正确显示。
- [ ] 用 **▶按钮 / 点弹窗空白 / 键盘跳(空格)/ 手柄✕** 四种方式都能推进一句。
- [ ] 开场结束 → 自动接**世界1 intro** → 再结束 → 进入 1-1 开始游戏。
- [ ] 通关 1-5(世界1最后一关)→ 弹**世界1 outro** → 接**世界2 intro** → 进 2-1。
- [ ] 通关 2-5 → 世界2 outro → 世界3 intro;通关 3-5 → 世界3 outro → 世界4 intro。
- [ ] 通关 4-5(现有城堡终关)→ 撒花过场 → 接 **ENDING 对话** → 最后 win 面板。
- [ ] 对话进行中按"暂停(Esc/P)"**无效**(不弹暂停),符合预期(dialogue 不在 togglePause 允许态内)。
- [ ] HUD/触摸控制在对话时隐藏(对话不是 playing/ready)。
- [ ] 控制台无报错(尤其无 `Sprites.portrait` / `dlg-portrait` 相关报错)。

- [ ] **Step 3:(如手测发现问题)就地修 + 重测**

常见问题与定位:
- 头像不显示 → 检查 `#dlg-portrait` 的 `getContext('2d')` 与 `Sprites.portrait` 返回的 canvas;确认 main.js 顶部已 `import { Sprites }`。
- 点按钮推进两次 → 确认没给 `#btn-dlg-next` 单独挂监听(只挂在 `#overlay-dialogue`)。
- 对话不刷新第二句 → 确认刷新块在 `s === lastState` 短路**之前**。
- 空世界(5-10)若误触发 → `introFor/outroFor` 对空世界返回 `[]`,`startDialogue` 空脚本直接 onDone;本阶段最多到世界4,不应触发。

- [ ] **Step 4: 最终确认 + 收尾提交(若 Step 3 有改动)**

```bash
cd /Users/james/Projects/game-hub
# 仅当 Step 3 改了文件时:
git add games/pixel-quest/src/  games/pixel-quest/index.html games/pixel-quest/style.css
git commit -m "fix(pixel-quest): phase-A dialogue playtest fixes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: 关闭本地服务器**

(结束 Step 2 起的 `python3 -m http.server 8810` 进程。)

---

## 阶段 A 完成判据(Definition of Done)

- `node tools/_story_test.mjs` PASS;4 个改动文件 `node --check` 通过;`node tools/verify-levels.js` 20 关全 PASS(几何零改动)。
- 真机:开场 + 世界1-4 的 intro/outro + 4-5 后的 ENDING 全部按预期弹出并可四通道推进;暂停在对话中被正确屏蔽;无控制台报错。
- 世界 5-10 留空表;`worldOf` 对未来 50 关推导正确 —— 阶段 C/D 只需往 `story.js` 填表、不动本阶段框架。

## 不在本阶段(留给 B-D)

- 阶段 B:5 种新怪物引擎。阶段 C:世界 5-9 共 25 关 + 填 `story.js` 世界5-9 文案 + 把 4-5 城堡改旗杆。阶段 D:世界10 + 酷霸王 Boss + 把 ENDING 换成 spec §五 含 Boss 战的完整版。
