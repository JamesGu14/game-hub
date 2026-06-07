// Core game state + simulation for 像素冒险 PIXEL QUEST.
// Pure logic in world-space; rendering lives in render.js, I/O in input.js.
// State machine:
//   menu (choose mode) -> story -> ready -> playing <-> paused
//     -> levelclear -> (next level) ... -> win
//     any playing death with no lives -> gameover

import {
  FIELD, TILE, MODES, SCORE, STORAGE_KEY, BUMPABLE, SOLID,
} from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import {
  Player, Goomba, Koopa, Coin, Powerup, Fireball, MovingPlatform,
} from './entities.js';
import { aabb } from './physics.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Game {
  constructor() {
    this.state = 'menu';
    this.prevState = 'menu';
    this.mode = MODES.easy;
    this.menuChoice = 'easy';

    this.score = 0;
    this.coins = 0;
    this.lives = 5;
    this.levelIndex = 0;

    this.level = null;
    this.player = null;
    this.enemies = [];
    this.coinsArr = [];
    this.powerups = [];
    this.fireballs = [];
    this.movers = [];
    this.floatTexts = [];
    this.particles = [];

    this.camera = { x: 0, y: 0 };
    this.timeLeft = 300;
    this.checkpointReached = false;

    this.flagAnim = 0; // >0 while sliding the flag
    this.winTimer = 0;

    this.best = this._loadBest();
    this._world = this._makeWorld();
  }

  // ---- persistence ----
  _loadBest() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { score: 0, level: 1 };
  }
  _saveBest() {
    const level = this.levelIndex + 1;
    if (this.score > this.best.score) this.best.score = this.score;
    if (level > this.best.level) this.best.level = level;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.best)); } catch { /* ignore */ }
  }

  // ---- world facade handed to entities ----
  _makeWorld() {
    const game = this;
    return {
      get grid() { return game.level.grid; },
      get enemies() { return game.enemies; },
      get coins() { return game.coinsArr; },
      get powerups() { return game.powerups; },
      get fireballs() { return game.fireballs; },
      get movers() { return game.movers; },
      get player() { return game.player; },
      get mode() { return game.mode; },
      input: Input,
      sound: Sound,
      addScore(n) { game.score += n; },
      addCoin() { game._collectCoin(); },
      spawnPowerup(kind, x, y) { game.powerups.push(new Powerup(kind, x, y)); },
      hurtPlayer() { game._hurtPlayer(); },
      bumpTile(col, row, by) { game._bumpTile(col, row, by); },
      floatText(text, x, y, color) { game.floatTexts.push({ text, x, y, color, life: 1 }); },
    };
  }

  // ---- lifecycle ----
  startGame(modeId) {
    this.mode = MODES[modeId] || MODES.easy;
    this.menuChoice = this.mode.id;
    this.score = 0;
    this.coins = 0;
    this.lives = this.mode.lives;
    this.levelIndex = 0;
    this.state = 'story';
    Sound.ui();
  }

  beginAfterStory() {
    this.loadLevel(0);
  }

  loadLevel(i) {
    this.levelIndex = i;
    this.level = parseLevel(LEVELS[i]);
    this.checkpointReached = false;
    this.timeLeft = this.level.time;
    this._spawnEntities(true);
    this.state = 'ready';
    this.readyTimer = 1.3;
    Sound.stopMusic();
  }

  // (re)spawn entities; full=true resets everything, false = respawn from checkpoint
  _spawnEntities(full) {
    const lv = this.level;
    let sx = lv.spawn.x, sy = lv.spawn.y;
    if (!full && this.checkpointReached && lv.checkpoint) {
      sx = lv.checkpoint.x; sy = lv.checkpoint.y;
    }
    // Never (re)spawn hovering over a pit — snap to the nearest grounded column.
    const safe = this._safeSpawn(sx, sy);
    sx = safe.x; sy = safe.y;
    this.player = new Player(sx, sy);
    this.player.h = 28; // start small
    this.player.x = sx;
    this.player.y = sy - this.player.h + TILE; // sit feet near spawn tile bottom
    this.fireballs = [];
    this.powerups = [];
    this.floatTexts = [];
    this.particles = [];
    this.flagAnim = 0;

    if (full) {
      this.enemies = lv.enemies.map((e) =>
        e.type === 'koopa' ? new Koopa(e.x, e.y) : new Goomba(e.x, e.y));
      this.coinsArr = lv.coins.map((c) => new Coin(c.x, c.y));
      this.movers = (lv.movers || []).map((m) => new MovingPlatform(m));
    }
    this.camera.x = clamp(this.player.x - FIELD.W / 2, 0, Math.max(0, lv.width - FIELD.W));
    this.camera.y = clamp(this.player.y - FIELD.H / 2, 0, Math.max(0, lv.height - FIELD.H));
  }

  // First solid tile row at/below `fromRow` in `col`, or null if the column is a pit.
  _groundRowBelow(col, fromRow) {
    const grid = this.level.grid;
    for (let r = Math.max(0, fromRow); r < grid.length; r++) {
      const t = grid[r] && grid[r][col];
      if (t && SOLID.has(t)) return r;
    }
    return null;
  }

  // Keep a spawn point over solid ground; if it's over a pit, snap to the nearest
  // grounded column (guards against checkpoints/spawns authored above a gap).
  _safeSpawn(sx, sy) {
    const col0 = Math.round(sx / TILE);
    const row0 = Math.round(sy / TILE);
    if (this._groundRowBelow(col0, row0) != null) return { x: sx, y: sy };
    for (let d = 1; d <= 12; d++) {
      for (const col of [col0 - d, col0 + d]) {
        if (col < 0 || col >= this.level.cols) continue;
        if (this._groundRowBelow(col, row0) != null) return { x: col * TILE, y: sy };
      }
    }
    return { x: sx, y: sy }; // no ground anywhere on this row — leave as-is
  }

  // ---- input-driven actions ----
  confirm() {
    switch (this.state) {
      case 'menu': this.startGame(this.menuChoice); break;
      case 'story': this.beginAfterStory(); break;
      case 'ready': this._startPlaying(); break;
      case 'paused': this.togglePause(); break;
      case 'levelclear': this.nextLevel(); break;
      case 'gameover': this.continueRun(); break;
      case 'win': this.state = 'menu'; break;
    }
  }

  _startPlaying() {
    this.state = 'playing';
    Sound.startMusic(this.level.theme);
  }

  togglePause() {
    if (this.state === 'paused') {
      this.state = this.prevState;
      if (this.state === 'playing') Sound.startMusic(this.level.theme);
    } else if (this.state === 'playing' || this.state === 'ready') {
      this.prevState = this.state;
      this.state = 'paused';
      Sound.stopMusic();
    }
    Sound.ui();
  }

  nextLevel() {
    const next = this.levelIndex + 1;
    if (next >= LEVELS.length) { this.state = 'win'; this._saveBest(); Sound.win(); return; }
    this.loadLevel(next);
  }

  restart() { this.startGame(this.mode.id); }

  // After a game-over: refill lives and replay the CURRENT level (keep score),
  // instead of dropping back to level 1-1.
  continueRun() {
    this.lives = this.mode.lives;
    this.loadLevel(this.levelIndex);
  }

  // ---- coin / life ----
  _collectCoin() {
    this.coins += 1;
    this.score += SCORE.coin;
    Sound.coin();
    if (this.coins >= SCORE.oneUpAtCoins) {
      this.coins -= SCORE.oneUpAtCoins;
      this.lives += 1;
      Sound.oneUp();
      this.floatTexts.push({ text: '1UP', x: this.player.x, y: this.player.y - 10, color: '#5fd97a', life: 1.2 });
    }
  }

  _hurtPlayer() {
    const lost = this.player.takeDamage(this._world);
    if (lost) { /* death handled by player.dying + update */ }
  }

  _bumpTile(col, row, by) {
    const grid = this.level.grid;
    if (!grid[row] || !grid[row][col]) return;
    const type = grid[row][col];
    if (!BUMPABLE.has(type)) { Sound.bump(); return; }

    const cx = col * TILE + TILE / 2;
    const cy = row * TILE;
    const big = by.form !== 'small';

    if (type === 'brick') {
      if (big) {
        grid[row][col] = null;
        Sound.brickBreak();
        this._brickParticles(col, row);
      } else { Sound.bump(); }
      return;
    }
    if (type === 'brickCoin') {
      grid[row][col] = null;
      this.coinsArr.push(Coin.popped(cx, cy));
      this._collectCoin();
      this._brickParticles(col, row);
      return;
    }
    if (type === 'qcoin') {
      grid[row][col] = 'qempty';
      this.coinsArr.push(Coin.popped(cx, cy + TILE / 2));
      this._collectCoin();
      Sound.bump();
      return;
    }
    if (type === 'qpower') {
      grid[row][col] = 'qempty';
      const kind = by.form === 'small' ? 'mushroom' : 'flower';
      this.powerups.push(new Powerup(kind, cx - 13, cy - 4));
      this.score += SCORE.powerup;
      Sound.powerupAppear();
      return;
    }
    if (type === 'qstar') {
      grid[row][col] = 'qempty';
      this.powerups.push(new Powerup('star', cx - 13, cy - 4));
      this.score += SCORE.powerup;
      Sound.powerupAppear();
      return;
    }
  }

  _brickParticles(col, row) {
    const cx = col * TILE + TILE / 2;
    const cy = row * TILE + TILE / 2;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 120;
      this.particles.push({
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        life: 0.8, color: '#c4731f', size: 4,
      });
    }
  }

  // ---- simulation ----
  update(dt) {
    this._updateFloatTexts(dt);
    this._updateParticles(dt);

    if (this.state === 'ready') {
      if (this.readyTimer != null) {
        this.readyTimer -= dt;
        if (this.readyTimer <= 0) this._startPlaying();
      }
      return;
    }
    if (this.state === 'ending') { this._updateEnding(dt); return; }
    if (this.state !== 'playing') return;

    // Fire action consumed via Input subscription in main.js -> game.tryFire()
    const lv = this.level;
    const p = this.player;

    // Flag finish animation
    if (this.flagAnim > 0) {
      this.flagAnim -= dt;
      p.y += 120 * dt;
      const groundY = lv.height - 2 * TILE;
      if (p.y + p.h > groundY) p.y = groundY - p.h;
      if (this.flagAnim <= 0) this._finishLevel();
      this._updateCamera();
      return;
    }

    // Timer
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; if (p.dying <= 0) p.startDeath(this._world); }

    // Movers first (so carry uses fresh deltas)
    for (const m of this.movers) m.update(dt);

    // Player
    p.update(dt, this._world);

    // Death plunge / pit fall
    if (p.dying > 0) {
      if (p.y > lv.height + 80) this._onPlayerDead();
      this._updateCamera();
      return;
    }
    if (p.y > lv.height + 40) { p.startDeath(this._world); }

    // Enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.update(dt, this._world);
      if (e.y > lv.height + 80) e.dead = true;
    }

    // Coins
    for (const c of this.coinsArr) {
      if (c.dead) continue;
      c.update(dt);
      if (!c.popped && aabb(p, c)) { c.dead = true; this._collectCoin(); }
    }

    // Powerups
    for (const pu of this.powerups) {
      if (pu.dead) continue;
      pu.update(dt, this._world);
      if (aabb(p, pu)) {
        pu.dead = true;
        if (pu.kind === 'mushroom') p.grow(this._world);
        else if (pu.kind === 'flower') p.goFire(this._world);
        else { p.goStar(); Sound.powerupGet(); }
        this.score += SCORE.powerup;
      }
    }

    // Fireballs
    for (const f of this.fireballs) {
      if (f.dead) continue;
      f.update(dt, this._world);
    }

    // Player vs enemies
    this._playerEnemyCollisions();

    // Cull dead
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.coinsArr = this.coinsArr.filter((c) => !c.dead);
    this.powerups = this.powerups.filter((pu) => !pu.dead);
    this.fireballs = this.fireballs.filter((f) => !f.dead);

    // Flag / castle reach
    this._checkGoal();

    this._updateCamera();
  }

  _playerEnemyCollisions() {
    const p = this.player;
    if (p.dying > 0) return;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!aabb(p, e)) continue;

      // Star: instakill on touch
      if (p.star > 0) {
        if (e instanceof Koopa) e.dead = true; else if (e.kill) e.kill(this._world);
        this.score += SCORE.stomp;
        continue;
      }

      const stomping = p.vy > 0 && (p.y + p.h) - e.y < 16;

      if (e instanceof Goomba) {
        if (e.squish > 0) continue;
        if (stomping) {
          e.stomp(this._world);
          p.vy = -440;
          this.score += SCORE.stomp;
        } else {
          this._hurtPlayer();
        }
      } else if (e instanceof Koopa) {
        if (e.state === 'walk') {
          if (stomping) { e.toShell(this._world); p.vy = -440; this.score += SCORE.stomp; }
          else this._hurtPlayer();
        } else if (e.kickGrace <= 0) {
          // Shell never hurts the player. A STOPPED shell gets kicked away on ANY
          // contact — that slides it out from under the player, fixing the
          // stand-on-shell-edge jitter + score spam (each frame used to re-trigger
          // stopShell + a stomp bounce + score). A MOVING shell is stopped by a
          // stomp, otherwise redirected.
          if (e.state === 'shell') {
            const dir = (p.x + p.w / 2) < (e.x + e.w / 2) ? 1 : -1;
            e.kickShell(dir, this._world);
            this.score += SCORE.shellHit;
            if (stomping) p.vy = -440;
          } else if (stomping) {
            e.stopShell(this._world);
            p.vy = -440;
            this.score += SCORE.stomp;
          } else {
            const dir = (p.x + p.w / 2) < (e.x + e.w / 2) ? 1 : -1;
            e.kickShell(dir, this._world);
          }
        }
      }
    }
  }

  _checkGoal() {
    const lv = this.level;
    const p = this.player;
    // The pole is drawn ~22px into the flag cell (blit at flagX+8, pole at logical
    // x7 × SC2). Require the player to actually reach the pole, not just enter the
    // cell, so victory triggers on contact instead of ~2cm short.
    if (lv.flagX != null && this.flagAnim <= 0 && p.x + p.w > lv.flagX + 20) {
      this.flagAnim = 1.0;
      this.player.vx = 0;
      const groundY = lv.height - 2 * TILE;
      const heightFrac = clamp(1 - (p.y) / (groundY - 2 * TILE), 0, 1);
      this.flagBonus = Math.round(SCORE.flagBase + heightFrac * 500);
      Sound.stopMusic();
      Sound.flag();
      return;
    }
    if (lv.castleX != null && p.x + p.w > lv.castleX + 10) {
      this._winGame();
    }
    // checkpoint
    if (!this.checkpointReached && lv.checkpoint && p.x > lv.checkpoint.x) {
      this.checkpointReached = true;
    }
  }

  _finishLevel() {
    this.score += (this.flagBonus || SCORE.flagBase);
    this.score += Math.floor(this.timeLeft) * SCORE.timeBonus;
    this.score += SCORE.levelClear;
    this._saveBest();
    this.state = 'levelclear';
    Sound.levelClear();
  }

  _winGame() {
    this.score += SCORE.levelClear;
    this.score += Math.floor(this.timeLeft) * SCORE.timeBonus;
    this._saveBest();
    Sound.win();
    // Play the victory cutscene; the win panel (HTML overlay) appears only once it
    // finishes (state 'ending' is not in main.js's overlay map, so nothing covers
    // the canvas during the scene).
    const lv = this.level;
    const p = this.player;
    p.vx = 0; p.vy = 0; p.faceRight = true;
    this.enemies = []; // clear the stage for a clean celebration
    this.ending = {
      phase: 'walk',
      t: 0,
      meetX: lv.castleX + TILE - 24 - p.w / 2, // stand a step left of the princess
      crownY: null,
      confettiT: 0,
    };
    this.state = 'ending';
  }

  // Scripted ending: hero walks to the princess, kneels & kisses her hand, she
  // crowns him, then confetti rains before the win panel shows.
  _updateEnding(dt) {
    const e = this.ending;
    const p = this.player;
    if (!e) { this.state = 'win'; return; }
    e.t += dt;
    if (e.phase === 'walk') {
      const dx = e.meetX - p.x;
      const step = 70 * dt;
      if (Math.abs(dx) <= step || dx < 0) { p.x = e.meetX; e.phase = 'kneel'; e.t = 0; }
      else { p.x += step; p.faceRight = true; }
      return;
    }
    if (e.phase === 'kneel') {            // kneel + kiss the hand (hearts in render)
      p.faceRight = true;
      if (e.t > 1.4) { e.phase = 'crown'; e.t = 0; e.crownY = -42; }
      return;
    }
    if (e.phase === 'crown') {            // princess lowers the crown onto the hero
      e.crownY = Math.min(0, e.crownY + 70 * dt);
      if (e.t > 1.3) { e.phase = 'celebrate'; e.t = 0; }
      return;
    }
    if (e.phase === 'celebrate') {        // confetti, then reveal the win panel
      e.confettiT -= dt;
      if (e.confettiT <= 0) { this._spawnConfetti(); e.confettiT = 0.04; }
      if (e.t > 2.8) this.state = 'win';
      return;
    }
  }

  _spawnConfetti() {
    const colors = ['#ff5a5f', '#ffd23f', '#5fd97a', '#4f9bff', '#c46bff', '#ff9f1c'];
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: this.camera.x + Math.random() * FIELD.W,
        y: this.camera.y - 12,
        vx: (Math.random() - 0.5) * 90,
        vy: 30 + Math.random() * 70,
        life: 1.6,
        color: colors[(Math.random() * colors.length) | 0],
        size: 4 + ((Math.random() * 3) | 0),
      });
    }
  }

  _onPlayerDead() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.state = 'gameover';
      this._saveBest();
      Sound.gameOver();
      return;
    }
    // respawn
    this._spawnEntities(false);
    this.state = 'ready';
    this.readyTimer = 1.0;
    Sound.stopMusic();
  }

  // Called from main.js on the 'fire' discrete action.
  tryFire() {
    if (this.state !== 'playing' || !this.player) return;
    this.player.fire(this._world);
  }

  _updateCamera() {
    const lv = this.level;
    const p = this.player;
    const dead = FIELD.W * 0.18;
    const target = p.x + p.w / 2;
    const camMid = this.camera.x + FIELD.W / 2;
    if (target > camMid + dead) this.camera.x = target - FIELD.W / 2 - dead;
    else if (target < camMid - dead) this.camera.x = target - FIELD.W / 2 + dead;
    this.camera.x = clamp(this.camera.x, 0, Math.max(0, lv.width - FIELD.W));

    // vertical: follow softly, clamp
    const ty = clamp(p.y + p.h / 2 - FIELD.H / 2, 0, Math.max(0, lv.height - FIELD.H));
    this.camera.y += (ty - this.camera.y) * 0.12;
    this.camera.y = clamp(this.camera.y, 0, Math.max(0, lv.height - FIELD.H));
  }

  _updateFloatTexts(dt) {
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const t = this.floatTexts[i];
      t.y -= 28 * dt;
      t.life -= dt * 1.0;
      if (t.life <= 0) this.floatTexts.splice(i, 1);
    }
  }
  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += 700 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 1.4;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  // ---- HUD helpers ----
  currentLevelName() { return this.level ? this.level.name : ''; }
  currentLevelId() { return this.level ? this.level.id : '1-1'; }
  totalLevels() { return LEVELS.length; }
}
