// Core game state + simulation for 丛林勇士. Pure world-space logic; rendering lives in
// render.js, I/O in input.js. M1 state machine:
//   title -> ready -> playing -> clear        (+ respawning, gameover[classic])
// M1 starts in casual mode (infinite in-place respawns). Mode switch / select screen /
// save / BOSS arrive in later milestones.

import { FIELD, TILE, MODES, SCORE, SOLID, DEFAULT_WEAPON, PLAYER, COMBO, BOSSES } from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import { Player, Runner, Jumper, Bullet, Pickup, Falcon, Boss, Gunner, Turret, Flyer } from './entities.js';
import { aabb } from './physics.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import * as Save from './save.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Game {
  constructor() {
    this.state = 'title';
    this.mode = MODES[Save.getMode()] || MODES.casual;
    this.score = 0;
    this.lives = this.mode.lives;
    this.deaths = 0;
    this._elapsed = 0;   // seconds in the current level (for ⭐)
    this.lastStars = 0;
    this.konami = false;
    this.levelIndex = 0;
    this.level = null;
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.floatTexts = [];
    this.camera = { x: 0, y: 0 };
    this.shake = 0;
    this.readyTimer = 0;
    this._t = 0; // wall clock for shake phase
    this.pickups = [];
    this.falcons = [];
    this._falconDefs = [];
    this.boss = null;
    this.enemyBullets = [];
    this.combo = { count: 0, mult: 1, timer: 0 };
    this._world = this._makeWorld();
  }

  // ---- world facade handed to entities (spec §13 contract) ----
  _makeWorld() {
    const game = this;
    return {
      get grid() { return game.level.grid; },
      get player() { return game.player; },
      get enemies() { return game.enemies; },
      get bullets() { return game.bullets; },
      get particles() { return game.particles; },
      get camera() { return game.camera; },
      get mode() { return game.mode; },
      get pickups() { return game.pickups; },
      get falcons() { return game.falcons; },
      get boss() { return game.boss; },
      get enemyBullets() { return game.enemyBullets; },
      get levelMul() { return (game.level && game.level.difficulty && game.level.difficulty.enemyMul) || 1; },
      get fireRateMul() { return (game.level && game.level.difficulty && game.level.difficulty.fireRateMul) || 1; },
      input: Input,
      addScore(n) { game.score += n; },
      killScore(base) { game.score += game.registerKill(base); },
      spawnEnemy(type, x, y) { game.spawnEnemy(type, x, y); },
      spawnPickup(letter, x, y) { game.pickups.push(new Pickup(letter, x, y)); },
      spawnBullets(specs) { for (const s of specs) game.bullets.push(new Bullet(s)); },
      spawnEnemyBullet(spec) { game.enemyBullets.push(new Bullet({ ...spec, hostile: true })); },
      playSound(id) { Sound.play(id); },
      shake(intensity) { game.shake = Math.max(game.shake, intensity); },
      addFloatText(text, x, y, color) { game.floatTexts.push({ text, x, y, color, life: 1 }); },
      spawnParticles(x, y, opts = {}) { game._spawnParticles(x, y, opts); },
    };
  }

  // ---- lifecycle ----
  setMode(id) {
    this.mode = MODES[id] || MODES.casual;
    this.lives = this.mode.lives;
    Save.setMode(this.mode.id);
  }

  startLevel(i) {
    this.levelIndex = i;
    this.level = parseLevel(LEVELS[i]);
    this.score = this.score || 0;
    this.deaths = 0;
    this._elapsed = 0;
    this._spawnEntities();
    this.state = 'ready';
    this.readyTimer = 1.2;
  }

  _spawnEntities() {
    const lv = this.level;
    const sp = this._safeSpawn(lv.spawn.x, lv.spawn.y);
    this.player = new Player(sp.x, sp.y);
    this.player.weapon = DEFAULT_WEAPON;
    this.enemies = lv.enemies.map((e) => this._makeEnemy(e.type, e.x, e.y));
    this.bullets = [];
    this.particles = [];
    this.floatTexts = [];
    this.pickups = [];
    this.falcons = [];
    this._falconDefs = (lv.falcons || []).map((f) => ({ ...f, fired: false }));
    this.boss = null;
    this.enemyBullets = [];
    this.combo = { count: 0, mult: 1, timer: 0 };
    this.camera.x = clamp(this.player.x - FIELD.W / 2, 0, Math.max(0, lv.width - FIELD.W));
    this.camera.y = clamp(this.player.y - FIELD.H / 2, 0, Math.max(0, lv.height - FIELD.H));
  }

  _makeEnemy(type, x, y) {
    switch (type) {
      case 'jumper': return new Jumper(x, y);
      case 'gunner': return new Gunner(x, y);
      case 'turret': return new Turret(x, y);
      case 'flyer': return new Flyer(x, y);
      default: return new Runner(x, y);
    }
  }
  spawnEnemy(type, x, y) { this.enemies.push(this._makeEnemy(type, x, y)); }

  _startPlaying() { this.state = 'playing'; }

  confirm() {
    switch (this.state) {
      case 'title': this.goSelect(); break;
      case 'select': this.selectLevel(this.levelIndex); break;
      case 'ready': this._startPlaying(); break;
      case 'clear': this.goSelect(); break;
      case 'gameover': this.continueRun(); break;
      default: break;
    }
  }

  goTitle() { this.state = 'title'; }
  goSelect() { this.state = 'select'; }

  // Start a level by 0-based index if its 1-based id is unlocked. Returns success.
  selectLevel(i) {
    const id = i + 1;
    if (i < 0 || i >= LEVELS.length) return false;
    if (!Save.isUnlocked(id)) return false;
    this.startLevel(i);
    return true;
  }

  // Konami easter egg (spec §6.2): classic → 30 lives, casual → cool fx; persist the flag.
  onKonami() {
    this.konami = true;
    Save.setKonami(true);
    if (this.mode.lives !== Infinity) this.lives = 30;
    Sound.play('clear');
  }

  // Classic Game Over → replay the current level, refill lives, keep unlocks.
  continueRun() {
    this.lives = this.mode.lives;
    this.startLevel(this.levelIndex);
  }

  // ---- spawn safety (spec §13 M1): find the ground SURFACE near (sx,sy) ----
  // Topmost solid (the standing surface) of a column, or null if the column is a pit.
  _surfaceRow(col) {
    const grid = this.level.grid;
    for (let r = 0; r < grid.length; r++) {
      const t = grid[r] && grid[r][col];
      if (t && SOLID.has(t)) return r;
    }
    return null;
  }
  // Search the fall column then +/-3 tiles for footing; fall back to the level spawn if
  // everything nearby is a pit (e.g. died below the map — guards the respawn loop).
  _safeSpawn(sx, sy) {
    const col0 = clamp(Math.round(sx / TILE), 0, this.level.cols - 1);
    let r = this._surfaceRow(col0);
    if (r != null) return { x: col0 * TILE, y: r * TILE - PLAYER.h };
    for (let d = 1; d <= 3; d++) {
      for (const col of [col0 - d, col0 + d]) {
        if (col < 0 || col >= this.level.cols) continue;
        r = this._surfaceRow(col);
        if (r != null) return { x: col * TILE, y: r * TILE - PLAYER.h };
      }
    }
    return { x: this.level.spawn.x, y: this.level.spawn.y };
  }

  // ---- simulation ----
  update(dt) {
    this._t += dt;
    this._updateParticles(dt);
    this._updateFloatTexts(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    if (this.state === 'ready') {
      this.readyTimer -= dt;
      if (this.readyTimer <= 0) this._startPlaying();
      return;
    }
    if (this.state !== 'playing') return;

    const lv = this.level;
    const p = this.player;
    this._elapsed += dt;

    p.update(dt, this._world);

    // death plunge / pit
    if (p.dying > 0) {
      if (p.y > lv.height + 80) this._onPlayerDead();
      this._updateCamera();
      return;
    }
    if (p.y > lv.height + 40) p.startDeath(this._world);

    for (const b of this.bullets) { if (!b.dead) b.update(dt, this._world); }
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.update(dt, this._world);
      if (e.y > lv.height + 80) e.dead = true;
    }

    this._playerEnemyCollisions();

    // Falcons + pickups (capsule loop)
    this._updateFalcons(dt);
    for (const pk of this.pickups) { if (!pk.dead) pk.update(dt, this._world); }
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const f of this.falcons) {
        if (!f.dead && aabb(b, f)) { f.hitByBullet(this._world); if (!b.pierce) b.dead = true; }
      }
    }
    for (const pk of this.pickups) { if (!pk.dead && aabb(p, pk)) pk.apply(p, this._world); }

    // Boss: spawns at bossX, takes bullet/contact damage, gates the level clear.
    if (!this.boss && lv.bossX != null && p.x + p.w > lv.bossX) this._spawnBoss();
    if (this.boss) {
      if (!this.boss.dead) this.boss.update(dt, this._world);
      for (const b of this.bullets) {
        if (!b.dead && !this.boss.dead && aabb(b, this.boss)) { this.boss.hit(b.dmg, this._world); if (!b.pierce) b.dead = true; }
      }
      if (!this.boss.dead && this.boss.cfg.touchDamage && aabb(p, this.boss)) {
        if (p.barrier > 0) this.boss.hit(999, this._world);
        else if (!p.isInvulnerable()) p.takeDamage(this._world);
      }
      if (this.boss.dead) {
        this.boss.dying -= dt;
        if (this.boss.dying <= 0) { this._levelClear(); return; }
      }
    }

    // Enemy bullets (hostile): move, die on terrain, damage the player on contact.
    for (const b of this.enemyBullets) {
      if (b.dead) continue;
      b.update(dt, this._world);
      if (!b.dead && p.dying <= 0 && aabb(p, b)) {
        if (p.barrier > 0) b.dead = true;
        else if (!p.isInvulnerable()) { p.takeDamage(this._world); b.dead = true; }
      }
    }

    // Combo decay
    if (this.combo.timer > 0) {
      this.combo.timer -= dt;
      if (this.combo.timer <= 0) { this.combo.count = 0; this.combo.mult = 1; }
    }

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.pickups = this.pickups.filter((pk) => !pk.dead);
    this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);

    // No-boss levels clear by reaching the goal flag (boss levels clear on boss death).
    if (this.boss == null && lv.bossX == null && p.x + p.w > lv.goalX) { this._levelClear(); return; }

    this._updateCamera();
  }

  _playerEnemyCollisions() {
    const p = this.player;
    if (p.dying > 0) return;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!aabb(p, e)) continue;
      if (p.barrier > 0) { if (e.hit) e.hit(999, this._world); continue; } // barrier: instakill
      if (p.isInvulnerable()) continue;
      p.takeDamage(this._world);
      break;
    }
  }

  _onPlayerDead() {
    const pt = this._safeSpawn(this.player.x, this.player.y);
    if (this.mode.lives !== Infinity) {
      this.lives -= 1;
      if (this.lives <= 0) { this.state = 'gameover'; Sound.play('die'); return; }
      if (this.mode.loseWeaponOnDeath) { this.player.weapon = DEFAULT_WEAPON; this.player.rapid = 0; }
    }
    this.deaths += 1;
    this.player.respawn(pt.x, pt.y, this.mode.invuln);
    this.state = 'playing';
  }

  _levelClear() {
    this.score += SCORE.levelClear;
    const id = this.levelIndex + 1;
    const stars = Save.rateStars({ time: this._elapsed, deaths: this.deaths, mode: this.mode.id });
    this.lastStars = stars;
    Save.markCleared(id, { time: Math.round(this._elapsed), score: this.score, stars });
    this.state = 'clear';
    Sound.play('clear');
  }

  // Combo: stacks kills within COMBO.window, multiplies score, floats text. Returns gain.
  registerKill(baseScore) {
    if (this.combo.timer > 0) this.combo.count += 1; else this.combo.count = 1;
    this.combo.timer = COMBO.window;
    this.combo.mult = Math.min(COMBO.maxMult, this.combo.count);
    const gain = Math.round(baseScore * this.combo.mult);
    if (this.combo.mult > 1) Sound.play('combo');
    this._world.addFloatText(
      this.combo.mult > 1 ? `+${gain} x${this.combo.mult}` : `+${gain}`,
      this.player.x, this.player.y - 12, '#ffe066');
    return gain;
  }

  // Trigger + fly falcons; cull off the left edge.
  _updateFalcons(dt) {
    const camRight = this.camera.x + FIELD.W;
    for (const def of this._falconDefs) {
      if (!def.fired && camRight > def.atX) {
        def.fired = true;
        const path = (def.path || []).map((pt) => ({ x: pt.x * TILE, y: pt.y * TILE }));
        const start = path[0] || { x: camRight + 40, y: 3 * TILE };
        this.falcons.push(new Falcon(def.drop, start.x, start.y, path));
      }
    }
    for (const f of this.falcons) { if (!f.dead) f.update(dt, this._world); }
    this.falcons = this.falcons.filter((f) => !f.dead && f.x > this.camera.x - 80);
  }

  _spawnBoss() {
    const lv = this.level;
    const cfg = BOSSES[lv.bossType || 'ironGate'] || BOSSES.ironGate;
    const surf = this._surfaceRow(Math.floor((lv.bossX + 2 * TILE) / TILE));
    const gy = (surf != null ? surf : lv.rows - 4);
    this.boss = new Boss(lv.bossType || 'ironGate', lv.bossX + TILE, gy * TILE - cfg.h);
    const mul = (lv.difficulty && lv.difficulty.bossHpMul) || 1;
    this.boss.maxHp = Math.round(this.boss.maxHp * mul);
    this.boss.hp = this.boss.maxHp;
    Sound.play('hit');
  }

  _updateCamera() {
    const lv = this.level, p = this.player;
    const dead = FIELD.W * 0.18;
    const target = p.x + p.w / 2;
    const camMid = this.camera.x + FIELD.W / 2;
    if (target > camMid + dead) this.camera.x = target - FIELD.W / 2 - dead;
    else if (target < camMid - dead) this.camera.x = target - FIELD.W / 2 + dead;
    this.camera.x = clamp(this.camera.x, 0, Math.max(0, lv.width - FIELD.W));
    const ty = clamp(p.y + p.h / 2 - FIELD.H / 2, 0, Math.max(0, lv.height - FIELD.H));
    this.camera.y += (ty - this.camera.y) * 0.12;
    this.camera.y = clamp(this.camera.y, 0, Math.max(0, lv.height - FIELD.H));
  }

  _spawnParticles(x, y, opts) {
    const count = opts.count || 8;
    const color = opts.color || '#ffcc33';
    const speed = opts.speed || 160;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.particles.push({
        x, y, vx: Math.cos(a) * speed * (0.5 + (i % 3) * 0.25),
        vy: Math.sin(a) * speed * (0.5 + (i % 2) * 0.4) - 60,
        life: 0.7, color, size: 4,
      });
    }
  }
  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.4;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }
  _updateFloatTexts(dt) {
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const t = this.floatTexts[i];
      t.y -= 28 * dt; t.life -= dt;
      if (t.life <= 0) this.floatTexts.splice(i, 1);
    }
  }
}
