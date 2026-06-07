// Game state machine for 炮炮虫 BOOM WORMS.
// Holds all live state: teams, terrain, projectiles, effects, crates, turn flow.
// No canvas/DOM here — pure logic driven by main.js.

import { PHYSICS, WEAPONS, STARTING_WEAPONS, CRATE, STORAGE_KEY, FIELD, WATER, AIM } from './config.js';
import { Sound } from './audio.js';
import { buildLevel, LEVELS } from './levels.js';
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
    this._aiState = null;         // AI aiming state machine (null = not mid-aim)
    this._aiAiming = false;       // true while AI is visibly aiming (renderer shows the guide)

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
    this._aiState = null;
    this._aiAiming = false;

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
    if (next >= LEVELS.length) {
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

  /** Show the pre-game level-select route map (its own state → overlay-levelselect). */
  showLevelSelect() {
    this.state = 'levelselect';
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
        Sound.jump();
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
      case 'weaponSlot': {
        // Fixed 1-5 mapping to the starting weapons; ignore if depleted/unavailable.
        const key = STARTING_WEAPONS[action.slot];
        if (key && this._availableWeapons().includes(key)) this.weaponKey = key;
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

    // Crates fall under gravity during live play (and slide into freshly-blown
    // pits) — but stay frozen while paused / on menu / after the round ends.
    if (this.terrain &&
        (this.state === 'aim' || this.state === 'firing' ||
         this.state === 'projectile' || this.state === 'resolve')) {
      this._updateCrates(dt);
      this._checkCratePickups(this._allWorms());
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

    // AI: drive the aiming state machine frame-by-frame (rotate + charge + fire).
    if (activeTeam.isAI) {
      AIController.step(this, dt);
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

    // Rising-pitch charge tick (throttled to a chip-chip, not a buzz).
    if (Aim.charging) {
      this._chargeSndT = (this._chargeSndT || 0) + dt;
      if (this._chargeSndT >= 0.07) {
        this._chargeSndT = 0;
        const lvl = (Aim.power - AIM.minSpeed) / (AIM.maxSpeed - AIM.minSpeed);
        Sound.charge(Math.max(0, Math.min(1, lvl)));
      }
    }

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

    // (Crate gravity + pickups are handled centrally in update().)

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

    // Reset AI flags for next turn
    this._aiPending = false;
    this._aiTimer = 0;
    this._aiState = null;
    this._aiAiming = false;

    if (worm) this._trackCamera(worm);
    const teamName = this.teams[next.team].name;
    this._showBanner(teamName + ' 的回合', 1500);
    Sound.turn();
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

    Sound.fire(this.weaponKey);

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
    Sound.explode(radius >= 55);
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

  /**
   * Walk a worm one frame for the AI — same physics path the human uses, just
   * driven by `moveX` ∈ [-1,1] instead of input. Kept here (not in ai.js) so
   * `stepWorm` stays a game.js concern. AIController.step calls this.
   */
  _aiWalk(worm, moveX, dt) {
    if (!worm || !worm.alive || !this.terrain) return;
    stepWorm(worm, dt, this.terrain.mask, {
      waterY: this.level.waterY,
      moveX,
      wantJump: false,
    });
  }

  /**
   * Footing check the AI uses before stepping toward `x`: is there solid ground
   * there whose top stays safely above the water line? Returns false over a
   * gap / water / out-of-bounds so the AI never walks itself into a drowning
   * fall. `margin` keeps it off the very lip of the water.
   */
  _aiFootingSafe(x, margin = 8) {
    if (!this.terrain) return false;
    if (x < 4 || x > FIELD.W - 4) return false;
    const waterY = this.level.waterY;
    const gy = this.terrain.ground(x | 0, 0);
    return gy != null && gy < waterY - margin;
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
    if (type === 'splash') Sound.splash();  // covers worm + crate drowning (single choke point)
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
      y: -20,         // starts above screen; falls via _updateCrates gravity
      vy: 60,         // initial fall speed (gravity takes over)
      landed: false,
      dead: false,
      kind,
      weaponReward,
    });
  }

  /**
   * Crates fall under gravity each frame. They settle on solid terrain, keep
   * falling when the ground beneath them is blown away (sliding into pits), and
   * vanish with a splash if they reach the water.
   */
  _updateCrates(dt) {
    if (!this.crates.length || !this.terrain) return;
    const halfH = CRATE.h / 2;
    for (const c of this.crates) {
      if (c.dead) continue;
      c.vy = Math.min((c.vy || 0) + 900 * dt, 800);          // gravity
      const ny = c.y + c.vy * dt;
      if (this.terrain.solid(c.x | 0, (ny + halfH) | 0)) {   // solid underfoot → settle on the surface
        let gy = (ny + halfH) | 0;
        while (gy > 0 && this.terrain.solid(c.x | 0, gy - 1)) gy--;
        c.y = gy - halfH; c.vy = 0; c.landed = true;
      } else { c.y = ny; c.landed = false; }                 // nothing underfoot → keep falling (pits included)
      if (c.y >= this.level.waterY) { c.dead = true; this._spawnEffect('splash', c.x, this.level.waterY, 24); }
    }
    this.crates = this.crates.filter(c => !c.dead);
  }

  _checkCratePickups(allWorms) {
    for (const c of this.crates) {
      if (c.dead) continue;
      for (const w of allWorms) {
        if (!w.alive) continue;
        if (Math.hypot(w.x - c.x, w.y - c.y) < 24) {
          c.dead = true;
          if (c.kind === 'heal') {
            w.hp = Math.min(100, w.hp + (CRATE.healAmount || 30));
          } else if (c.weaponReward) {
            const team = this.teams[w.team];
            if (team) {
              const cur = team.ammo[c.weaponReward] || 0;
              if (cur !== Infinity) team.ammo[c.weaponReward] = cur + 2;
            }
          }
          this._spawnEffect('explosion', c.x, c.y, 16);
          Sound.pickup();
          break;
        }
      }
    }
    this.crates = this.crates.filter(c => !c.dead);
  }

  /** Returns the Aim singleton (used by main.js / debugging). */
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

