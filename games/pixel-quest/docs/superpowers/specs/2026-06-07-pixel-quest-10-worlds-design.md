# 像素冒险 PIXEL QUEST — 10 世界扩展设计 (2026-06-07)

> 实现前置:本扩展规模较大(新建 `story.js` + 改 ~8 个文件 + 新增 31 关)。落地前先把工作区里其他未提交改动收敛/提交干净,避免与本次大改交叉冲突;然后按 §六的阶段 A→D 分批实现,每批独立验证。

## 背景与目标(为什么做、现状、本次范围)

**为什么做。** Pixel Quest 是 game-hub 下的浏览器横版跳跃游戏(马里奥式),面向一年级小朋友。当前可玩但缺两样东西:(1) 关卡规模偏小、怪物种类只有 2 种(Goomba/Koopa),后期重复感强;(2) 完全没有剧情,玩家不知道"为什么要闯关"。本次扩展把游戏做成一个**完整的、有头有尾的"救公主"冒险**:10 个世界、50 关、7 种普通怪 + 1 个最终 Boss、一套贯穿始终的像素头像对话剧情。

**现状(已逐条对代码核实)。**
- `src/levels.js`:实测 **只有 20 关**(`1-1`…`4-5`,4 个世界),不是 50 关。
- `src/config.js` `THEMES`:已定义 **20 套主题**(overworld / underground / sky / castle / lava / snow / desert / forest / beach / night / swamp / crystal / storm / steel / abyss / sakura / temple / mushroom / cosmic / celestial),当前 20 关每关用一套、刚好用满。
- `ENTITY_CHARS`(levels.js:11)实测为 `['@','c','g','k','o']` —— **不含** `v z p a m W`(草稿曾误述为"现状已含",以本文档为准:这些是**需新增**的)。
- `src/config.js` `ENEMY`(config.js:22)实测为单行对象 `{ goombaSpeed, koopaSpeed, shellSpeed, fireballSpeed, fireballBounce }` —— 新字段是**追加**,不是整体替换。
- `_spawnEntities`(game.js:141)实测是三元 `e.type==='koopa' ? new Koopa : new Goomba` —— **必须改成查表**,否则新怪全部静默退化成 Goomba。
- 引擎核心机制(`Fireball.update` 的 Koopa→dead/其余→kill、星星 instakill、踩踏判定 `p.vy>0 && (p.y+p.h)-e.y<16`、`update()` 的 `state!=='playing'` 早退、overlays map、`confirm()` 分发、`_updateEnding` cutscene)均已比对属实,可作为实现基础。

**本次范围(明确拍板,解决评审 A 类阻塞)。**
1. **关卡从 20 扩到 50**:保留现有 20 关作为世界 1-4(`worldOf=floor(i/5)+1` 对它们天然成立),**新增 30 关**作为世界 5-9(每世界 5 关),再**新增 1 关** Boss 关 `10-5`。即世界 10 只有 1 关(Boss 竞技场),其余 9 个世界各 5 关 → 共 **46 关**。为保持"10×5=50"的整齐结构与 `worldOf` 推导,世界 10 仍按 5 关位补满:`10-1`…`10-4` 为通往魔城的 4 段普通关(炎魔+全怪混合),`10-5` 为 Boss 关 → **共 50 关**。
2. **"每世界 5 怪"的解读**:指每个世界的关卡里**出现的怪物种类约为 5 种**(复用旧怪 + 引入新怪混搭),给出每世界配方表(§一)。**不是**每世界 5 种全新怪。
3. **"5 怪 + Boss"中的 Boss**:**只有 1 个最终 Boss**(酷霸王,在 `10-5`)。世界 1-9 没有关底 Boss,关尾是 outro 剧情。此为正式范围声明(解决评审第 3、22 条范围二义)。
4. 新增 5 种普通怪:飞翼怪 / 冲刺兽 / 食人花 / 甲壳兽 / 炎魔。
5. 新增剧情系统:开场 + 每世界 intro/outro + Boss 登场 + 结局,像素头像对话弹窗。
6. **内存约束**(iPad 实测敏感):主题**只新增 1 套**(`bowser`),其余世界全部复用上述 20 套现成主题;新怪与 Boss sprite 走现有 `cached()` 缓存,不引入新的大位图。

**不在本次范围**:世界 1-9 的关底 Boss;触碰伤害的地形机关格(尖刺/岩浆格);多人对话(头像统一左侧);存档系统改造。

---

## 一、世界结构

### 权威世界主表(所有剧情/关卡/怪物配置以此为准 —— 解决评审第 2 条"三草稿互相矛盾")

> 世界号 1-based;`levelIndex` 0-based,`worldOf(i)=floor(i/5)+1`。每世界 5 关 `x-1`…`x-5`,各关复用一套现成主题(护内存)。"引入新怪"=该世界首次出现的新怪种;"本世界 5 怪"=该世界关卡里会出现的怪种配方。

| 世界 | 名称 | 5 关主题(各关一套现成主题) | 引入新怪 | 本世界怪物配方(≈5 种) |
|---|---|---|---|---|
| 1 蘑菇平原 | 草原起点 | overworld / underground / sky / lava / snow | —(仅基础怪) | g(Goomba)、k(Koopa) |
| 2 失落边境 | 边境前哨 | desert / forest / beach / night / castle | — | g、k、o(道具/平台等基础) |
| 3 魔界裂隙 | 越走越险 | swamp / crystal / storm / steel / abyss | — | g、k(密度↑、坑↑) |
| 4 天空回廊 | 云端试炼 | sakura / temple / mushroom / cosmic / celestial | — | g、k(空中平台多) |
| 5 烈焰熔域 | 火焰防线 | lava / desert / steel / storm / castle | **飞翼怪 v** | v、g、k |
| 6 寒霜绝境 | 冰天雪地 | snow / crystal / sky / night / celestial | **冲刺兽 z** | z、v、g、k |
| 7 毒林深处 | 管道伏击 | swamp / forest / mushroom / underground / abyss | **食人花 p** | p、z、g、k(p 配火花道具) |
| 8 黄沙古城 | 古城机关 | desert / temple / steel / beach / castle | **甲壳兽 a** | a、p、k(k 提供龟壳消 a) |
| 9 星界回廊 | 最后考验 | cosmic / celestial / sky / storm / crystal | **炎魔 m** | m、a、p、z、v、g、k(大集合) |
| 10 酷霸王魔城 | 魔城决战 | 10-1…10-4 全用新主题 `bowser`;10-5 `bowser` | **酷霸王 W**(Boss) | 10-1…10-4:m、a、z、g、k;10-5:仅 Boss W |

> 火/冰顺序自洽:世界 5 = 烈焰(火)→ 世界 5 outro "前面好冷"→ 世界 6 = 寒霜(冰)intro "到处都是冰",严丝合缝。术语统一(解决评审第 7 条):中途坏蛋据点一律叫"前哨/要塞/据点",**最终唯一**叫"酷霸王魔城"。

### 难度曲线

- **世界 1-4(现有 20 关)**:基础怪密度与坑宽随世界递增,保持现状曲线不动。
- **世界 5-9**:每世界引入 1 种新怪并叠加旧怪;新怪密度从世界 5 的"零星几只"到世界 9 的"全怪大集合"。`time` 随关卡长度给足;`mode.enemyMul`(现有难度倍率)继续生效于新怪速度。
- **世界 10**:`10-1`…`10-4` 为高强度混合关(炎魔远程压制 + 甲壳兽/冲刺兽地面压制);`10-5` 为固定竞技场 Boss 战,`time: 999`,无坑。

### 主题复用与"仅新增 1 主题"的内存考量

- 50 关只用 **20 套现成主题 + 1 套新主题 `bowser`** = 21 套,**复用率高**。`bowser` 复用现有 tile 绘制函数(drawGround/drawBlock 等读 theme 颜色),**不新增 tile sprite**。
- 怪物/Boss/头像 sprite 全部走 `Sprites.cached(key, make)`:首帧惰性绘制一次、之后命中缓存;`Sprites.clearCache()`(visibilitychange/绘制出错)自动重建。新增的位图都是 ≤58px 的小 canvas,对 iPad 内存压力极小。
- 不引入逐帧动画大图、不引入额外 THEME tile 图集 —— 这是满足"iPad 内存敏感"的核心设计约束。

---

## 二、新怪物规格(5 种)

> 引擎事实(已核实,所有新怪共享):敌人由 `_spawnEntities`(game.js:140-141)的 `lv.enemies.map` 构造;update 在 game.js:348-352 统一 `e.update(dt, world)`,并对 `e.y > lv.height+80` 标记 `dead`;碰撞在 `_playerEnemyCollisions`(game.js:395-446),星星 instakill 在该函数顶部(game.js:403-407),踩踏判定 `const stomping = p.vy>0 && (p.y+p.h)-e.y<16;`;火球杀敌在 `Fireball.update`(entities.js:361-370,Koopa→dead,其余→`e.kill(world)`);渲染在 `render._enemies`(render.js:234-258),底部锚定 `Sprites.blit(ctx, cv, e.x, e.y+e.h-cv.height*sc, sc)`;sprite 走 `cached(key, make)`(sprites.js:319-323)。
>
> **架构铁律**:新怪"碰到掉血"一律放在 `_playerEnemyCollisions` 分支里调 `this._hurtPlayer()`(复用无敌帧/星星短路),**不在实体 update 里直接扣血**。例外:炎魔的远程火球用独立的 `EnemyShot`(见 §二 P4 与 §二.5 炎魔)。

### 公共前置改动(所有新怪都依赖)

**(P1) config.js — ENEMY 追加(不是替换)**

```js
// config.js:22 现有: export const ENEMY = { goombaSpeed:46, koopaSpeed:40, shellSpeed:320, fireballSpeed:320, fireballBounce:360 };
// 改为追加新字段(保留全部现有字段):
export const ENEMY = {
  goombaSpeed: 46, koopaSpeed: 40, shellSpeed: 320, fireballSpeed: 320, fireballBounce: 360,
  flyerSpeed: 55, flyerAmp: 40, flyerFreq: 1.6,
  dasherPatrol: 30, dasherDash: 280, dasherSight: 260, dasherCooldown: 1.2, dasherWindup: 0.35,
  piranhaUp: 90, piranhaHideT: 1.6, piranhaShowT: 1.8, piranhaRise: 30,
  spikedSpeed: 38,
  flameThrowEvery: 2.2, flameSpeed: 200,
};
```

**(P2) game.js — 敌人工厂改查表(关键,否则新类型全退化为 Goomba)**

```js
import { Player, Goomba, Koopa, Coin, Powerup, Fireball, MovingPlatform,
         Flyer, Dasher, Piranha, Spiked, Flamer, EnemyShot, Bowser } from './entities.js';
const ENEMY_CTORS = { goomba: Goomba, koopa: Koopa, flyer: Flyer, dasher: Dasher,
                      piranha: Piranha, spiked: Spiked, flamer: Flamer, bowser: Bowser };
// _spawnEntities full 分支替换三元(game.js:141):
this.enemies = lv.enemies.map((e) => { const C = ENEMY_CTORS[e.type] || Goomba; return new C(e.x, e.y); });
```

**(P3) entities.js — 顶部 import 追加 `SOLID`**(多个新怪需要直接查 grid):
`import { TILE, GRAVITY, PLAYER, FORGIVE, ENEMY, SOLID } from './config.js';`

**(P4) game.js — 敌方火球容器(炎魔/Boss 用)**:新增独立数组 `this.enemyShots = []`(constructor + `_spawnEntities` 重置处);world facade 加 `get enemyShots(){return game.enemyShots;}` 与 `spawnEnemyShot(x,y,vx,vy){game.enemyShots.push(new EnemyShot(x,y,vx,vy));}`;update() 主循环追加更新+玩家碰撞+cull:
```js
for (const s of this.enemyShots) {
  if (s.dead) continue;
  s.update(dt, this._world);
  if (!s.dead && aabb(this.player, s) && this.player.dying <= 0) { s.dead = true; this._hurtPlayer(); }
}
this.enemyShots = this.enemyShots.filter((s) => !s.dead);
```
> `_hurtPlayer→takeDamage` 在 `p.star>0` 时自动短路(entities.js:134),故星星状态下敌方火球不伤人,符合预期。

**(P5) 字符成对修改铁律**(解决评审第 15、16 条):每个新字符必须**同时** (a) 加进 `ENTITY_CHARS`(才进入 entity 分支),(b) 在 `parseLevel` 的 if/else 链加一条 `else if`(才被解析)。漏一处则字符被静默忽略。本次一次性把 6 个字符全加:
`ENTITY_CHARS = new Set(['@','c','g','k','o','v','z','p','a','m','W']);`

---

### 1. 飞翼怪 Flyer(世界 5 引入;字符 `v`)

- **行为**:正弦曲线在空中巡航(不受重力、不走 collideTiles,仅水平撞墙折返)。踩第一脚 → 掉翅膀变普通行走怪(`winged=false`,退化为 Goomba 式地面巡逻);踩第二脚 → squish 死。火球/星星/踢壳直接死。
- **实体类**(entities.js,仿 Goomba):字段 `w=24,h=22,baseY(悬停中心线),vx=-flyerSpeed,winged=true,t(正弦相位),squish,anim`。`update`:winged 时 `y = baseY + sin(t*2π)*flyerAmp`,水平移动 + 探测前方一格 `SOLID` 折返;非 winged 时复用 `collideTiles`+`groundAhead` 地面逻辑。方法 `loseWings()`(去翅、baseY=当前y)、`stomp(world)`(squish=0.4)、`kill(world)`(dead=true)。
- **碰撞处理**(`_playerEnemyCollisions` 新增 `else if (e instanceof Flyer)`):`stomping` 且 `e.winged` → `loseWings(); p.vy=-360`;`stomping` 且非 winged → `stomp(); p.vy=-440`;非踩 → `_hurtPlayer()`。
- **精灵**(sprites.js `drawFlyer(state,frame)`):紫红身体(区别 Goomba 棕色),`state==='fly'` 画上下扇动的白翅膀两帧,行走态不画翅膀。访问器 `flyer(state,frame)` 经 `cached('fly:'+state+':'+(frame&1), ...)`。
- **关卡字符 + ENTITY_CHARS + parseLevel**:`v` 已在 §P5 集合;parseLevel 加 `else if (ch==='v') enemies.push({type:'flyer', x:px, y:py});`。摆位放在半空(row 6-8),构造器以 `y` 为悬停中心线。
- **verifier 与 kit 改动**:verify-levels.js **逻辑无需改**(`v` 是实体,gridRow 留 null,对 WALK/坑/步/blocks 判定透明;飞翼怪不能当"桥",其所在列若是坑仍按坑算,符合预期)。`_level_kit.md` Entity markers 段补 `v 飞翼怪(空中)`。

### 2. 冲刺兽 Dasher(世界 6 引入;字符 `z`)

- **行为**:三态 `patrol→windup→dash`。巡逻同 Goomba;当玩家与其大致同一水平线(`|脚部y差|<TILE`)且在视野水平距离 `dasherSight` 内 → 进入 `windup`(原地蓄力 `dasherWindup` 秒)→ `dash`(以 `dasherDash` 速度冲向玩家)→ 撞墙或前方悬崖结束,回 patrol 并进入 `dasherCooldown`。
- **实体类**:字段 `w=28,h=24,state,timer,cooldown,dashDir,squish,anim`。`update` 按三态切换(详见 §一草稿逻辑,已对齐 collideTiles/groundAhead)。`stomp()`、`kill()` 同 Flyer。
- **碰撞处理**:`else if (e instanceof Dasher)`:`stomping` → `stomp(); p.vy=-440`;否则 `_hurtPlayer()`(冲刺中撞到也走此分支,靠无敌帧自然防连击,无需 kickGrace)。
- **精灵** `drawDasher(state,frame)`:低身带犄角,`state==='dash'` 时身体发红(`#ff5a3c`)、奔跑两帧。访问器 `dasher(state,frame)`。
- **字符/解析**:`z` 在集合;parseLevel `else if (ch==='z') enemies.push({type:'dasher', x:px, y:py});`。摆地面行,给一段平直地面让冲刺有意义。
- **verifier/kit**:透明,kit 补 `z 冲刺兽(地面)`。

### 3. 食人花 Piranha(世界 7 引入;字符 `p`;踩不死)

- **行为**:固定位置不水平移动,四态定时升降 `hidden→rising→shown→sinking`(经典管道伏击)。玩家压在管口正上方时不冒出(防呆)。**踩不死**——任何接触(含踩)都掉血;只能用火球或躲过。
- **实体类**:字段 `w=26,h=30,baseY(=y+TILE,缩回时头顶/管口线),state,timer,anim`。`update` 按四态升降,`hidden` 态检测玩家是否压在管口决定是否冒出。**不实现 `stomp`**;实现 `kill(world)`(火球/星星可杀)。
- **碰撞处理**(踩不死的关键):`else if (e instanceof Piranha)`:`if (e.state==='hidden') continue;` 否则**无条件** `this._hurtPlayer();`(**不读 `stomping`**)。火球杀走 `Fireball.update→e.kill`(Piranha 有 kill,OK);星星杀走顶部统一 `e.kill`。
- **精灵** `drawPiranha(frame)`:绿茎 + 红头白点 + 开合两帧的牙嘴。访问器 `piranha(frame)`。
- **字符/解析**:`p` 在集合;parseLevel `else if (ch==='p') enemies.push({type:'piranha', x:px, y:py});`。放管口(`[]` 上方一格)。world 7 主题含 mushroom/forest/underground,管道多。
- **渲染防呆**:`e.state==='hidden'` 时 render 不赋值 `cv`,靠末尾 `if (cv)`(render.js:254)自然跳过 blit。
- **verifier/kit**:透明,kit 补 `p 食人花(管口伏击,踩不死,用火球/躲;关卡须配火花道具)`。**配套关卡设计要求**(解决评审第 25 条):世界 7 凡有 `p` 的段落必须给到火花道具 `M`,且永远留出"等它缩回再跳过"的躲避路径,避免小火力状态卡关。

### 4. 甲壳兽 Spiked(世界 8 引入;字符 `a`;踩了反伤)

- **行为**:行走同 Goomba,但**带刺**——踩它**反伤玩家**,不能被踩死。只能用火球 / 踢龟壳 / 星星消灭。
- **实体类**:字段 `w=26,h=24,vx=-spikedSpeed,anim`。`update` 完全复用 Goomba 地面巡逻(collideTiles+groundAhead 折返)。**不实现 stomp/squish**;实现 `kill(world)`。
- **碰撞处理**(踩反伤的关键):`else if (e instanceof Spiked)`:**无条件** `this._hurtPlayer();`(含踩)。三种杀法**零额外代码**:火球(`Fireball.update` 对有 kill 的敌人调 kill ✓)、星星(顶部分支 ✓)、踢壳(`Koopa.update` slide 分支对碰到的敌人调 `e.kill` ✓)。这正是"踩反伤、只能火/壳/星杀"的精确实现。
- **精灵** `drawSpiked(frame)`:深蓝灰硬壳 + 三根背刺 + 行走两帧。访问器 `spiked(frame)`。
- **字符/解析**:`a` 在集合;parseLevel `else if (ch==='a') enemies.push({type:'spiked', x:px, y:py});`。世界 8 必须与 Koopa `k` 同摆,让玩家能用踢壳消灭甲壳兽。
- **verifier/kit**:透明,kit 补 `a 甲壳兽(带刺/踩反伤,只能火球/踢壳/星星杀)`。

### 5. 炎魔 Flamer(世界 9 引入;字符 `m`;喷敌方火球)

- **行为**:原地(或慢速)、朝玩家、每 `flameThrowEvery` 秒喷一发**敌方火球** `EnemyShot`(伤玩家、不杀敌、带弱重力弧线、撞墙/超时即灭)。本体能被踩死、碰伤。
- **实体类 Flamer**:字段 `w=26,h=28,throwTimer,faceRight,squish,anim`。`update`:`collideTiles` 贴地,朝向玩家,`throwTimer<=0` 时 `world.spawnEnemyShot(...)` + `world.sound.fireball()`。`stomp()`、`kill()`。
- **EnemyShot 类**(entities.js,见 §P4):`w=14,h=14,life=3.0`,`update` 走 `collideTiles(this, grid, dt, {gravity:600})`(physics.js:24 支持第 4 参 opts.gravity),落地反弹或灭,撞墙/天花板/超时即 `dead`。**不在自身 update 碰玩家**——玩家碰撞统一在 game.update 主循环做(§P4),保持"实体不直接扣血"架构。
- **碰撞处理**(本体):`else if (e instanceof Flamer)`:`stomping` → `stomp(); p.vy=-440`;否则 `_hurtPlayer()`。
- **精灵**:`drawFlamer(frame)` 熔岩魔(橙红身 + 角 + 发光眼 + 火苗顶两帧);敌方火球渲染新增 `render._enemyShots`(紫色 `#c46bff`,区别玩家橙火),在 render() 的 `this._fireballs(...)` 调用之后插入 `this._enemyShots(ctx, game);`(用方法名锚点,不用裸行号——见评审第 17 条)。访问器 `flamer(frame)`。
- **字符/解析**:`m`(小写,未与大写 `M` qpower 冲突)在集合;parseLevel `else if (ch==='m') enemies.push({type:'flamer', x:px, y:py});`。世界 9 是"全怪大集合",`v z p a m g k` 混摆,给足玩家躲火球的空间。
- **verifier/kit**:透明。注意"不引入触碰伤害机关格"指的是**地形格**(尖刺/岩浆 tile);怪物远程火球是"靠怪"的难度,符合决策。kit 补 `m 炎魔(定时喷火球)`。

---

## 三、酷霸王 Boss 战(`10-5` 竞技场)

> 决策:固定竞技场;**HP=5**;踩一脚扣 1(玩家弹起、Boss 短暂无敌 0.9s + 击退);玩家火球扣 1;星星接触扣 1(受无敌帧限频)。Boss 朝玩家走 / 定时跳 / 定时喷敌方火球。血量归零 → 公主笼打开 → 现有结局过场 → ENDING 对话 → win。**套用现有踩踏/火球引擎,不引入瞬杀斧头。**

- **Boss 实体 `Bowser`**(entities.js):`w=54,h=58,hp=5,invuln,state('walk'|'jump'|'hurt'|'defeated'),faceRight,throwTimer,jumpTimer,defeatT,anim`。`update`:朝玩家慢走(70px/s);`onGround && jumpTimer<=0` 跳(vy=-620);`throwTimer<=0` 喷敌方火球;`state==='defeated'` 时只受重力倒地、`defeatT` 累加。核心方法 `hit(world, fromDir)`:`if (invuln>0||state==='defeated') return false;` 否则 `hp-=1; invuln=0.9; vx=fromDir*120; vy=-200;` 若 `hp<=0` → `state='defeated'; vy=-260; return true`。

- **HP / 攻击**:HP=5;攻击 = 朝玩家走撞 + 定时跳 + 定时敌方火球(`spawnEnemyShot`,玩家碰撞已在 §P4 主循环统一处理)。

- **碰撞处理(防秒杀,解决评审第 5、20 条)**:
  - **星星分支例外**(game.js:403-407 内):`if (e instanceof Bowser) e.hit(this._world, p.faceRight?1:-1);`(每接触扣 1,受 invuln 限频),其余敌人走通用 `e.dead/e.kill`。
  - **普通 Boss 分支**:`else if (e instanceof Bowser)`:`defeated` 时 continue;`stomping && invuln<=0` → `const dead=e.hit(...); p.vy=-440;` 若 dead → `this._defeatBoss(e)`;非踩且 `invuln<=0` → `_hurtPlayer()`;`invuln>0` 期间不互伤(防击退瞬间连击)。
  - **玩家火球分支**(`Fireball.update` 内,entities.js):用**鸭子类型**判定避免类声明顺序问题——`if (typeof e.hit==='function' && e.hp!==undefined) { e.hit(world, this.vx>=0?1:-1); world.addScore(200); this.dead=true; return; }`,否则走原 Koopa/kill 逻辑。
  - **判定归属明确**(消二义):game.js 内用 `instanceof Bowser`(已 import);entities.js 的 `Fireball.update` 用鸭子类型(同模块声明顺序)。
  - **防坠落清除**:`10-5` 竞技场地面满铺无坑,`e.y>lv.height+80→dead`(game.js:351)不会误伤 Boss。

- **击败触发结局**:新增 `game._defeatBoss(boss)` 设 `this.bossDefeated=true; this.bossDefeatTimer=1.4; Sound.win();`。update() 的 playing 段开头加冻结:`if (this.bossDefeated){ this.bossDefeatTimer-=dt; if (this.bossDefeatTimer<=0){ this.bossDefeated=false; this._winGame(); } this._updateCamera(); return; }`。**复用现有 `_winGame()`**(它清场→走向 `lv.castleX` 公主→kneel→crown→celebrate),`_updateEnding` 的 celebrate 收尾接 ENDING 对话(见 §四 5.4)。
  - **跨文档依赖(解决评审第 18 条)**:此路径要求 `10-5` 关卡**同时含 castle `A`**(放竞技场最右,供 `_winGame` 走位)。剧情系统的 ENDING 触发(§四)显式依赖本节方案。

- **关卡 `10-5` 要点(lvlBowser)**:新主题 `bowser`,固定竞技场,四壁+天花板用 `X`,地面满铺 `#` **无坑**(verifier:0 deadly cols);`@` 在最左 row 9;Boss `W` 在中右 row 9;castle `A` 在最右(公主站位/结局走位);上方可放 2-3 排 `B`/`=` 供玩家借力踩 Boss;`time: 999`。`10-5` **不含 flag `F`**,只有 castle `A` + Boss `W`。

- **公主笼 + HP 心(render)**:`_flagAndCastle` 在 `game.theme==='bowser'` 且未击败时,于 `lv.castleX` 公主外画竖条铁笼,`game.bossDefeated || game.state==='ending'` 时不画(笼开);Boss 头顶用 `❤️/🖤` 画 5 颗心(读 `game.enemies.find(e=>e instanceof Bowser).hp`)。Boss 受击 invuln 期间闪烁(`globalAlpha` 切换)。

- **Boss 主题 `bowser`(唯一新增主题)**:config.js THEMES 追加 `bowser: { skyTop:'#1a0508', skyBot:'#3a0a0a', ground:'#4a2a2a', groundDark:'#2a1414', grass:'#7a2020', hills:'#250606' }`。复用现有 tile 绘制,不新增 tile sprite。

- **状态机**:Boss 战在 `playing` 进行;击败 → `bossDefeated` 短计时 → `_winGame` → `ending` → ENDING 对话 → `win`。`nextLevel`(game.js:204-208)无需改(`10-5` 是最后一关,Boss 死亡与到达 castle 都汇入 `_winGame`)。

- **字符/解析**:`W` 在 §P5 集合;parseLevel `else if (ch==='W') enemies.push({type:'bowser', x:px, y:py});`;`ENEMY_CTORS.bowser = Bowser`。verifier 对 `W` 透明、对 `A` 走 castle 目标判定、无坑 → PASS。

---

## 四、剧情系统架构

> 目标:在现有 `menu→story→ready→playing↔paused→levelclear→win/gameover` 状态机里,加入**通用剧情对话弹窗系统**(像素头像 + 名字 + 文字 + ▶继续,逐节点推进),用于开场 / 每世界 intro / outro / Boss 后 ENDING。设计原则:复用现有引擎(overlays map、`confirm()` 四通道、`Sprites.cached`、`Sound.ui`),最小化新概念。

### 数据模型 — 新建 `src/story.js`

一个对话节点:`{ speaker: '国王', portrait: 'king', text: '……' }`(`speaker`=中文显示名;`portrait`=英文 key ∈ `king|mario|princess|bowser|herald`;`text`≤38 字,长内容拆多节点)。导出:

```js
export const OPENING = [ ... ];
export const WORLD_INTRO = { 1:[...], 2:[...], ..., 10:[...] };   // 对象避免 0 偏移
export const WORLD_OUTRO = { 1:[...], ..., 9:[...] };             // 世界10无 outro(收尾是 ENDING)
export const ENDING = [ ... ];
export function worldOf(i)            { return Math.floor(i / 5) + 1; }
export function isWorldFirstLevel(i)  { return i % 5 === 0; }
export function isWorldLastLevel(i)   { return i % 5 === 4; }
export function introFor(i) { return WORLD_INTRO[worldOf(i)] || []; }  // 空脚本→直接跳过
export function outroFor(i) { return WORLD_OUTRO[worldOf(i)] || []; }
```

> 空脚本安全降级让"对话系统可与关卡扩展解耦上线":未填世界返回 `[]`,运行器立即 onDone 不卡死。`worldOf` 对当前 20 关与扩展后 50 关均正确。

### 头像精灵 — 改 `src/sprites.js`

- **复用** `drawPrincess()` → `portrait:'princess'`;**新增** `drawKingHead/drawMarioHead/drawBowserHead/drawHeraldHead`(用现有 `mk/r/E` 辅助,放 `// ---- portraits ----` 段,统一逻辑尺寸 ~32×32)。`drawMarioHead` 可裁用 `drawHero('big')` 头部以与游戏内主角一致。`drawBowserHead` 卡通不吓人(与对白软化基调统一,见 §五受众约束)。
- **统一访问器**(走 `cached`,自动随 `clearCache()` 重建):
```js
portrait(key) {
  switch (key) {
    case 'princess': return Sprites.princess();
    case 'king':    return cached('portrait:king',   () => drawKingHead()).cv;
    case 'mario':   return cached('portrait:mario',  () => drawMarioHead()).cv;
    case 'bowser':  return cached('portrait:bowser', () => drawBowserHead()).cv;
    case 'herald':  return cached('portrait:herald', () => drawHeraldHead()).cv;
    default:        return cached('portrait:mario',  () => drawMarioHead()).cv;
  }
},
```

### 对话弹窗 UI(混合 DOM + canvas)

- **取舍结论**:DOM 容器(复用 `.overlay/.panel/.big-btn/.tiny`,自动换行 + 触摸命中 + 无障碍)+ 内嵌 1 个 `<canvas>` 只画像素头像(nearest-neighbour,CSS `image-rendering:pixelated` 放大)。
- **index.html**(放 `#overlay-win` 后、`#touch-controls` 前):`#overlay-dialogue` > `.dialogue-panel` > `.dlg-row`(`<canvas id="dlg-portrait" width="32" height="32">` + `.dlg-body`(`#dlg-speaker` 名字 + `#dlg-text` 台词)) + `#btn-dlg-next`("▶ 继续") + `.tiny`("按 跳/手柄✕ 继续")。
- **style.css**:加 `.dialogue-panel/.dlg-row/.dlg-portrait/.dlg-body/.dlg-speaker/.dlg-text` 少量布局(头像左、文字右、头像 `image-rendering:pixelated`,CSS 放大如 96×96)。
- **渲染方式**:头像 = JS 取 `Sprites.portrait(key)` 后 `ctx.imageSmoothingEnabled=false` + `drawImage` 进 `#dlg-portrait`;名字/台词 = `textContent`(DOM 自动换行);▶继续 = 推进一节点。

### 通用 dialogue 状态机 — 改 `src/game.js` + `src/main.js`

- **新增 1 个 state `dialogue`**:非 playing,故 `update()` 的 `if (state!=='playing') return;`(game.js:312)天然不跑模拟;进 overlays map 后 `syncOverlays` 自动显隐;touch-controls 因 `s==='playing'||'ready'` 判断自动隐藏。
- **Game 字段 + 方法**(constructor 加 `this.dialogue=null`):
```js
startDialogue(script, onDone) {
  if (!script || script.length === 0) { if (onDone) onDone(); return; }   // 空脚本直接 onDone
  this.dialogue = { script, index: 0, onDone: onDone || null };
  this.state = 'dialogue'; Sound.stopMusic(); Sound.ui();
}
advanceDialogue() {
  const d = this.dialogue; if (!d) return;
  d.index += 1;
  if (d.index >= d.script.length) { const done = d.onDone; this.dialogue = null; if (done) done(); return; }
  Sound.ui();
}
currentDialogueNode() { const d = this.dialogue; return d ? d.script[d.index] : null; }
```
> `onDone` 是 continuation,**由它决定 state 去向**(进关/下一关/进 win),`startDialogue` 不假设结局。(删去草稿里"可选/无碍"的 `prevState` 死字段——解决评审第 23c。)
- **`confirm()` 加** `case 'dialogue': this.advanceDialogue(); break;`。
- **main.js**:(a) overlays map 加 `dialogue: el('overlay-dialogue')`;(b) `el('btn-dlg-next').addEventListener('click', () => game.advanceDialogue())`;(c) `handleConfirm()` switch 加 `case 'dialogue': game.advanceDialogue(); break;`(键盘跳/手柄✕/点空白/点▶四通道全推进);(d) **`syncOverlays()` 在 `if (s===lastState) return` 短路之前**单独刷 dialogue 节点(state 不变但 index 变,不能走短路):用 `_lastNode` 脏标记,变化时写 `dlg-speaker/dlg-text.textContent` 并把 `Sprites.portrait(node.portrait)` drawImage 进 `#dlg-portrait`;离开 dialogue 复位 `_lastNode=null`。

### 4 类触发接入点(具体到函数)

**5.1 开场 OPENING**(保留静态 story 作封面,改动最小):
```js
beginAfterStory() {
  this.startDialogue(OPENING, () => this.startDialogue(introFor(0), () => this.loadLevel(0)));
}
```
`btn-story-go`/story confirm 已调 `beginAfterStory()`(main.js),无需再改。点"▶开始冒险"→ OPENING → 世界1 intro → `loadLevel(0)`。

**5.2 + 5.3 世界 intro / outro(合并进 `nextLevel`,以此完整版为准)**:
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
> 刚通关世界最后一关 → 先 outro 再(若跨入新世界第一关)intro 再 loadLevel。`continueRun()`(game-over 重玩走 `loadLevel(levelIndex)`,不经 nextLevel)**不会重播 intro**——正确。空脚本世界自动跳过。

**5.4 Boss 后 ENDING(衔接现有 cutscene)**:改 `_updateEnding` 的 celebrate 收尾:
```js
if (e.phase === 'celebrate') {
  e.confettiT -= dt;
  if (e.confettiT <= 0) { this._spawnConfetti(); e.confettiT = 0.04; }
  if (e.t > 2.8) { this.ending = null; this.startDialogue(ENDING, () => { this.state = 'win'; }); }
  return;
}
```
> 依赖 §三 Boss 方案:`10-5` 含 castle `A`,Boss 死 → `_defeatBoss` → `_winGame` → cutscene → ENDING 对话 → win overlay。

### 剧情系统补充决策(解决评审第 23a/23b)

- **dialogue 与 paused 互斥**:dialogue 进行中屏蔽暂停键(`Input.on('pause')` 在 `state==='dialogue'` 时不进 paused),避免叠加 overlay。
- **可跳过/快进**:`#btn-dlg-next` 长按或第二次"跳"键可一次性 `advanceDialogue` 到脚本末尾(`while index<len` 直接 onDone),照顾重玩的小朋友。实现为 `skipDialogue()` 方法,绑到一个"跳过"小按钮(可选,二期)。

---

## 五、全部剧情文案

> 规范(解决评审第 24 条):统一 `- 中文名(portraitKey): "台词"`。受众约束(解决评审第 10-13 条):一年级口语高频词、句子短(每句意象 ≤3)、卡通化威胁不吓人(无"受死/不知死活")、生字可在 `dlg-text` 旁留拼音位(交互决策见 §四 4.x,默认零生字优先)。叙事统一(解决第 5-9 条):侍从 herald 全程当画外向导;公主在世界 8 outro 提前露一句呼救;世界 4 的"力量"在 Boss 战回收;中段轻点"驸马/答应"主线;术语"前哨/要塞"vs 唯一"酷霸王魔城"。

### OPENING
- 国王(king): "不好啦!桃花公主被酷霸王抓走了!"
- 国王(king): "谁能把公主救回来,我就把他招为驸马!"
- 侍从(herald): "可是……能去的勇士,都被酷霸王打败了。"
- 侍从(herald): "现在没人敢去啦,呜呜。"
- 马里奥(mario): "别怕!交给我!"
- 马里奥(mario): "我去把公主救回来!出发啦!"

### 世界1 蘑菇平原 intro
- 侍从(herald): "勇士,先穿过这片蘑菇平原吧!"
- 马里奥(mario): "草地、山洞、天空,还有热熔岩和冷雪地。"
- 马里奥(mario): "我顺着酷霸王的脚印,一路追上去!"

### 世界1 蘑菇平原 outro
- 马里奥(mario): "耶!平原闯过来啦!"
- 马里奥(mario): "前面是陌生的边境……公主,我来了!"

### 世界2 失落边境 intro
- 侍从(herald): "这里是失落边境:沙漠、森林、海边,还有黑夜。"
- 侍从(herald): "那座城堡是坏蛋的小基地。"
- 马里奥(mario): "我把它攻下来,找到公主的下落!"

### 世界2 失落边境 outro
- 马里奥(mario): "前哨,攻破!"
- 侍从(herald): "马里奥!公主被带去更深的地方了,小心呀!"
- 马里奥(mario): "知道啦!我继续追!"

### 世界3 魔界裂隙 intro
- 侍从(herald): "哇……这里是魔界裂隙,好可怕。"
- 马里奥(mario): "毒沼、水晶矿、打雷的山。"
- 马里奥(mario): "越走越吓人,但我不怕!继续往里冲!"

### 世界3 魔界裂隙 outro
- 马里奥(mario): "呼……魔界裂隙,走完啦!"
- 马里奥(mario): "我好像越来越有劲了!继续前进!"

### 世界4 天空回廊 intro
- 侍从(herald): "这里是天空回廊,飘在云上面。"
- 马里奥(mario): "樱花、神殿、大蘑菇,还有星空。"
- 马里奥(mario): "听说闯过这些考验,就能得到厉害的力量!我试一试!"

### 世界4 天空回廊 outro
- 马里奥(mario): "考验通过!我浑身都是劲儿!"
- 马里奥(mario): "有了这股力量,坏蛋们等着吧!"

### 世界5 烈焰熔域 intro
- 侍从(herald): "好烫!这里是烈焰熔域,火焰军团的地盘。"
- 马里奥(mario): "咦?天上有会飞的怪!那是飞翼怪!"
- 马里奥(mario): "踩它一脚,它就掉下来啦。冲过去!"

### 世界5 烈焰熔域 outro
- 马里奥(mario): "火焰防线,突破成功!飞的也拦不住我!"
- 马里奥(mario): "想到能救出公主,我就更有劲了。"
- 马里奥(mario): "前面好冷……是冰天雪地。继续走!"

### 世界6 寒霜绝境 intro
- 侍从(herald): "勇士!前面是寒霜绝境,到处都是冰!"
- 马里奥(mario): "好冷啊……我哈口气暖暖手!"
- 侍从(herald): "小心!这里有会突然冲过来的冲刺兽!"
- 马里奥(mario): "我看准它,一脚踩扁!穿过去就行!"

### 世界6 寒霜绝境 outro
- 侍从(herald): "太棒了!你冲过了冰天雪地!"
- 马里奥(mario): "下一站……呀,是黑黑的毒林!"

### 世界7 毒林深处 intro
- 侍从(herald): "这里是毒林深处,雾好浓。"
- 侍从(herald): "管道里藏着食人花!它会突然钻出来吓你一跳!"
- 马里奥(mario): "踩不到它?那我用火球,或者跳着躲开!"
- 马里奥(mario): "公主在等我,毒林挡不住我!"

### 世界7 毒林深处 outro
- 马里奥(mario): "呼,终于走出毒林啦!"
- 侍从(herald): "前面是黄沙古城,离公主越来越近了!"

### 世界8 黄沙古城 intro
- 侍从(herald): "欢迎来到黄沙古城,好多老机关。"
- 侍从(herald): "守卫是甲壳兽,身上有刺,踩它会扎手哦!"
- 马里奥(mario): "明白!我用火球、踢龟壳,或者吃星星打它!"
- 马里奥(mario): "古城再难,也拦不住我!"

### 世界8 黄沙古城 outro
- 马里奥(mario): "破解古城啦!我闻到星星的味道了!"
- 桃花公主(princess): "马里奥……我在这里……快来救我……"
- 马里奥(mario): "是公主的声音!公主,等我!"

### 世界9 星界回廊 intro
- 侍从(herald): "这里是星界回廊,最后的大考验!"
- 侍从(herald): "会喷火球的炎魔来了,前面的怪都聚在这儿!"
- 马里奥(mario): "全到齐了?正好,我一个一个收拾!"
- 马里奥(mario): "闯过去,酷霸王魔城就在眼前!"

### 世界9 星界回廊 outro
- 马里奥(mario): "我做到了!星界回廊也走通了!"
- 侍从(herald): "勇士,前面就是酷霸王魔城,公主就在里面!"

### 世界10 酷霸王魔城 intro
- 侍从(herald): "到了……这就是酷霸王魔城,又黑又大。"
- 马里奥(mario): "桃花公主,我来救你啦!"
- 酷霸王(bowser): "哈哈哈!又来一个小不点!"
- 酷霸王(bowser): "公主是我的!想救她,先过我这一关!"
- 马里奥(mario): "哼,等我打败你,就带公主回家!"

### 世界10 Boss 登场
- 酷霸王(bowser): "小不点,你居然闯到这里!佩服佩服……才怪!"
- 酷霸王(bowser): "尝尝我的大火球!哈哈哈!"
- 桃花公主(princess): "马里奥,小心!我相信你一定行!"
- 马里奥(mario): "公主别怕!我用天空回廊的力量!踩他、火球招呼,我一定赢!"

### ENDING
- 马里奥(mario): "酷霸王,看招!这一下,为了公主!"
- 酷霸王(bowser): "不……不可能!我输了……"
- 桃花公主(princess): "马里奥!你真的来救我了!"
- 马里奥(mario): "我说过的,毒林、雪山、火海都挡不住我!"
- 桃花公主(princess): "我们回家吧,回到我们的王国!"
- 国王(king): "勇士啊!你救回了我的女儿,了不起!"
- 国王(king): "我说话算话——封你为驸马!全国一起庆祝!"
- 侍从(herald): "大家快来呀,王国要办大喜事啦!"
- 桃花公主(princess): "谢谢你,马里奥。一路上你从没放弃过我。"
- 马里奥(mario): "因为我答应过,一定把你带回家。"

---

## 六、实现分阶段

> 总原则:**阶段 A 先行可独立上线**(剧情系统对空脚本/20 关安全降级,不依赖新关卡/新怪);阶段 B-D 渐进叠加。每阶段结束跑 `node tools/verify-levels.js` 全 PASS + 语法检查 + 真机试玩。

### 阶段 A — 剧情系统 + 给世界 1-4 补剧情 + 开场
- **交付物**:新建 `src/story.js`(数据 + 推导函数,先填 OPENING + 世界 1-4 intro/outro,世界 5-10 留空表);sprites.js 加 4 个 head + `portrait()` 访问器;index.html + style.css 加 `#overlay-dialogue`;game.js 加 `dialogue` state + `startDialogue/advanceDialogue/currentDialogueNode` + 改 `beginAfterStory/nextLevel/_updateEnding`;main.js 加 overlays/按钮/handleConfirm/syncOverlays 接入。
- **如何验证**:`node tools/verify-levels.js` 全 PASS(关卡几何未动);`node --check` 各 src 文件;真机:开场出 OPENING 对话 → 世界1 intro → 进 1-1;每通一关世界最后一关弹 outro;世界 5-10 空表自动跳过不卡;键盘/触摸/▶四通道都能推进;暂停键在对话中不叠加。

### 阶段 B — 5 种新怪引擎(无新关卡)
- **交付物**:config.js ENEMY 追加(P1);entities.js 新增 `Flyer/Dasher/Piranha/Spiked/Flamer/EnemyShot` + import SOLID;game.js `ENEMY_CTORS` 查表(P2)+ `enemyShots` 容器/facade/主循环(P4)+ `_playerEnemyCollisions` 5 分支;render.js 5 分支 + `_enemyShots`;sprites.js 5 个 draw + 访问器;levels.js `ENTITY_CHARS` 加 `v z p a m` + parseLevel 5 条 else if;`_level_kit.md` 补字符说明。
- **如何验证**:`node tools/verify-levels.js` 全 PASS(现有 20 关无新字符,不受影响);`node --check`;造 1 个临时测试关分别摆 `v/z/p/a/m` 真机验证:飞翼怪踩一脚掉翅膀、冲刺兽看到玩家冲刺、食人花踩不死/火球可杀、甲壳兽踩反伤/踢壳可杀、炎魔喷紫色火球伤玩家。验证后删测试关。

### 阶段 C — 世界 5-9 共 25 关(并行 agent)
- **交付物**:25 个关卡对象,主题按 §一主表分配,怪物按配方混摆(`v` 世界5起 / `z` 6起 / `p` 7起配火花 `M` / `a` 8起配 `k` / `m` 9起全怪);story.js 填世界 5-9 的 intro/outro。
- **并行方式**:每个 agent 负责 1 个世界 5 关,严格按 `_level_kit.md`(apex≈4.3 tile、maxGap=3、maxStep=3、走路可通关)作图;统一行宽/行数;产出后单独 verify。
- **如何验证**:每世界产出立即 `node tools/verify-levels.js` 该批全 PASS(走路可通关,怪物字符对验证器透明);合并后整体 verify;真机逐世界试玩通关 + 对应 intro/outro 文案显示正确。

### 阶段 D — 世界 10 + Boss + 结局
- **交付物**:config.js THEMES 加 `bowser`;entities.js 加 `Bowser` 类 + `Fireball.update` 鸭子类型扣血;game.js `_defeatBoss` + `bossDefeated` 冻结 + 星星/Boss 碰撞例外;render.js Boss 分支 + 公主笼 + HP 心;sprites.js `drawBowserHead`(头像,阶段A已含)+ `drawBowser`(关内);levels.js `ENTITY_CHARS` 加 `W` + parseLevel 1 条 + `10-1`…`10-5`(`10-5` = lvlBowser 竞技场含 `A`+`W`);story.js 填世界10 intro / Boss登场 / ENDING。
- **如何验证**:`node tools/verify-levels.js` 全 50 关 PASS(`10-5` 无坑、有 castle `A` 目标);真机:世界10 intro → 打 Boss(踩/火球各扣 1、星星限频扣、HP 心递减、invuln 闪烁、Boss 不被坑/星星秒杀)→ 血归零 → 公主笼开 → cutscene → ENDING 对话 → win overlay。

---

## 七、验证与回归

- **verify-levels.js 全 PASS**:每阶段结束跑 `node tools/verify-levels.js`,要求全部 50 关 PASS。**verifier 逻辑无需改**——新字符全是实体(`ENTITY_CHARS`,gridRow 留 null),对 WALK/坑/步/blocks/SOLID 判定透明;`W` 透明、`A` 走 castle 目标判定。物理常量(apex≈4.3 tile、maxGap=3、maxStep=3)对新世界关卡仍适用,新世界 25 关须照 `_level_kit.md` 作图、保证走路可通关(怪物不影响几何判定)。
- **语法检查**:每改一个 src 文件跑 `node --check src/xxx.js`;`index.html` 经浏览器控制台无报错。
- **真机试玩**:按阶段 A-D 的验证项逐一在 iPad/手机触摸 + 桌面键盘各试一遍;重点验证四通道推进对话、踩不死/踩反伤/冲刺/敌方火球/Boss 防秒杀。
- **iPad 内存注意**:确认只新增 1 套主题 `bowser`;所有新 sprite 走 `cached()`、无逐帧大图;`Sprites.clearCache()` 在 visibilitychange 仍能整体重建头像/怪物/Boss 缓存。长时间游玩后切后台再回前台,验证无内存膨胀、画面正常重建。
- **回归**:阶段 A 上线后单独验证世界 1-4 原有玩法/通关/结局链路不受剧情系统影响;阶段 B 后验证 Goomba/Koopa 旧行为不变(查表退化兜底为 Goomba)。

---

## 八、不改动 / 风险与权衡

**明确不改动**:
- `tools/verify-levels.js` 验证**逻辑**(新字符透明,只改 `_level_kit.md` 文档)。
- `nextLevel` 的关卡推进核心(只在其内**包裹** outro/intro 触发,不改 `loadLevel` 本身,避免污染 respawn/continueRun)。
- 现有 20 关数据与 20 套主题(全部保留复用)。
- 现有踩踏/火球/星星/无敌帧引擎(新怪全部复用,Boss 也复用并加扣血例外)。
- 存档/难度系统、touch-controls 显隐逻辑、`showOverlay`(加 overlays map 项即自动工作)。

**风险与权衡**:
1. **范围大(31 关新增 + 6 文件改 + 新模块)**:用分阶段 + 空脚本降级,使剧情系统可先独立上线、关卡渐进补;每阶段独立 verify 收敛风险。
2. **飞翼怪不走 collideTiles**:飞行态靠直接查 grid 折返;退化为行走态后依赖 collideTiles/groundAhead 贴地,关卡作者须保证 `v` 落点退化后能正确站地。`flyerAmp=40` 下移仍远高于坠落阈值,不会被误清除。
3. **Boss 防秒杀的判定一致性**:game.js 用 `instanceof Bowser`、entities.js 的 Fireball 用鸭子类型(规避类声明顺序),两处口径已在 §三明确,落地须照此分文件处理,避免误用导致 Boss 被秒。
4. **食人花踩不死可能让低龄玩家受挫**:靠世界 7 关卡设计强制配火花道具 `M` + 留躲避路径 + intro 文案引导("用火球或躲开")三重缓解。
5. **行号会过期**:本文档技术锚点尽量用"方法名/字符集/分支"描述;落地前对 `_fireballs` 方法名、render() 调用顺序、`config.js ENEMY` 现有字段、`_updateEnding` celebrate 分支做一次 grep 复核,以代码现状为准。
6. **成本/作用域**:本扩展落地前应先收敛/提交工作区现有 30 个改动,避免与本次大改交叉;新增关卡批次用并行 agent 但须各自带 verify,防止"产出多但不落地"。

---

相关文件(绝对路径):
- 新建:`/Users/james/Projects/game-hub/games/pixel-quest/src/story.js`
- 改:`/Users/james/Projects/game-hub/games/pixel-quest/src/config.js`、`/Users/james/Projects/game-hub/games/pixel-quest/src/entities.js`、`/Users/james/Projects/game-hub/games/pixel-quest/src/game.js`、`/Users/james/Projects/game-hub/games/pixel-quest/src/render.js`、`/Users/james/Projects/game-hub/games/pixel-quest/src/sprites.js`、`/Users/james/Projects/game-hub/games/pixel-quest/src/levels.js`、`/Users/james/Projects/game-hub/games/pixel-quest/src/main.js`、`/Users/james/Projects/game-hub/games/pixel-quest/index.html`、`/Users/james/Projects/game-hub/games/pixel-quest/style.css`、`/Users/james/Projects/game-hub/games/pixel-quest/tools/_level_kit.md`
- 不改逻辑:`/Users/james/Projects/game-hub/games/pixel-quest/tools/verify-levels.js`
