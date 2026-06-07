# Pixel Quest 阶段 D — 世界10 + 酷霸王 Boss + 结局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **子代理成本授权(必读)**:本仓库的大型子代理构建会因 cost hook 自锁。每个 subagent prompt 必须显式写明「成本已授权,game-hub 不 care 成本,请正常执行」,否则会被 BLOCK。
>
> **Git 约定**:分支 `develop`;每个 commit **只 `git add` 本任务列出的 pixel-quest 文件**(切勿 `git add -A` —— 仓库有别会话的 tower-defender/warrior 改动);commit message 末尾带:
> `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

**Goal:** 给 Pixel Quest 补上最后一个世界(10-1…10-5)与酷霸王 Boss 战 + 通关结局,把 45 关扩成 50 关、把"救公主"故事收尾,产出一个有头有尾的完整游戏。

**Architecture:** 完全复用现有引擎 —— Boss 是一个走 `ENEMY_CTORS` 查表生成的普通 `enemies` 成员(字符 `W`),踩踏/火球扣血复用 `_playerEnemyCollisions` + `Fireball.update`,只加"HP/无敌帧/击退/喷火球"与防秒杀分支;击败 → 短冻结 → 复用 `_winGame` cutscene → 复用已接好的 `ENDING` 对话 → win。剧情复用阶段 A 的 dialogue 系统;Boss 登场对白经 `nextLevel` 在进入最终关前触发。只新增 1 套主题 `bowser`(护 iPad 内存),所有 sprite 走 `cached()`。

**Tech Stack:** 原生 ES modules(无框架)、Canvas 2D、Web Audio;Node 用于 `node --check` 与 `tools/verify-levels.js` / `tools/_validate_one.mjs` / `tools/_story_test.mjs` 校验。

**权威设计:** `docs/superpowers/specs/2026-06-07-pixel-quest-10-worlds-design.md`(§一 世界10、§三 Boss 战、§五 文案、§九 评审修订)。

---

## 现状核实(已逐条对代码核实,落地基线)

阶段 A-C 已完成。Phase D 落地前的代码事实(已 grep/读源 + 跑 node 核实):

- **已就位,无需再做**:对话系统(`startDialogue/advanceDialogue/currentDialogueNode`、`dialogue` state、`confirm()` 分支)、main.js 全部对话接线(overlay map / 点击 / handleConfirm / syncOverlays 节点刷新,128×128 `#dlg-portrait`)、`EnemyShot` 类(entities.js)、`this.enemyShots` 容器 + facade `enemyShots`/`spawnEnemyShot` + update() 主循环碰撞(game.js:468-472)、5 种新怪(Flyer/Dasher/Piranha/Spiked/Flamer)、头像 `drawBowserHead()` + `portrait('bowser')`(sprites.js:550/695)、`Sound.stomp()`/`Sound.win()`、render `_enemyShots`(紫色)。`config.js ENEMY` 新怪字段全已追加。
- **当前关卡**:`LEVELS.length === 45`,**全部 45 关以旗子 `F` 结尾,无任何 castle `A`**(已跑 node 确认;源码里 3-5/4-5 "Castle-only" 注释是**陈旧错误**,phase C 已按评审 §E 改回旗杆)。终关 9-5(index 44)旗子 → `nextLevel` → `next>=LEVELS.length` → 直接 `win`(无过场)。
- **需要新增/修改**:见下方任务。

### 三个 spec 未点透、本计划已定方案的真问题(务必照做)

1. **`_checkGoal` 的 castle 分支会让 10-5 提前通关。** `_checkGoal`(game.js:593)对 `lv.castleX` 无条件 `_winGame()`。10-5 含 castle `A`,玩家没打 Boss 走到最右就会提前通关。**修复:给 castle 分支加"场上无存活 `Bowser`"护栏**(Task 4)。
2. **Boss 登场对白(10-5 前)缺触发点。** 10-5 是 index 49(非世界首关),现有 `nextLevel` 只在 `isWorldFirstLevel` 放 intro,不会触发 Boss 登场。**修复:`nextLevel` 的 `afterOutro` 内加 `if (next === LEVELS.length - 1) startDialogue(BOSS_INTRO, …)`**,不硬编码 49(Task 7)。
3. **Boss 受击加分会双计。** spec 的 Fireball 片段单独 `addScore(200)`,而 §B 又要"每次受击 addScore(200)"。**修复:把 `addScore(200)+Sound.stomp()` 收进 `Bowser.hit()` 单一出处**,Fireball 分支与 stomp 分支都不再单独加分(Task 2/4)。

---

## File Structure(本阶段触碰的文件与职责)

| 文件 | 改动 | 职责 |
|---|---|---|
| `src/config.js` | 改 | `THEMES` 追加 1 套 `bowser` 主题(唯一新增主题) |
| `src/entities.js` | 改 | 新增 `Bowser` 类;`Fireball.update` 加 Boss 鸭子类型扣血分支 |
| `src/sprites.js` | 改 | 新增 `drawBowser(frame)` 关内精灵 + `bowser(frame)` 访问器 |
| `src/game.js` | 改 | import `Bowser`/`BOSS_INTRO`;`ENEMY_CTORS` 加 bowser + 改兜底;`bossDefeated` 冻结;星星/Boss 碰撞例外;`_defeatBoss`;`_checkGoal` 护栏;`_winGame` 清 enemyShots;`nextLevel`/`selectLevel` BOSS_INTRO 钩子 |
| `src/render.js` | 改 | import `Bowser`;`_enemies` Boss 分支(精灵+血心+无敌帧闪烁);`_flagAndCastle` 公主笼 |
| `src/levels.js` | 改 | `ENTITY_CHARS` 加 `W`;parseLevel 加 `W` 映射;新增 `WORLD_10`(10-1…10-5)+ `...WORLD_10` 入 LEVELS;头注释 |
| `src/story.js` | 改 | `WORLD_INTRO[10]`、新 export `BOSS_INTRO`、`ENDING` 换完整版、头注释 |
| `index.html` | 改 | "闯过 45 关" → "50 关" |
| `tools/_level_kit.md` | 改 | 放宽 A 规则(仅 10-5)、补 `W` 说明、补世界10配方 |
| `tools/_story_test.mjs` | 改 | world10 intro 断言改为 `>0`;纳入 `BOSS_INTRO` 校验 |
| `tools/verify-levels.js` | **不改** | 逻辑对 `W` 透明、对 `A` 走 castle 目标判定 |
| `src/main.js` | **不改** | 对话接线阶段 A 已完成 |

**执行顺序与依赖**:Task 1→2→3→4→5 是 Boss 引擎(串行 + 逐个 review);Task 6 加关卡(10-5 手写 + 10-1…10-4 占位);Task 7 剧情 + 对话钩子;Task 8 并行作图替换 10-1…10-4;Task 9 收尾文档 + 全量校验 + 真机。`ENEMY_CTORS` 在 Task 4 才认识 `bowser`,故含 `W` 的关卡(Task 6)真机可玩需 Task 2+4 先就绪;但 `verify-levels.js` 只调 `parseLevel`(不实例化 Bowser),Task 6 可独立通过 verify。

---

## Task 1: config.js — 新增 `bowser` 主题(唯一新增主题)

**Files:**
- Modify: `src/config.js`(`THEMES` 对象,结尾 `celestial` 项之后)

- [ ] **Step 1: 在 THEMES 的最后一项 `celestial` 后追加 `bowser`**

把 `src/config.js` 的 `celestial: { ... },`(当前文件第 63 行)这一行之后、`};`(第 64 行)之前,插入一行:

```js
  bowser:     { skyTop:'#1a0508', skyBot:'#3a0a0a', ground:'#4a2a2a', groundDark:'#2a1414', grass:'#7a2020', hills:'#250606' },
```

定位锚点(改动后应是这样):

```js
  celestial:  { skyTop:'#8fd0ff', skyBot:'#fff3cf', ground:'#e8d98f', groundDark:'#bfa85f', grass:'#ffe9a0', hills:'#cfe6ff' },
  bowser:     { skyTop:'#1a0508', skyBot:'#3a0a0a', ground:'#4a2a2a', groundDark:'#2a1414', grass:'#7a2020', hills:'#250606' },
};
```

- [ ] **Step 2: 语法检查**

Run: `node --check src/config.js`
Expected: 无输出(exit 0)

- [ ] **Step 3: 确认主题数 = 21(20 旧 + 1 新)**

Run: `node -e "import('./src/config.js').then(m=>console.log('themes=', Object.keys(m.THEMES).length, 'has bowser=', !!m.THEMES.bowser))"`
Expected: `themes= 21 has bowser= true`

> 不在此任务单独 commit;与 Task 2 合并提交(见 Task 2 Step 末)。

---

## Task 2: entities.js — `Bowser` 类 + `Fireball.update` Boss 扣血

**Files:**
- Modify: `src/entities.js`(在 `Flamer` 类之后、`MovingPlatform` 类之前新增 `Bowser`;并改 `Fireball.update`)

**关键设计(防秒杀 + 单一加分出处):**
- `hit(world, fromDir)`:`invuln>0` 或已 `defeated` → 直接 `return false`(不扣血、不加分、不响声);否则扣 1 血、`invuln=0.9`、击退、`addScore(200)`、`Sound.stomp()`;血空 → `state='defeated'` 并 `return true`。**加分与音效只在 `hit()` 里**,踩踏/火球两个调用方都不再单独 addScore。
- Boss 走 `collideTiles`(默认施加 `GRAVITY`,已核实 physics.js:24/28),所以 `update` 只设 `vx`/跳跃 `vy` 冲量,重力/落地/撞墙自动处理。

- [ ] **Step 1: 新增 `Bowser` 类(放在 `Flamer` 类结束的 `}` 之后、`// ----` 分隔线与 `export class MovingPlatform` 之前)**

```js
// ---------------------------------------------------------------------------
// 酷霸王 Bowser(字符 'W',仅 10-5)。HP=5,踩一脚/玩家火球/星星接触各扣 1(受 0.9s
// 无敌帧限频防秒杀)。朝玩家慢走 + 定时跳 + 定时喷敌方火球(EnemyShot)。血空 → state
// 'defeated'(倒地)→ game._defeatBoss → _winGame → ENDING。加分/音效集中在 hit()。
export class Bowser {
  constructor(x, y) {
    this.w = 54; this.h = 58;
    this.x = x + (TILE - this.w) / 2;   // 宽于一格,居中到出生列(会左探出,正常)
    this.y = y + (TILE - this.h);       // 脚底贴出生格底部
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.hp = 5;
    this.invuln = 0;                     // 受击后短无敌(限频)
    this.state = 'walk';                 // 'walk' | 'defeated'
    this.faceRight = false;
    this.throwTimer = 1.4;               // 首发稍慢,给玩家进场时间
    this.jumpTimer = 2.0;
    this.defeatT = 0;
    this.anim = 0;
  }
  update(dt, world) {
    this.anim += dt * 4;
    if (this.invuln > 0) this.invuln -= dt;
    const p = world.player;

    if (this.state === 'defeated') {     // 倒地:只受重力,累计倒地计时(game 冻结期间不调本函数)
      this.vx = 0;
      this.defeatT += dt;
      collideTiles(this, world.grid, dt);
      return;
    }

    // 朝玩家慢走
    if (p) this.faceRight = (p.x + p.w / 2) >= (this.x + this.w / 2);
    const dir = this.faceRight ? 1 : -1;
    this.vx = dir * 70 * world.mode.enemyMul;

    // 定时跳(站地时)
    this.jumpTimer -= dt;
    if (this.onGround && this.jumpTimer <= 0) {
      this.vy = -620;
      this.jumpTimer = 2.4 + Math.random() * 1.2;
      world.sound.jump();
    }

    // 定时喷敌方火球(EnemyShot;玩家碰撞由 game.update 主循环统一处理)
    this.throwTimer -= dt;
    if (this.throwTimer <= 0) {
      this.throwTimer = 1.8;
      const sx = this.x + (dir > 0 ? this.w : -14);
      const sy = this.y + this.h * 0.25;
      world.spawnEnemyShot(sx, sy, 200 * dir, -150);
      world.sound.fireball();
    }

    collideTiles(this, world.grid, dt);  // 重力/落地/撞墙(撞墙下一帧靠朝向自然折返)
  }
  frame() { return Math.floor(this.anim) % 2; }
  // 受击:扣血 + 限频无敌 + 击退;加分/音效在此(单一出处)。血空返回 true。
  hit(world, fromDir) {
    if (this.invuln > 0 || this.state === 'defeated') return false;
    this.hp -= 1;
    this.invuln = 0.9;
    this.vx = fromDir * 120;
    this.vy = -200;
    world.sound.stomp();
    world.addScore(200);
    if (this.hp <= 0) { this.state = 'defeated'; this.vy = -260; return true; }
    return false;
  }
}
```

- [ ] **Step 2: 改 `Fireball.update` —— 加 Boss 鸭子类型扣血分支(放在敌人循环里,`if (e instanceof Koopa)` 之前)**

当前(entities.js:361-370):

```js
    // hit enemies
    for (const e of world.enemies) {
      if (e.dead) continue;
      if (aabb(this, e)) {
        if (e instanceof Koopa) e.dead = true;
        else if (e.kill) e.kill(world);
        world.addScore(200);
        this.dead = true;
        return;
      }
    }
```

改为(新增鸭子类型分支;**Boss 分支不单独 addScore**,加分在 `hit()` 内):

```js
    // hit enemies
    for (const e of world.enemies) {
      if (e.dead) continue;
      if (aabb(this, e)) {
        // Boss:鸭子类型判定(规避同模块类声明顺序);扣血/加分/音效在 e.hit() 内。
        if (typeof e.hit === 'function' && e.hp !== undefined) {
          e.hit(world, this.vx >= 0 ? 1 : -1);
          this.dead = true;
          return;
        }
        if (e instanceof Koopa) e.dead = true;
        else if (e.kill) e.kill(world);
        world.addScore(200);
        this.dead = true;
        return;
      }
    }
```

> 注:Koopa/Flamer 等没有 `hp` 字段,鸭子类型 `e.hp !== undefined` 只命中 Bowser,不误伤普通怪。

- [ ] **Step 3: 语法检查**

Run: `node --check src/entities.js`
Expected: 无输出(exit 0)

- [ ] **Step 4: 冒烟测试 Bowser 类基本不变量(无 DOM 依赖)**

Run:
```bash
node --input-type=module -e "
import { Bowser } from './src/entities.js';
const sounds = []; const world = { player:{x:200,y:288,w:22,h:28}, mode:{enemyMul:1}, grid:[], sound:new Proxy({},{get:()=>()=>sounds.push(1)}), enemyShots:[], spawnEnemyShot(){}, addScore(){} };
const b = new Bowser(22*32, 9*32);
console.assert(b.hp===5 && b.w===54 && b.h===58, 'init');
// 受击扣血 + 无敌帧限频:连扣两次,第二次应被无敌帧挡住
const d1 = b.hit(world, 1); console.assert(d1===false && b.hp===4 && b.invuln>0, 'hit1 hp4');
const d2 = b.hit(world, 1); console.assert(d2===false && b.hp===4, 'invuln blocks');
b.invuln = 0; b.hit(world,1); b.invuln=0; b.hit(world,1); b.invuln=0; b.hit(world,1); b.invuln=0; // 共 5 次落地命中 → hp 5→0
const dead = b.hit(world,1); console.assert(dead===true && b.hp<=0 && b.state==='defeated', 'defeat at 0 hp');
console.log('Bowser unit OK');
"
```
Expected: `Bowser unit OK`(无 assert 报错)

- [ ] **Step 5: Commit(config 主题 + Boss 实体引擎)**

```bash
git add src/config.js src/entities.js
git commit -m "feat(pixel-quest): 阶段D · bowser 主题 + Bowser 实体(HP/无敌帧/喷火球)+ Fireball 扣血

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: sprites.js — `drawBowser(frame)` 关内精灵 + 访问器

**Files:**
- Modify: `src/sprites.js`(新增 `drawBowser`,放在 `drawBowserHead` 之后即可;并在 `Sprites` 对象里加 `bowser()` 访问器,放 `flamer()` 之后)

> 约定:关内怪走小画布 + render 按 `e.w/cv.width` 放大。Bowser `e.w=54`,本精灵画布 `mk(44,48)`,render 缩放 ≈1.23。配色对齐 `drawBowserHead`(身 `#6abf45`、鬃 `#e87a1a`、角 `#f4f0e0`、壳 `#c75e0e`)。两帧用腿位区分。

- [ ] **Step 1: 新增 `drawBowser(frame)` 函数(放在 `drawBowserHead` 的 `}` 之后)**

```js
// 关内酷霸王:绿身 + 橙鬃 + 双角 + 棘壳;frame 切换双腿。画布 44×48(render 放大到 e.w）。
function drawBowser(frame) {
  const o = mk(44, 48), x = o.cx;
  const step = frame ? 2 : -2;
  // 腿
  x.fillStyle = '#4f9636';
  r(x, 13 + step, 40, 7, 7); r(x, 24 - step, 40, 7, 7);
  x.fillStyle = '#e8cf86'; r(x, 13 + step, 45, 7, 2); r(x, 24 - step, 45, 7, 2); // 爪
  // 壳(背)
  x.fillStyle = '#7a3b16'; E(x, 22, 30, 15, 13);
  x.fillStyle = '#c75e0e'; E(x, 22, 30, 12, 10);
  x.fillStyle = '#e8cf86'; E(x, 22, 31, 8, 7);
  x.fillStyle = '#7a3b16';                 // 壳棘
  [10, 22, 34].forEach((cx) => { x.beginPath(); x.moveTo(cx - 3, 20); x.lineTo(cx, 13); x.lineTo(cx + 3, 20); x.closePath(); x.fill(); });
  // 身/肚
  x.fillStyle = '#6abf45'; E(x, 22, 28, 11, 10);
  x.fillStyle = '#e8cf86'; E(x, 22, 31, 7, 6);
  // 手臂
  x.fillStyle = '#6abf45'; E(x, 8, 28, 3.5, 5); E(x, 36, 28, 3.5, 5);
  // 鬃毛
  x.fillStyle = '#e87a1a';
  [13, 18, 22, 26, 31].forEach((cx, i) => E(x, cx, 12 - (i === 2 ? 2 : 0), 3, 3));
  // 角
  x.fillStyle = '#f4f0e0';
  x.beginPath(); x.moveTo(12, 12); x.lineTo(14, 4); x.lineTo(17, 12); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(32, 12); x.lineTo(30, 4); x.lineTo(27, 12); x.closePath(); x.fill();
  // 头
  x.fillStyle = '#6abf45'; E(x, 22, 16, 9, 8);
  x.fillStyle = '#5aa83f'; E(x, 22, 19, 7.5, 4.5);
  // 眼
  x.fillStyle = '#fff'; E(x, 18.5, 15, 2, 2.3); E(x, 25.5, 15, 2, 2.3);
  x.fillStyle = '#1b1e26'; E(x, 18.8, 15.3, 0.9, 1.3); E(x, 25.2, 15.3, 0.9, 1.3);
  // 眉(凶萌)
  x.fillStyle = '#3f7a2c'; r(x, 15.5, 12.5, 4, 1.4); r(x, 24.5, 12.5, 4, 1.4);
  // 嘴 + 獠牙
  x.fillStyle = '#7a3b16'; x.beginPath(); x.ellipse(22, 20, 5, 1.8, 0, 0, Math.PI); x.fill();
  x.fillStyle = '#fff';
  x.beginPath(); x.moveTo(18.5, 19.6); x.lineTo(19.7, 19.6); x.lineTo(19, 22); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(25.5, 19.6); x.lineTo(24.3, 19.6); x.lineTo(25, 22); x.closePath(); x.fill();
  return o;
}
```

- [ ] **Step 2: 在 `Sprites` 对象里加 `bowser()` 访问器(放 `flamer(frame){...},` 之后)**

```js
  bowser(frame) {
    return cached(`bowser:${frame & 1}`, () => drawBowser(frame & 1)).cv;
  },
```

- [ ] **Step 3: 语法检查**

Run: `node --check src/sprites.js`
Expected: 无输出(exit 0)

> sprites.js 依赖 DOM(`document.createElement`),无法用 node 实例化测试;以 `node --check` + Task 9 真机验收。本任务与 Task 5(render)合并提交(见 Task 5)。

---

## Task 4: game.js — Bowser 战斗集成(import / 查表 / 冻结 / 碰撞 / 击败 / 护栏)

**Files:**
- Modify: `src/game.js`

> 本任务是 Boss 引擎核心,串行实现并 review。**先不接 Boss 登场对白与 ENDING 内容**(Task 7);本任务做完后,Boss 在 10-5 已可被打、扣血、防秒杀、击败 → cutscene → (占位)ENDING → win。

- [ ] **Step 1: import 追加 `Bowser`(entities import 块)**

当前(game.js:16-18):

```js
import {
  Player, Goomba, Koopa, Coin, Powerup, Fireball, MovingPlatform,
  Flyer, Dasher, Piranha, Spiked, Flamer, EnemyShot,
} from './entities.js';
```

改为(行尾加 `Bowser`):

```js
import {
  Player, Goomba, Koopa, Coin, Powerup, Fireball, MovingPlatform,
  Flyer, Dasher, Piranha, Spiked, Flamer, EnemyShot, Bowser,
} from './entities.js';
```

- [ ] **Step 2: `ENEMY_CTORS` 加 bowser,并把 `_spawnEntities` 的 throw 改回 `|| Goomba` 兜底(评审 §F:上线兜底)**

当前(game.js:26-29):

```js
const ENEMY_CTORS = {
  goomba: Goomba, koopa: Koopa,
  flyer: Flyer, dasher: Dasher, piranha: Piranha, spiked: Spiked, flamer: Flamer,
};
```

改为:

```js
const ENEMY_CTORS = {
  goomba: Goomba, koopa: Koopa,
  flyer: Flyer, dasher: Dasher, piranha: Piranha, spiked: Spiked, flamer: Flamer,
  bowser: Bowser,
};
```

当前(game.js:191-195):

```js
      this.enemies = lv.enemies.map((e) => {
        const C = ENEMY_CTORS[e.type];
        if (!C) throw new Error('Unknown enemy type: ' + e.type);
        return new C(e.x, e.y);
      });
```

改为(上线兜底,未知类型退化为 Goomba 而非崩溃):

```js
      this.enemies = lv.enemies.map((e) => {
        const C = ENEMY_CTORS[e.type] || Goomba;
        return new C(e.x, e.y);
      });
```

- [ ] **Step 3: constructor 加 Boss 冻结字段(放在 `this.dialogue = null;` 之后,game.js:62 附近)**

```js
    this.bossDefeated = false;   // 击败 Boss 后的短冻结标记
    this.bossDefeatTimer = 0;
```

- [ ] **Step 4: update() playing 段开头加 Boss 击败冻结(放在 `if (this.state !== 'playing') return;` 之后、`const lv = this.level;` 之前,game.js:399 附近)**

当前(game.js:398-402):

```js
    if (this.state === 'ending') { this._updateEnding(dt); return; }
    if (this.state !== 'playing') return;

    // Fire action consumed via Input subscription in main.js -> game.tryFire()
    const lv = this.level;
```

改为(插入冻结块):

```js
    if (this.state === 'ending') { this._updateEnding(dt); return; }
    if (this.state !== 'playing') return;

    // Boss 击败:短冻结(Boss 倒地定格)→ 复用 _winGame cutscene。
    if (this.bossDefeated) {
      this.bossDefeatTimer -= dt;
      if (this.bossDefeatTimer <= 0) { this.bossDefeated = false; this._winGame(); }
      this._updateCamera();
      return;
    }

    // Fire action consumed via Input subscription in main.js -> game.tryFire()
    const lv = this.level;
```

- [ ] **Step 5: 星星 instakill 分支加 Boss 例外(`_playerEnemyCollisions` 顶部,game.js:498-503)**

当前:

```js
      // Star: instakill on touch
      if (p.star > 0) {
        if (e instanceof Piranha && e.hittable === false) continue; // hidden 食人花不被星星误杀
        if (e instanceof Koopa) e.dead = true; else if (e.kill) e.kill(this._world);
        this.score += SCORE.stomp;
        continue;
      }
```

改为(Boss 走 `hit()` 限频扣血,不被星星瞬杀):

```js
      // Star: instakill on touch
      if (p.star > 0) {
        if (e instanceof Bowser) { const dead = e.hit(this._world, p.faceRight ? 1 : -1); if (dead) this._defeatBoss(e); continue; }
        if (e instanceof Piranha && e.hittable === false) continue; // hidden 食人花不被星星误杀
        if (e instanceof Koopa) e.dead = true; else if (e.kill) e.kill(this._world);
        this.score += SCORE.stomp;
        continue;
      }
```

- [ ] **Step 6: `_playerEnemyCollisions` 加 Bowser 分支(放在 `Flamer` 分支 `}` 之后、循环结束 `}` 之前,game.js:573 附近)**

当前结尾(game.js:564-574):

```js
      } else if (e instanceof Flamer) {
        if (e.squish > 0) continue;
        if (stomping) {
          e.stomp(this._world);
          p.vy = -440;
          this.score += SCORE.stomp;
        } else {
          this._hurtPlayer();
        }
      }
    }
  }
```

改为(追加 Bowser 分支;**踩/碰都不单独 addScore,加分在 hit() 内**;invuln 期不互伤防连击):

```js
      } else if (e instanceof Flamer) {
        if (e.squish > 0) continue;
        if (stomping) {
          e.stomp(this._world);
          p.vy = -440;
          this.score += SCORE.stomp;
        } else {
          this._hurtPlayer();
        }
      } else if (e instanceof Bowser) {
        if (e.state === 'defeated') continue;
        if (e.invuln > 0) continue;            // 击退无敌期:不互伤(防瞬间连击/秒杀)
        if (stomping) {
          const dead = e.hit(this._world, p.faceRight ? 1 : -1);
          p.vy = -440;
          if (dead) this._defeatBoss(e);
        } else {
          this._hurtPlayer();
        }
      }
    }
  }
```

- [ ] **Step 7: 新增 `_defeatBoss(boss)` 方法(放在 `_winGame()` 之前,game.js:612 附近)**

```js
  // Boss 血空:进入短冻结,Boss 倒地定格;冻结结束后 update() 调 _winGame → cutscene。
  _defeatBoss(boss) {
    this.bossDefeated = true;
    this.bossDefeatTimer = 1.4;
    Sound.win();
  }
```

- [ ] **Step 8: `_winGame()` 顺手清 `enemyShots`(避免 cutscene 期残留冻结火球),game.js:624 附近**

当前(game.js:624):

```js
    this.enemies = []; // clear the stage for a clean celebration
```

改为:

```js
    this.enemies = []; // clear the stage for a clean celebration
    this.enemyShots = []; // 清掉残留敌方火球,cutscene 干净
```

- [ ] **Step 9: `_checkGoal` 的 castle 分支加"无存活 Bowser"护栏(防 10-5 提前通关),game.js:593-595**

当前:

```js
    if (lv.castleX != null && p.x + p.w > lv.castleX + 10) {
      this._winGame();
    }
```

改为:

```js
    if (lv.castleX != null && p.x + p.w > lv.castleX + 10) {
      // 10-5:Boss 未败前走到城堡不算通关(通关由 _defeatBoss 触发);其余城堡关正常。
      if (!this.enemies.some((e) => e instanceof Bowser)) this._winGame();
    }
```

- [ ] **Step 10: 语法检查 + 全量回归 verify(关卡几何未动,应仍全 45 PASS)**

Run: `node --check src/game.js && node tools/verify-levels.js | tail -3`
Expected: `node --check` 无输出;verify 末尾不含 `FAIL`,最后一行附近显示全 PASS(此时仍 45 关)。

- [ ] **Step 11: Commit(Boss 战斗集成)**

```bash
git add src/game.js
git commit -m "feat(pixel-quest): 阶段D · game Boss 集成(查表/冻结/踩+火球+星星扣血/防秒杀/城堡护栏)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: render.js — Boss 精灵 + HP 血心 + 无敌帧闪烁 + 公主笼

**Files:**
- Modify: `src/render.js`

- [ ] **Step 1: import 追加 `Bowser`(render.js:7)**

当前:

```js
import { Goomba, Koopa, Flyer, Dasher, Piranha, Spiked, Flamer } from './entities.js';
```

改为:

```js
import { Goomba, Koopa, Flyer, Dasher, Piranha, Spiked, Flamer, Bowser } from './entities.js';
```

- [ ] **Step 2: `_enemies` 加 Bowser 分支(放在 `Flamer` 分支之后、`if (cv) {` 之前,render.js:289 附近)**

当前(render.js:279-294):

```js
      } else if (e instanceof Flamer) {
        if (e.squish > 0) {
          cv = Sprites.flamer(0);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cv, Math.round(e.x), Math.round(e.y + e.h * 0.6), e.w, e.h * 0.4);
          ctx.restore();
          continue;
        }
        cv = Sprites.flamer(e.frame());
      }
      if (cv) {
        const sc = e.w / cv.width;
        Sprites.blit(ctx, cv, e.x, e.y + e.h - cv.height * sc, sc);
      }
```

改为(追加 Bowser 分支;自带 blit + 闪烁 + 血心,然后 `continue`):

```js
      } else if (e instanceof Flamer) {
        if (e.squish > 0) {
          cv = Sprites.flamer(0);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cv, Math.round(e.x), Math.round(e.y + e.h * 0.6), e.w, e.h * 0.4);
          ctx.restore();
          continue;
        }
        cv = Sprites.flamer(e.frame());
      } else if (e instanceof Bowser) {
        const bcv = Sprites.bowser(e.frame());
        const sc = e.w / bcv.width;
        ctx.save();
        // 受击无敌帧闪烁;倒地半透明
        if (e.state === 'defeated') ctx.globalAlpha = 0.55;
        else if (e.invuln > 0 && Math.floor(e.invuln * 16) % 2 === 0) ctx.globalAlpha = 0.4;
        Sprites.blit(ctx, bcv, e.x, e.y + e.h - bcv.height * sc, sc);
        ctx.restore();
        // HP 血心(头顶):满心 ❤️ / 空心 🖤
        if (e.state !== 'defeated') {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '14px "Apple Color Emoji","Segoe UI Emoji",serif';
          const total = 5;
          for (let i = 0; i < total; i++) {
            ctx.fillText(i < e.hp ? '❤️' : '🖤',
              e.x + e.w / 2 + (i - (total - 1) / 2) * 16, e.y - 10);
          }
          ctx.restore();
        }
        continue;
      }
      if (cv) {
        const sc = e.w / cv.width;
        Sprites.blit(ctx, cv, e.x, e.y + e.h - cv.height * sc, sc);
      }
```

- [ ] **Step 3: `_flagAndCastle` 加公主笼(bowser 主题 + Boss 未败时画铁栏;笼开则不画),render.js:204-212**

当前 castle 分支:

```js
    if (lv.castleX != null) {
      const cv = Sprites.castle();
      const bottom = lv.height - 2 * TILE;
      Sprites.blitBottom(ctx, cv, lv.castleX + TILE, bottom, SC);
      // princess waiting near the castle door (stand on the floor top, not the
      // castle's sunken base, so she lines up with the hero in the ending scene)
      const pri = Sprites.princess();
      Sprites.blitBottom(ctx, pri, lv.castleX + TILE, lv.height - 4 * TILE, SC * 0.7);
    }
```

改为(末尾追加铁笼绘制):

```js
    if (lv.castleX != null) {
      const cv = Sprites.castle();
      const bottom = lv.height - 2 * TILE;
      Sprites.blitBottom(ctx, cv, lv.castleX + TILE, bottom, SC);
      // princess waiting near the castle door (stand on the floor top, not the
      // castle's sunken base, so she lines up with the hero in the ending scene)
      const pri = Sprites.princess();
      Sprites.blitBottom(ctx, pri, lv.castleX + TILE, lv.height - 4 * TILE, SC * 0.7);
      // 公主笼:bowser 魔城且 Boss 未败时画竖铁栏;击败/ending/win 时笼开(不画)。
      if (game.level.theme === 'bowser' && !game.bossDefeated
          && game.state !== 'ending' && game.state !== 'win') {
        const cx = lv.castleX + TILE;          // 公主中心 x
        const top = lv.height - 5 * TILE;
        const cageL = cx - 22, cageR = cx + 22;
        ctx.save();
        ctx.strokeStyle = '#b8c2cf';
        ctx.lineWidth = 2;
        for (let bx = cageL; bx <= cageR; bx += 11) {
          ctx.beginPath(); ctx.moveTo(bx, top); ctx.lineTo(bx, bottom); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(cageL, top); ctx.lineTo(cageR, top); ctx.stroke();         // 顶横梁
        ctx.beginPath(); ctx.moveTo(cageL, (top + bottom) / 2); ctx.lineTo(cageR, (top + bottom) / 2); ctx.stroke(); // 中横梁
        ctx.restore();
      }
    }
```

- [ ] **Step 4: 语法检查**

Run: `node --check src/render.js`
Expected: 无输出(exit 0)

- [ ] **Step 5: Commit(Boss + 笼 视觉,含 Task 3 的 sprites)**

```bash
git add src/sprites.js src/render.js
git commit -m "feat(pixel-quest): 阶段D · Boss 关内精灵 + HP 血心 + 无敌帧闪烁 + 公主铁笼

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: levels.js — `W` 解析 + WORLD_10(手写 10-5 + 占位 10-1…10-4)

**Files:**
- Modify: `src/levels.js`

> 本任务先让 50 关结构成立、10-5 Boss 竞技场可玩、verify 全 50 PASS。10-1…10-4 先放**临时简单占位关**(走路可通关、旗子结尾、含世界10怪混合),Task 8 再用并行 agent 作图替换。

- [ ] **Step 1: `ENTITY_CHARS` 加 `W`(levels.js:12)**

当前:

```js
const ENTITY_CHARS = new Set(['@', 'c', 'g', 'k', 'o', 'v', 'z', 'p', 'a', 'm']);
```

改为:

```js
const ENTITY_CHARS = new Set(['@', 'c', 'g', 'k', 'o', 'v', 'z', 'p', 'a', 'm', 'W']);
```

- [ ] **Step 2: parseLevel 加 `W` → bowser 映射(放在 `else if (ch === 'm') ...` 之后、`else if (ch === 'c')` 之前,levels.js:1053-1055)**

当前:

```js
        } else if (ch === 'm') {
          enemies.push({ type: 'flamer', x: px, y: py });
        } else if (ch === 'c') {
```

改为:

```js
        } else if (ch === 'm') {
          enemies.push({ type: 'flamer', x: px, y: py });
        } else if (ch === 'W') {
          enemies.push({ type: 'bowser', x: px, y: py });
        } else if (ch === 'c') {
```

- [ ] **Step 3: 头注释更新(levels.js:4)**

当前:

```js
//   'v' flyer, 'z' dasher, 'p' piranha, 'a' spiked, 'm' flamer (阶段 B 新怪;'W' bowser 阶段 D).
```

改为:

```js
//   'v' flyer, 'z' dasher, 'p' piranha, 'a' spiked, 'm' flamer, 'W' bowser(仅 10-5 Boss).
```

- [ ] **Step 4: 生成手写 Boss 竞技场 10-5(用 gen 脚本保证行宽一致)**

Run(打印 10-5 关卡对象):
```bash
node -e "
const COLS=34, ROWS=14;
const g=Array.from({length:ROWS},()=>Array(COLS).fill(' '));
const span=(r,c0,c1,ch)=>{for(let c=c0;c<=c1;c++)g[r][c]=ch;};
const set=(r,c,ch)=>{g[r][c]=ch;};
span(0,0,COLS-1,'X');                       // 天花板
for(let r=1;r<=13;r++){set(r,0,'X');set(r,COLS-1,'X');} // 侧墙
for(let r=10;r<=13;r++) span(r,1,COLS-2,'#');           // 满铺地面(无坑)
span(7,6,8,'='); span(7,23,25,'=');         // 两处借力台(靠两侧)
set(9,3,'@');                               // 玩家(左)
set(9,19,'W');                              // 酷霸王(中右)
set(9,30,'A');                              // 城堡/公主(右)
const rows=g.map(r=>r.join(''));
console.log(JSON.stringify({id:'10-5',name:'酷霸王魔城',theme:'bowser',time:300,rows},null,0));
" > /tmp/pq-10-5.json && cat /tmp/pq-10-5.json
```
Expected: 打印一行 JSON,`rows` 为 14 个等长(34 字符)字符串。

- [ ] **Step 5: 校验 10-5 单关 PASS**

把上一步 JSON 转成临时校验文件并跑 `_validate_one.mjs`:
```bash
node -e "const j=require('/tmp/pq-10-5.json'); require('fs').writeFileSync('/tmp/level-10-5.mjs','export default '+JSON.stringify(j)+';')" \
  && node tools/_validate_one.mjs /tmp/level-10-5.mjs
```
Expected: 末行 `PASS`,且报告 `castle=Y flag=- checkpoint=-`。

- [ ] **Step 6: 新增 `WORLD_10` 数组(放在 `WORLD_5_9` 定义之后、`export const LEVELS` 之前,levels.js:1008 附近)**

加入如下数组。`10-5` 的 `rows` 用 Step 4 脚本输出的精确字符串(把 `<<10-5 rows>>` 替换为脚本打印的 `rows` 数组);`10-1…10-4` 先用占位(走路可通关、世界10怪混合、旗子结尾,均 34 行宽以内,Task 8 替换):

```js
// ---------------------------------------------------------------------------
// 世界 10 酷霸王魔城。10-1…10-4 通往魔城的混合普通关(炎魔 m / 甲壳 a / 冲刺 z / g / k,
// 旗子结尾);10-5 为 Boss 竞技场(手写:满铺地面无坑 + 天花板/侧墙 + 借力台 + 城堡A + Boss W,
// time 300,无 flag、无 checkpoint)。主题统一 bowser。
const WORLD_10 = [
  // 10-1 …(占位:Task 8 由并行 agent 按 _level_kit.md 替换为正式关)
  {
    id: '10-1', name: '魔城外墙', theme: 'bowser', time: 360,
    rows: [
      '                                                                                                                            ',
      '                                                                                                                            ',
      '                                                                                                                            ',
      '                                                                                                                            ',
      '                                                                                                                            ',
      '                              ?   ?                                              M                                          ',
      '                                                                                                                            ',
      '              o o                          o o o                       o o                       o o                        ',
      '                                                                                                            F               ',
      '    @     g        k          a            z          g      c       k        a          g     k                           ',
      '################   ##########   ###########   ##########   ##########   ##########   ##########   ###########################',
      '################   ##########   ###########   ##########   ##########   ##########   ##########   ###########################',
      '################   ##########   ###########   ##########   ##########   ##########   ##########   ###########################',
      '################   ##########   ###########   ##########   ##########   ##########   ##########   ###########################',
    ],
  },
  // 10-2 占位
  {
    id: '10-2', name: '魔城回廊', theme: 'bowser', time: 360,
    rows: [
      '                                                                                                                            ',
      '                                                                                                                            ',
      '                                                                                                                            ',
      '                                                                                                                            ',
      '                                                                                                                            ',
      '                    ?  ?                              *                          ?  ?                                       ',
      '                                                                                                                            ',
      '            o o            o o o                 o o            o o o                    o o                                ',
      '                                                                                                            F               ',
      '    @    k      g      z         m          a        c     g      k        z       g       a      m                        ',
      '###############   ##########   ##########   ##########   ##########   ##########   ##########   #############################',
      '###############   ##########   ##########   ##########   ##########   ##########   ##########   #############################',
      '###############   ##########   ##########   ##########   ##########   ##########   ##########   #############################',
      '###############   ##########   ##########   ##########   ##########   ##########   ##########   #############################',
    ],
  },
  // 10-3 占位
  {
    id: '10-3', name: '魔城内殿', theme: 'bowser', time: 370,
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X                                                                                                                          X',
      'X                                                                                                                          X',
      'X                                                                                                                          X',
      'X                                                                                                                          X',
      'X            ?   ?                            M                          ?   ?                                             X',
      'X                                                                                                                          X',
      'X         o o            o o o                       o o o                       o o                                       X',
      'X                                                                                                              F           X',
      'X   @   m      a       k        z       g       a        c      m       k        z       a       g                        X',
      'X##########   ##########   ##########   ##########   ##########   ##########   ##########   ##########   ##############XXXXX',
      'X##########   ##########   ##########   ##########   ##########   ##########   ##########   ##########   ##############XXXXX',
      'X##########   ##########   ##########   ##########   ##########   ##########   ##########   ##########   ##############XXXXX',
      'X##########   ##########   ##########   ##########   ##########   ##########   ##########   ##########   ##############XXXXX',
    ],
  },
  // 10-4 占位
  {
    id: '10-4', name: '魔城天梯', theme: 'bowser', time: 380,
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X                                                                                                                          X',
      'X                                                                                                                          X',
      'X                                                                                                                          X',
      'X                                                                                                                          X',
      'X          ?  ?                         *                              ?  ?                       M                        X',
      'X                                                                                                                          X',
      'X       o o          o o o                     o o o                       o o          o o o                              X',
      'X                                                                                                            F             X',
      'X   @  a    m     z      g      k      a       z      c     m      a      k      z      g      a     m                     X',
      'X#########   ##########   ##########   ##########   ##########   ##########   ##########   ##########   ###############XXXXX',
      'X#########   ##########   ##########   ##########   ##########   ##########   ##########   ##########   ###############XXXXX',
      'X#########   ##########   ##########   ##########   ##########   ##########   ##########   ##########   ###############XXXXX',
      'X#########   ##########   ##########   ##########   ##########   ##########   ##########   ##########   ###############XXXXX',
    ],
  },
  // 10-5 Boss 竞技场(手写;rows 用 Step 4 gen 脚本输出替换)
  {
    id: '10-5', name: '酷霸王魔城', theme: 'bowser', time: 300,
    rows: <<10-5 rows>>,
  },
];
```

> **重要**:把 `<<10-5 rows>>` 替换为 Step 4 脚本打印 JSON 里的 `rows` 字段(14 个 34 字符串的数组)。占位 10-1…10-4 的行如有 verify 报错(坑过宽/步过高),按 `_validate_one.mjs` 提示就地收窄空缺到 ≤3 格;它们是临时关,Task 8 会整关替换。

- [ ] **Step 7: `LEVELS` 追加 `...WORLD_10`(levels.js:1003-1008)**

当前:

```js
export const LEVELS = [
  lvl1, lvl2, lvl3, lvlLava, lvlSnow, lvlDesert, lvlForest, lvlBeach, lvlNight, lvl4,
  lvlSwamp, lvlCrystal, lvlStorm, lvlSteel, lvlAbyss,
  lvlSakura, lvlTemple, lvlMushroom, lvlCosmic, lvlCelestial,
  ...WORLD_5_9,
];
```

改为:

```js
export const LEVELS = [
  lvl1, lvl2, lvl3, lvlLava, lvlSnow, lvlDesert, lvlForest, lvlBeach, lvlNight, lvl4,
  lvlSwamp, lvlCrystal, lvlStorm, lvlSteel, lvlAbyss,
  lvlSakura, lvlTemple, lvlMushroom, lvlCosmic, lvlCelestial,
  ...WORLD_5_9,
  ...WORLD_10,
];
```

- [ ] **Step 8: 语法检查 + 全量 verify(50 关全 PASS)+ 关数/索引断言**

Run:
```bash
node --check src/levels.js && node tools/verify-levels.js | tail -8
node -e "import('./src/levels.js').then(({LEVELS,parseLevel})=>{ \
  console.log('count=',LEVELS.length); \
  const b=parseLevel(LEVELS[49]); \
  console.log('10-5 id=',LEVELS[49].id,'castle=',b.castleX!=null,'flag=',b.flagX!=null,'bowser=',b.enemies.filter(e=>e.type==='bowser').length); \
})"
```
Expected:
- verify 末尾全 `PASS`(无 `FAIL`),包含 `PASS 10-1`…`PASS 10-5`。
- `count= 50`
- `10-5 id= 10-5 castle= true flag= false bowser= 1`

- [ ] **Step 9: Commit(世界10 关卡结构 + Boss 竞技场)**

```bash
git add src/levels.js
git commit -m "feat(pixel-quest): 阶段D · W 解析 + 世界10 五关(10-5 Boss 竞技场 + 10-1..10-4 占位)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: story.js — 世界10 intro + BOSS_INTRO + 完整 ENDING;game.js Boss 登场钩子

**Files:**
- Modify: `src/story.js`、`src/game.js`

- [ ] **Step 1: `WORLD_INTRO` 加 world 10(在 `9: [...]` 项之后、`};` 之前,story.js:62)**

```js
  10: [
    { speaker: '侍从', portrait: 'herald', text: '到了……这就是酷霸王魔城,又黑又大。' },
    { speaker: '马里奥', portrait: 'mario', text: '桃花公主,我来救你啦!' },
    { speaker: '酷霸王', portrait: 'bowser', text: '哈哈哈!又来一个小不点!' },
    { speaker: '酷霸王', portrait: 'bowser', text: '公主是我的!想救她,先过我这一关!' },
    { speaker: '马里奥', portrait: 'mario', text: '哼,等我打败你,就带公主回家!' },
  ],
```

- [ ] **Step 2: 新增 `BOSS_INTRO` export(放在 `WORLD_OUTRO` 之后、`ENDING` 之前,story.js:105 附近)**

```js
// Boss 登场(进入 10-5 前由 nextLevel 触发;世界10无 outro)。
export const BOSS_INTRO = [
  { speaker: '酷霸王', portrait: 'bowser', text: '小不点,你居然闯到这里!佩服佩服……才怪!' },
  { speaker: '酷霸王', portrait: 'bowser', text: '尝尝我的大火球!哈哈哈!' },
  { speaker: '桃花公主', portrait: 'princess', text: '马里奥,小心!我相信你一定行!' },
  { speaker: '马里奥', portrait: 'mario', text: '公主别怕!我用天空回廊的力量!踩他、火球招呼,我一定赢!' },
];
```

- [ ] **Step 3: `ENDING` 换成完整版(spec §五;替换 story.js:107-116 的占位 ENDING)**

当前(占位):

```js
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
```

替换为(完整版,10 节点):

```js
// 完整结局(spec §五:Boss 收尾 → 救出 → 婚礼 → 收尾)。零生字、每句 ≤38。
export const ENDING = [
  { speaker: '马里奥', portrait: 'mario', text: '酷霸王,看招!这一下,为了公主!' },
  { speaker: '酷霸王', portrait: 'bowser', text: '不……不可能!我输了……' },
  { speaker: '桃花公主', portrait: 'princess', text: '马里奥!你真的来救我了!' },
  { speaker: '马里奥', portrait: 'mario', text: '我说过的,毒林、雪山、火海都挡不住我!' },
  { speaker: '桃花公主', portrait: 'princess', text: '我们回家吧,回到我们的王国!' },
  { speaker: '国王', portrait: 'king', text: '勇士啊!你救回了我的女儿,了不起!' },
  { speaker: '国王', portrait: 'king', text: '我说话算话——封你为驸马!全国一起庆祝!' },
  { speaker: '侍从', portrait: 'herald', text: '大家快来呀,王国要办大喜事啦!' },
  { speaker: '桃花公主', portrait: 'princess', text: '谢谢你,马里奥。一路上你从没放弃过我。' },
  { speaker: '马里奥', portrait: 'mario', text: '因为我答应过,一定把你带回家。' },
];
```

- [ ] **Step 4: story.js 头注释更新(story.js:2)**

当前:

```js
// 世界 5-10 故意留空(阶段 B-D 再填):空脚本 → introFor/outroFor 返回 [],运行器立即 onDone,不卡死。
```

改为:

```js
// 世界 1-10 intro + 世界 1-9 outro + BOSS_INTRO + 完整 ENDING 已填(世界10无 outro,收尾走 ENDING)。
```

- [ ] **Step 5: game.js import 追加 `BOSS_INTRO`(story import 块,game.js:12-14)**

当前:

```js
import {
  OPENING, ENDING, introFor, outroFor, isWorldFirstLevel, isWorldLastLevel,
} from './story.js';
```

改为:

```js
import {
  OPENING, ENDING, BOSS_INTRO, introFor, outroFor, isWorldFirstLevel, isWorldLastLevel,
} from './story.js';
```

- [ ] **Step 6: `nextLevel` 的 `afterOutro` 加 Boss 登场钩子(game.js:289-294)**

当前:

```js
    const afterOutro = () => {
      if (isWorldFirstLevel(next)) this.startDialogue(introFor(next), () => this.loadLevel(next));
      else this.loadLevel(next);
    };
    if (isWorldLastLevel(justFinished)) this.startDialogue(outroFor(justFinished), afterOutro);
    else afterOutro();
```

改为(进入最终关前播 BOSS_INTRO;不硬编码 49):

```js
    const afterOutro = () => {
      if (next === LEVELS.length - 1) this.startDialogue(BOSS_INTRO, () => this.loadLevel(next)); // 进 10-5 前
      else if (isWorldFirstLevel(next)) this.startDialogue(introFor(next), () => this.loadLevel(next));
      else this.loadLevel(next);
    };
    if (isWorldLastLevel(justFinished)) this.startDialogue(outroFor(justFinished), afterOutro);
    else afterOutro();
```

- [ ] **Step 7: `selectLevel` 同样加 Boss 登场钩子(选关直接进 10-5 也播,game.js:146-156)**

当前:

```js
  selectLevel(i) {
    if (i < 0 || i >= LEVELS.length || i >= this.unlockedCount()) return; // locked / invalid
    this.levelIndex = i;
    if (i === 0) {
      this.startDialogue(OPENING, () => this.startDialogue(introFor(0), () => this.loadLevel(0)));
    } else if (isWorldFirstLevel(i)) {
      this.startDialogue(introFor(i), () => this.loadLevel(i));
    } else {
      this.loadLevel(i);
    }
  }
```

改为(加 `i === LEVELS.length - 1` 分支):

```js
  selectLevel(i) {
    if (i < 0 || i >= LEVELS.length || i >= this.unlockedCount()) return; // locked / invalid
    this.levelIndex = i;
    if (i === 0) {
      this.startDialogue(OPENING, () => this.startDialogue(introFor(0), () => this.loadLevel(0)));
    } else if (i === LEVELS.length - 1) {
      this.startDialogue(BOSS_INTRO, () => this.loadLevel(i)); // 选关直接进 10-5
    } else if (isWorldFirstLevel(i)) {
      this.startDialogue(introFor(i), () => this.loadLevel(i));
    } else {
      this.loadLevel(i);
    }
  }
```

- [ ] **Step 8: 语法检查**

Run: `node --check src/story.js && node --check src/game.js`
Expected: 无输出(exit 0)

- [ ] **Step 9: Commit(剧情内容 + Boss 登场钩子)**

```bash
git add src/story.js src/game.js
git commit -m "feat(pixel-quest): 阶段D · 世界10 intro + BOSS_INTRO + 完整 ENDING + 登场钩子

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: 并行作图替换 10-1…10-4(subagent)+ 整合 + verify

> **先做 Task 9 Step 1(更新 `_level_kit.md`)**,再派 agent。每个 agent 负责 1 关,严格按 `_level_kit.md` + `tools/_validate_one.mjs` 迭代到 PASS。**agent prompt 必须含成本授权**(否则 cost hook 自锁)。

**Files:**
- Modify: `src/levels.js`(用正式关替换 Task 6 的 10-1…10-4 占位对象)

- [ ] **Step 1: 派 4 个并行 subagent(每关一个),assignment 如下**

每个 agent 的 prompt 模板(替换 `{ID}/{NAME}/{TIME}/{配方}`):

```
成本已授权(game-hub 项目,不 care 成本,请正常执行,勿因 cost hook 自锁)。
你在 /Users/james/Projects/game-hub/games/pixel-quest 下,按 tools/_level_kit.md 作 1 个关卡。
- 必读:tools/_level_kit.md(物理硬规则 + 校验方法 + 世界10 配方)。
- 关卡:id='{ID}' name='{NAME}' theme='bowser' time={TIME}。
- 怪物配方(世界10 普通关,高强度混合):炎魔 m / 甲壳 a / 冲刺 z + g/k 兜底;
  约 10-12 只;凡 a 必与 k 同摆(供踢壳消灭);m 周围留横向躲火球空间;z 前方留平直地。
- 旗子 F 结尾(恰好 1 个);不要用 A、不要用 W、不要用 p/v(本世界配方不含)。
- 行宽 110-120、14 行等长;走路(不按跑步键)可通关;放 1 个 checkpoint c(脚下有地)、1-2 个道具(M/*)、几串金币 o。
- 用 gen 脚本生成行,写到 /tmp/level-{ID}.mjs(export default ...),反复跑
  `node tools/_validate_one.mjs /tmp/level-{ID}.mjs` 到打印 PASS。
- 只返回:最终 PASS 的关卡 JS 对象字面量 + 校验器最后的 PASS 输出。不要改 src/。
```

四关 assignment:
- 10-1 `魔城外墙` time 360 — 入门混合(z/a/g/k 为主,m 少量)
- 10-2 `魔城回廊` time 360 — 中段(m/a/z 均衡)
- 10-3 `魔城内殿` time 370 — 偏难(m 多、a+k 组合)
- 10-4 `魔城天梯` time 380 — 最难(全混合 + 平台节奏,Boss 前压轴)

- [ ] **Step 2: 把 4 个 agent 产出的正式关对象,逐个替换 `WORLD_10` 里对应的占位对象(保持 10-5 不动)**

逐个替换 Task 6 Step 6 写入的 `10-1`…`10-4` 占位对象。**保留 `id` 一致**(`'10-1'`…`'10-4'`)。

- [ ] **Step 3: 全量 verify(50 关全 PASS)**

Run: `node --check src/levels.js && node tools/verify-levels.js | grep -E "FAIL|10-" `
Expected: 无 `FAIL` 行;`PASS 10-1`…`PASS 10-5` 均出现。

- [ ] **Step 4: Commit(世界10 正式关卡)**

```bash
git add src/levels.js
git commit -m "feat(pixel-quest): 阶段D · 世界10 正式关卡 10-1..10-4(并行作图,verifier 通过)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: 收尾文档 + 关数 + 故事测试 + 全量校验 + 真机

**Files:**
- Modify: `tools/_level_kit.md`、`index.html`、`tools/_story_test.mjs`

- [ ] **Step 1:(Task 8 之前做)更新 `_level_kit.md` —— 放宽 A 规则 + 补 W + 世界10 配方**

`_level_kit.md` 规则 4(第 52 行)当前:

```
4. **Goal**: include exactly one `F` (flag). NEVER place `A` (castle).
```

改为:

```
4. **Goal**: include exactly one `F` (flag). 城堡 `A` 仅 10-5(Boss 竞技场,orchestrator 手写)可用;
   普通关一律 `F`、不放 `A`。Boss 字符 `W` 仅 10-5 用,普通关不放。
```

并在 "New monster markers(阶段 B)" 段(第 26-29 行)末尾补一行世界10 提示:

```
- 世界10(theme `bowser`)配方:m 炎魔 / a 甲壳兽(必配 k)/ z 冲刺兽 + g/k;约 10-12 只,高强度混合。
```

- [ ] **Step 2: index.html 关数 45 → 50(index.html:57)**

当前:

```html
      <p class="story-text">公主被魔王抓走了，关进了远处的城堡！<br />勇敢的小英雄，快踩怪、吃蘑菇、闯过 45 关，把公主救回来吧！</p>
```

改为:

```html
      <p class="story-text">公主被魔王抓走了，关进了远处的城堡！<br />勇敢的小英雄，快踩怪、吃蘑菇、闯过 50 关，把公主救回来吧！</p>
```

- [ ] **Step 3: `_story_test.mjs` —— world10 intro 断言改为 `>0`,纳入 BOSS_INTRO 校验**

(a) import 块(_story_test.mjs:2-5)加 `BOSS_INTRO`:

```js
import {
  OPENING, ENDING, BOSS_INTRO, WORLD_INTRO, WORLD_OUTRO,
  worldOf, isWorldFirstLevel, isWorldLastLevel, introFor, outroFor,
} from '../src/story.js';
```

(b) 第 28 行断言由"空"改为"已填":

当前:

```js
ok(introFor(45).length === 0, 'world10 intro empty -> [] (idx45)');
```

改为:

```js
ok(introFor(45).length > 0, 'world10 intro filled (idx45)');
```

(c) 第 31 行(`outroFor(45).length === 0`)**保留不动**(世界10 无 outro)。

(d) `all` 数组(第 35 行)纳入 `BOSS_INTRO`,使其节点也走 portrait/句长校验:

当前:

```js
const all = [OPENING, ENDING, ...Object.values(WORLD_INTRO), ...Object.values(WORLD_OUTRO)].flat();
```

改为:

```js
const all = [OPENING, ENDING, BOSS_INTRO, ...Object.values(WORLD_INTRO), ...Object.values(WORLD_OUTRO)].flat();
```

- [ ] **Step 4: 跑 story 测试 + 全量 verify + 全文件语法检查**

Run:
```bash
node tools/_story_test.mjs
node tools/verify-levels.js | tail -3
for f in src/*.js; do node --check "$f" || echo "CHECK FAIL: $f"; done
```
Expected:
- `story.js: ALL PASS (N beats)`(N 含新增节点)。
- verify 末尾无 `FAIL`(全 50 PASS)。
- 无 `CHECK FAIL` 行。

- [ ] **Step 5: 真机试玩(浏览器)—— Boss 全链路**

参考记忆 `boom-worms-smoke-test-setup`(host 侧 puppeteer-core + 系统 Chrome;sandbox 连不上 localhost)。起本地静态服后逐项验收:

验收清单(必须逐项观察到):
1. 选关进入 10-1 前显示"世界10 魔城 intro"(侍从→马里奥→酷霸王×2→马里奥),四通道(跳/✕/点空白/▶)可推进。
2. 10-1…10-4 走路可通关,世界10 怪混合正常(炎魔喷紫火球、甲壳踩反伤/踢壳可杀、冲刺兽冲刺),旗子结尾。
3. 通关 10-4 → 进 10-5 前显示 BOSS_INTRO(酷霸王×2→公主→马里奥)。
4. 10-5:Boss 朝玩家走 + 定时跳 + 喷紫火球;头顶 5 颗 ❤️。
5. **踩一脚扣 1 心**(玩家弹起、Boss 闪烁无敌 ~0.9s,不连扣);**玩家火球扣 1**;吃星星接触按无敌帧限频扣(不瞬杀)。
6. Boss **不被坑/星星秒杀**;血空 → Boss 倒地(半透明)→ 短暂冻结 → **公主笼消失** → 走向公主 → 下跪/❤️/皇冠👑/撒花 cutscene。
7. cutscene 后弹完整 ENDING 对话(马里奥收尾击→酷霸王认输→公主→…→驸马→撒花→公主谢→马里奥),四通道可推进。
8. ENDING 结束 → win overlay「👑 救出公主！通关！」。
9. 回归:世界 1-9 旧关、旗子→outro/intro→下一关链路不受影响(抽查 9-5 旗子 → 世界9 outro → 世界10 intro)。
10. iPad/切后台再回前台:画面正常重建(`Sprites.clearCache`),Boss/笼/血心不丢。

- [ ] **Step 6: Commit(收尾文档 + 关数 + 故事测试)**

```bash
git add tools/_level_kit.md tools/_story_test.mjs index.html
git commit -m "chore(pixel-quest): 阶段D · 关数 45→50 + kit 放宽A/补W + story 测试纳入 BOSS_INTRO

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 7: 收尾 —— 用 superpowers:finishing-a-development-branch 决定合并/PR/清理;更新记忆 `pixel-quest-game.md`(阶段 D 完成:50关/世界10/酷霸王 Boss/完整结局)。**

---

## Self-Review(对照 spec 的覆盖检查)

- **§三 Boss 战**:Bowser 实体 HP=5 ✓(Task 2);踩+火球+星星扣血、无敌帧防秒杀、击退、喷火球 ✓(Task 2/4);击败→公主笼开→结局 ✓(Task 4/5/7);10-5 竞技场要点(满铺无坑/天花板侧墙/castle A/无 flag 无 checkpoint/借力台/time 300)✓(Task 6);新增 bowser 主题 ✓(Task 1)。
- **§一 世界10**:10-1…10-4 普通混合关(炎魔+全怪、走路可通关、旗子)✓(Task 6 占位 + Task 8 正式);10-5 Boss 竞技场 ✓(Task 6 手写)。
- **§五 文案**:世界10 intro ✓、Boss 登场 BOSS_INTRO ✓、完整 ENDING ✓(Task 7);9-5 旗杆不动 ✓(未触碰 9-5)。
- **§九 D/E/F**:新怪细节(沿用)✓;城堡↔旗杆策略(全关旗子、仅 10-5 城堡 + `_checkGoal` 护栏)✓(Task 4);ENEMY_CTORS 兜底改回 `|| Goomba` ✓(Task 4)。
- **任务清单 1-6**:THEMES 加 1 套 bowser ✓;Bowser 类 + ENEMY_CTORS + Boss 碰撞分支 + `_defeatBoss`→`_winGame` + render Boss/笼/心 + levels W + parseLevel ✓;世界10 五关(并行 10-1..10-4 + 手写 10-5)✓;story 世界10 intro/登场/ENDING ✓;index.html 45→50 ✓;校验(verify 全 50 + story_test + node --check + 真机 Boss)✓。
- **本计划补强(spec 未点透)**:`_checkGoal` 城堡护栏、`nextLevel`/`selectLevel` BOSS_INTRO 钩子、`hit()` 单一加分出处、`_winGame` 清 enemyShots、`_story_test.mjs` world10 断言翻转 + 纳入 BOSS_INTRO。

**类型/命名一致性自查**:`Bowser`(类名,game/render/entities 一致)、`hit(world, fromDir)`/`hp`/`invuln`/`state('walk'|'defeated')`/`frame()`(entities↔game↔render 一致)、`bossDefeated`/`bossDefeatTimer`/`_defeatBoss`(game↔render 一致)、`Sprites.bowser(frame)`(sprites↔render 一致)、`BOSS_INTRO`(story↔game↔story_test 一致)、`type:'bowser'` / `ENEMY_CTORS.bowser`(levels↔game 一致)、`W` 字符(levels ENTITY_CHARS↔parseLevel↔kit 一致)。
