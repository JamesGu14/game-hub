// Game state machine for 炮炮虫 BOOM WORMS.
// Holds all live state: teams, terrain, projectiles, effects, crates, turn flow.
// No canvas/DOM here — pure logic driven by main.js.

import { PHYSICS, WEAPONS, STARTING_WEAPONS, CRATE, STORAGE_KEY, FIELD, WATER } from './config.js';
import { buildLevel } from './levels.js';
import { Terrain } from './terrain.js';
import { makeWorm, makeTeam } from './worm.js';
import { stepWorm } from './physics.js';
import { nextActive, checkOutcome } from './turns.js';
import { applyExplosion } from './combat.js';
import { updateProjectile } from './projectile.js';
import { fire } from './weapons.js';
import { Aim } from './aim.js';
import { AIController } from './ai.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _loadBest() {
  if (typeof localStorage === 'undefined') return { level: 0 };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { level: 0 };
  } catch {
    return { level: 0 };
  }
}

function _saveBest(best) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(best)); } catch { /* noop */ }
}

function _buildAmmo(extraAmmo = {}) {
  const ammo = {};
  for (const [key, def] of Object.entries(WEAPONS)) {
    ammo[key] = def.ammo === Infinity ? Infinity : (def.ammo ?? 0);
  }
  return Object.assign(ammo, extraAmmo);
}

function _spawnWorms(level, teamId, terrain) {
  const xs = level.spawns[teamId];
  return xs.map((sx, i) => {
    const gy = terrain.ground(sx, 0) ?? Math.round(FIELD.H * 0.55);
    const x = sx;
    const y = gy - 15; // place above ground
    return makeWorm(teamId * 10 + i, teamId, x, y);
  });
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export class Game {
  constructor() {
    // State: menu | intro | aim | firing | projectile | resolve | levelclear | gameover | win
    this.state = 'menu';
    this.mode = 'solo';           // 'solo' | 'duo'
    this.windEnabled = false;

    this.levelIndex = 0;
    this.level = null;
    this.terrain = null;
    this.teams = [];
    this.active = null;           // { team, wormIdx }
    this.weaponKey = 'bazooka';
    this.aim = Aim;               // expose Aim singleton so the renderer can draw the guide

    this.projectiles = [];
    this.crates = [];
    this.effects = [];

    this.wind = 0;
    this.camX = 0;

    this.bannerMs = 0;
    this.bannerText = '';

    this._resolveTimer = 0;       // seconds before switching turns after projectiles settle
    this._introTimer = 0;
    this._aiPending = false;      // guard against double AI fire
    this._aiTimer = 0;

    this.best = _loadBest();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Start (or restart) the game at the given level. */
  startGame(levelIndex = 0, mode = 'solo') {
    this.mode = mode;
    this.levelIndex = levelIndex;
    this.projectiles = [];
    this.crates = [];
    this.effects = [];
    this._aiPending = false;
    this._aiTimer = 0;

    this.level = buildLevel(levelIndex);
    this.wind = this.windEnabled ? (Math.random() * 80 - 40) : 0;
    this.level.wind = this.wind;

    // Build terrain (DOM-dependent; Terrain class uses document.createElement)
    this.terrain = new Terrain();
    this.terrain.generate(this.level);

    // Build teams
    const w0 = _spawnWorms(this.level, 0, this.terrain);
    const w1 = _spawnWorms(this.level, 1, this.terrain);
    const ammo0 = _buildAmmo();
    const ammo1 = _buildAmmo();
    const team1IsAI = (mode === 'solo');

    this.teams = [
      makeTeam(0, '你的队', '#ff7043', false, w0, ammo0),
      makeTeam(1, team1IsAI ? 'AI 队' : '对手队', '#42a5f5', team1IsAI, w1, ammo1),
    ];

    // First active worm: team 0, worm 0
    this.active = { team: 0, wormIdx: 0 };
    this.teams[0]._idx = 0;
    this.teams[1]._idx = -1;

    this.weaponKey = 'bazooka';
    Aim.reset(this.teams[0].worms[0].facing);

    this.camX = 0;
    this.bannerMs = 0;

    this._showBanner('第 ' + (levelIndex + 1) + ' 关 · ' + this.level.name, 2000);
    this.state = 'aim';
  }

  /** Restart current level. */
  restartLevel() {
    this.startGame(this.levelIndex, this.mode);
  }

  /** Advance to the next level (from levelclear). */
  nextLevel() {
    const next = this.levelIndex + 1;
    if (next >= 6) {
      this.state = 'win';
    } else {
      this.startGame(next, this.mode);
    }
  }

  /** Return to the menu. */
  toMenu() {
    this.state = 'menu';
    this.terrain = null;
    this.teams = [];
    this.projectiles = [];
    this.crates = [];
    this.effects = [];
  }

  /** Toggle pause (only when in aim or paused). */
  togglePause() {
    if (this.state === 'aim') {
      this.state = 'paused';
    } else if (this.state === 'paused') {
      this.state = 'aim';
    }
  }

  // -------------------------------------------------------------------------
  // Input handler
  // -------------------------------------------------------------------------

  handleAction(action) {
    if (!action) return;

    // Global
    if (action.type === 'pause') {
      if (this.state === 'aim' || this.state === 'firing') this.state = 'paused';
      else if (this.state === 'paused') this.state = 'aim';
      return;
    }

    // Only process gameplay actions when it's a human turn in aim/firing state
    if (this.state !== 'aim' && this.state !== 'firing') return;
    if (!this.active || !this.teams.length) return;

    const activeTeam = this.teams[this.active.team];
    // Ignore input if it's the AI's turn
    if (activeTeam && activeTeam.isAI) return;

    const worm = activeTeam ? activeTeam.worms[this.active.wormIdx] : null;
    if (!worm || !worm.alive) return;

    switch (action.type) {
      case 'jump':
        // Handled continuously in update() via Input.poll — but also on keydown
        worm.vy = -360;
        worm.onGround = false;
        break;

      case 'mouseAim':
        Aim.setFromMouse(worm, action.x, action.y);
        this._lastAimPoint = { x: action.x, y: action.y };
        break;

      case 'chargeStart':
        if (this.state === 'aim') {
          this.state = 'firing';
          Aim.startCharge();
        }
        break;

      case 'chargeRelease':
        if (this.state === 'firing') {
          const launchParams = Aim.release();
          this._fireActiveWorm(launchParams);
        }
        break;

      case 'weaponNext': {
        const available = this._availableWeapons();
        const idx = available.indexOf(this.weaponKey);
        this.weaponKey = available[(idx + 1) % available.length] || this.weaponKey;
        break;
      }
      case 'weaponPrev': {
        const available = this._availableWeapons();
        const idx = available.indexOf(this.weaponKey);
        this.weaponKey = available[(idx - 1 + available.length) % available.length] || this.weaponKey;
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Per-frame update
  // -------------------------------------------------------------------------

  update(dt) {
    // Countdown banner
    if (this.bannerMs > 0) this.bannerMs -= dt * 1000;

    // Decay effects
    for (const e of this.effects) {
      if (e.dead) continue;
      e.t = (e.t || 0) + dt / (e.dur || 0.5);
      if (e.t >= 1) e.dead = true;
      // Move debris / splash particles
      if (e.vx !== undefined) { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 200 * dt; }
    }

    switch (this.state) {
      case 'aim':    this._updateAim(dt); break;
      case 'firing': this._updateFiring(dt); break;
      case 'projectile': this._updateProjectile(dt); break;
      case 'resolve': this._updateResolve(dt); break;
      default: break;
    }
  }

  // -------------------------------------------------------------------------
  // State handlers
  // -------------------------------------------------------------------------

  _updateAim(dt) {
    if (!this.active || !this.teams.length) return;

    const { Input } = this._getInput();
    const worm = this._activeWorm();
    if (!worm || !worm.alive) return;

    const activeTeam = this.teams[this.active.team];

    // AI: schedule turn
    if (activeTeam.isAI && !this._aiPending) {
      this._aiPending = true;
      this._aiTimer = 0.8; // brief pause before AI fires
    }

    if (activeTeam.isAI) {
      this._aiTimer -= dt;
      if (this._aiTimer <= 0) {
        this._runAITurn();
      }
      return;
    }

    // Worm movement (human turn)
    const moveX = Input ? Input.moveX : 0;
    const aimDir = Input ? Input.aimDir : 0;
    const chargeHeld = Input ? Input.chargeHeld : false;

    stepWorm(worm, dt, this.terrain.mask, {
      waterY: this.level.waterY,
      moveX,
      wantJump: false, // jump via handleAction
    });

    // Nudge aim by key/pad
    if (aimDir !== 0) {
      Aim.nudgeAngle(aimDir, dt);
    }

    // Auto-start charge if held but not yet in firing state
    if (chargeHeld && this.state === 'aim') {
      this.state = 'firing';
      Aim.startCharge();
    }

    // Camera follows active worm
    this._trackCamera(worm);
  }

  _updateFiring(dt) {
    if (!this.active) return;
    const { Input } = this._getInput();
    const worm = this._activeWorm();
    if (!worm) return;

    const activeTeam = this.teams[this.active.team];
    if (activeTeam && activeTeam.isAI) return; // AI handled elsewhere

    // Step worm (can still fall while charging)
    stepWorm(worm, dt, this.terrain.mask, {
      waterY: this.level.waterY,
      moveX: 0,
      wantJump: false,
    });

    // Advance aim indicator
    const aimDir = Input ? Input.aimDir : 0;
    if (aimDir !== 0) Aim.nudgeAngle(aimDir, dt);

    Aim.stepCharge(dt);

    // If charge was released (chargeHeld just went false), release
    // — main path is via handleAction(chargeRelease); also handle key held release
    const chargeHeld = Input ? Input.chargeHeld : false;
    if (!chargeHeld && Aim.charging) {
      const launchParams = Aim.release();
      this._fireActiveWorm(launchParams);
    }

    this._trackCamera(worm);
  }

  _updateProjectile(dt) {
    // Step all worms (for knockback/falls to settle)
    const allWorms = this._allWorms();
    for (const w of allWorms) {
      if (!w.alive) continue;
      stepWorm(w, dt, this.terrain.mask, {
        waterY: this.level.waterY,
        moveX: 0,
        wantJump: false,
      });
    }

    // Update projectiles
    const explodeCb = (x, y, radius, dmg, weaponKey) => {
      this._onExplode(x, y, radius, dmg, weaponKey);
    };
    const terrainRef = this.terrain;
    for (const p of this.projectiles) {
      updateProjectile(p, dt, {
        terrain: terrainRef,
        allWorms,
        wind: this.wind,
        gravity: PHYSICS.projGravity,
        onExplode: explodeCb,
      });
    }

    // Cull dead projectiles
    this.projectiles = this.projectiles.filter(p => !p.dead);

    // Check crate pickups
    this._checkCratePickups(allWorms);

    // Camera: follow last live projectile if any
    const liveProj = this.projectiles.find(p => !p.dead);
    if (liveProj) {
      this.camX = liveProj.x - FIELD.W / 2;
    } else {
      // All projectiles gone — wait for worms to settle then resolve
      const allResting = allWorms.every(
        w => !w.alive || (Math.abs(w.vx) < 5 && Math.abs(w.vy) < 5 && w.onGround)
      );
      if (allResting) {
        this._beginResolve();
      }
    }
  }

  _updateResolve(dt) {
    // Still step worms so they fall to ground
    const allWorms = this._allWorms();
    for (const w of allWorms) {
      if (!w.alive) continue;
      stepWorm(w, dt, this.terrain.mask, {
        waterY: this.level.waterY,
        moveX: 0,
        wantJump: false,
      });
    }

    this._resolveTimer -= dt;
    if (this._resolveTimer > 0) return;

    // Kill worms with hp <= 0 or drowned
    for (const w of allWorms) {
      if (w.hp <= 0 || w.y >= this.level.waterY) {
        if (w.alive) {
          w.alive = false;
          // Splash effect if drowned
          if (w.y >= this.level.waterY) {
            this._spawnEffect('splash', w.x, this.level.waterY, 30);
          }
        }
      }
    }

    // checkOutcome returns the winning team's id (or -1 draw, null continue).
    // Invariant (set in startGame): teams[0].id === 0 is ALWAYS the human player,
    // teams[1].id === 1 is the opponent (AI in solo). Ids match array indices.
    const outcome = checkOutcome(this.teams);

    if (outcome === 0) {
      // Team 0 (player) wins
      if (this.mode === 'duo') {
        this._showBanner('玩家1 获胜！', 9999);
        this.state = 'levelclear';
      } else {
        // Solo: level clear
        const bestLevel = Math.max(this.best.level, this.levelIndex + 1);
        this.best = { level: bestLevel };
        _saveBest(this.best);
        this.state = 'levelclear';
      }
    } else if (outcome === 1) {
      // Team 1 wins
      if (this.mode === 'duo') {
        this._showBanner('玩家2 获胜！', 9999);
        this.state = 'levelclear';
      } else {
        this.state = 'gameover';
      }
    } else if (outcome === -1) {
      // Draw
      if (this.mode === 'duo') {
        this._showBanner('平局！', 9999);
      }
      this.state = 'gameover';
    } else {
      // null: game continues — advance to next turn
      this._advanceTurn();
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  _advanceTurn() {
    // Maybe drop a crate
    if (Math.random() < CRATE.dropChance) {
      this._dropCrate();
    }

    const next = nextActive(this.teams, this.active);
    if (!next) {
      this.state = 'gameover';
      return;
    }

    this.active = next;
    const worm = this.teams[next.team].worms[next.wormIdx];
    this.weaponKey = 'bazooka';
    Aim.reset(worm ? worm.facing : 1);

    // Reset AI flag for next turn
    this._aiPending = false;
    this._aiTimer = 0;

    if (worm) this._trackCamera(worm);
    const teamName = this.teams[next.team].name;
    this._showBanner(teamName + ' 的回合', 1500);
    this.state = 'aim';
  }

  _beginResolve() {
    this._resolveTimer = 0.8; // brief settle pause
    this.state = 'resolve';
  }

  _fireActiveWorm(launchParams) {
    const worm = this._activeWorm();
    const activeTeam = this.teams[this.active.team];
    if (!worm || !activeTeam) return;

    // Airstrike needs a target column. Mouse users: where they pointed last.
    // Key/pad users: project along the aim direction scaled by charge power.
    if (WEAPONS[this.weaponKey] && WEAPONS[this.weaponKey].kind === 'airstrike') {
      let targetX = (Aim.mode === 'mouse' && this._lastAimPoint)
        ? this._lastAimPoint.x
        : worm.x + Math.cos(launchParams.angle) * (launchParams.speed * 0.9);
      targetX = Math.max(20, Math.min(FIELD.W - 20, targetX));
      launchParams = { ...launchParams, x: targetX };
    }

    const allWorms = this._allWorms();
    const newProjectiles = fire(this.weaponKey, worm, launchParams, {
      team: activeTeam,
      allWorms,
      terrain: this.terrain,
      gravity: PHYSICS.projGravity,
      wind: this.wind,
      onExplode: (x, y, r, dmg, wk) => this._onExplode(x, y, r, dmg, wk),
    });

    for (const p of newProjectiles) {
      this.projectiles.push(p);
    }

    this.state = 'projectile';
  }

  _onExplode(x, y, radius, dmg, weaponKey) {
    if (radius > 0 && dmg > 0) {
      const allWorms = this._allWorms();
      const hits = applyExplosion(allWorms, x, y, radius, dmg, 1);

      // Carve terrain
      this.terrain.carveAt(x | 0, y | 0, radius);

      // Explosion effect
      const big = radius > 55;
      this._spawnEffect('explosion', x, y, radius * 1.2);

      // Debris particles
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this._spawnEffect('debris', x + Math.cos(a) * 10, y + Math.sin(a) * 10, 4, {
          vx: Math.cos(a) * 80,
          vy: Math.sin(a) * 80 - 40,
          dur: 0.7,
        });
      }

      // Mark worms that just died
      for (const w of this._allWorms()) {
        if (!w.alive) continue;
        if (w.hp <= 0) {
          w.hitFlashMs = 300;
        }
      }
    }
  }

  _availableWeapons() {
    if (!this.active || !this.teams.length) return ['bazooka'];
    const activeTeam = this.teams[this.active.team];
    if (!activeTeam) return ['bazooka'];
    return Object.keys(WEAPONS).filter(k => {
      const a = activeTeam.ammo[k];
      return a === Infinity || a > 0;
    });
  }

  _allWorms() {
    const ws = [];
    for (const t of this.teams) for (const w of t.worms) ws.push(w);
    return ws;
  }

  _activeWorm() {
    if (!this.active || !this.teams.length) return null;
    const t = this.teams[this.active.team];
    return t ? t.worms[this.active.wormIdx] : null;
  }

  _trackCamera(worm) {
    const targetX = worm.x - FIELD.W / 2;
    const maxCamX = FIELD.W - FIELD.W; // world is same width as field (no scroll needed for 960px)
    this.camX = Math.max(0, Math.min(0, targetX)); // Keep camX=0 for single-screen field
  }

  _showBanner(text, ms) {
    this.bannerText = text;
    this.bannerMs = ms;
  }

  _spawnEffect(type, x, y, r, extra = {}) {
    this.effects.push({
      type, x, y, r,
      t: 0,
      dead: false,
      dur: extra.dur || 0.5,
      vx: extra.vx || 0,
      vy: extra.vy || 0,
      color: extra.color || null,
    });
  }

  _dropCrate() {
    // Find a random X in the field, then let it fall to terrain
    const x = 80 + Math.random() * (FIELD.W - 160);
    const kind = Math.random() < 0.4 ? 'heal' : 'weapon';
    let weaponReward = null;
    if (kind === 'weapon') {
      const crateWeapons = ['airstrike', 'holy', 'dynamite', 'shotgun'];
      weaponReward = crateWeapons[Math.floor(Math.random() * crateWeapons.length)];
    }
    this.crates.push({
      x,
      y: -20,         // starts above screen; falls in _updateProjectile
      vy: 60,         // fall speed
      landed: false,
      dead: false,
      kind,
      weaponReward,
    });
  }

  _checkCratePickups(allWorms) {
    for (const c of this.crates) {
      if (c.dead) continue;
      // Animate crate fall
      if (!c.landed) {
        c.y += c.vy * (1 / 60); // approximate step
        const gy = this.terrain.ground(c.x | 0, c.y | 0);
        if (gy !== null && c.y >= gy) { c.y = gy; c.landed = true; }
        if (c.y >= this.level.waterY) { c.dead = true; continue; }
      }
      // Check if any worm touches it
      for (const w of allWorms) {
        if (!w.alive) continue;
        const dx = w.x - c.x;
        const dy = w.y - c.y;
        if (Math.hypot(dx, dy) < 24) {
          c.dead = true;
          if (c.kind === 'heal') {
            const team = this.teams[w.team];
            if (team) {
              // Heal all worms in the team (just the one worm for simplicity)
              w.hp = Math.min(100, w.hp + 30);
            }
          } else if (c.weaponReward) {
            const team = this.teams[w.team];
            if (team) {
              const cur = team.ammo[c.weaponReward] || 0;
              if (cur !== Infinity) team.ammo[c.weaponReward] = (cur) + 2;
            }
          }
          break;
        }
      }
    }
    // Cull fallen-off crates
    this.crates = this.crates.filter(c => !c.dead);
  }

  // -------------------------------------------------------------------------
  // AI turn — delegated to AIController in ai.js
  // -------------------------------------------------------------------------
  _runAITurn() {
    AIController.takeTurn(this);
  }

  /** Returns the Aim singleton so AIController can sync the render state. */
  _getAim() {
    return { Aim };
  }

  /** Returns the Input singleton (wired by main.js). */
  _getInput() {
    return { Input: this._input || null };
  }

  /** main.js calls this to wire up the Input singleton. */
  setInput(inputRef) {
    this._input = inputRef;
  }
}

