REQUIRED SUB-SKILL: superpowers:writing-plans

# Pixel-Quest 阶段 B 实现计划 — 5 新怪 + 敌方火球

**Goal:** 为 pixel-quest 增加 5 种新敌人(飞翼怪 Flyer / 冲刺兽 Dasher / 食人花 Piranha / 甲壳兽 Spiked / 炎魔 Flamer)及其依赖的敌方火球系统(EnemyShot),保证现有 20 关零回归、所有源文件 `node --check` 通过、`verify-levels` 全 PASS。本阶段**只做引擎/精灵/字符支持**,不产关卡内容(阶段 C)、不引入 Bowser/`W`(阶段 D)。

**Architecture:**
- **掉血唯一通道铁律**:任何"碰到玩家掉血"只走 `game._playerEnemyCollisions → this._hurtPlayer()`(复用 `takeDamage` 的无敌帧/星星短路);实体 `update` 内**绝不**直接扣血。EnemyShot 的玩家碰撞放在 `game.update` 主循环统一处理,不在 shot 自身 `update`。
- **工厂查表**:`game.js` 用 `ENEMY_CTORS[type]` 把关卡 `{type}` 映射到构造器;开发期未知类型抛错(便于发现关卡笔误),上线前改 `|| Goomba` 兜底。
- **远程杀法零额外代码**:新怪只要实现 `kill(world)` 即自动被火球(`Fireball.update`)、星星(`_playerEnemyCollisions` 顶部 instakill)、踢龟壳(`Koopa.update` slide)消灭——这三处**不改任何代码**。
- **踩死语义**:能踩死的怪(Flyer 退化态/Dasher/Flamer)实现 `stomp()`+`squish`;踩不死/踩反伤的怪(Piranha/Spiked)**不实现** `stomp`,其 `_playerEnemyCollisions` 分支不读 `stomping`、无条件 `_hurtPlayer()`。
- **公共文件单一改动原则(消除评审 #7/#8/#20 根因)**:`game.js` import、`ENEMY_CTORS`、`enemyShots` 接线、`render.js` import 全集、`levels.js` `ENTITY_CHARS`、`parseLevel` 的 5 条 `else if`、`config.js` 全部 ENEMY 字段——**全部归到 Task 1 落一次**。Task 2-6 对这些公共文件**只做"确认存在"**,绝不重复 Edit(避免 old_string 不唯一/重复插入)。Task 2-6 各自只改自己独有、互不冲突的部分(entities.js 的怪类、game.js/render.js 的 `else if (e instanceof X)` 独立分支、sprites.js 的 draw+访问器)。
- **占位 stub 策略**:Task 1 的 import/查表要求 5 个怪类已存在(named import 缺失即报错),故 Task 1 先 stub 出 5 个空类;Task 2-6 各自**整类替换**对应 stub。
- **verifier 透明性**:新字符 `v/z/p/a/m` 是实体,`parseLevel` 走 `ENTITY_CHARS` 分支不入 `grid`,对 `verify-levels` 的 WALK/坑/步/blocks 几何检查完全透明。

**Tech Stack:** 纯原生 ES modules(浏览器 Canvas 2D);无构建步骤。校验工具:`node --check <file>`(语法)、`node tools/verify-levels.js`(20 关几何回归)、`node tools/_validate_one.mjs <file>`(单关几何)。

**约定(铁律):**
- **只提交 pixel-quest 文件**:commit 时只 `git add` 本计划列出的 pixel-quest 路径,**禁止** `git add -A`(本会话已有 36 个无关文件改动)。
- **commit 末尾**带:`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **分支**:`develop`(当前分支,直接提交)。
- 每个 commit 前先 `node --check` 改动文件 + 视情况跑 `verify-levels` 全 PASS。

---

## File Structure

| 文件(绝对路径) | Task 1 公共前置 | Task 2-6 各怪独有 |
|---|---|---|
| `/Users/james/Projects/game-hub/games/pixel-quest/src/config.js` | `ENEMY` 全部新字段(一次写全) | — |
| `/Users/james/Projects/game-hub/games/pixel-quest/src/entities.js` | `import SOLID`;`EnemyShot` 类;5 个占位 stub | **整类替换** Flyer/Dasher/Piranha/Spiked/Flamer |
| `/Users/james/Projects/game-hub/games/pixel-quest/src/game.js` | import 全集;`ENEMY_CTORS`;`_spawnEntities` 查表;`enemyShots` 容器/重置/facade/主循环/cull | `_playerEnemyCollisions` 各怪 `else if` 分支 |
| `/Users/james/Projects/game-hub/games/pixel-quest/src/render.js` | import 全集;`_enemyShots` 方法+调用 | `_enemies` 各怪 `else if` 分支 |
| `/Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js` | — | 各怪 `drawX` + 访问器 |
| `/Users/james/Projects/game-hub/games/pixel-quest/src/levels.js` | `ENTITY_CHARS` 加 `v z p a m`;`parseLevel` 5 条 `else if`;顶部注释 | — |
| `/Users/james/Projects/game-hub/games/pixel-quest/tools/_level_kit.md` | 5 新怪字符说明(一次写全) | — |
| `/Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js` | **不改**(新字符透明) | **不改** |

类名:`Flyer` / `Dasher` / `Piranha` / `Spiked` / `Flamer` / `EnemyShot`。type 名:`flyer` / `dasher` / `piranha` / `spiked` / `flamer`。字符:`v` / `z` / `p` / `a` / `m`。三者全程一致。

---

## Task 1：公共前置(P1-P5,必须最先做)

> 本 Task 落地后:5 src 文件 `node --check` 通过;`verify-levels` 全 PASS;`v/z/p/a/m` 能 parse 成 5 个 type 并经 `ENEMY_CTORS` 命中真类(stub);敌方火球容器/facade/主循环/紫色渲染就位。Bowser/`W` 不引入。

### Step 0 —(只读核实)collideTiles 第 4 参签名

EnemyShot 弧线下落依赖 `collideTiles(ent, grid, dt, opts)` 第 4 参 `opts.gravity`。先核实:

```bash
grep -n "export function collideTiles\|opts\|gravity\|export function groundAhead\|export function aabb" /Users/james/Projects/game-hub/games/pixel-quest/src/physics.js
```

判定:
- 若 `collideTiles(ent, grid, dt, opts = {})` 且内部读 `opts.gravity` → P4.1 EnemyShot 用第 4 参版本(下方主版本)。
- 若**不支持**第 4 参 → P4.1 用自管物理版本(下方备选,用到 P3 的 SOLID import)。

无文件改动,无 commit。

---

### P1 — config.js:ENEMY 一次写全所有新字段

**锚点**:`config.js` 现有单行 `export const ENEMY = { goombaSpeed: 46, koopaSpeed: 40, shellSpeed: 320, fireballSpeed: 320, fireballBounce: 360 };`

Edit 把该整行替换为:

```js
export const ENEMY = {
  goombaSpeed: 46, koopaSpeed: 40, shellSpeed: 320, fireballSpeed: 320, fireballBounce: 360,
  flyerSpeed: 55, flyerAmp: 40, flyerFreq: 1.6,
  dasherPatrol: 30, dasherDash: 280, dasherSight: 260, dasherCooldown: 1.2, dasherWindup: 0.35,
  piranhaUp: 90, piranhaHideT: 1.6, piranhaShowT: 1.8, piranhaRise: 30,
  spikedSpeed: 38,
  flameThrowEvery: 2.2, flameSpeed: 200,
};
```

**验证**:
```bash
node --check /Users/james/Projects/game-hub/games/pixel-quest/src/config.js
node /Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js
```

**commit**(只 add config.js):
```bash
git add /Users/james/Projects/game-hub/games/pixel-quest/src/config.js
git commit -m "$(cat <<'EOF'
feat(pixel-quest): P1 — ENEMY config fields for 5 new monsters

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### P3 — entities.js:顶部 import 追加 SOLID

> 先做 P3 再做 P4,因 P4 的 EnemyShot 自管物理备选版需要 SOLID。

**锚点**:`entities.js` 现有 `import { TILE, GRAVITY, PLAYER, FORGIVE, ENEMY } from './config.js';`

Edit 改为:

```js
import { TILE, GRAVITY, PLAYER, FORGIVE, ENEMY, SOLID } from './config.js';
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js`(SOLID 暂未用,语法 OK;P4 即用)。与 P4 合并提交。

---

### P4 — 敌方火球:EnemyShot 类 + 5 个占位 stub + game 接线 + render

#### P4.1 — entities.js:新增 EnemyShot 类

**锚点**:插在 `export class Fireball { … }` 闭合 `}` 之后、`MovingPlatform` 的分隔注释之前。Edit 插入(**Step 0 主版本**,collideTiles 支持第 4 参):

```js
// ---------------------------------------------------------------------------
// 敌方火球(炎魔/Boss 喷出):14×14 紫色、弱重力弧线;撞墙/天花板/超时/落地反弹后即灭。
// 不在自身 update 里碰玩家——玩家碰撞由 game.update 主循环统一处理(复用无敌帧)。
export class EnemyShot {
  constructor(x, y, vx, vy) {
    this.w = 14; this.h = 14;
    this.x = x; this.y = y;
    this.vx = vx;
    this.vy = vy != null ? vy : -120;
    this.dead = false;
    this.life = 3.0;
    this.bounced = false;
    this.anim = 0;
  }
  update(dt, world) {
    this.life -= dt;
    this.anim += dt * 10;
    if (this.life <= 0) { this.dead = true; return; }
    const info = collideTiles(this, world.grid, dt, { gravity: 600 });
    if (info.hitWall || info.hitCeiling) { this.dead = true; return; }
    if (info.onGround) {
      if (this.bounced) { this.dead = true; return; } // 反弹一次后再落地即灭
      this.bounced = true;
      this.vy = -ENEMY.fireballBounce * 0.6;
    }
  }
}
```

> **Step 0 备选版本**(若 `collideTiles` 不支持第 4 参 `{gravity}`):把 `update` 体替换为自管物理(用到 P3 的 SOLID):
> ```js
>   update(dt, world) {
>     this.life -= dt; this.anim += dt * 10;
>     if (this.life <= 0) { this.dead = true; return; }
>     this.vy += 600 * dt;
>     this.x += this.vx * dt;
>     this.y += this.vy * dt;
>     const g = world.grid;
>     const col = Math.floor((this.x + this.w / 2) / TILE);
>     const row = Math.floor((this.y + this.h) / TILE);
>     const t = g[row] && g[row][col];
>     if (t && SOLID.has(t)) {
>       if (this.bounced) { this.dead = true; return; }
>       this.bounced = true; this.y = row * TILE - this.h; this.vy = -ENEMY.fireballBounce * 0.6;
>     }
>   }
> ```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js`

#### P4.2 — entities.js:5 个怪的占位 stub

**锚点**:插在 `EnemyShot` 类之后、`MovingPlatform` 之前。Edit 插入(Task 2-6 各自整类替换对应 stub):

```js
// ---------------------------------------------------------------------------
// 阶段 B 占位 stub —— 让 ENEMY_CTORS 查表与 named import 先跑通。
// 行为/精灵/碰撞由 Task 2-6 各怪整类替换。合并前务必替换完毕。
export class Flyer  { constructor(x, y) { this.w = 24; this.h = 22; this.x = x + (TILE - this.w) / 2; this.y = y + (TILE - this.h); this.vx = -ENEMY.flyerSpeed; this.vy = 0; this.dead = false; this.squish = 0; this.anim = 0; } update() {} }
export class Dasher { constructor(x, y) { this.w = 28; this.h = 24; this.x = x + (TILE - this.w) / 2; this.y = y + (TILE - this.h); this.vx = -ENEMY.dasherPatrol; this.vy = 0; this.dead = false; this.squish = 0; this.anim = 0; } update() {} }
export class Piranha{ constructor(x, y) { this.w = 26; this.h = 30; this.x = x + (TILE - this.w) / 2; this.y = y + (TILE - this.h); this.baseY = y; this.dead = false; this.state = 'hidden'; this.anim = 0; } update() {} }
export class Spiked { constructor(x, y) { this.w = 26; this.h = 24; this.x = x + (TILE - this.w) / 2; this.y = y + (TILE - this.h); this.vx = -ENEMY.spikedSpeed; this.vy = 0; this.dead = false; this.anim = 0; } update() {} }
export class Flamer { constructor(x, y) { this.w = 26; this.h = 28; this.x = x + (TILE - this.w) / 2; this.y = y + (TILE - this.h); this.vx = 0; this.vy = 0; this.dead = false; this.throwTimer = ENEMY.flameThrowEvery; this.squish = 0; this.anim = 0; } update() {} }
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js`

#### P4.3 — game.js:import 追加 5 新怪 + EnemyShot(不含 Bowser)

**锚点**:game.js:15-17
```js
import {
  Player, Goomba, Koopa, Coin, Powerup, Fireball, MovingPlatform,
} from './entities.js';
```

Edit 改为:

```js
import {
  Player, Goomba, Koopa, Coin, Powerup, Fireball, MovingPlatform,
  Flyer, Dasher, Piranha, Spiked, Flamer, EnemyShot,
} from './entities.js';
```

> Bowser/`W` 属阶段 D,本阶段**不**引入(评审 #7:避免 import 不存在的类导致模块加载即报错)。

#### P4.4 — game.js:ENEMY_CTORS 查表 + 替换 _spawnEntities 三元

**锚点 A**:game.js:20 `import { Sound } from './audio.js';` 与 :22 `const clamp = …` 之间。Edit 插入:

```js
// 敌人类型→构造器查表。开发期:未知类型抛错(便于及早发现关卡数据笔误)。
// 上线前改回兜底:`const C = ENEMY_CTORS[e.type] || Goomba;`。
// 注:bowser 属阶段 D,本阶段不在表内;阶段 D 再 import Bowser 并加 `bowser: Bowser`。
const ENEMY_CTORS = {
  goomba: Goomba, koopa: Koopa,
  flyer: Flyer, dasher: Dasher, piranha: Piranha, spiked: Spiked, flamer: Flamer,
};
```

**锚点 B**:game.js:177-179
```js
    if (full) {
      this.enemies = lv.enemies.map((e) =>
        e.type === 'koopa' ? new Koopa(e.x, e.y) : new Goomba(e.x, e.y));
```

Edit 把那两行 `.map(...)` 替换为(开发期抛错版):

```js
    if (full) {
      this.enemies = lv.enemies.map((e) => {
        const C = ENEMY_CTORS[e.type];
        if (!C) throw new Error('Unknown enemy type: ' + e.type);
        return new C(e.x, e.y);
      });
```

> **上线 TODO**(写进 commit body,评审 #27):正式发布前把上面三行收敛为 `const C = ENEMY_CTORS[e.type] || Goomba; return new C(e.x, e.y);`,容忍关卡笔误兜底为 Goomba(否则笔误会让 `loadLevel` 抛错使游戏崩在加载)。

#### P4.5 — game.js:enemyShots 容器(constructor + _spawnEntities 重置)

**锚点 A**:game.js:41 constructor 内 `this.fireballs = [];`。在其下一行 Edit 插入:

```js
    this.enemyShots = []; // 敌方火球(炎魔/Boss)
```

**锚点 B**:game.js:171 `_spawnEntities` 内 `this.fireballs = [];`。在其下一行 Edit 插入:

```js
    this.enemyShots = [];
```

#### P4.6 — game.js:_makeWorld facade 加 get enemyShots + spawnEnemyShot

**锚点 A**:game.js:97 `get fireballs() { return game.fireballs; },`。在其下一行 Edit 插入:

```js
      get enemyShots() { return game.enemyShots; },
```

**锚点 B**:game.js:105 `spawnPowerup(kind, x, y) { game.powerups.push(new Powerup(kind, x, y)); },`。在其下一行 Edit 插入:

```js
      spawnEnemyShot(x, y, vx, vy) { game.enemyShots.push(new EnemyShot(x, y, vx, vy)); },
```

#### P4.7 — game.js:update() 主循环加 enemyShots 更新/玩家碰撞/cull

**锚点 A**:game.js:445-449 `// Fireballs` 块的 `for` 循环闭合 `}`(:449)之后、`// Player vs enemies`(:451)之前。Edit 插入:

```js
    // Enemy shots (炎魔/Boss 火球) — 更新 + 与玩家碰撞(走 _hurtPlayer 复用无敌帧)
    for (const s of this.enemyShots) {
      if (s.dead) continue;
      s.update(dt, this._world);
      if (!s.dead && aabb(p, s) && p.dying <= 0) { s.dead = true; this._hurtPlayer(); }
    }
```

> `aabb` 已在 game.js:18 import;`p` 是本作用域已有的 `const p = this.player;`。星星/无敌帧时 `_hurtPlayer→takeDamage` 自动短路,火球不伤人。

**锚点 B**:game.js:458 `this.fireballs = this.fireballs.filter((f) => !f.dead);`。在其下一行 Edit 插入:

```js
    this.enemyShots = this.enemyShots.filter((s) => !s.dead);
```

> cull 在 `_playerEnemyCollisions`(:452)之后、渲染前(评审 #19),时机正确。

#### P4.8 — render.js:import 全集 + _enemyShots 调用与方法

> **此处一次性 import 全部 5 怪类**(评审 #20 根因修法:render import 只在此落一次全集,Task 2-6 对 render import 只"确认含",不重复 Edit)。

**锚点 A**:render.js:7 `import { Goomba, Koopa } from './entities.js';`。Edit 改为:

```js
import { Goomba, Koopa, Flyer, Dasher, Piranha, Spiked, Flamer } from './entities.js';
```

> EnemyShot 渲染用纯几何(画圆),不需 import EnemyShot。

**锚点 B**:render.js 中 `this._fireballs(ctx, game);` 调用行。在其下一行 Edit 插入:

```js
        this._enemyShots(ctx, game);
```

**锚点 C**:`_fireballs(ctx, game) { … }` 方法闭合 `}` 之后、`_player(ctx, game)` 之前。Edit 插入:

```js
  _enemyShots(ctx, game) {
    const cam = game.camera;
    for (const s of game.enemyShots) {
      if (s.dead) continue;
      if (s.x + s.w < cam.x || s.x > cam.x + FIELD.W) continue; // cull off-screen
      ctx.save();
      ctx.fillStyle = '#c46bff';
      ctx.beginPath();
      ctx.arc(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9c6ff';
      ctx.beginPath();
      ctx.arc(s.x + s.w / 2, s.y + s.h / 2, s.w / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
```

> `FIELD` 已在 render.js:5 import。紫色 `#c46bff` 区别玩家橙火。

**P3+P4 整体验证**:
```bash
node --check /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js
node --check /Users/james/Projects/game-hub/games/pixel-quest/src/game.js
node --check /Users/james/Projects/game-hub/games/pixel-quest/src/render.js
node /Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js
```

**commit**(P3+P4 合并,只 add 三文件):
```bash
git add /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/game.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/render.js
git commit -m "$(cat <<'EOF'
feat(pixel-quest): P3/P4 — SOLID import, EnemyShot + 5 monster stubs, ENEMY_CTORS table, enemyShots container/facade/loop/render

- 5 monster classes are placeholder stubs, replaced整类 by Task 2-6.
- ENEMY_CTORS dev-mode throws on unknown type; before release switch to `|| Goomba`.
- Bowser/W deferred to stage D (not imported).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### P5 — levels.js:ENTITY_CHARS + parseLevel 5 条 else if + 注释 + kit 文档

> **parseLevel 的 5 条 else if 与 ENTITY_CHARS 只在此落一次**(评审 #8 根因修法:Task 2-6 对 levels.js 只"确认存在",不重复 Edit)。本阶段**只加 5 字符,不加 `W`**(评审 #7:`W` 属阶段 D)。

**锚点 A**:levels.js:11 现有 `const ENTITY_CHARS = new Set(['@', 'c', 'g', 'k', 'o']);`。Edit 改为:

```js
const ENTITY_CHARS = new Set(['@', 'c', 'g', 'k', 'o', 'v', 'z', 'p', 'a', 'm']);
```

**锚点 B**:levels.js:486-490。现有:
```js
        } else if (ch === 'o') {
          coins.push({ x: px + TILE / 2, y: py + TILE / 2 });
        } else if (ch === 'c') {
          checkpoint = { x: px, y: py };
        }
```

Edit 改为(在 `'o'` 之后、`'c'` 之前插入 5 条;`old_string` 取从 `'o'` 的 `coins.push` 那行到 `'c'` 的 `} else if (ch === 'c') {` 确保唯一):

```js
        } else if (ch === 'o') {
          coins.push({ x: px + TILE / 2, y: py + TILE / 2 });
        } else if (ch === 'v') {
          enemies.push({ type: 'flyer', x: px, y: py });
        } else if (ch === 'z') {
          enemies.push({ type: 'dasher', x: px, y: py });
        } else if (ch === 'p') {
          enemies.push({ type: 'piranha', x: px, y: py });
        } else if (ch === 'a') {
          enemies.push({ type: 'spiked', x: px, y: py });
        } else if (ch === 'm') {
          enemies.push({ type: 'flamer', x: px, y: py });
        } else if (ch === 'c') {
          checkpoint = { x: px, y: py };
        }
```

**锚点 C**(顶部注释,文档一致性):levels.js:3 `//   '@' player start, 'c' checkpoint, 'g' goomba, 'k' koopa, 'o' floating coin.`。在其下一行 Edit 追加:

```js
//   'v' flyer, 'z' dasher, 'p' piranha, 'a' spiked, 'm' flamer (阶段 B 新怪;'W' bowser 阶段 D).
```

**锚点 D**(kit 文档):`tools/_level_kit.md` 的 "Entity markers" 段:
```
- Entity markers (become objects, not tiles): `@` player spawn, `c` checkpoint,
  `g` goomba, `k` koopa, `o` floating coin
```
Edit 在该两行之后追加(注意大小写区分:`a` 小写=甲壳兽,`A` 大写=城堡仍是 HARD RULE NEVER place,评审 #6):

```
- New monster markers (阶段 B): `v` 飞翼怪(空中,须摆在地面/平台上方,掉翅膀后能落地),
  `z` 冲刺兽(地面,前方留一段平直地),`p` 食人花(管口,踩不死;本段必须配火花道具 `M` +
  留"等它缩回再跳过"的躲避路径),`a` 甲壳兽(踩反伤,小写 `a`≠大写 `A` 城堡;必须与 `k` 同摆,
  供踢壳消灭),`m` 炎魔(定时喷火球,须给玩家躲火球的横向空间)。
- 注意:verifier 对新怪透明,不校验"摆位合理性"(飞翼下方有地/食人花配 M/甲壳配 k),阶段 C 须人工+真机验收。
```

**P5 验证**:
```bash
node --check /Users/james/Projects/game-hub/games/pixel-quest/src/levels.js
node /Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js
```

**(可选)临时关冒烟**(验证 parse→type 映射):
```bash
cat > /tmp/smoke-newchars.mjs <<'EOF'
import { parseLevel } from '/Users/james/Projects/game-hub/games/pixel-quest/src/levels.js';
const lv = { id:'B-test', name:'smoke', theme:'overworld', time:300, rows:[
  '                              ',
  '          v                   ',
  '                              ',
  '                          F   ',
  '   @  z   p   a   m            ',
  '##############################',
  '##############################',
]};
const w = parseLevel(lv);
console.log('enemies:', w.enemies.map(e => e.type).join(','));
EOF
node /tmp/smoke-newchars.mjs   # 期望: enemies: dasher,flyer,piranha,spiked,flamer
rm /tmp/smoke-newchars.mjs
```

**commit**(只 add levels.js + _level_kit.md):
```bash
git add /Users/james/Projects/game-hub/games/pixel-quest/src/levels.js \
        /Users/james/Projects/game-hub/games/pixel-quest/tools/_level_kit.md
git commit -m "$(cat <<'EOF'
feat(pixel-quest): P5 — level chars v/z/p/a/m → 5 new enemy types + kit docs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 1 收尾验证(全绿才进 Task 2)

```bash
for f in config entities game render levels; do node --check /Users/james/Projects/game-hub/games/pixel-quest/src/$f.js; done
node /Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js
```

---

## Task 2：飞翼怪 Flyer(字符 `v`,世界 5)

> 行为:winged 态正弦悬停飞行、不受重力、仅水平撞墙折返;踩第一脚 → `loseWings()` 退化为 Goomba 式地面巡逻;踩第二脚 → `stomp()` squish 死;火球/星星/踢壳 → `kill()` 死。
> **公共文件依赖(Task 1 已落,本 Task 仅确认)**:`ENEMY.flyer*`、game.js import 含 `Flyer` + `ENEMY_CTORS.flyer`、render.js import 含 `Flyer`、`ENTITY_CHARS`/`parseLevel` 的 `v`。

### Step 2.1 — entities.js:整类替换 Flyer stub

**锚点**:Task 1 P4.2 插入的 `export class Flyer { … update() {} }` 单行 stub。用 Edit 把该整行替换为:

```js
// ---------------------------------------------------------------------------
// 飞翼怪 Flyer (字符 'v', 世界 5)。winged: 正弦悬停飞行,不受重力、不走 collideTiles,
// 仅水平直接查 grid 撞墙折返。踩第一脚 loseWings() 退化为 Goomba 式地面巡逻;踩第二脚
// stomp() squish 死。火球/星星/踢壳 kill() 直接死。掉血走 game._playerEnemyCollisions。
export class Flyer {
  constructor(x, y) {
    this.w = 24; this.h = 22;
    this.x = x + (TILE - this.w) / 2;
    this.y = y + (TILE - this.h);
    this.baseY = this.y;
    this.vx = -ENEMY.flyerSpeed;
    this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.winged = true;
    this.t = 0;
    this.squish = 0;
    this.anim = 0;
  }
  update(dt, world) {
    if (this.squish > 0) { this.squish -= dt; if (this.squish <= 0) this.dead = true; return; }
    const mul = world.mode.enemyMul;
    if (this.winged) {
      const spd = ENEMY.flyerSpeed * mul;
      this.vx = this.vx < 0 ? -spd : spd;
      this.x += this.vx * dt;
      this.t += dt * ENEMY.flyerFreq;
      this.y = this.baseY + Math.sin(this.t * Math.PI * 2) * ENEMY.flyerAmp;
      const grid = world.grid;
      const midRow = Math.floor((this.y + this.h / 2) / TILE);
      const aheadCol = Math.floor((this.vx > 0 ? this.x + this.w + 1 : this.x - 1) / TILE);
      const row = grid[midRow];
      const t = row && row[aheadCol];
      if (t && SOLID.has(t)) this.vx = -this.vx;
      this.anim += dt * 10;
    } else {
      const spd = ENEMY.flyerSpeed * mul;
      this.vx = this.vx < 0 ? -spd : spd;
      const info = collideTiles(this, world.grid, dt);
      if (info.hitWall) this.vx = -this.vx;
      if (this.onGround) {
        const aheadX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
        if (!groundAhead(world.grid, aheadX, this.y + this.h)) this.vx = -this.vx;
      }
      this.anim += dt * 6;
    }
  }
  frame() { return Math.floor(this.anim) % 2; }
  loseWings() { this.winged = false; this.baseY = this.y; this.vy = 0; }
  stomp(world) { this.squish = 0.4; this.vx = 0; world.sound.stomp(); }
  kill(world) { this.dead = true; world.sound.kick(); }
}
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js`

### Step 2.2 — game.js:_playerEnemyCollisions 加 Flyer 分支

**锚点**:`_playerEnemyCollisions` 内 game.js:482 `if (e instanceof Goomba) {`。把该行改为 Flyer 分支 + Goomba 降级为 `else if`(Edit `old_string` 取 `if (e instanceof Goomba) {`):

```js
      if (e instanceof Flyer) {
        if (e.squish > 0) continue;
        if (stomping) {
          if (e.winged) { e.loseWings(); p.vy = -360; this.score += SCORE.stomp; } // 第一脚:掉翅小弹
          else { e.stomp(this._world); p.vy = -440; this.score += SCORE.stomp; }   // 第二脚:踩扁
        } else {
          this._hurtPlayer();
        }
      } else if (e instanceof Goomba) {
```

> 星星 instakill 走 game.js:475 顶部分支(Flyer 有 `kill`),无需在此处理。

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/game.js`

### Step 2.3 — render.js:_enemies 加 Flyer 分支

**锚点**:render.js:250-253 的 Koopa 分支闭合 `}`(:253)之后、`if (cv) {`(:254)之前。Edit(`old_string` 取 Koopa 分支末两行 + `      }` + `      if (cv) {`)在 Koopa 分支后插入:

```js
      } else if (e instanceof Flyer) {
        if (e.squish > 0) {
          cv = Sprites.flyer('walk', 0);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cv, Math.round(e.x), Math.round(e.y + e.h * 0.6), e.w, e.h * 0.4);
          ctx.restore();
          continue;
        }
        cv = Sprites.flyer(e.winged ? 'fly' : 'walk', e.frame());
      }
```

> render.js import 已含 `Flyer`(Task 1 P4.8),**不改 import**。

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/render.js`

### Step 2.4 — sprites.js:drawFlyer + flyer 访问器

**锚点 A**:在 `// ---- enemies ----` 段内 `drawKoopaShell()` 函数闭合 `}` 之后插入:

```js
// 飞翼怪:紫红身体(区别 Goomba 棕),fly 态画上下扇动的白翅膀两帧;walk(退化)态无翅。
function drawFlyer(state, frame) {
  const o = mk(20, 17), x = o.cx;
  if (state === 'fly') {
    x.fillStyle = '#f2eaff';
    if (frame === 1) {
      x.beginPath(); x.moveTo(3, 8); x.lineTo(-1, 2); x.lineTo(5, 6); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(17, 8); x.lineTo(21, 2); x.lineTo(15, 6); x.closePath(); x.fill();
    } else {
      x.beginPath(); x.moveTo(3, 8); x.lineTo(-1, 13); x.lineTo(5, 10); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(17, 8); x.lineTo(21, 13); x.lineTo(15, 10); x.closePath(); x.fill();
    }
    x.fillStyle = '#d9c8f0';
    x.fillRect(2, 7, 2, 2); x.fillRect(16, 7, 2, 2);
  }
  x.fillStyle = '#b03a6e'; x.beginPath(); x.ellipse(10, 9, 9, 7, 0, Math.PI, 0); x.fill();
  r(x, 2, 9, 16, 5);
  x.fillStyle = '#7a2548'; r(x, 2, 13, 16, 1.5);
  x.fillStyle = '#d96b9a'; E(x, 10, 11, 6, 3.2);
  x.fillStyle = '#4a1530'; r(x, 3, 7, 6, 1.6); r(x, 11, 7, 6, 1.6);
  x.fillStyle = '#fff'; E(x, 7, 9.6, 2, 2.4); E(x, 13, 9.6, 2, 2.4);
  x.fillStyle = '#1b1e26'; E(x, 7.4, 10, 1.1, 1.5); E(x, 12.6, 10, 1.1, 1.5);
  x.fillStyle = '#5a1838'; r(x, 7, 13.6, 6, 1.2);
  x.fillStyle = '#3a1024';
  if (frame === 1) { E(x, 5, 16, 3, 1.8); E(x, 15, 16, 3, 1.8); }
  else { E(x, 7, 16, 3, 1.8); E(x, 13, 16, 3, 1.8); }
  return o;
}
```

**锚点 B**:`Sprites` 对象内 `koopa(state, frame) { … },` 之后插入(评审 #23:5 怪都插同一锚点后,逐个 Edit 时 `koopa` 块文本不变,old_string 始终唯一):

```js
  flyer(state, frame) {
    return cached(`fly:${state}:${frame & 1}`, () => drawFlyer(state, frame & 1)).cv;
  },
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js`

### Step 2.5 — levels.js:确认 `v`(不重复 Edit)

```bash
grep -n "'v'" /Users/james/Projects/game-hub/games/pixel-quest/src/levels.js   # ENTITY_CHARS + parseLevel 各一处(Task 1 P5 已加)
```
若两处都在 → **不动 levels.js**。若缺 → 回 Task 1 P5 补。

### Step 2.6 — /tmp 临时关手验(验后删)

写 `/tmp/level-flyer.mjs`(`v` 在 row 7 半空、正下方连续地面、含 `M` 火花、`k` 踢壳、`F`):
```js
export default {
  id: '5-T', name: '飞翼测试', theme: 'lava', time: 300,
  rows: [
    '                                                                        ',
    '                                                                        ',
    '                                                                        ',
    '                                                                        ',
    '                                                                        ',
    '            M                                                           ',
    '                                                                        ',
    '          v        v            v                  v                     ',
    '    @                                                          k     F   ',
    '                                                                        ',
    '########################################################################',
    '########################################################################',
    '########################################################################',
    '########################################################################',
  ],
};
```
```bash
node /Users/james/Projects/game-hub/games/pixel-quest/tools/_validate_one.mjs /tmp/level-flyer.mjs   # 期望 PASS(v 透明)
```
真机手验项:正弦上下飞 + 撞墙折返;踩一脚掉翅小弹(-360)+ 落地走巡逻;踩二脚 squish 死(-440);火球/踢壳秒杀;侧/底接触掉血(无敌帧不连扣);退化后掉坑正常清除。验证后 `rm /tmp/level-flyer.mjs`。

### Step 2.7 — Flyer 收尾验证 + commit

```bash
node --check /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js
node --check /Users/james/Projects/game-hub/games/pixel-quest/src/game.js
node --check /Users/james/Projects/game-hub/games/pixel-quest/src/render.js
node --check /Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js
node /Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js
git add /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/game.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/render.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js
git commit -m "$(cat <<'EOF'
feat(pixel-quest): Flyer (v) — sine flight, lose-wings stomp, sprite + collision branch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3：冲刺兽 Dasher(字符 `z`,世界 6)

> 行为:patrol→windup→dash 三态。**仅当玩家在其前方水平区域、`|脚部 y 差| < TILE` 时**进 windup/dash;玩家正上方(踩头)不触发。撞墙/前方悬崖结束 dash 并冷却。能被踩死;火球/星星/踢壳 → `kill()`。
> **公共文件依赖(确认)**:`ENEMY.dasher*`、game.js import 含 `Dasher` + `ENEMY_CTORS.dasher`、render.js import 含 `Dasher`、`ENTITY_CHARS`/`parseLevel` 的 `z`。

### Step 3.1 — entities.js:整类替换 Dasher stub

**锚点**:Task 1 P4.2 的 `export class Dasher { … update() {} }` 单行 stub。Edit 替换为:

```js
// ---------------------------------------------------------------------------
// 冲刺兽 Dasher(世界6;字符 z)。三态:patrol→windup→dash。触发(spec 九.D):
// 玩家在其【前方】水平区域内、且 |脚部 y 差| < TILE 才蓄力冲刺;正上方踩头不触发。
// 撞墙/前方悬崖结束 dash 并冷却。掉血在 game._playerEnemyCollisions,不在此扣血。
export class Dasher {
  constructor(x, y) {
    this.w = 28; this.h = 24;
    this.x = x + (TILE - this.w) / 2;
    this.y = y + (TILE - this.h);
    this.vx = -ENEMY.dasherPatrol;
    this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.state = 'patrol';   // 'patrol' | 'windup' | 'dash'
    this.timer = 0;
    this.cooldown = 0;
    this.dashDir = -1;
    this.squish = 0;
    this.anim = 0;
  }
  update(dt, world) {
    if (this.squish > 0) { this.squish -= dt; if (this.squish <= 0) this.dead = true; return; }
    const mul = world.mode.enemyMul;
    if (this.cooldown > 0) this.cooldown -= dt;
    const p = world.player;

    if (this.state === 'patrol') {
      const spd = ENEMY.dasherPatrol * mul;
      this.vx = this.vx < 0 ? -spd : spd;
      const info = collideTiles(this, world.grid, dt);
      if (info.hitWall) this.vx = -this.vx;
      if (this.onGround) {
        const aheadX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
        if (!groundAhead(world.grid, aheadX, this.y + this.h)) this.vx = -this.vx;
      }
      this.anim += dt * 5;
      if (this.cooldown <= 0 && p && p.dying <= 0) {
        const sameRow = Math.abs((p.y + p.h) - (this.y + this.h)) < TILE;
        const dir = this.vx < 0 ? -1 : 1;
        const dx = (p.x + p.w / 2) - (this.x + this.w / 2);
        const inFront = dir < 0 ? (dx < 0) : (dx > 0);
        if (sameRow && inFront && Math.abs(dx) <= ENEMY.dasherSight) {
          this.state = 'windup';
          this.timer = ENEMY.dasherWindup;
          this.dashDir = dir;
          this.vx = 0;
          world.sound.bump();
        }
      }
    } else if (this.state === 'windup') {
      this.vx = 0;
      collideTiles(this, world.grid, dt);
      this.timer -= dt;
      this.anim += dt * 14;
      if (this.timer <= 0) { this.state = 'dash'; this.vx = ENEMY.dasherDash * this.dashDir; }
    } else { // dash
      this.vx = ENEMY.dasherDash * this.dashDir * mul;
      const info = collideTiles(this, world.grid, dt);
      this.anim += dt * 16;
      let stop = info.hitWall;
      if (!stop && this.onGround) {
        const aheadX = this.dashDir > 0 ? this.x + this.w + 1 : this.x - 1;
        if (!groundAhead(world.grid, aheadX, this.y + this.h)) stop = true;
      }
      if (stop) {
        this.state = 'patrol';
        this.cooldown = ENEMY.dasherCooldown;
        this.vx = this.dashDir < 0 ? ENEMY.dasherPatrol : -ENEMY.dasherPatrol;
      }
    }
  }
  frame() { return Math.floor(this.anim) % 2; }
  stomp(world) { this.squish = 0.4; this.vx = 0; this.state = 'patrol'; world.sound.stomp(); }
  kill(world) { this.dead = true; world.sound.kick(); }
}
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js`

### Step 3.2 — game.js:_playerEnemyCollisions 加 Dasher 分支

**锚点(评审 #4 精确修法)**:`_playerEnemyCollisions` 内 `} else if (e instanceof Koopa) {` 块的闭合 `}`(game.js:515)与 `for` 闭合 `}`(:516)之间。Edit `old_string` 取从 game.js:510 `} else {` 到 :516(Koopa 块结尾的精确文本):

```js
          } else {
            const dir = (p.x + p.w / 2) < (e.x + e.w / 2) ? 1 : -1;
            e.kickShell(dir, this._world);
          }
        }
      }
    }
  }
```
`new_string` 改为(在 Koopa 块闭合 `}` 后插 Dasher 分支):
```js
          } else {
            const dir = (p.x + p.w / 2) < (e.x + e.w / 2) ? 1 : -1;
            e.kickShell(dir, this._world);
          }
        }
      } else if (e instanceof Dasher) {
        if (e.squish > 0) continue;
        if (stomping) {
          e.stomp(this._world);
          p.vy = -440;
          this.score += SCORE.stomp;
        } else {
          this._hurtPlayer(); // 冲刺中撞到也走这里,无敌帧天然防连击
        }
      }
    }
  }
```

> **后续 Task 4/5/6 沿用同一闭合锚点**:每次 Edit 时上一个怪的分支已在,`old_string` 取"最后一个新增分支的闭合 `}` + `    }` + `  }`",落地者按当前文件实读追加,不复用此处文本。

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/game.js`

### Step 3.3 — render.js:_enemies 加 Dasher 分支(评审 #22:加 squish 扁平绘制)

**锚点**:`_enemies` 类型链末尾(Flyer 分支之后、`if (cv) {` 之前)。Edit 追加:

```js
      } else if (e instanceof Dasher) {
        if (e.squish > 0) {
          cv = Sprites.dasher('patrol', 0);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cv, Math.round(e.x), Math.round(e.y + e.h * 0.6), e.w, e.h * 0.4);
          ctx.restore();
          continue;
        }
        cv = Sprites.dasher(e.state, e.frame());
      }
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/render.js`

### Step 3.4 — sprites.js:drawDasher + dasher 访问器

**锚点 A**:`drawFlyer()` 之后(或 `drawKoopaShell` 之后,enemies 段内)插入:

```js
// 冲刺兽:低身带犄角;dash 态身体发红(#ff5a3c)、奔跑两帧。
function drawDasher(state, frame) {
  const o = mk(24, 20), x = o.cx;
  const dashing = state === 'dash';
  const body = dashing ? '#ff5a3c' : '#7a5cff';
  const bodyDk = dashing ? '#c43320' : '#5238c0';
  const bodyLt = dashing ? '#ff8a72' : '#a48cff';
  x.fillStyle = body; E(x, 12, 12, 11, 7.5); r(x, 1, 12, 22, 6);
  x.fillStyle = bodyDk; r(x, 1, 17, 22, 2);
  x.fillStyle = bodyLt; E(x, 12, 9.5, 8, 2.6);
  x.fillStyle = '#f4f0e0';
  x.beginPath(); x.moveTo(2, 8); x.lineTo(6, 3); x.lineTo(7, 8); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(22, 8); x.lineTo(18, 3); x.lineTo(17, 8); x.closePath(); x.fill();
  x.fillStyle = '#fff'; E(x, 8, 11, 2.2, 2.6); E(x, 16, 11, 2.2, 2.6);
  x.fillStyle = '#1b1e26'; E(x, 8.4, 11.4, 1.1, 1.6); E(x, 15.6, 11.4, 1.1, 1.6);
  x.fillStyle = bodyDk; r(x, 5.5, 8.2, 4, 1.4); r(x, 14.5, 8.2, 4, 1.4);
  x.fillStyle = '#3a1208'; r(x, 8, 15, 8, 1.6);
  x.fillStyle = '#fff';
  x.beginPath(); x.moveTo(9, 15); x.lineTo(10.4, 15); x.lineTo(9.7, 17); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(15, 15); x.lineTo(13.6, 15); x.lineTo(14.3, 17); x.closePath(); x.fill();
  x.fillStyle = '#2a1a0a';
  if (frame === 1) { E(x, 6, 19, 3, 1.8); E(x, 18, 19, 3, 1.8); }
  else { E(x, 9, 19, 3, 1.8); E(x, 15, 19, 3, 1.8); }
  if (dashing) {
    x.fillStyle = '#ffd23f';
    r(x, 0, 6, 3, 1); r(x, 0, 10, 4, 1); r(x, 0, 14, 3, 1);
  }
  return o;
}
```

**锚点 B**:`flyer(...)` 访问器之后插入:

```js
  dasher(state, frame) {
    return cached(`dsh:${state === 'dash' ? 'dash' : 'patrol'}:${frame & 1}`, () =>
      drawDasher(state === 'dash' ? 'dash' : 'patrol', frame & 1)).cv;
  },
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js`

### Step 3.5 — levels.js:确认 `z`(不重复 Edit)
```bash
grep -n "'z'" /Users/james/Projects/game-hub/games/pixel-quest/src/levels.js   # ENTITY_CHARS + parseLevel 各一处
```

### Step 3.6 — /tmp 临时关手验(验后删)

写 `/tmp/dasher-test.mjs`(长平地,`@` 在 `z` 前方同一行):
```js
export default {
  id: '6-T', name: 'Dasher测试', theme: 'snow', time: 300,
  rows: [
    '                                                            ',
    '                                                            ',
    '                                                            ',
    '                                                            ',
    '    @                            z                     F     ',
    '############################################################',
    '############################################################',
    '############################################################',
    '############################################################',
  ],
};
```
```bash
node /Users/james/Projects/game-hub/games/pixel-quest/tools/_validate_one.mjs /tmp/dasher-test.mjs   # 期望 PASS
```
真机手验:同行前方 ≤260px → 抖动 ~0.35s 后红身冲刺;正上方踩头**不**触发;撞墙/悬崖停 + 1.2s 冷却;踩=踩扁+弹;正面被冲=掉血(不连击);火球/星星/踢壳秒杀。验证后 `rm /tmp/dasher-test.mjs`。

### Step 3.7 — Dasher 收尾验证 + commit

```bash
for f in entities game render sprites; do node --check /Users/james/Projects/game-hub/games/pixel-quest/src/$f.js; done
node /Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js
git add /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/game.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/render.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js
git commit -m "$(cat <<'EOF'
feat(pixel-quest): Dasher (z) — patrol/windup/dash, front-only trigger, sprite + collision branch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4：食人花 Piranha(字符 `p`,世界 7,踩不死)

> 行为:固定位置,hidden→rising→shown→sinking 四态定时升降。**踩不死**(分支不读 `stomping`、无条件掉血);只能火球/星星杀或躲。压管口防呆:玩家压在管口上方时不冒出。
> **公共文件依赖(确认)**:`ENEMY.piranha*`、game.js import 含 `Piranha` + `ENEMY_CTORS.piranha`、render.js import 含 `Piranha`、`ENTITY_CHARS`/`parseLevel` 的 `p`。

### Step 4.1 — entities.js:整类替换 Piranha stub(含 `hittable` 标志,修评审 #10)

**锚点**:Task 1 P4.2 的 `export class Piranha{ … update() {} }` 单行 stub。Edit 替换为:

```js
// ---------------------------------------------------------------------------
// Piranha 食人花(世界7,字符 'p'):固定位置,四态定时升降,踩不死。baseY = y(作图格上沿)。
// shown 升到 baseY,hidden 缩到 baseY+TILE。掉血由 game._playerEnemyCollisions 无条件触发
// (踩也掉血,不读 stomping)。kill() 供火球/星星消灭。hittable: hidden 态为 false,
// 让顶部星星 instakill 与碰撞分支都跳过藏在管里的花(评审 #10)。
export class Piranha {
  constructor(x, y) {
    this.w = 26; this.h = 30;
    this.x = x + (TILE - this.w) / 2;
    this.baseY = y;
    this.topY = y + TILE;
    this.y = this.topY;
    this.vx = 0; this.vy = 0;
    this.dead = false;
    this.state = 'hidden';   // 'hidden' | 'rising' | 'shown' | 'sinking'
    this.hittable = false;   // 只有非 hidden 态可被碰/被星星杀
    this.timer = ENEMY.piranhaHideT;
    this.anim = 0;
  }
  update(dt, world) {
    this.anim += dt * 6;
    const p = world.player;
    const hiY = this.baseY + TILE;
    const loY = this.baseY;

    if (this.state === 'hidden') {
      const onTop = p && !p.dead && p.dying <= 0 &&
        p.x + p.w > this.x - 4 && p.x < this.x + this.w + 4 &&
        p.y + p.h <= this.baseY + 8;
      this.topY = hiY;
      if (onTop) { this.timer = ENEMY.piranhaHideT; }
      else {
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'rising'; }
      }
    } else if (this.state === 'rising') {
      this.topY -= ENEMY.piranhaUp * dt;
      if (this.topY <= loY) { this.topY = loY; this.state = 'shown'; this.timer = ENEMY.piranhaShowT; }
    } else if (this.state === 'shown') {
      this.topY = loY;
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'sinking'; }
    } else { // sinking
      this.topY += ENEMY.piranhaUp * dt;
      if (this.topY >= hiY) { this.topY = hiY; this.state = 'hidden'; this.timer = ENEMY.piranhaHideT; }
    }
    this.hittable = this.state !== 'hidden';
    this.y = this.topY;
  }
  frame() { return Math.floor(this.anim) % 2; }
  kill(world) { this.dead = true; world.sound.kick(); }
}
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js`

### Step 4.2 — game.js:顶部星星分支加 Piranha hidden 守卫(修评审 #10)+ Piranha 碰撞分支

**锚点 A(星星误杀修复)**:game.js:474-478 顶部星星分支:
```js
      if (p.star > 0) {
        if (e instanceof Koopa) e.dead = true; else if (e.kill) e.kill(this._world);
        this.score += SCORE.stomp;
        continue;
      }
```
Edit 改为(藏在管里的食人花不被星星误杀):
```js
      if (p.star > 0) {
        if (e instanceof Piranha && e.hittable === false) continue; // hidden 食人花不被星星误杀
        if (e instanceof Koopa) e.dead = true; else if (e.kill) e.kill(this._world);
        this.score += SCORE.stomp;
        continue;
      }
```

**锚点 B(Piranha 碰撞分支)**:Dasher 分支(Step 3.2)之后追加。落地者按当前文件实读 Dasher 块闭合处,在其后插:
```js
      } else if (e instanceof Piranha) {
        // 踩不死:藏起来跳过;否则无条件掉血(不读 stomping)。火球/星星杀走别处。
        if (!e.hittable) continue;
        this._hurtPlayer();
      }
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/game.js`

### Step 4.3 — render.js:_enemies 加 Piranha 分支(hidden 不画)

**锚点**:Dasher 分支之后、`if (cv) {` 之前。Edit 追加:
```js
      } else if (e instanceof Piranha) {
        if (!e.hittable) continue; // 藏起来不画(管口内)
        cv = Sprites.piranha(e.frame());
      }
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/render.js`

### Step 4.4 — sprites.js:drawPiranha + piranha 访问器

**锚点 A**:`drawDasher()` 之后插入:
```js
function drawPiranha(frame) {
  const o = mk(26, 30), x = o.cx;
  x.fillStyle = '#2c9b34'; r(x, 10, 16, 6, 14);
  x.fillStyle = '#5fd06a'; r(x, 10, 16, 2, 14);
  x.fillStyle = '#1d6a24'; r(x, 14, 16, 2, 14);
  x.fillStyle = '#e23b2e'; E(x, 13, 11, 11, 10);
  x.fillStyle = '#ff6d5c'; E(x, 9, 7, 3, 2.2);
  x.fillStyle = '#fff';
  E(x, 7, 6, 1.6, 1.6); E(x, 18, 6, 1.6, 1.6);
  E(x, 5.5, 12, 1.6, 1.6); E(x, 20, 12, 1.6, 1.6);
  E(x, 13, 4.5, 1.6, 1.6);
  x.fillStyle = '#3a0a06';
  if (frame === 1) {
    x.beginPath(); x.ellipse(13, 13, 8, 5.5, 0, 0, 7); x.fill();
    x.fillStyle = '#ff9b8a'; x.beginPath(); x.ellipse(13, 14, 5, 3, 0, 0, 7); x.fill();
    x.fillStyle = '#fff';
    for (const tx of [6, 10, 14, 18]) { x.beginPath(); x.moveTo(tx, 9); x.lineTo(tx + 2.6, 9); x.lineTo(tx + 1.3, 12); x.closePath(); x.fill(); }
    for (const tx of [6, 10, 14, 18]) { x.beginPath(); x.moveTo(tx, 17.5); x.lineTo(tx + 2.6, 17.5); x.lineTo(tx + 1.3, 14.5); x.closePath(); x.fill(); }
  } else {
    r(x, 5, 12, 16, 2.4);
    x.fillStyle = '#fff';
    for (const tx of [6, 10, 14, 18]) { x.beginPath(); x.moveTo(tx, 12); x.lineTo(tx + 2.6, 12); x.lineTo(tx + 1.3, 14.6); x.closePath(); x.fill(); }
  }
  return o;
}
```

**锚点 B**:`dasher(...)` 访问器之后插入:
```js
  piranha(frame) {
    return cached(`piranha:${frame & 1}`, () => drawPiranha(frame & 1)).cv;
  },
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js`

### Step 4.5 — levels.js:确认 `p`(不重复 Edit)
```bash
grep -n "'p'" /Users/james/Projects/game-hub/games/pixel-quest/src/levels.js
```

### Step 4.6 — /tmp 临时关手验(验后删)

写 `/tmp/level-piranha-test.mjs`(3 根管 `[]` + `p` 居中列、间距留躲避窗、`M` 火花、`F`):
```js
export default {
  id: '7-T', name: '食人花测试', theme: 'mushroom', time: 300,
  rows: [
    '                                                            ',
    '                                                            ',
    '                                                            ',
    '        M                                                   ',
    '                                                            ',
    '              p           p           p                     ',
    '             []          []          []                  F  ',
    '    @                                                       ',
    '############################################################',
    '############################################################',
    '############################################################',
    '############################################################',
  ],
};
```
```bash
node /Users/james/Projects/game-hub/games/pixel-quest/tools/_validate_one.mjs /tmp/level-piranha-test.mjs   # 期望 PASS
```
真机手验:四态升降可见(牙嘴两帧);站管口正上方→不冒出;踩它/侧碰→掉血(踩不死,无敌帧不连扣);吃 `M` 火球→消灭;徒手"等缩回再跳过"可通关;星星接触已冒出的花→秒杀,但藏在管里的花**不**被星星误杀(评审 #10)。验证后 `rm /tmp/level-piranha-test.mjs`。

### Step 4.7 — Piranha 收尾验证 + commit

```bash
for f in entities game render sprites; do node --check /Users/james/Projects/game-hub/games/pixel-quest/src/$f.js; done
node /Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js
git add /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/game.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/render.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js
git commit -m "$(cat <<'EOF'
feat(pixel-quest): Piranha (p) — 4-state rise/sink, stomp-proof, hittable guard vs star instakill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5：甲壳兽 Spiked(字符 `a`,世界 8,踩反伤)

> 行为:行走同 Goomba(collideTiles + groundAhead 折返)。带刺,**任何接触(含踩)都反伤**、不能被踩死(不实现 `stomp`);只能火球/踢壳/星星杀(实现 `kill()`)。
> **公共文件依赖(确认)**:`ENEMY.spikedSpeed`、game.js import 含 `Spiked` + `ENEMY_CTORS.spiked`、render.js import 含 `Spiked`、`ENTITY_CHARS`/`parseLevel` 的 `a`。

### Step 5.1 — entities.js:整类替换 Spiked stub

**锚点**:Task 1 P4.2 的 `export class Spiked { … update() {} }` 单行 stub。Edit 替换为:

```js
// ---------------------------------------------------------------------------
// 甲壳兽 Spiked(世界8,字符 'a')。行走同 Goomba(collideTiles + groundAhead 折返),
// 但带刺:踩它反伤(_playerEnemyCollisions 无条件 _hurtPlayer),不能被踩死、无 stomp。
// 只能 火球 / 踢龟壳 / 星星(三者都调 e.kill)消灭。
export class Spiked {
  constructor(x, y) {
    this.w = 26; this.h = 24;
    this.x = x + (TILE - this.w) / 2;
    this.y = y + (TILE - this.h);
    this.vx = -ENEMY.spikedSpeed;
    this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.anim = 0;
  }
  update(dt, world) {
    const spd = ENEMY.spikedSpeed * world.mode.enemyMul;
    this.vx = this.vx < 0 ? -spd : spd;
    const info = collideTiles(this, world.grid, dt);
    if (info.hitWall) this.vx = -this.vx;
    if (this.onGround) {
      const aheadX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
      if (!groundAhead(world.grid, aheadX, this.y + this.h)) this.vx = -this.vx;
    }
    this.anim += dt * 6;
  }
  frame() { return Math.floor(this.anim) % 2; }
  // NO stomp(): 踩到走 _hurtPlayer。
  kill(world) { this.dead = true; world.sound.kick(); }
}
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js`

### Step 5.2 — game.js:_playerEnemyCollisions 加 Spiked 分支(无条件反伤)

**锚点**:Piranha 分支(Step 4.2 锚点 B)之后追加。落地者按当前文件实读追加:
```js
      } else if (e instanceof Spiked) {
        // 带刺:任何接触(含踩)都反伤,不读 stomping。火球/踢壳/星星走 e.kill。
        this._hurtPlayer();
      }
```
> 星星杀已被顶部 `p.star>0` 分支截走(game.js:474),不会进这里。

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/game.js`

### Step 5.3 — render.js:_enemies 加 Spiked 分支

**锚点**:Piranha 分支之后、`if (cv) {` 之前。Edit 追加:
```js
      } else if (e instanceof Spiked) {
        cv = Sprites.spiked(e.frame());
      }
```
> 无 squish,沿用末尾底部锚定 blit。

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/render.js`

### Step 5.4 — sprites.js:drawSpiked + spiked 访问器

**锚点 A**:`drawPiranha()` 之后插入:
```js
// 甲壳兽 Spiked:深蓝灰硬壳 + 三根背刺,踩反伤(视觉上要"扎手")。行走两帧晃脚。
function drawSpiked(frame) {
  const o = mk(20, 18), x = o.cx;
  x.fillStyle = '#cdd6e0';
  [[5, 6], [10, 8], [15, 6]].forEach(([sx, sy]) => {
    x.beginPath(); x.moveTo(sx - 2.4, sy); x.lineTo(sx, sy - 5.5); x.lineTo(sx + 2.4, sy); x.closePath(); x.fill();
  });
  x.fillStyle = '#8a97a8';
  [[5, 6], [10, 8], [15, 6]].forEach(([sx, sy]) => {
    x.beginPath(); x.moveTo(sx, sy - 5.5); x.lineTo(sx + 2.4, sy); x.lineTo(sx + 0.6, sy); x.closePath(); x.fill();
  });
  x.fillStyle = '#3a4a5e'; x.beginPath(); x.ellipse(10, 11, 9, 6.5, 0, Math.PI, 0); x.fill();
  r(x, 1, 11, 18, 4);
  x.fillStyle = '#56708c'; E(x, 10, 11, 6, 3);
  x.fillStyle = '#26323f'; r(x, 1, 14, 18, 1.5);
  x.fillStyle = '#26323f'; r(x, 5, 11, 1.4, 3); r(x, 13.6, 11, 1.4, 3);
  x.fillStyle = '#1b222b'; r(x, 4, 14.5, 12, 1.2);
  x.fillStyle = '#fff'; E(x, 7, 13.4, 1.8, 2); E(x, 13, 13.4, 1.8, 2);
  x.fillStyle = '#1b1e26'; E(x, 7.3, 13.8, 0.9, 1.2); E(x, 12.7, 13.8, 0.9, 1.2);
  x.fillStyle = '#243b2a';
  if (frame === 1) { E(x, 5, 17, 3, 1.8); E(x, 15, 17, 3, 1.8); }
  else { E(x, 7, 17, 3, 1.8); E(x, 13, 17, 3, 1.8); }
  return o;
}
```

**锚点 B**:`piranha(...)` 访问器之后插入:
```js
  spiked(frame) {
    return cached(`spk:${frame & 1}`, () => drawSpiked(frame & 1)).cv;
  },
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js`

### Step 5.5 — levels.js:确认 `a`(不重复 Edit)
```bash
grep -n "'a'" /Users/james/Projects/game-hub/games/pixel-quest/src/levels.js
```

### Step 5.6 — /tmp 临时关手验(验后删)

写 `/tmp/level-spiked-test.mjs`(`a` 与 `k` 同摆供踢壳;`M` 火花;`*` 星星;平地;`F`):
```js
export default {
  id: '8-T', name: '甲壳兽测试', theme: 'desert', time: 300,
  rows: [
    '                                                                                ',
    '          M                          *                                          ',
    '                                                                                ',
    '    @      k   a        a      k         a        g                    F         ',
    '################################################################################',
    '################################################################################',
    '################################################################################',
    '################################################################################',
  ],
};
```
```bash
node /Users/james/Projects/game-hub/games/pixel-quest/tools/_validate_one.mjs /tmp/level-spiked-test.mjs   # 期望 PASS
```
真机手验:踩 `a` 掉血(不被踩死);吃 `M` 火球打 `a` 死;踩 `k` 成壳后踢出滑壳撞 `a` 死;吃 `*` 后碰 `a` 秒杀且不掉血。验证后 `rm /tmp/level-spiked-test.mjs`。

### Step 5.7 — Spiked 收尾验证 + commit

```bash
for f in entities game render sprites; do node --check /Users/james/Projects/game-hub/games/pixel-quest/src/$f.js; done
node /Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js
git add /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/game.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/render.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js
git commit -m "$(cat <<'EOF'
feat(pixel-quest): Spiked (a) — Goomba walk, stomp-reflects-damage, kill via fire/shell/star

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6：炎魔 Flamer(字符 `m`,世界 9)

> 行为:贴地站立、面朝玩家,每 `flameThrowEvery` 秒喷一发 `EnemyShot`(弧线敌方火球)朝玩家。能被踩死;火球/踢壳/星星 → `kill()`。火球伤玩家由 Task 1 主循环统一处理;Flamer **只调** `world.spawnEnemyShot`,绝不在 update 碰玩家。
> **公共文件依赖(确认)**:`ENEMY.flame*`、`EnemyShot` 类、`game.spawnEnemyShot`/`get enemyShots`/主循环/cull、`render._enemyShots`、game.js import 含 `Flamer` + `ENEMY_CTORS.flamer`、render.js import 含 `Flamer`、`ENTITY_CHARS`/`parseLevel` 的 `m`。

### Step 6.1 — entities.js:整类替换 Flamer stub

**锚点**:Task 1 P4.2 的 `export class Flamer { … update() {} }` 单行 stub。Edit 替换为:

```js
// ---------------------------------------------------------------------------
// 炎魔 Flamer(世界9;字符 'm'):贴地站立、面朝玩家,每 flameThrowEvery 秒喷一发
// EnemyShot(弧线敌方火球)。能被踩死(squish)或被 火球/踢壳/星星 杀。火球的玩家碰撞
// 由 game.update 主循环处理(EnemyShot),不在此扣血——本体只负责喷。
export class Flamer {
  constructor(x, y) {
    this.w = 26; this.h = 28;
    this.x = x + (TILE - this.w) / 2;
    this.y = y + (TILE - this.h);
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.faceRight = false;
    this.throwTimer = ENEMY.flameThrowEvery * (0.5 + Math.random() * 0.5); // 错峰首发
    this.squish = 0;
    this.anim = 0;
  }
  update(dt, world) {
    if (this.squish > 0) { this.squish -= dt; if (this.squish <= 0) this.dead = true; return; }
    this.vx = 0;
    collideTiles(this, world.grid, dt);
    this.anim += dt * 5;
    const p = world.player;
    if (p) {
      const myMid = this.x + this.w / 2;
      const pMid = p.x + p.w / 2;
      this.faceRight = pMid >= myMid;
    }
    this.throwTimer -= dt;
    if (this.throwTimer <= 0) {
      this.throwTimer = ENEMY.flameThrowEvery;
      const dir = this.faceRight ? 1 : -1;
      const sx = this.x + (dir > 0 ? this.w : -14);
      const sy = this.y + this.h * 0.3;
      world.spawnEnemyShot(sx, sy, ENEMY.flameSpeed * dir, -120);
      world.sound.fireball();
    }
  }
  frame() { return Math.floor(this.anim) % 2; }
  stomp(world) { this.squish = 0.4; this.vx = 0; world.sound.stomp(); }
  kill(world) { this.dead = true; world.sound.kick(); }
}
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js`

### Step 6.2 — game.js:_playerEnemyCollisions 加 Flamer 分支(本体可踩死)

**锚点**:Spiked 分支(Step 5.2)之后追加。落地者按当前文件实读追加:
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
```
> 敌方火球的玩家碰撞不在这里——由 Task 1 P4.7 主循环对 `enemyShots` 统一处理。

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/game.js`

### Step 6.3 — render.js:_enemies 加 Flamer 分支(squish 扁平)

**锚点**:Spiked 分支之后、`if (cv) {` 之前。Edit 追加:
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
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/render.js`

### Step 6.4 — sprites.js:drawFlamer + flamer 访问器

**锚点 A**:`drawSpiked()` 之后插入:
```js
// 炎魔 Flamer: 橙红熔岩身 + 双角 + 发光眼 + 头顶火苗(两帧摇曳)。
function drawFlamer(frame) {
  const o = mk(24, 26), x = o.cx;
  const flick = frame === 1 ? 1 : 0;
  x.fillStyle = '#ffd23f';
  x.beginPath(); x.moveTo(12, 0 - flick); x.lineTo(8 + flick, 7); x.lineTo(16 - flick, 7); x.closePath(); x.fill();
  x.fillStyle = '#ff7a1a';
  x.beginPath(); x.moveTo(7, 8); x.lineTo(5 + flick, 4); x.lineTo(9, 8); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(17, 8); x.lineTo(19 - flick, 4); x.lineTo(15, 8); x.closePath(); x.fill();
  x.fillStyle = '#4a1c0c';
  x.beginPath(); x.moveTo(3, 11); x.lineTo(1, 6); x.lineTo(5, 10); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(21, 11); x.lineTo(23, 6); x.lineTo(19, 10); x.closePath(); x.fill();
  x.fillStyle = '#c23a12'; E(x, 12, 16, 9, 8);
  x.fillStyle = '#7a2208'; E(x, 12, 21, 8, 4);
  x.fillStyle = '#ff7a1a'; r(x, 5, 14, 14, 2);
  x.fillStyle = '#ffd23f'; r(x, 8, 18, 1.4, 4); r(x, 14, 17, 1.4, 5); r(x, 11, 20, 1.2, 3);
  x.fillStyle = '#fff2a0'; E(x, 9, 14.5, 2.2, 2.4); E(x, 15, 14.5, 2.2, 2.4);
  x.fillStyle = '#ff3b1a'; E(x, 9, 14.7, 1.1, 1.4); E(x, 15, 14.7, 1.1, 1.4);
  x.fillStyle = '#1b1e26'; E(x, 9, 14.9, 0.5, 0.7); E(x, 15, 14.9, 0.5, 0.7);
  x.fillStyle = '#3a1206'; r(x, 8, 21, 8, 1.6);
  x.fillStyle = '#fff'; r(x, 9, 21, 1.2, 1.4); r(x, 14, 21, 1.2, 1.4);
  x.fillStyle = '#4a1c0c';
  if (frame === 1) { E(x, 7, 25, 3, 1.6); E(x, 17, 25, 3, 1.6); }
  else { E(x, 9, 25, 3, 1.6); E(x, 15, 25, 3, 1.6); }
  return o;
}
```

**锚点 B**:`spiked(...)` 访问器之后插入:
```js
  flamer(frame) {
    return cached(`flm:${frame & 1}`, () => drawFlamer(frame & 1)).cv;
  },
```

**验证**:`node --check /Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js`

### Step 6.5 — levels.js:确认 `m`(不重复 Edit)
```bash
grep -n "'m'" /Users/james/Projects/game-hub/games/pixel-quest/src/levels.js
```

### Step 6.6 — /tmp 临时关手验(验后删)

写 `/tmp/level-flamer-test.mjs`(满铺地面无坑,两只 `m` 错峰、左侧留躲火横向空间,`M` 火花,`F`):
```js
export default {
  id: '9-T', name: '炎魔测试', theme: 'cosmic', time: 300,
  rows: [
    '                                                            ',
    '                                                            ',
    '        M                                                   ',
    '                                                            ',
    '   @                m              m                   F     ',
    '############################################################',
    '############################################################',
    '############################################################',
    '############################################################',
  ],
};
```
```bash
node /Users/james/Projects/game-hub/games/pixel-quest/tools/_validate_one.mjs /tmp/level-flamer-test.mjs   # 期望 PASS
```
真机手验:贴地站、始终面朝玩家;每 ~2.2s 喷紫色 14×14 弧线火球飞向玩家;火球碰玩家掉血(星星状态不掉);火球撞墙/落地/超时消失、不杀其它敌;踩炎魔头→squish 死+弹起;火球打炎魔→死;两只各自独立错峰计时。验证后 `rm /tmp/level-flamer-test.mjs`。

### Step 6.7 — Flamer 收尾验证 + commit

```bash
for f in entities game render sprites; do node --check /Users/james/Projects/game-hub/games/pixel-quest/src/$f.js; done
node /Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js
git add /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/game.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/render.js \
        /Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js
git commit -m "$(cat <<'EOF'
feat(pixel-quest): Flamer (m) — ground caster spits arcing EnemyShots at player, stompable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7：回归 + DoD

### Step 7.1 — 确认无临时测试关残留

```bash
ls /tmp/level-flyer.mjs /tmp/dasher-test.mjs /tmp/level-piranha-test.mjs \
   /tmp/level-spiked-test.mjs /tmp/level-flamer-test.mjs /tmp/smoke-newchars.mjs 2>/dev/null
```
应全部"No such file"。若有残留 → `rm` 之。再确认 `src/levels.js` 的 `LEVELS` 数组未被临时关污染(真机手验时若曾临时塞关,须已回滚):
```bash
git diff --stat /Users/james/Projects/game-hub/games/pixel-quest/src/levels.js   # 应只有 P5 的正式改动,无临时关
```

### Step 7.2 — 全文件 node --check

```bash
for f in config entities game render sprites levels; do
  node --check /Users/james/Projects/game-hub/games/pixel-quest/src/$f.js
done
node --check /Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js
```
全部无输出(通过)。

### Step 7.3 — 现有 20 关 verify-levels 全 PASS

```bash
node /Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js
```
期望 20 关全 PASS(新字符对 verifier 透明,几何零变化)。

### Step 7.4 — 5 个怪类全部已替换 stub(无残留空 update)

```bash
grep -n "update() {} }" /Users/james/Projects/game-hub/games/pixel-quest/src/entities.js
```
应**无匹配**(5 个占位 stub 全被整类替换;EnemyShot 不是 stub)。

### Step 7.5 — 渲染分支齐全(评审 #21:防隐形怪)

```bash
grep -n "instanceof Flyer\|instanceof Dasher\|instanceof Piranha\|instanceof Spiked\|instanceof Flamer" \
  /Users/james/Projects/game-hub/games/pixel-quest/src/render.js
```
应有 5 处(`_enemies` 各一分支)。同样核对 game.js 5 个碰撞分支:
```bash
grep -n "instanceof Flyer\|instanceof Dasher\|instanceof Piranha\|instanceof Spiked\|instanceof Flamer" \
  /Users/james/Projects/game-hub/games/pixel-quest/src/game.js
```
应有 5 处(+ Piranha 顶部星星守卫额外 1 处 `instanceof Piranha`,共 6 处含 Piranha)。

### Definition of Done

- [ ] `config/entities/game/render/sprites/levels.js` 6 文件 `node --check` 全通过。
- [ ] `verify-levels.js` 现有 20 关全 PASS(零回归)。
- [ ] 5 个怪类(Flyer/Dasher/Piranha/Spiked/Flamer)整类实现完毕,无 stub 残留;EnemyShot 实现完毕。
- [ ] type 名 ↔ `ENEMY_CTORS` 键 ↔ 类名 ↔ 字符 四者一致(`flyer/v/Flyer` … `flamer/m/Flamer`)。
- [ ] 公共文件(game/render import、`ENEMY_CTORS`、`ENTITY_CHARS`、`parseLevel`)无重复 Edit、无 `W` 误入(评审 #7/#8/#20)。
- [ ] `_playerEnemyCollisions` 5 分支 + render `_enemies` 5 分支齐全(无隐形怪,评审 #21)。
- [ ] Piranha hidden 态不被星星误杀(`hittable` 守卫,评审 #10)。
- [ ] 踩死语义正确:Flyer 退化态/Dasher/Flamer 可踩死;Piranha/Spiked 踩不死/踩反伤(分支不读 `stomping`)。
- [ ] EnemyShot 玩家碰撞在主循环、cull 在 `_playerEnemyCollisions` 后渲染前(评审 #19)。
- [ ] 所有 `/tmp` 临时测试关已删除;`LEVELS` 无临时关残留。
- [ ] 每个 Task 一个 commit,均只 `git add` pixel-quest 文件、commit 末尾带 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`、分支 `develop`。
- [ ] **上线前 TODO**(阶段 B 不做,记入 backlog):`ENEMY_CTORS` 抛错版改回 `|| Goomba` 兜底(评审 #27);verifier 增加"新怪摆位规则"检查(评审 #26)。

---

### 已应用的评审修复对照

- **#4**:Dasher/Piranha/Spiked/Flamer 的 `_playerEnemyCollisions` 分支锚点改为按 Koopa 块真实闭合 `}`(game.js:515)追加,old_string 用实读文本,不复用不精确片段。
- **#7**:`ENTITY_CHARS` 与 `parseLevel` 本阶段只含 `v/z/p/a/m`,**不含 `W`**;`W` 留阶段 D。
- **#8 / #20**:`parseLevel` 5 条 else if、`ENTITY_CHARS`、game/render import 全集**只在 Task 1 落一次**;Task 2-6 对这些公共文件只 `grep` 确认,不重复 Edit。
- **#10**:Piranha 加 `hittable` 标志,顶部星星分支与碰撞分支都跳过 hidden 态,杜绝星星误杀管内花。
- **#21**:Task 7 用 grep 核对 5 条 render + 5 条 collision 分支齐全,防隐形怪。
- **#22**:Dasher render 分支补 squish 扁平绘制,与 Goomba/Flyer/Flamer 一致。
- **#27**:`ENEMY_CTORS` 上线兜底写进 commit body + DoD backlog。
- **#26**:摆位合理性 verifier 不校验,写进 `_level_kit.md` HARD RULE + DoD 阶段 C 人工验收。

---

**成本提示(协议要求上报)**:本会话累计成本已达 $709.99(COST CRITICAL),本会话已有 36 个文件改动(SCOPE WARNING)。本任务为纯计划产出(我未改任何项目文件、未提交)。落地执行前请确认是否继续投入,并注意上方"只 add pixel-quest 文件、勿 git add -A"铁律以避免把无关的 36 个改动一并提交。
