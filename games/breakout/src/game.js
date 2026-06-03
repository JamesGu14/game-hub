// Core game state + simulation for 打砖块 BREAKOUT.
// Pure logic in field-space; rendering lives in render.js, I/O in input.js.
// The game advances on a fixed dt from main.js. State machine:
//   menu → ready(ball on paddle) → playing → (levelclear → ready) → win
//                                         ↘ lose life → ready / gameover
//   any → paused → back

import {
  FIELD,
  TOP_WALL,
  PADDLE,
  GRID,
  BRICK_W,
  BRICK_H,
  CANDY,
  HARD_CANDY,
  MODES,
  POWERUPS,
  SCORE,
  STORAGE_KEY,
} from './config.js';
import { LEVELS } from './levels.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const MAX_BOUNCE = (60 * Math.PI) / 180; // paddle deflection from vertical
const MAX_BALLS = 6;

export class Game {
  constructor() {
    this.state = 'menu';
    this.prevState = 'menu';
    this.clock = 0; // ms accumulated from dt (avoids wall-clock)
    this.mode = MODES.easy;
    this.menuChoice = 'easy'; // highlighted button on the start screen

    this.score = 0;
    this.lives = 0;
    this.levelIndex = 0;
    this.speed = 0; // current ball speed, grows as bricks break

    this.paddle = { x: FIELD.W / 2, w: MODES.easy.paddleW, baseW: MODES.easy.paddleW };
    this.balls = [];
    this.bricks = [];
    this.powerups = [];
    this.particles = [];
    this.floatTexts = []; // little "+宽板" labels when a power-up is caught

    this.wideUntil = 0;
    this.slowUntil = 0;

    this.best = this._loadBest();
  }

  // ---- persistence ----
  _loadBest() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return { score: 0, level: 1 };
  }
  _saveBest() {
    const level = this.levelIndex + 1;
    if (this.score > this.best.score) this.best.score = this.score;
    if (level > this.best.level) this.best.level = level;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.best));
    } catch {
      /* ignore */
    }
  }

  // ---- lifecycle ----
  startGame(modeId) {
    this.mode = MODES[modeId] || MODES.easy;
    this.score = 0;
    this.lives = this.mode.lives;
    this.levelIndex = 0;
    this.paddle.baseW = this.mode.paddleW;
    this.loadLevel(0);
  }

  loadLevel(i) {
    this.levelIndex = i;
    this.speed = this.mode.ballSpeed;
    this.wideUntil = 0;
    this.slowUntil = 0;
    this.powerups = [];
    this.particles = [];
    this.floatTexts = [];
    this.paddle.w = this.paddle.baseW;
    this.paddle.x = FIELD.W / 2;
    this.bricks = this._buildBricks(LEVELS[i]);
    this._resetBallOnPaddle();
    this.state = 'ready';
  }

  _buildBricks(level) {
    const bricks = [];
    level.rows.forEach((row, r) => {
      for (let c = 0; c < GRID.cols; c++) {
        const ch = row[c];
        if (!ch || ch === '.') continue;
        const x = GRID.marginX + c * (BRICK_W + GRID.gap);
        const y = GRID.top + r * GRID.rowH;
        if (ch === HARD_CANDY.char) {
          bricks.push({
            x, y, w: BRICK_W, h: BRICK_H, alive: true,
            type: 'hard', hits: HARD_CANDY.hits, maxHits: HARD_CANDY.hits,
            color: HARD_CANDY.base,
          });
        } else {
          const color = CANDY[ch];
          if (!color) continue;
          bricks.push({
            x, y, w: BRICK_W, h: BRICK_H, alive: true,
            type: 'normal', hits: 1, maxHits: 1, color,
          });
        }
      }
    });
    return bricks;
  }

  _resetBallOnPaddle() {
    this.balls = [
      {
        x: this.paddle.x,
        y: PADDLE.y - this.mode.ballRadius - 1,
        vx: 0,
        vy: 0,
        r: this.mode.ballRadius,
        stuck: true,
      },
    ];
  }

  // ---- input-driven actions ----
  launch() {
    if (this.state !== 'ready') return;
    const angle = Math.random() * 0.4 - 0.2; // small random tilt
    const eff = this._effectiveSpeed();
    this.balls.forEach((b) => {
      b.stuck = false;
      b.vx = Math.sin(angle) * eff;
      b.vy = -Math.cos(angle) * eff;
    });
    this.state = 'playing';
    Sound.launch();
  }

  togglePause() {
    if (this.state === 'paused') {
      this.state = this.prevState;
    } else if (this.state === 'playing' || this.state === 'ready') {
      this.prevState = this.state;
      this.state = 'paused';
    }
    Sound.ui();
  }

  confirm() {
    // Context-sensitive "OK" used by Enter / gamepad A / click on overlays.
    switch (this.state) {
      case 'levelclear':
        this.nextLevel();
        break;
      case 'gameover':
      case 'win':
        this.state = 'menu';
        break;
      case 'ready':
        this.launch();
        break;
    }
  }

  nextLevel() {
    const next = this.levelIndex + 1;
    if (next >= LEVELS.length) {
      this.state = 'win';
      this._saveBest();
      Sound.win();
      return;
    }
    this.loadLevel(next);
  }

  restart() {
    this.startGame(this.mode.id);
  }

  // ---- simulation ----
  _effectiveSpeed() {
    const capped = Math.min(this.speed, this.mode.ballSpeedMax);
    return this.clock < this.slowUntil ? capped * 0.6 : capped;
  }

  update(dt) {
    this.clock += dt * 1000;
    this._updateParticles(dt);
    this._updateFloatTexts(dt);
    if (this.state !== 'playing' && this.state !== 'ready') return;

    this._expireEffects();
    this._movePaddle(dt);

    if (this.state === 'ready') {
      // Ball rides on the paddle until launch.
      const b = this.balls[0];
      if (b) {
        b.x = this.paddle.x;
        b.y = PADDLE.y - b.r - 1;
      }
      this._updatePowerups(dt);
      return;
    }

    this._updateBalls(dt);
    this._updatePowerups(dt);
    this._checkLevelClear();
  }

  _expireEffects() {
    if (this.wideUntil && this.clock >= this.wideUntil) {
      this.paddle.w = this.paddle.baseW;
      this.wideUntil = 0;
      // keep paddle inside the field after shrinking
      this.paddle.x = clamp(this.paddle.x, this.paddle.w / 2, FIELD.W - this.paddle.w / 2);
    }
  }

  _movePaddle(dt) {
    const half = this.paddle.w / 2;
    if (Input.usingPointer && Input.pointerX != null) {
      this.paddle.x = clamp(Input.pointerX, half, FIELD.W - half);
    } else if (Input.dir !== 0) {
      this.paddle.x = clamp(
        this.paddle.x + Input.dir * PADDLE.keySpeed * dt,
        half,
        FIELD.W - half,
      );
    }
  }

  _updateBalls(dt) {
    const eff = this._effectiveSpeed();
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];

      // Renormalize to the current effective speed (applies speed-ups / slow instantly).
      const mag = Math.hypot(b.vx, b.vy) || 1;
      b.vx = (b.vx / mag) * eff;
      b.vy = (b.vy / mag) * eff;

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Walls.
      if (b.x - b.r < 0) {
        b.x = b.r;
        b.vx = Math.abs(b.vx);
        Sound.wall();
      } else if (b.x + b.r > FIELD.W) {
        b.x = FIELD.W - b.r;
        b.vx = -Math.abs(b.vx);
        Sound.wall();
      }
      if (b.y - b.r < TOP_WALL) {
        b.y = TOP_WALL + b.r;
        b.vy = Math.abs(b.vy);
        Sound.wall();
      }

      this._paddleBounce(b);
      this._brickCollision(b, eff);

      // Fell off the bottom.
      if (b.y - b.r > FIELD.H) {
        this.balls.splice(i, 1);
      }
    }

    if (this.balls.length === 0) this._loseLife();
  }

  _paddleBounce(b) {
    const p = this.paddle;
    const half = p.w / 2;
    const top = PADDLE.y;
    if (
      b.vy > 0 &&
      b.y + b.r >= top &&
      b.y - b.r <= top + PADDLE.h &&
      b.x >= p.x - half - b.r &&
      b.x <= p.x + half + b.r
    ) {
      const offset = clamp((b.x - p.x) / half, -1, 1);
      const angle = offset * MAX_BOUNCE;
      const eff = this._effectiveSpeed();
      b.vx = Math.sin(angle) * eff;
      b.vy = -Math.cos(angle) * eff;
      b.y = top - b.r - 0.5;
      Sound.paddle();
    }
  }

  _brickCollision(b, eff) {
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      const cx = clamp(b.x, brick.x, brick.x + brick.w);
      const cy = clamp(b.y, brick.y, brick.y + brick.h);
      const dx = b.x - cx;
      const dy = b.y - cy;
      if (dx * dx + dy * dy > b.r * b.r) continue;

      // Resolve along the axis of least penetration.
      const overlapX = Math.min(b.x + b.r - brick.x, brick.x + brick.w - (b.x - b.r));
      const overlapY = Math.min(b.y + b.r - brick.y, brick.y + brick.h - (b.y - b.r));
      if (overlapX < overlapY) {
        b.vx = b.x < brick.x + brick.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
        b.x += b.vx > 0 ? overlapX : -overlapX;
      } else {
        b.vy = b.y < brick.y + brick.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
        b.y += b.vy > 0 ? overlapY : -overlapY;
      }
      // keep a minimum vertical component so the ball never gets stuck horizontal
      if (Math.abs(b.vy) < 0.2 * eff) {
        b.vy = (b.vy < 0 ? -1 : 1) * 0.2 * eff;
      }

      this._damageBrick(brick);
      this.speed += this.mode.speedup;
      return; // one brick per ball per frame
    }
  }

  _damageBrick(brick) {
    brick.hits -= 1;
    if (brick.hits > 0) {
      brick.color = HARD_CANDY.cracked;
      Sound.hard();
      this._spawnParticles(brick, 3);
      return;
    }
    brick.alive = false;
    this.score += brick.type === 'hard' ? SCORE.hardCandy : SCORE.brick;
    Sound.brick();
    this._spawnParticles(brick, 7);
    this._maybeDropPowerup(brick);
  }

  // ---- power-ups ----
  _maybeDropPowerup(brick) {
    if (Math.random() > this.mode.powerupChance) return;
    const type = this._weightedPowerup();
    this.powerups.push({
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      type,
    });
  }

  _weightedPowerup() {
    const w = POWERUPS.weights;
    const entries = Object.entries(w);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    let roll = Math.random() * total;
    for (const [k, v] of entries) {
      if ((roll -= v) <= 0) return k;
    }
    return entries[0][0];
  }

  _updatePowerups(dt) {
    const p = this.paddle;
    const half = p.w / 2;
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.y += POWERUPS.fallSpeed * dt;

      // Caught by the paddle?
      if (
        pu.y + POWERUPS.h / 2 >= PADDLE.y &&
        pu.y - POWERUPS.h / 2 <= PADDLE.y + PADDLE.h &&
        pu.x >= p.x - half - POWERUPS.w / 2 &&
        pu.x <= p.x + half + POWERUPS.w / 2
      ) {
        this._applyPowerup(pu.type);
        this.powerups.splice(i, 1);
        continue;
      }
      if (pu.y - POWERUPS.h / 2 > FIELD.H) this.powerups.splice(i, 1);
    }
  }

  _applyPowerup(type) {
    const def = POWERUPS.types[type];
    Sound.powerup();
    this.floatTexts.push({
      x: this.paddle.x,
      y: PADDLE.y - 14,
      text: def.label,
      color: def.color,
      life: 1,
    });
    switch (type) {
      case 'wide':
        this.paddle.w = Math.min(this.paddle.baseW * 1.6, FIELD.W * 0.5);
        this.wideUntil = this.clock + def.duration;
        break;
      case 'slow':
        this.slowUntil = this.clock + def.duration;
        break;
      case 'life':
        this.lives = Math.min(this.lives + 1, 9);
        break;
      case 'multi':
        this._splitBalls();
        break;
    }
  }

  _splitBalls() {
    const eff = this._effectiveSpeed();
    const extra = [];
    for (const b of this.balls) {
      if (b.stuck) continue;
      for (const da of [-0.35, 0.35]) {
        if (this.balls.length + extra.length >= MAX_BALLS) break;
        const ang = Math.atan2(b.vy, b.vx) + da;
        extra.push({
          x: b.x,
          y: b.y,
          vx: Math.cos(ang) * eff,
          vy: Math.sin(ang) * eff,
          r: b.r,
          stuck: false,
        });
      }
    }
    this.balls.push(...extra);
  }

  // ---- lives / level ----
  _loseLife() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.state = 'gameover';
      this._saveBest();
      Sound.gameOver();
      return;
    }
    Sound.loseLife();
    this.paddle.w = this.paddle.baseW;
    this.wideUntil = 0;
    this.slowUntil = 0;
    this._resetBallOnPaddle();
    this.state = 'ready';
  }

  _checkLevelClear() {
    if (this.bricks.some((b) => b.alive)) return;
    this.score += SCORE.levelClear;
    this._saveBest();
    this.state = 'levelclear';
    Sound.levelClear();
  }

  // ---- cosmetic particles ----
  _spawnParticles(brick, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 120;
      this.particles.push({
        x: brick.x + brick.w / 2,
        y: brick.y + brick.h / 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        color: brick.color,
        size: 3 + Math.random() * 3,
      });
    }
  }
  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += 320 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 1.6;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }
  _updateFloatTexts(dt) {
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const t = this.floatTexts[i];
      t.y -= 30 * dt;
      t.life -= dt * 1.2;
      if (t.life <= 0) this.floatTexts.splice(i, 1);
    }
  }

  // ---- helpers for HUD ----
  effectsActive() {
    return {
      wide: this.wideUntil > this.clock,
      slow: this.slowUntil > this.clock,
    };
  }
  currentLevelName() {
    return LEVELS[this.levelIndex] ? LEVELS[this.levelIndex].name : '';
  }
  totalLevels() {
    return LEVELS.length;
  }
}
