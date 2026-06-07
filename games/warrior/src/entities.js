// Entities for 丛林勇士: Player, Runner, Jumper, Bullet. Each has update(dt, world).
// `world` is the facade from game.js. Physics via collideTiles/aabb. Player aiming
// uses resolveAim; firing uses the pure weapons.fire() and world.spawnBullets.

import { TILE, GRAVITY, PLAYER, FORGIVE, ENEMY, DEFAULT_WEAPON, SOLID, PRONE } from './config.js';
import { collideTiles, aabb, groundAhead } from './physics.js';
import { resolveAim } from './input.js';
import { fire, cooldownFor } from './weapons.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------------------
export class Player {
  constructor(x, y) {
    this.w = PLAYER.w; this.h = PLAYER.h;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.faceRight = true;
    this.coyote = 0; this.jumpBuffer = 0; this.jumpHeld = false;
    this.fireTimer = 0;
    this.weapon = DEFAULT_WEAPON;
    this.aim = { x: 1, y: 0 };
    this.invuln = 0;
    this.dead = false;
    this.dying = 0;
    this.prone = false;
  }

  update(dt, world) {
    if (this.dying > 0) { // death hop, no collision
      this.dying -= dt;
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      return;
    }

    const intent = world.input.intent;
    const accel = this.onGround ? PLAYER.accel : PLAYER.airAccel;

    // Horizontal move (single speed) + friction
    if (intent.moveX !== 0) {
      this.vx += intent.moveX * accel * dt;
      this.vx = clamp(this.vx, -PLAYER.maxSpeed, PLAYER.maxSpeed);
      this.faceRight = intent.moveX > 0;
    } else if (this.onGround) {
      const f = PLAYER.friction * dt;
      if (this.vx > 0) this.vx = Math.max(0, this.vx - f);
      else if (this.vx < 0) this.vx = Math.min(0, this.vx + f);
    }

    // Coyote + jump buffer
    if (this.onGround) this.coyote = FORGIVE.coyote;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (intent.jumpHeld && !this.jumpHeld) this.jumpBuffer = FORGIVE.jumpBuffer;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.jumpHeld = intent.jumpHeld;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -PLAYER.jumpVel; this.coyote = 0; this.jumpBuffer = 0; this.onGround = false;
      world.playSound('jump');
    }
    if (!intent.jumpHeld && this.vy < 0) this.vy *= PLAYER.jumpCutoff; // variable height

    // Prone: on the ground, holding down shrinks the hitbox (still a horizontal shot).
    const wantProne = intent.aimDown && this.onGround;
    if (wantProne !== this.prone) {
      const feet = this.y + this.h;
      this.prone = wantProne;
      this.h = wantProne ? PRONE.h : PLAYER.h;
      this.y = feet - this.h; // keep feet planted
    }

    // Aim + auto-fire while held
    this.aim = resolveAim(intent, this.onGround, this.faceRight);
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (intent.fireHeld && this.fireTimer <= 0) this.fire(world);

    collideTiles(this, world.grid, dt);

    if (this.invuln > 0) this.invuln -= dt;
  }

  _muzzle() {
    const cx = this.x + this.w / 2 + this.aim.x * (this.w / 2 + 4);
    const cy = this.y + this.h * 0.4 + this.aim.y * (this.h / 2);
    return { x: cx - 6, y: cy - 3 }; // center the BULLET (12x6)
  }

  fire(world) {
    this.fireTimer = cooldownFor(this.weapon);
    const m = this._muzzle();
    const specs = fire(this.weapon, m.x, m.y, this.aim);
    world.spawnBullets(specs);
    world.playSound('shoot');
  }

  // One hit = down (spec §3.4). Returns true if this hit started a death.
  takeDamage(world) {
    if (this.invuln > 0 || this.dying > 0) return false;
    this.startDeath(world);
    return true;
  }

  startDeath(world) {
    this.dying = 1.0; this.vy = -520; this.vx = 0;
    world.playSound('die');
  }

  respawn(x, y, invuln) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.dying = 0; this.dead = false; this.onGround = false;
    this.invuln = invuln;
  }

  frame() {
    if (!this.onGround) return 2;
    if (Math.abs(this.vx) < 8) return 0;
    return Math.floor(Math.abs(this.x) / 10) % 2 === 0 ? 0 : 1;
  }
}

// ---------------------------------------------------------------------------
// Shared: ground grunt that walks toward the player, turns at walls/ledges.
class GroundEnemy {
  constructor(x, y, cfg) {
    this.w = cfg.w; this.h = cfg.h;
    this.x = x + (TILE - this.w) / 2;
    this.y = y + (TILE - this.h);
    this.speed = cfg.speed; this.hp = cfg.hp; this.score = cfg.score;
    this.vx = -cfg.speed; this.vy = 0; this.onGround = false;
    this.dead = false; this.anim = 0;
  }
  hit(dmg, world) {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.dead = true;
      world.addScore(this.score);
      world.spawnParticles(this.x + this.w / 2, this.y + this.h / 2, { count: 12, color: '#ffcc33', speed: 200 });
      world.playSound('hit');
    }
  }
  _walk(dt, world, spd) {
    // collideTiles zeroes vx on a wall hit, so decide the turn from a local `dir` and
    // re-apply vx at the end — otherwise a wall-stuck enemy keeps vx=0 and never turns.
    let dir = this.vx < 0 ? -1 : 1;
    this.vx = dir * spd;
    const info = collideTiles(this, world.grid, dt);
    if (info.hitWall) dir = -dir;
    if (this.onGround) {
      const aheadX = dir > 0 ? this.x + this.w + 1 : this.x - 1;
      if (!groundAhead(world.grid, aheadX, this.y + this.h)) dir = -dir;
    }
    this.vx = dir * spd;
    this.anim += dt * 6;
  }
  // Face toward the player so it chases rather than wandering off forever.
  _chase(world) {
    const p = world.player;
    if (!p) return;
    const dir = (p.x + p.w / 2) < (this.x + this.w / 2) ? -1 : 1;
    this.vx = dir * Math.abs(this.vx || this.speed);
  }
  frame() { return Math.floor(this.anim) % 2; }
}

export class Runner extends GroundEnemy {
  constructor(x, y) { super(x, y, ENEMY.runner); }
  update(dt, world) {
    if (this.dead) return;
    if (this.onGround) this._chase(world);
    this._walk(dt, world, this.speed * world.mode.enemyMul);
  }
}

export class Jumper extends GroundEnemy {
  constructor(x, y) {
    super(x, y, ENEMY.jumper);
    this.jumpCd = 0;
  }
  update(dt, world) {
    if (this.dead) return;
    const p = world.player;
    if (this.onGround) this._chase(world);
    if (this.jumpCd > 0) this.jumpCd -= dt;
    if (p && this.onGround && this.jumpCd <= 0) {
      const dist = Math.hypot((p.x - this.x), (p.y - this.y));
      if (dist < ENEMY.jumper.triggerDist) {
        this.vy = -ENEMY.jumper.jumpVel;
        this.onGround = false;
        this.jumpCd = ENEMY.jumper.retrigger;
      }
    }
    this._walk(dt, world, this.speed * world.mode.enemyMul);
  }
}

// ---------------------------------------------------------------------------
export class Bullet {
  constructor(spec) {
    this.w = 12; this.h = 6;
    this.x = spec.x; this.y = spec.y;
    this.vx = spec.vx; this.vy = spec.vy;
    this.dmg = spec.dmg; this.pierce = !!spec.pierce;
    this.life = spec.life; this.dead = false;
  }
  update(dt, world) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Solid tile -> die (bullets do not pass through terrain in M1).
    const col = Math.floor((this.x + this.w / 2) / TILE);
    const row = Math.floor((this.y + this.h / 2) / TILE);
    const gridRow = world.grid[row];
    if (gridRow && gridRow[col] && SOLID.has(gridRow[col])) { this.dead = true; return; }

    // Enemies
    for (const e of world.enemies) {
      if (e.dead) continue;
      if (aabb(this, e)) {
        if (e.hit) e.hit(this.dmg, world);
        if (!this.pierce) { this.dead = true; return; }
      }
    }
  }
}
