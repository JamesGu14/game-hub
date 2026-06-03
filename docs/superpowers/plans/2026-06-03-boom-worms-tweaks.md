# 炮炮虫 BOOM WORMS — 玩法微调 (3 项) 实现交接

> 试玩反馈，3 项玩法改动。代码已基本设计好，下面是 turnkey 实现说明。
> 全部改 `games/boom-worms/src/` 下的文件。改完跑 `cd games/boom-worms && node --test`（应仍 23/23），再浏览器冒烟测试。

## 1. 蓄力条变慢 + 到顶/到底往复 (ping-pong)

**`src/config.js`** — `AIM.chargeSeconds: 1.2` → `1.7`（变慢约 40%）。

**`src/aim.js`** — `Aim` 对象加方向位 `_dir: 1`；`stepCharge` 改为往复；`startCharge`/`reset` 重置方向：
```js
// 对象字段里加：
  _dir: 1,            // 蓄力方向：+1 上升 / -1 下降

  startCharge() {
    this.charging = true;
    this.power = AIM.minSpeed;
    this._dir = 1;
  },

  stepCharge(dt) {
    if (!this.charging) return;
    const rampRate = (AIM.maxSpeed - AIM.minSpeed) / AIM.chargeSeconds;
    this.power += this._dir * rampRate * dt;
    if (this.power >= AIM.maxSpeed) { this.power = AIM.maxSpeed; this._dir = -1; } // 到顶回落
    else if (this.power <= AIM.minSpeed) { this.power = AIM.minSpeed; this._dir = 1; } // 到底再涨
  },

  // reset() 里加： this._dir = 1;
```
力道条显示 `(power-minSpeed)/(maxSpeed-minSpeed)`，所以显示上是 0%↔100% 往复，符合"到顶退回、到 0 又涨、循环往复"。

## 2. 血包/宝箱受重力，落入被炸出的坑

**`src/game.js`** —
- 把 `_checkCratePickups` 里的"下落动画"剥离，新增 `_updateCrates(dt)`（每帧重力下落 + 落地吸附 + 若脚下地形被炸空则继续下落 + 落水消失）：
```js
  _updateCrates(dt) {
    if (!this.crates.length || !this.terrain) return;
    const halfH = CRATE.w / 2;
    for (const c of this.crates) {
      if (c.dead) continue;
      c.vy = Math.min((c.vy || 0) + 900 * dt, 800);       // 重力
      const ny = c.y + c.vy * dt;
      if (this.terrain.solid(c.x | 0, (ny + halfH) | 0)) { // 脚下有地 → 吸附
        let gy = (ny + halfH) | 0;
        while (gy > 0 && this.terrain.solid(c.x | 0, gy - 1)) gy--;
        c.y = gy - halfH; c.vy = 0; c.landed = true;
      } else { c.y = ny; c.landed = false; }               // 脚下空 → 继续掉（坑里也会掉）
      if (c.y >= this.level.waterY) { c.dead = true; this._spawnEffect('splash', c.x, this.level.waterY, 24); }
    }
    this.crates = this.crates.filter(c => !c.dead);
  }
```
- `_checkCratePickups(allWorms)` 改为只做拾取（去掉下落/吸附那段）：
```js
  _checkCratePickups(allWorms) {
    for (const c of this.crates) {
      if (c.dead) continue;
      for (const w of allWorms) {
        if (!w.alive) continue;
        if (Math.hypot(w.x - c.x, w.y - c.y) < 24) {
          c.dead = true;
          if (c.kind === 'heal') w.hp = Math.min(100, w.hp + (CRATE.healAmount || 30));
          else if (c.weaponReward) {
            const team = this.teams[w.team];
            if (team) { const cur = team.ammo[c.weaponReward] || 0; if (cur !== Infinity) team.ammo[c.weaponReward] = cur + 2; }
          }
          this._spawnEffect('explosion', c.x, c.y, 16);
          break;
        }
      }
    }
    this.crates = this.crates.filter(c => !c.dead);
  }
```
- `update(dt)` 里、`switch(this.state)` 之前加（让宝箱每帧都掉，包括 aim 状态刚掉下来时、以及爆炸炸空地形后）：
```js
    if (this.terrain && this.state !== 'menu') {
      this._updateCrates(dt);
      this._checkCratePickups(this._allWorms());
    }
```
- 从 `_updateProjectile` 里删掉原来的 `this._checkCratePickups(allWorms);`（已由 update() 统一处理）。
- `_dropCrate` 里 `vy: 60` 可保留或设 0（重力会接管）。

## 3. AI 回合模拟玩家瞄准过程（真人对战感）

**`src/ai.js`** — 把"瞬间开火"的 `takeTurn` 换成多帧状态机 `step(game, dt)`：think 延迟 → 转动准星到目标角 → 蓄力（力道条上升）→ 到目标力道发射。新增：
```js
  step(game, dt) {
    let st = game._aiState;
    if (!st) {
      const worm = game._activeWorm();
      if (!worm || !worm.alive) { game._advanceTurn(); return; }
      const targets = game.teams[0].worms.filter(w => w.alive);
      if (!targets.length) { game._advanceTurn(); return; }
      const target = targets.reduce((b, w) =>
        w.hp < b.hp || (w.hp === b.hp && dist(worm.x,worm.y,w.x,w.y) < dist(worm.x,worm.y,b.x,b.y)) ? w : b);
      const gravity = PHYSICS.projGravity, wind = game.wind, terrain = game.terrain;
      const team = game.teams[game.active.team];
      const weaponKey = _chooseWeapon(worm, target, team, terrain, gravity, wind);
      game.weaponKey = weaponKey;
      const dx = target.x - worm.x; worm.facing = dx >= 0 ? 1 : -1;
      let tgt;
      if (weaponKey === 'firepunch') tgt = { angle: dx >= 0 ? 0 : Math.PI, speed: AIM.minSpeed };
      else {
        let sol; try { sol = solveAim(worm.x,worm.y,target.x,target.y,gravity,AIM.minSpeed,AIM.maxSpeed,wind); } catch {}
        tgt = sol ? jitterAim(sol, game.level.aiError, Math.random)
                  : { angle: dx >= 0 ? -Math.PI/4 : Math.PI+Math.PI/4, speed: 420 };
      }
      tgt.speed = Math.max(AIM.minSpeed, Math.min(AIM.maxSpeed, tgt.speed));
      const Aim = game.aim;
      Aim.charging = false; Aim.power = AIM.minSpeed;
      Aim.angle = dx >= 0 ? -0.05 : Math.PI + 0.05;   // 从近水平开始，转动可见
      game._aiState = { phase: 'delay', t: 0, target: tgt };
      game._aiAiming = true;
      return;
    }
    const Aim = game.aim; st.t += dt;
    if (st.phase === 'delay') { if (st.t > 0.5) { st.phase = 'aim'; st.t = 0; } return; }
    if (st.phase === 'aim') {                          // 转动准星到目标角
      const diff = st.target.angle - Aim.angle;
      Aim.angle += Math.sign(diff) * Math.min(Math.abs(diff), 2.2 * dt);
      if (Math.abs(st.target.angle - Aim.angle) < 0.02) { Aim.angle = st.target.angle; st.phase = 'charge'; st.t = 0; Aim.startCharge(); }
      return;
    }
    if (st.phase === 'charge') {                       // 力道条上升到目标值发射
      Aim.stepCharge(dt);
      if (Aim.power >= st.target.speed || st.t > 3) {
        const lp = Aim.release(); lp.angle = st.target.angle; lp.speed = st.target.speed;
        game._aiAiming = false; game._aiState = null;
        game._fireActiveWorm(lp); game._aiPending = false;
      }
      return;
    }
  },
```
（`takeTurn` 可删除或保留不用。）

**`src/game.js`** —
- 构造函数 + `startGame` + `_advanceTurn` 里都加：`this._aiState = null; this._aiAiming = false;`
- `_updateAim` 的 AI 分支替换为逐帧驱动：
```js
    if (activeTeam.isAI) { AIController.step(this, dt); return; }
```
（删掉原来的 `_aiPending/_aiTimer/_runAITurn` 那套；`_runAITurn` 可删。）

**`src/render.js`** — 让 AI 瞄准时也显示引导线。调用处守卫改为：
```js
        if (activeWorm && activeWorm.alive && (!activeTeam.isAI || game._aiAiming)) {
          this._aimIndicator(ctx, activeWorm, game.aim, game, camX);
          if (game.aim.charging) this._powerBar(ctx, game.aim);
        }
```

## 验证
- `cd games/boom-worms && node --test` → 23/23（这些改动不碰被测纯逻辑）。
- 浏览器冒烟（host 侧 puppeteer-core + 本机 Chrome，见 memory `boom-worms-smoke-test-setup`）：
  1. 长按空格力道条来回涨落；2. 血包掉地、把它脚下炸出坑后会继续往下掉；3. AI 回合能看到准星转动 + 力道条上升再发射。
- 提交：`feat(boom-worms): ping-pong power charge, crate gravity, animated AI aiming`。
