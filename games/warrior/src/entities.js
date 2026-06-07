// Entities for 丛林勇士: Player, Runner, Jumper, Bullet. Each has update(dt, world).
// `world` is the facade from game.js. Physics via collideTiles/aabb. Player aiming
// uses resolveAim; firing uses the pure weapons.fire() and world.spawnBullets.

import { TILE, GRAVITY, PLAYER, FORGIVE, HIT_INVULN, ENEMY, DEFAULT_WEAPON, SOLID, PRONE, BARRIER, FALCON, PICKUP, PICKUPS, BOSSES, RAPID, RAPID_COOLDOWN_MUL, ENEMY_RANGED } from './config.js';
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
    this.barrier = 0;
    this.rapid = 0; // R stacks
    this.maxHp = 5; this.hp = 5; // HP system (game sets from mode.hp)
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
    if (this.barrier > 0) this.barrier -= dt;
  }

  _muzzle() {
    const cx = this.x + this.w / 2 + this.aim.x * (this.w / 2 + 4);
    const cy = this.y + this.h * 0.4 + this.aim.y * (this.h / 2);
    return { x: cx - 6, y: cy - 3 }; // center the BULLET (12x6)
  }

  fire(world) {
    this.fireTimer = cooldownFor(this.weapon) * Math.pow(RAPID_COOLDOWN_MUL, this.rapid);
    const m = this._muzzle();
    const specs = fire(this.weapon, m.x, m.y, this.aim, { rapid: this.rapid > 0 });
    world.spawnBullets(specs);
    world.playSound('shoot');
  }

  giveBarrier() { this.barrier = BARRIER.time; }
  giveRapid() { this.rapid = Math.min(RAPID.maxStacks, this.rapid + 1); }
  isInvulnerable() { return this.invuln > 0 || this.barrier > 0 || this.dying > 0; }

  // HP system: a hit costs 1 HP + grants brief i-frames; only a hit at 0 HP kills.
  // (Overrides spec §3.4 one-hit-down — kid-friendly, per playtest.) Returns true on death.
  takeDamage(world) {
    if (this.isInvulnerable()) return false;
    this.hp -= 1;
    if (this.hp <= 0) { this.startDeath(world); return true; }
    this.invuln = HIT_INVULN;
    world.playSound('hurt');
    return false;
  }

  startDeath(world) {
    this.dying = 1.0; this.vy = -520; this.vx = 0;
    world.playSound('die');
  }

  respawn(x, y, invuln) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.dying = 0; this.dead = false; this.onGround = false;
    this.invuln = invuln;
    this.hp = this.maxHp;
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
      world.killScore(this.score); // routes through combo + float-text
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
    this._walk(dt, world, this.speed * world.mode.enemyMul * (world.levelMul || 1));
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
    this._walk(dt, world, this.speed * world.mode.enemyMul * (world.levelMul || 1));
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
    this.gravity = spec.gravity || 0; // F fireball arc
    this.hostile = !!spec.hostile;    // enemy bullet: damages the player, not enemies
  }
  update(dt, world) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.gravity) this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Solid tile -> die (bullets do not pass through terrain).
    const col = Math.floor((this.x + this.w / 2) / TILE);
    const row = Math.floor((this.y + this.h / 2) / TILE);
    const gridRow = world.grid[row];
    if (gridRow && gridRow[col] && SOLID.has(gridRow[col])) { this.dead = true; return; }
    if (this.hostile) return; // player damage is applied by game.update

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

// ---------------------------------------------------------------------------
// Red-falcon carrier: flies a polyline (world-px points); a player bullet drops its
// letter Pickup and kills it. Off-screen culling is the game's job.
export class Falcon {
  constructor(drop, x, y, path) {
    this.w = FALCON.w; this.h = FALCON.h;
    this.x = x; this.y = y;
    this.drop = drop;
    this.path = path && path.length ? path : [{ x, y }];
    this.seg = 0; this.dead = false; this.anim = 0;
  }
  update(dt, world) {
    if (this.dead) return;
    this.anim += dt;
    const target = this.path[Math.min(this.seg + 1, this.path.length - 1)];
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const dx = target.x - cx, dy = target.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < 4) { if (this.seg < this.path.length - 2) this.seg++; }
    else { const s = FALCON.speed * dt; this.x += (dx / d) * s; this.y += (dy / d) * s; }
  }
  hitByBullet(world) {
    if (this.dead) return;
    this.dead = true;
    world.spawnPickup(this.drop, this.x + this.w / 2 - PICKUP.w / 2, this.y + this.h / 2);
    world.playSound('hit');
  }
}

// ---------------------------------------------------------------------------
// A blinking letter that falls onto terrain, despawns after PICKUP.life, applies on touch.
export class Pickup {
  constructor(letter, x, y) {
    this.letter = letter;
    this.w = PICKUP.w; this.h = PICKUP.h;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.onGround = false; this.dead = false;
    this.life = PICKUP.life; this.anim = 0;
  }
  update(dt, world) {
    this.anim += dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    collideTiles(this, world.grid, dt);
  }
  visible() { return (this.anim % (PICKUP.blink * 2)) < PICKUP.blink; }
  // Apply to the player; returns true if it was a weapon switch.
  apply(player, world) {
    const def = PICKUPS[this.letter];
    this.dead = true;
    world.playSound('pickup');
    if (def && def.kind === 'weapon') { player.weapon = def.weapon; return true; }
    if (def && def.item === 'barrier') { player.giveBarrier(); }
    if (def && def.item === 'rapid') { player.giveRapid(); }
    return false;
  }
}

// ---------------------------------------------------------------------------
// BOSS model (spec §4.2). Iron Gate is the M2 template; later bosses reuse this shape.
// A stationary fortress that telegraphs then slams (screen shake), and at <=50% hp
// also summons grunts. Bullets/contact damage it via game.js.
export class Boss {
  constructor(typeId, x, y) {
    const cfg = BOSSES[typeId] || BOSSES.ironGate;
    this.cfg = cfg; this.typeId = typeId;
    this.w = cfg.w; this.h = cfg.h;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.onGround = false;
    this.maxHp = cfg.maxHp; this.hp = cfg.maxHp;
    this.phase = 0; this.dead = false; this.dying = 0;
    this.slamTimer = cfg.phases[0].slamCd; this.telegraph = 0; this.anim = 0;
    this.fireTimer = 1.0;
  }
  _phaseFor(hpFrac) {
    // phases are ordered high→low by upTo; current phase = largest index still bounding hpFrac.
    let idx = 0;
    for (let i = 0; i < this.cfg.phases.length; i++) if (this.cfg.phases[i].upTo >= hpFrac) idx = i;
    return idx;
  }
  hit(dmg, world) {
    if (this.dead) return;
    this.hp -= dmg;
    world.playSound('hit');
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.dying = 1.2;
      world.addScore(this.cfg.score);
      world.spawnParticles(this.x + this.w / 2, this.y + this.h / 2, { count: 40, color: '#ffcc33', speed: 320 });
      world.shake(8);
      world.playSound('die');
    }
  }
  update(dt, world) {
    if (this.dead) return;
    this.anim += dt;
    this.phase = this._phaseFor(this.hp / this.maxHp);
    const ph = this.cfg.phases[this.phase];
    if (this.telegraph > 0) {
      this.telegraph -= dt;
      if (this.telegraph <= 0) {
        world.shake(6); world.playSound('hit');
        if (ph.spawnGrunts) for (let i = 0; i < ph.spawnGrunts; i++) world.spawnEnemy('runner', this.x, this.y);
        if (this.typeId === 'ironGate' || this.typeId === 'frost') this._shockwave(world);
      }
      return;
    }
    // Valkyrie hovers (bobs vertically); other bosses stay grounded.
    if (this.cfg.fly) {
      if (this.baseY == null) this.baseY = this.y;
      this.y = this.baseY + Math.sin(this.anim * 1.6) * 26;
    }
    this.slamTimer -= dt;
    if (this.slamTimer <= 0) { this.slamTimer = ph.slamCd; this.telegraph = 0.5; }
    // Distinct attack per boss on the phase fire cooldown.
    if (this.cfg.fires && ph.fireCd) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) { this.fireTimer = ph.fireCd; this._fire(world); }
    }
  }

  // A slam that also rolls two ground shockwaves outward (heavy ground bosses).
  _shockwave(world) {
    const y = this.y + this.h - 12, spd = 120;
    world.spawnEnemyBullet({ x: this.x, y, vx: -spd, vy: 0, dmg: 1, life: 3 });
    world.spawnEnemyBullet({ x: this.x + this.w - 10, y, vx: spd, vy: 0, dmg: 1, life: 3 });
  }

  // Per-boss projectile signature (F4 variety).
  _fire(world) {
    const p = world.player; if (!p) return;
    const cx = this.x + this.w / 2, cy = this.y + this.h * 0.45;
    const shoot = (vx, vy) => world.spawnEnemyBullet({ x: cx - 5, y: cy, vx, vy, dmg: 1, life: 3.2 });
    const aim = () => { const dx = (p.x + p.w / 2) - cx, dy = (p.y + p.h / 2) - cy, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
    switch (this.typeId) {
      case 'cyclops': { const [ax, ay] = aim(); shoot(ax * 105, ay * 105); break; }                 // slow aimed eye beam
      case 'valkyrie': { const dir = (p.x < this.x) ? -1 : 1; for (let i = -1; i <= 1; i++) shoot(dir * 150, i * 70 + 30); break; } // strafing spread
      case 'frost': { for (let i = -1; i <= 1; i++) shoot(i * 70, 150); break; }                     // downward ice shards
      case 'gomera': { const n = 8 + this.phase * 2; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; shoot(Math.cos(a) * 130, Math.sin(a) * 130); } break; } // radial burst, denser per phase
      default: { const [ax, ay] = aim(); shoot(ax * 125, ay * 125); }                                // ironGate: aimed shot
    }
  }
}

// ---------------------------------------------------------------------------
// Ranged enemies (spec §4.1) — they fire HOSTILE enemy bullets at the player.
function aimAt(from, to) {
  const dx = (to.x + (to.w || 0) / 2) - (from.x + from.w / 2);
  const dy = (to.y + (to.h || 0) / 2) - (from.y + from.h / 2);
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

function rangedHit(self, dmg, world, color) {
  self.hp -= dmg;
  if (self.hp <= 0) {
    self.dead = true;
    world.killScore(self.score);
    world.spawnParticles(self.x + self.w / 2, self.y + self.h / 2, { count: 12, color, speed: 200 });
    world.playSound('hit');
  }
}

// Gunner 蹲守兵: stationary, fires one aimed bullet on its cooldown.
export class Gunner {
  constructor(x, y) {
    const c = ENEMY_RANGED.gunner; this.cfg = c;
    this.w = c.w; this.h = c.h;
    this.x = x + (TILE - c.w) / 2; this.y = y + (TILE - c.h);
    this.vx = 0; this.vy = 0; this.onGround = false;
    this.hp = c.hp; this.score = c.score; this.dead = false;
    this.fireCd = c.fireCd; this.anim = 0;
  }
  hit(dmg, world) { rangedHit(this, dmg, world, '#ffcc33'); }
  update(dt, world) {
    if (this.dead) return;
    this.anim += dt;
    collideTiles(this, world.grid, dt);
    this.fireCd -= dt * (world.fireRateMul || 1);
    if (this.fireCd <= 0) {
      this.fireCd = this.cfg.fireCd;
      const p = world.player; if (!p) return;
      const a = aimAt(this, p);
      world.spawnEnemyBullet({ x: this.x + this.w / 2 - 5, y: this.y + this.h * 0.4, vx: a.x * this.cfg.bulletSpeed, vy: a.y * this.cfg.bulletSpeed, dmg: this.cfg.bulletDmg, life: 2.5 });
      world.playSound('shoot');
    }
  }
  frame() { return Math.floor(this.anim * 4) % 2; }
}

// Turret 炮台: fixed, fires a fan/burst of bullets on its cooldown.
export class Turret {
  constructor(x, y) {
    const c = ENEMY_RANGED.turret; this.cfg = c;
    this.w = c.w; this.h = c.h;
    this.x = x + (TILE - c.w) / 2; this.y = y + (TILE - c.h);
    this.vx = 0; this.vy = 0; this.onGround = false;
    this.hp = c.hp; this.score = c.score; this.dead = false;
    this.fireCd = c.fireCd; this.anim = 0;
  }
  hit(dmg, world) { rangedHit(this, dmg, world, '#ffcc33'); }
  update(dt, world) {
    if (this.dead) return;
    this.anim += dt;
    collideTiles(this, world.grid, dt);
    this.fireCd -= dt * (world.fireRateMul || 1);
    if (this.fireCd <= 0) {
      this.fireCd = this.cfg.fireCd;
      const p = world.player; if (!p) return;
      const a = aimAt(this, p);
      const base = Math.atan2(a.y, a.x);
      const n = this.cfg.burst, half = this.cfg.spreadAngle * (n - 1) / 2;
      for (let i = 0; i < n; i++) {
        const ang = base - half + this.cfg.spreadAngle * i;
        world.spawnEnemyBullet({ x: this.x + this.w / 2 - 5, y: this.y + this.h * 0.4, vx: Math.cos(ang) * this.cfg.bulletSpeed, vy: Math.sin(ang) * this.cfg.bulletSpeed, dmg: this.cfg.bulletDmg, life: 2.5 });
      }
      world.playSound('shoot');
    }
  }
  frame() { return Math.floor(this.anim * 3) % 2; }
}

// Flyer 飞兵: airborne sine-wave drift toward the player; periodically fires.
export class Flyer {
  constructor(x, y) {
    const c = ENEMY_RANGED.flyer; this.cfg = c;
    this.w = c.w; this.h = c.h;
    this.x = x; this.baseY = y; this.y = y;
    this.vx = 0; this.vy = 0; this.onGround = false;
    this.hp = c.hp; this.score = c.score; this.dead = false;
    this.t = 0; this.fireCd = c.fireCd; this.dir = -1;
  }
  hit(dmg, world) { rangedHit(this, dmg, world, '#9fe6ff'); }
  update(dt, world) {
    if (this.dead) return;
    this.t += dt;
    const p = world.player;
    if (p) this.dir = (p.x + p.w / 2) < (this.x + this.w / 2) ? -1 : 1;
    this.x += this.dir * this.cfg.speed * (world.levelMul || 1) * dt;
    this.y = this.baseY + Math.sin(this.t * this.cfg.freq) * this.cfg.amp;
    this.fireCd -= dt * (world.fireRateMul || 1);
    if (this.fireCd <= 0 && p) {
      this.fireCd = this.cfg.fireCd;
      const a = aimAt(this, p);
      world.spawnEnemyBullet({ x: this.x + this.w / 2 - 5, y: this.y + this.h, vx: a.x * this.cfg.bulletSpeed, vy: a.y * this.cfg.bulletSpeed, dmg: this.cfg.bulletDmg, life: 2.5 });
    }
  }
  frame() { return Math.floor(this.t * 8) % 2; }
}
