// Core game state + simulation for 丛林勇士. Pure world-space logic; rendering lives in
// render.js, I/O in input.js. M1 state machine:
//   title -> ready -> playing -> clear        (+ respawning, gameover[classic])
// M1 starts in casual mode (infinite in-place respawns). Mode switch / select screen /
// save / BOSS arrive in later milestones.

import { FIELD, TILE, MODES, SCORE, SOLID, DEFAULT_WEAPON, PLAYER } from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import { Player, Runner, Jumper, Bullet } from './entities.js';
import { aabb } from './physics.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Game {
  constructor() {
    this.state = 'title';
    this.mode = MODES.casual;
    this.score = 0;
    this.lives = this.mode.lives;
    this.deaths = 0;
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
      input: Input,
      addScore(n) { game.score += n; },
      spawnEnemy(type, x, y) { game.spawnEnemy(type, x, y); },
      spawnBullets(specs) { for (const s of specs) game.bullets.push(new Bullet(s)); },
      playSound(id) { Sound.play(id); },
      shake(intensity) { game.shake = Math.max(game.shake, intensity); },
      addFloatText(text, x, y, color) { game.floatTexts.push({ text, x, y, color, life: 1 }); },
      spawnParticles(x, y, opts = {}) { game._spawnParticles(x, y, opts); },
    };
  }

  // ---- lifecycle ----
  setMode(id) { this.mode = MODES[id] || MODES.casual; this.lives = this.mode.lives; }

  startLevel(i) {
    this.levelIndex = i;
    this.level = parseLevel(LEVELS[i]);
    this.score = this.score || 0;
    this.deaths = 0;
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
    this.camera.x = clamp(this.player.x - FIELD.W / 2, 0, Math.max(0, lv.width - FIELD.W));
    this.camera.y = clamp(this.player.y - FIELD.H / 2, 0, Math.max(0, lv.height - FIELD.H));
  }

  _makeEnemy(type, x, y) {
    return type === 'jumper' ? new Jumper(x, y) : new Runner(x, y);
  }
  spawnEnemy(type, x, y) { this.enemies.push(this._makeEnemy(type, x, y)); }

  _startPlaying() { this.state = 'playing'; }

  confirm() {
    switch (this.state) {
      case 'title': this.startLevel(0); break;
      case 'ready': this._startPlaying(); break;
      case 'clear': this.state = 'title'; break;
      default: break;
    }
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

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);

    if (p.x + p.w > lv.goalX) { this._levelClear(); return; }

    this._updateCamera();
  }

  _playerEnemyCollisions() {
    const p = this.player;
    if (p.dying > 0 || p.invuln > 0) return;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (aabb(p, e)) { p.takeDamage(this._world); break; }
    }
  }

  _onPlayerDead() {
    const pt = this._safeSpawn(this.player.x, this.player.y);
    if (this.mode.lives !== Infinity) {
      this.lives -= 1;
      if (this.lives <= 0) { this.state = 'gameover'; Sound.play('die'); return; }
      if (this.mode.loseWeaponOnDeath) this.player.weapon = DEFAULT_WEAPON;
    }
    this.deaths += 1;
    this.player.respawn(pt.x, pt.y, this.mode.invuln);
    this.state = 'playing';
  }

  _levelClear() {
    this.score += SCORE.levelClear;
    this.state = 'clear';
    Sound.play('clear');
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
