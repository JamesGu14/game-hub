// Entities for 像素冒险 PIXEL QUEST.
// Each entity has position/size/velocity and update(dt, world). `world` exposes:
//   grid, enemies, coins, powerups, fireballs, movers, mode,
//   spawnPowerup(kind,x,y), addScore(n), addCoin(), hurtPlayer(), sound,
//   bumpTile(col,row), player.
// Physics uses collideTiles / aabb from physics.js.

import { TILE, GRAVITY, PLAYER, FORGIVE, ENEMY, SOLID } from './config.js';
import { collideTiles, aabb, groundAhead } from './physics.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------------------
export class Player {
  constructor(x, y) {
    this.form = 'small'; // 'small' | 'big' | 'fire'
    this.w = PLAYER.smallW;
    this.h = PLAYER.smallH;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.faceRight = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.invuln = 0;
    this.star = 0;
    this.fireTimer = 0;
    this.walkAnim = 0;
    this.dead = false;
    this.dying = 0; // death animation timer
  }

  setForm(form) {
    const wasBottom = this.y + this.h;
    const wasMid = this.x + this.w / 2;
    this.form = form;
    if (form === 'small') { this.w = PLAYER.smallW; this.h = PLAYER.smallH; }
    else { this.w = PLAYER.bigW; this.h = PLAYER.bigH; }
    this.y = wasBottom - this.h;
    this.x = wasMid - this.w / 2;
  }

  update(dt, world) {
    if (this.dying > 0) {
      // death hop: rise then fall, no collision
      this.dying -= dt;
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      return;
    }

    const input = world.input;
    const mode = world.mode;
    const moveX = input.moveX;
    const running = input.held.run;
    const maxSpeed = running ? PLAYER.maxRun : PLAYER.maxWalk;
    const accel = this.onGround ? PLAYER.accel : PLAYER.airAccel;

    // Horizontal accel / friction
    if (moveX !== 0) {
      this.vx += moveX * accel * dt;
      this.vx = clamp(this.vx, -maxSpeed, maxSpeed);
      this.faceRight = moveX > 0;
    } else if (this.onGround) {
      const f = PLAYER.friction * dt;
      if (this.vx > 0) this.vx = Math.max(0, this.vx - f);
      else if (this.vx < 0) this.vx = Math.min(0, this.vx + f);
    }

    // Coyote + jump buffer (scaled by mode forgiveness)
    if (this.onGround) this.coyote = FORGIVE.coyote * mode.coyoteMul;
    else this.coyote = Math.max(0, this.coyote - dt);

    if (input.held.jump && !this.jumpHeld) this.jumpBuffer = FORGIVE.jumpBuffer * mode.coyoteMul;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.jumpHeld = input.held.jump;

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -PLAYER.jumpVel;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.onGround = false;
      world.sound.jump();
    }
    // Variable jump height: cut upward velocity on release
    if (!input.held.jump && this.vy < 0) this.vy *= PLAYER.jumpCutoff;

    // Collide
    const info = collideTiles(this, world.grid, dt);
    if (info.bumped.length) {
      for (const b of info.bumped) world.bumpTile(b.col, b.row, this);
    }

    // Carry by moving platform
    for (const m of world.movers) {
      if (m.carry(this, dt)) { /* moved with platform */ }
    }

    // Animation
    if (Math.abs(this.vx) > 8 && this.onGround) {
      this.walkAnim += Math.abs(this.vx) * dt * 0.06;
    }

    // Timers
    if (this.invuln > 0) this.invuln -= dt;
    if (this.star > 0) this.star -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;
  }

  frame() {
    if (!this.onGround) return 2;
    if (Math.abs(this.vx) < 8) return 0;
    return Math.floor(this.walkAnim) % 2 === 0 ? 0 : 1;
  }

  canFire() {
    return this.form === 'fire' && this.fireTimer <= 0;
  }

  fire(world) {
    if (!this.canFire()) return;
    this.fireTimer = PLAYER.fireCooldown;
    const dir = this.faceRight ? 1 : -1;
    const fx = this.x + (dir > 0 ? this.w : -8);
    world.fireballs.push(new Fireball(fx, this.y + this.h * 0.4, dir));
    world.sound.fireball();
  }

  // Take damage: fire->big->small->die. Returns true if a life was lost.
  takeDamage(world) {
    if (this.invuln > 0 || this.star > 0 || this.dying > 0) return false;
    if (this.form === 'fire') { this.setForm('big'); this.invuln = PLAYER.invulnTime; world.sound.hurt(); return false; }
    if (this.form === 'big') { this.setForm('small'); this.invuln = PLAYER.invulnTime; world.sound.hurt(); return false; }
    // small -> die
    this.startDeath(world);
    return true;
  }

  startDeath(world) {
    this.dying = 1.4;
    this.vy = -560;
    this.vx = 0;
    world.sound.die();
  }

  grow(world) {
    if (this.form === 'small') this.setForm('big');
    else this.setForm('fire');
    world.sound.powerupGet();
  }
  goFire(world) {
    this.setForm('fire');
    world.sound.powerupGet();
  }
  goStar() {
    this.star = PLAYER.starTime;
  }
}

// ---------------------------------------------------------------------------
export class Goomba {
  constructor(x, y) {
    this.w = 24; this.h = 22;
    this.x = x + (TILE - this.w) / 2;
    this.y = y + (TILE - this.h);
    this.vx = -ENEMY.goombaSpeed;
    this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.squish = 0;
    this.anim = 0;
  }
  update(dt, world) {
    if (this.squish > 0) { this.squish -= dt; if (this.squish <= 0) this.dead = true; return; }
    const spd = ENEMY.goombaSpeed * world.mode.enemyMul;
    this.vx = this.vx < 0 ? -spd : spd;
    const info = collideTiles(this, world.grid, dt);
    if (info.hitWall) this.vx = -this.vx;
    // turn at ledges
    if (this.onGround) {
      const aheadX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
      if (!groundAhead(world.grid, aheadX, this.y + this.h)) this.vx = -this.vx;
    }
    this.anim += dt * 6;
  }
  frame() { return Math.floor(this.anim) % 2; }
  stomp(world) { this.squish = 0.4; this.vx = 0; world.sound.stomp(); }
  kill(world) { this.dead = true; world.sound.kick(); }
}

// ---------------------------------------------------------------------------
export class Koopa {
  constructor(x, y) {
    this.w = 24; this.h = 30;
    this.x = x + (TILE - this.w) / 2;
    this.y = y + (TILE - this.h);
    this.vx = -ENEMY.koopaSpeed;
    this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.state = 'walk'; // 'walk' | 'shell' | 'slide'
    this.shellTimer = 0;
    this.kickGrace = 0; // brief window after a kick where player contact is ignored
    this.anim = 0;
  }
  update(dt, world) {
    const mul = world.mode.enemyMul;
    if (this.kickGrace > 0) this.kickGrace -= dt;
    if (this.state === 'walk') {
      const spd = ENEMY.koopaSpeed * mul;
      this.vx = this.vx < 0 ? -spd : spd;
      const info = collideTiles(this, world.grid, dt);
      if (info.hitWall) this.vx = -this.vx;
      if (this.onGround) {
        const aheadX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
        if (!groundAhead(world.grid, aheadX, this.y + this.h)) this.vx = -this.vx;
      }
      this.anim += dt * 5;
    } else if (this.state === 'shell') {
      this.vx = 0;
      collideTiles(this, world.grid, dt);
      this.shellTimer -= dt;
      if (this.shellTimer <= 0) { // wake up
        this.state = 'walk';
        this.w = 24; this.h = 30;
        this.vx = -ENEMY.koopaSpeed * mul;
      }
    } else if (this.state === 'slide') {
      const info = collideTiles(this, world.grid, dt);
      if (info.hitWall) { this.vx = -this.vx; world.sound.shell(); }
      // slide shell kills other enemies
      for (const e of world.enemies) {
        if (e === this || e.dead) continue;
        if (aabb(this, e)) {
          if (e.kill) e.kill(world);
          if (e instanceof Koopa) e.dead = true;
          world.addScore(200);
        }
      }
    }
  }
  toShell(world) {
    this.state = 'shell';
    this.w = 24; this.h = 16;
    this.y += 14;
    this.vx = 0;
    this.shellTimer = 6;
    world.sound.stomp();
  }
  // Stop a moving/idle shell back into a still shell (e.g. when stomped again).
  stopShell(world) {
    this.state = 'shell';
    this.w = 24; this.h = 16;
    this.vx = 0;
    this.shellTimer = 6;
    world.sound.stomp();
  }
  kickShell(dir, world) {
    this.state = 'slide';
    this.vx = ENEMY.shellSpeed * dir;
    this.shellTimer = 0;
    this.kickGrace = 0.2; // don't immediately re-hit the player who kicked it
    world.sound.kick();
  }
  frame() { return Math.floor(this.anim) % 2; }
  kill(world) { this.dead = true; world.sound.kick(); }
}

// ---------------------------------------------------------------------------
export class Coin {
  constructor(x, y) {
    this.w = 18; this.h = 18;
    this.x = x - this.w / 2;
    this.y = y - this.h / 2;
    this.dead = false;
    this.anim = 0;
    // "popped" coins (from ?-blocks) animate upward then vanish
    this.popped = false;
    this.popTimer = 0;
  }
  static popped(cx, cy) {
    const c = new Coin(cx, cy);
    c.popped = true;
    c.popTimer = 0.5;
    c.vy = -300;
    return c;
  }
  update(dt) {
    this.anim += dt * 6;
    if (this.popped) {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      this.popTimer -= dt;
      if (this.popTimer <= 0) this.dead = true;
    }
  }
}

// ---------------------------------------------------------------------------
export class Powerup {
  constructor(kind, x, y) {
    this.kind = kind; // 'mushroom' | 'flower' | 'star'
    this.w = 26; this.h = 26;
    this.x = x;
    this.y = y;
    this.vx = kind === 'flower' ? 0 : 80;
    this.vy = -120; // emerge upward a bit
    this.onGround = false;
    this.dead = false;
    this.emerge = 0.4; // brief rise out of the block
  }
  update(dt, world) {
    if (this.emerge > 0) {
      this.emerge -= dt;
      this.y += this.vy * dt;
      this.vy = Math.min(0, this.vy + GRAVITY * dt * 0.5);
      return;
    }
    if (this.kind === 'flower') { collideTiles(this, world.grid, dt); return; }
    if (this.kind === 'star') {
      const info = collideTiles(this, world.grid, dt);
      if (info.onGround) this.vy = -360; // bounce
      if (info.hitWall) this.vx = -this.vx;
      this.vx = this.vx < 0 ? -90 : 90;
      return;
    }
    // mushroom walks
    const info = collideTiles(this, world.grid, dt);
    if (info.hitWall) this.vx = -this.vx;
    if (this.onGround) {
      const aheadX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
      if (!groundAhead(world.grid, aheadX, this.y + this.h)) this.vx = -this.vx;
    }
    this.vx = this.vx < 0 ? -80 : 80;
  }
}

// ---------------------------------------------------------------------------
export class Fireball {
  constructor(x, y, dir) {
    this.w = 12; this.h = 12;
    this.x = x;
    this.y = y;
    this.vx = ENEMY.fireballSpeed * dir;
    this.vy = 80;
    this.dead = false;
    this.life = 2.2;
    this.anim = 0;
  }
  update(dt, world) {
    this.life -= dt;
    this.anim += dt * 12;
    if (this.life <= 0) { this.dead = true; return; }
    const info = collideTiles(this, world.grid, dt);
    if (info.onGround) this.vy = -ENEMY.fireballBounce;
    if (info.hitWall || info.hitCeiling) { this.dead = true; return; }
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
  }
}

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

// ---------------------------------------------------------------------------
// 阶段 B 占位 stub —— 让 ENEMY_CTORS 查表与 named import 先跑通。
// 行为/精灵/碰撞由 Task 2-6 各怪整类替换。合并前务必替换完毕。
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

// ---------------------------------------------------------------------------
export class MovingPlatform {
  constructor(def) {
    this.w = TILE * 3;
    this.h = TILE * 0.5;
    this.axis = def.axis; // 'h' | 'v'
    this.x0 = def.x;
    this.y0 = def.y;
    this.x = def.x;
    this.y = def.y;
    this.range = def.range;
    this.speed = def.speed;
    this.dir = 1;
    this.dx = 0;
    this.dy = 0;
  }
  update(dt) {
    const prevX = this.x;
    const prevY = this.y;
    if (this.axis === 'h') {
      this.x += this.speed * this.dir * dt;
      if (this.x > this.x0 + this.range) { this.x = this.x0 + this.range; this.dir = -1; }
      if (this.x < this.x0) { this.x = this.x0; this.dir = 1; }
    } else {
      this.y += this.speed * this.dir * dt;
      if (this.y > this.y0 + this.range) { this.y = this.y0 + this.range; this.dir = -1; }
      if (this.y < this.y0) { this.y = this.y0; this.dir = 1; }
    }
    this.dx = this.x - prevX;
    this.dy = this.y - prevY;
  }
  // Returns true if the player is riding this platform; moves the player with it.
  carry(player, dt) {
    const onTop =
      player.vy >= 0 &&
      player.x + player.w > this.x + 2 &&
      player.x < this.x + this.w - 2 &&
      player.y + player.h >= this.y - 4 &&
      player.y + player.h <= this.y + this.h + 6;
    if (!onTop) return false;
    player.y = this.y - player.h;
    player.vy = 0;
    player.onGround = true;
    player.coyote = FORGIVE.coyote;
    player.x += this.dx;
    if (this.axis === 'v') player.y += this.dy;
    return true;
  }
}
