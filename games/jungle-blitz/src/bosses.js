// Boss definitions for 丛林尖兵 JUNGLE BLITZ. Logic-only — no canvas drawing.
import { BOSSES, ENEMY_BULLET, FIELD, PHYSICS } from './config.js';
import { spawnAimedBullet } from './util/combat.js';

// Factory: returns a boss object by type. roomLeftX is the world-x of the left edge
// of the locked camera room. world is the World instance (for floorTopAt).
export function createBoss(type, roomLeftX, world) {
  switch (type) {
    case 'gate':        return _createGate(roomLeftX, world);
    case 'gunship':     return _createGunship(roomLeftX, world);
    case 'mech':        return _createMech(roomLeftX, world);
    case 'twinCannon':  return _createTwinCannon(roomLeftX, world);
    case 'core':        return _createCore(roomLeftX, world);
    default: throw new Error('Unknown boss type: ' + type);
  }
}

function _createGate(roomLeftX, world) {
  const cfg = BOSSES.gate;

  // Gate body: tall pillar anchored to the right wall of the boss room.
  const gateX = roomLeftX + FIELD.W - 120;
  const gateW = 120;
  const gateTopY = 80;
  const gateBottomY = world.floorTopAt(gateX + gateW / 2);
  const gateH = gateBottomY - gateTopY;

  // Two cannon ports on the left face.
  const portX = gateX;           // left face of gate
  const portUpperY = gateTopY + gateH * 0.28;
  const portLowerY = gateTopY + gateH * 0.68;

  // Central glowing core — the only weak point. Sits LOW on the gate, at roughly
  // the player's standing gun height, so a 7-year-old can hit it with plain
  // horizontal fire (aiming up still works too).
  const coreW = 46;
  const coreH = 46;
  const coreX = gateX + (gateW - coreW) / 2;
  const coreY = gateBottomY - coreH - 24;

  let fireTimer = 0.6;   // first shot after half a second
  let portToggle = 0;    // alternates 0/1 between upper/lower port

  return {
    type: 'gate',
    name: '装甲炮门',

    // Overall bounds (for renderer).
    x: gateX,
    y: gateTopY,
    w: gateW,
    h: gateH,

    // Cached port positions (renderer may read these).
    portUpperY,
    portLowerY,
    portX,

    // Core rect (renderer may read this).
    coreX,
    coreY,
    coreW,
    coreH,

    hp: cfg.hp,
    hpMax: cfg.hp,
    phase: 1,
    dead: false,
    hitFlashMs: 0,

    update(dt, player, bullets /*, ctx */) {
      if (this.hitFlashMs > 0) this.hitFlashMs -= dt * 1000;

      fireTimer -= dt;
      if (fireTimer <= 0) {
        fireTimer = 1.1;

        // Compute aiming direction from the firing port to the player centre.
        const px = player.x + player.w / 2;
        const py = player.y + player.height / 2;
        const py_port = portToggle === 0 ? portUpperY : portLowerY;
        portToggle ^= 1;

        const ddx = px - portX;
        const ddy = py - py_port;
        const len = Math.hypot(ddx, ddy) || 1;

        bullets.spawn({
          x: portX,
          y: py_port,
          dx: ddx / len,
          dy: ddy / len,
          speed: ENEMY_BULLET.speed,
          dmg: 1,
          faction: 'enemy',
          kind: 'normal',
          color: ENEMY_BULLET.color,
        });
      }
    },

    boxes() {
      return [{ x: coreX, y: coreY, w: coreW, h: coreH }];
    },

    hurt(dmg /*, which */) {
      this.hp -= dmg;
      this.hitFlashMs = 90;
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 2 — 武装直升机 Gunship (hp 40)
// Patrols near the top of the room and periodically dive-bombs the player.
// ---------------------------------------------------------------------------
function _createGunship(roomLeftX, world) {
  const cfg = BOSSES.gunship;

  const W = 80;   // fuselage width
  const H = 30;   // fuselage height

  // Mid-room horizontal patrol bounds.
  const minX = roomLeftX + 20;
  const maxX = roomLeftX + FIELD.W - W - 20;

  // Hover altitude: near top of room.
  const hoverY = 70;

  // Ground reference for dive bottom.
  const midX = roomLeftX + FIELD.W / 2;
  const groundY = world.floorTopAt(midX);
  const diveBottomY = groundY - 100;   // dives low enough to be hit by standing/jumping fire

  // Rotor spin (renderer reads this).
  let rotorAngle = 0;

  // State machine.
  let state = 'hover';
  let stateTimer = 2.5;   // first dive after 2.5s
  let tilt = 0;           // radians; positive = nose-down
  let vy = 0;             // vertical velocity during dive/climb

  // Horizontal patrol velocity (alternates on wall hit).
  let vx = 110;           // px/s, will be clamped

  // Target x for dive (locked when dive starts).
  let diveTargetX = 0;

  // Burst fire during dive.
  let burstCount = 0;
  let burstTimer = 0;

  const startX = roomLeftX + FIELD.W / 2 - W / 2;

  return {
    type: 'gunship',
    name: '武装直升机',

    x: startX,
    y: hoverY,
    w: W,
    h: H,

    tilt,       // radians — renderer uses this
    rotorAngle, // radians — renderer uses this for spinning rotor line

    hp: cfg.hp,
    hpMax: cfg.hp,
    phase: 1,
    dead: false,
    hitFlashMs: 0,

    update(dt, player, bullets /*, ctx */) {
      if (this.hitFlashMs > 0) this.hitFlashMs -= dt * 1000;

      rotorAngle += dt * 12;   // fast spin
      this.rotorAngle = rotorAngle;

      if (state === 'hover') {
        // Horizontal patrol with light bob.
        this.x += vx * dt;
        // Bounce off room edges.
        if (this.x <= minX) { this.x = minX; vx = Math.abs(vx); }
        if (this.x >= maxX) { this.x = maxX; vx = -Math.abs(vx); }

        // Gentle vertical bob.
        this.y = hoverY + Math.sin(rotorAngle * 0.18) * 8;
        this.tilt = 0;

        stateTimer -= dt;
        if (stateTimer <= 0) {
          state = 'dive';
          // Lock target x onto current player position (centre of fuselage).
          diveTargetX = (player.x + player.w / 2) - W / 2;
          diveTargetX = Math.max(minX, Math.min(maxX, diveTargetX));
          vy = 0;
          burstCount = 0;
          burstTimer = 0.10;   // fire first bullet almost immediately
          this.tilt = 0.4;     // nose-down
        }

      } else if (state === 'dive') {
        // Move toward target x.
        const dx = diveTargetX - this.x;
        const horizSpeed = 180;
        if (Math.abs(dx) > 2) {
          this.x += Math.sign(dx) * Math.min(horizSpeed * dt, Math.abs(dx));
        }

        // Accelerate downward.
        vy += 600 * dt;
        this.y += vy * dt;
        this.tilt = 0.4;

        // Fire burst of 3 bullets while diving.
        if (burstCount < 3) {
          burstTimer -= dt;
          if (burstTimer <= 0) {
            burstTimer = 0.18;
            burstCount++;

            const bx = this.x + W / 2;
            const by = this.y + H;
            const tx = player.x + player.w / 2;
            const ty = player.y + player.height / 2;
            spawnAimedBullet(bullets, bx, by, tx, ty);
          }
        }

        // Reached dive bottom → start climb.
        if (this.y >= diveBottomY) {
          this.y = diveBottomY;
          state = 'climb';
          vy = -420;   // upward exit velocity
          this.tilt = -0.2;
        }

      } else if (state === 'climb') {
        vy += 200 * dt;   // decelerate upward (gravity-lite)
        this.y += vy * dt;
        this.tilt = -0.2;

        if (this.y <= hoverY) {
          this.y = hoverY;
          state = 'hover';
          stateTimer = 2.5;
          vy = 0;
          this.tilt = 0;
        }
      }

      // Constrain x at all times.
      this.x = Math.max(minX, Math.min(maxX, this.x));
    },

    boxes() {
      // Whole fuselage is the (only) hittable box.
      return [{ x: this.x, y: this.y, w: this.w, h: this.h }];
    },

    hurt(dmg /*, which */) {
      this.hp -= dmg;
      this.hitFlashMs = 90;
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 3 — 重装机甲 Heavy Mech (hp 50)
// Walks toward the player; fires shoulder spreads; jump-slams every ~4s.
// ---------------------------------------------------------------------------
function _createMech(roomLeftX, world) {
  const cfg = BOSSES.mech;

  const W = 60;
  const H = 80;

  // Start at right side of room.
  const startX = roomLeftX + FIELD.W - W - 40;

  // Ground y at start position.
  const groundY = world.floorTopAt(startX + W / 2);

  let fireTimer = 1.0;
  let jumpTimer = 4.0;
  let vy = 0;
  let jumping = false;
  let step = 0;   // leg phase for renderer (oscillates while walking)
  let stepDir = 1;

  // Cockpit rect (weak point) is relative offsets from mech top-left.
  // Upper-front of the mech, within player-reachable height.
  const cockpitRelX = W * 0.2;
  const cockpitRelY = H * 0.12;
  const cockpitW = W * 0.38;
  const cockpitH = H * 0.25;

  return {
    type: 'mech',
    name: '重装机甲',

    x: startX,
    y: groundY - H,
    w: W,
    h: H,

    step,
    jumping,

    hp: cfg.hp,
    hpMax: cfg.hp,
    phase: 1,
    dead: false,
    hitFlashMs: 0,

    update(dt, player, bullets /*, ctx */) {
      if (this.hitFlashMs > 0) this.hitFlashMs -= dt * 1000;

      // Room bounds.
      const minX = roomLeftX + 20;
      const maxX = roomLeftX + FIELD.W - W - 20;

      // --- Gravity / jump-slam physics ---
      if (jumping) {
        vy += PHYSICS.gravity * dt;
        this.y += vy * dt;

        // Land when back at ground level.
        const floorY = world.floorTopAt(this.x + W / 2) - H;
        if (this.y >= floorY) {
          this.y = floorY;
          vy = 0;
          jumping = false;
          this.jumping = false;

          // Shockwave: two enemy bullets along the ground.
          const shockY = this.y + H - 10;
          for (const sign of [-1, 1]) {
            bullets.spawn({
              x: this.x + W / 2,
              y: shockY,
              dx: sign,
              dy: 0,
              speed: 220,
              dmg: 1,
              faction: 'enemy',
              kind: 'normal',
              color: ENEMY_BULLET.color,
            });
          }
        }
      } else {
        // Walk toward player (keep a gap so cockpit remains visible).
        const stopDist = 100;
        const px = player.x + player.w / 2;
        const mx = this.x + W / 2;
        const dist = px - mx;

        if (Math.abs(dist) > stopDist) {
          const walkSpeed = 65;
          this.x += Math.sign(dist) * walkSpeed * dt;
          this.x = Math.max(minX, Math.min(maxX, this.x));

          // Animate step phase.
          step += dt * 6 * stepDir;
          if (step > 1) { step = 1; stepDir = -1; }
          if (step < 0) { step = 0; stepDir = 1; }
          this.step = step;
        }

        // Clamp to floor.
        const floorY = world.floorTopAt(this.x + W / 2) - H;
        if (this.y < floorY) {
          vy += PHYSICS.gravity * dt;
          this.y += vy * dt;
          if (this.y >= floorY) { this.y = floorY; vy = 0; }
        }

        // --- Shoulder cannon fire ---
        fireTimer -= dt;
        if (fireTimer <= 0) {
          fireTimer = 1.6;

          const bx = this.x + W / 2;
          const by = this.y + H * 0.28;   // shoulder height
          const tx = player.x + player.w / 2;
          const ty = player.y + player.height / 2;
          const baseDx = tx - bx;
          const baseDy = ty - by;
          const baseAngle = Math.atan2(baseDy, baseDx);

          // 3-bullet fan: centre ±0.25 rad.
          for (const offset of [-0.25, 0, 0.25]) {
            const a = baseAngle + offset;
            bullets.spawn({
              x: bx, y: by,
              dx: Math.cos(a), dy: Math.sin(a),
              speed: ENEMY_BULLET.speed,
              dmg: 1,
              faction: 'enemy',
              kind: 'normal',
              color: ENEMY_BULLET.color,
            });
          }
        }

        // --- Jump-slam trigger ---
        jumpTimer -= dt;
        if (jumpTimer <= 0) {
          jumpTimer = 4.0;
          jumping = true;
          this.jumping = true;
          vy = -580;   // hop upward
        }
      }
    },

    boxes() {
      // Cockpit is the only weak point.
      return [{
        x: this.x + cockpitRelX,
        y: this.y + cockpitRelY,
        w: cockpitW,
        h: cockpitH,
      }];
    },

    hurt(dmg /*, which */) {
      this.hp -= dmg;
      this.hitFlashMs = 90;
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 4 — 双管巨炮 Twin Cannon (hp 55)
// Stationary hub; left & right turrets each have ~half hp. Both must be
// destroyed. game.js calls hurt(dmg, i) where i is the index into boxes().
// boxes() returns alive turrets only (left first if alive, then right).
// ---------------------------------------------------------------------------
function _createTwinCannon(roomLeftX, world) {
  const cfg = BOSSES.twinCannon;

  // Hub geometry — anchored at right of room.
  const hubW = 80;
  const hubH = 60;
  const hubX = roomLeftX + FIELD.W - hubW - 30;
  const groundY = world.floorTopAt(hubX + hubW / 2);
  const hubY = groundY - hubH;

  // Turret geometry (protrude left from hub).
  const turretW = 50;
  const turretH = 22;
  // Upper turret (left cannon).
  const turretLX = hubX - turretW;
  const turretLY = hubY + hubH * 0.18;
  // Lower turret (right cannon).
  const turretRX = hubX - turretW;
  const turretRY = hubY + hubH * 0.58;

  const hpLeft  = Math.round(cfg.hp / 2);       // 28
  const hpRight = cfg.hp - hpLeft;              // 27

  let hpL = hpLeft;
  let hpR = hpRight;

  // Alternate fire between turrets.
  let fireTimer = 1.3;
  let fireSide = 0;   // 0 = left, 1 = right

  return {
    type: 'twinCannon',
    name: '双管巨炮',

    // Hub rect (renderer).
    x: hubX,
    y: hubY,
    w: hubW,
    h: hubH,

    // Turret rects (renderer reads these directly).
    turretLX, turretLY, turretW, turretH,
    turretRX, turretRY,

    // Alive flags (renderer: darken/break destroyed turrets).
    get hpLeft()  { return hpL; },
    get hpRight() { return hpR; },

    hp: cfg.hp,
    hpMax: cfg.hp,
    phase: 1,
    dead: false,
    hitFlashMs: 0,

    update(dt, player, bullets /*, ctx */) {
      if (this.hitFlashMs > 0) this.hitFlashMs -= dt * 1000;

      fireTimer -= dt;
      if (fireTimer <= 0) {
        fireTimer = 1.3;

        // Find the next alive turret to fire (alternate; skip dead ones).
        let attempts = 2;
        while (attempts-- > 0) {
          const useLeft = fireSide === 0;
          fireSide ^= 1;
          if (useLeft && hpL <= 0) continue;
          if (!useLeft && hpR <= 0) continue;

          // Muzzle position: tip of turret barrel.
          const bx = useLeft ? turretLX : turretRX;
          const by = useLeft
            ? turretLY + turretH / 2
            : turretRY + turretH / 2;

          const tx = player.x + player.w / 2;
          const ty = player.y + player.height / 2;
          spawnAimedBullet(bullets, bx, by, tx, ty);
          break;
        }
      }
    },

    boxes() {
      // Stable order: left turret first (if alive), then right turret (if alive).
      const result = [];
      if (hpL > 0) result.push({ x: turretLX, y: turretLY, w: turretW, h: turretH });
      if (hpR > 0) result.push({ x: turretRX, y: turretRY, w: turretW, h: turretH });
      return result;
    },

    hurt(dmg, which) {
      // Reconstruct the same alive ordering used by boxes().
      const alive = [];
      if (hpL > 0) alive.push('L');
      if (hpR > 0) alive.push('R');

      // Pick the hit turret (which is the index into the current boxes() array).
      const target = alive[which] ?? alive[0];
      if (!target) return;   // shouldn't happen but guard

      if (target === 'L') {
        hpL = Math.max(0, hpL - dmg);
      } else {
        hpR = Math.max(0, hpR - dmg);
      }

      this.hp = hpL + hpR;
      this.hitFlashMs = 90;

      if (hpL <= 0 && hpR <= 0) {
        this.hp = 0;
        this.dead = true;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 5 — 核心 Core (multi-phase, phaseHp [40,40,40] = 120 total)
//
// Phase 1 — shielded: two side generators are the ONLY weak points.
//           Both must be destroyed to advance. Fires aimed volleys.
// Phase 2 — exposed core: central core rect is the target.
//           Radial ring bursts + occasional enemy summons via ctx.addEnemy.
// Phase 3 — enraged: denser/faster ring bursts + aimed shots.
//           On hp ≤ 0 → exploding (1.2s timer) → dead = true → game.js win.
//
// Transition between phases: ~0.9s invulnerable gap (boxes() returns []).
// ---------------------------------------------------------------------------
function _createCore(roomLeftX, world) {
  const cfg = BOSSES.core;
  const phaseHp = cfg.phaseHp;   // [40, 40, 40]

  // ── Geometry ────────────────────────────────────────────────────────────
  // Main body: large central structure anchored against the right wall.
  const bodyW = 100;
  const bodyH = 160;
  const bodyX = roomLeftX + FIELD.W - bodyW - 20;
  const groundY = world.floorTopAt(bodyX + bodyW / 2);
  const bodyY = groundY - bodyH;

  // Central glowing core rect (exposed in phases 2 & 3).
  // Positioned at roughly mid-height of the body, player-reachable by jumping.
  const coreW = 44;
  const coreH = 44;
  const coreX = bodyX + (bodyW - coreW) / 2;
  const coreY = bodyY + bodyH * 0.38;   // ~60% up from bottom → ~96px above ground

  // Side generators (phase 1 weak points).
  // Both protrude to the LEFT of the body at player-reachable heights.
  // genL = upper generator, genR = lower generator.
  const genW = 36;
  const genH = 26;
  const genLX = bodyX - genW;           // left of body
  const genLY = bodyY + bodyH * 0.20;   // upper — ~32px from top of body
  const genRX = bodyX - genW;           // left of body
  const genRY = bodyY + bodyH * 0.58;   // lower — ~93px from top of body

  // ── State ────────────────────────────────────────────────────────────────
  let phase = 1;
  let transitioning = false;
  let transTimer = 0;
  const TRANS_DUR = 0.9;

  let exploding = false;
  let explodeTimer = 0;
  const EXPLODE_DUR = 1.2;
  let explodeT = 0;   // 0→1 progress, exposed to renderer

  // Phase 1 generator hp (each = phaseHp[0]/2 = 20).
  let genL = phaseHp[0] / 2;
  let genR = phaseHp[0] / 2;

  // Fire timers.
  let fireTimer = 1.3;            // aimed volley timer (phases 1 + 3)
  let ringTimer = 2.0;            // radial ring timer (phases 2 + 3)
  let summonTimer = 5.0;          // enemy summon timer (phase 2 + 3)
  const SUMMON_INTERVAL = 5.0;

  // Phase-advance helper (called at end of each phase to start transition).
  function _beginTransition() {
    transitioning = true;
    transTimer = TRANS_DUR;
    // NOTE: phase-change SFX hook — trigger audio here when audio is wired.
  }

  // Set new phase stats after transition completes.
  function _applyPhase(boss, p) {
    phase = p;
    boss.phase = p;
    if (p === 2) {
      boss.hp    = phaseHp[1];
      boss.hpMax = phaseHp[1];
      fireTimer  = 2.0;   // ring bursts in phase 2
      ringTimer  = 2.0;
      summonTimer = 5.0;
    } else if (p === 3) {
      boss.hp    = phaseHp[2];
      boss.hpMax = phaseHp[2];
      fireTimer  = 1.1;   // aimed shots return in phase 3 (faster)
      ringTimer  = 1.4;   // denser ring cadence
      summonTimer = 5.0;
    }
  }

  // Spawn a radial ring of bullets from the core centre.
  function _spawnRing(boss, bullets, count, speed) {
    const cx = coreX + coreW / 2;
    const cy = coreY + coreH / 2;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      bullets.spawn({
        x: cx, y: cy,
        dx: Math.cos(a),
        dy: Math.sin(a),
        speed,
        dmg: 1,
        faction: 'enemy',
        kind: 'normal',
        color: ENEMY_BULLET.color,
      });
    }
  }

  // Spawn a single aimed shot from the core centre toward the player.
  function _spawnAimed(bullets, player) {
    const cx = coreX + coreW / 2;
    const cy = coreY + coreH / 2;
    const tx = player.x + player.w / 2;
    const ty = player.y + player.height / 2;
    spawnAimedBullet(bullets, cx, cy, tx, ty);
  }

  return {
    type: 'core',
    name: '核心',

    // Overall body bounds (renderer).
    x: bodyX,
    y: bodyY,
    w: bodyW,
    h: bodyH,

    // Generator rects (renderer reads these; alive flags exposed via getters).
    genLX, genLY, genW, genH,
    genRX, genRY,

    // Core rect (renderer reads these).
    coreX, coreY, coreW, coreH,

    // Phase/state flags.
    phase,
    transitioning,
    exploding,
    explodeT,

    hp:    phaseHp[0],
    hpMax: phaseHp[0],
    dead:  false,
    hitFlashMs: 0,

    // Alive flags as getters (renderer: dim/break destroyed generators).
    get genLAlive() { return genL > 0; },
    get genRAlive() { return genR > 0; },

    update(dt, player, bullets, ctx) {
      if (this.hitFlashMs > 0) this.hitFlashMs -= dt * 1000;

      // ── Exploding finale ─────────────────────────────────────────────
      if (exploding) {
        explodeTimer -= dt;
        explodeT = Math.max(0, 1 - explodeTimer / EXPLODE_DUR);
        this.explodeT = explodeT;
        if (explodeTimer <= 0 && !this.dead) {
          this.dead = true;   // triggers game.js → win; fires exactly once
        }
        return;
      }

      // ── Transition gap (invulnerable between phases) ──────────────────
      if (transitioning) {
        transTimer -= dt;
        if (transTimer <= 0) {
          transitioning = false;
          this.transitioning = false;
          _applyPhase(this, phase);
        }
        return;
      }

      // ── Phase 1 — shield generators ──────────────────────────────────
      if (phase === 1) {
        // Update composite hp for the HUD bar.
        this.hp = genL + genR;

        // Aimed volley at the player from the generator positions.
        fireTimer -= dt;
        if (fireTimer <= 0) {
          fireTimer = 1.3;
          // Fire from whichever generators are still alive.
          if (genL > 0) {
            const bx = genLX;
            const by = genLY + genH / 2;
            const tx = player.x + player.w / 2;
            const ty = player.y + player.height / 2;
            const ddx = tx - bx; const ddy = ty - by;
            const len = Math.hypot(ddx, ddy) || 1;
            bullets.spawn({ x: bx, y: by, dx: ddx / len, dy: ddy / len,
              speed: ENEMY_BULLET.speed, dmg: 1, faction: 'enemy', kind: 'normal', color: ENEMY_BULLET.color });
          }
          if (genR > 0) {
            const bx = genRX;
            const by = genRY + genH / 2;
            const tx = player.x + player.w / 2;
            const ty = player.y + player.height / 2;
            const ddx = tx - bx; const ddy = ty - by;
            const len = Math.hypot(ddx, ddy) || 1;
            bullets.spawn({ x: bx, y: by, dx: ddx / len, dy: ddy / len,
              speed: ENEMY_BULLET.speed, dmg: 1, faction: 'enemy', kind: 'normal', color: ENEMY_BULLET.color });
          }
        }
        return;
      }

      // ── Phase 2 — core exposed ────────────────────────────────────────
      if (phase === 2) {
        // Radial ring bursts.
        ringTimer -= dt;
        if (ringTimer <= 0) {
          ringTimer = 2.0;
          _spawnRing(this, bullets, 10, 200);
        }

        // Occasional enemy summons (capped at every SUMMON_INTERVAL seconds).
        summonTimer -= dt;
        if (summonTimer <= 0) {
          summonTimer = SUMMON_INTERVAL;
          if (ctx && ctx.addEnemy) {
            // Summon a grunt near the player, but not outside the boss room.
            const spawnX = Math.max(roomLeftX + 60,
              Math.min(roomLeftX + FIELD.W - 80, player.x - 60));
            ctx.addEnemy({ x: spawnX, type: 'grunt' });
            // Second summon: drone from right side of room.
            ctx.addEnemy({ x: roomLeftX + FIELD.W - 100, type: 'drone' });
          }
        }
        return;
      }

      // ── Phase 3 — enraged ─────────────────────────────────────────────
      if (phase === 3) {
        // Denser, faster ring bursts.
        ringTimer -= dt;
        if (ringTimer <= 0) {
          ringTimer = 2.2;
          _spawnRing(this, bullets, 8, 200);
        }

        // Aimed shot toward the player (single shot — kid-friendly phase 3).
        fireTimer -= dt;
        if (fireTimer <= 0) {
          fireTimer = 1.1;
          const cx = coreX + coreW / 2;
          const cy = coreY + coreH / 2;
          const tx = player.x + player.w / 2;
          const ty = player.y + player.height / 2;
          const baseAngle = Math.atan2(ty - cy, tx - cx);
          for (const offset of [0]) {
            const a = baseAngle + offset;
            bullets.spawn({
              x: cx, y: cy,
              dx: Math.cos(a), dy: Math.sin(a),
              speed: ENEMY_BULLET.speed,
              dmg: 1, faction: 'enemy', kind: 'normal', color: ENEMY_BULLET.color,
            });
          }
        }

        // Occasional summons continue in phase 3.
        summonTimer -= dt;
        if (summonTimer <= 0) {
          summonTimer = SUMMON_INTERVAL;
          if (ctx && ctx.addEnemy) {
            const spawnX = Math.max(roomLeftX + 60,
              Math.min(roomLeftX + FIELD.W - 80, player.x - 80));
            ctx.addEnemy({ x: spawnX, type: 'grunt' });
          }
        }
        return;
      }
    },

    boxes() {
      if (this.dead || exploding || transitioning) return [];

      if (phase === 1) {
        // Stable order: upper generator (L) first, lower generator (R) second.
        const result = [];
        if (genL > 0) result.push({ x: genLX, y: genLY, w: genW, h: genH });
        if (genR > 0) result.push({ x: genRX, y: genRY, w: genW, h: genH });
        return result;
      }

      // Phases 2 & 3: central core rect.
      return [{ x: coreX, y: coreY, w: coreW, h: coreH }];
    },

    hurt(dmg, which) {
      if (exploding || transitioning) return;   // invulnerable

      this.hitFlashMs = 90;

      if (phase === 1) {
        // Reconstruct alive ordering matching boxes() — same pattern as twinCannon.
        const alive = [];
        if (genL > 0) alive.push('L');
        if (genR > 0) alive.push('R');

        const target = alive[which] ?? alive[0];
        if (!target) return;

        if (target === 'L') {
          genL = Math.max(0, genL - dmg);
        } else {
          genR = Math.max(0, genR - dmg);
        }

        this.hp = genL + genR;

        if (genL <= 0 && genR <= 0) {
          // Both generators destroyed → transition to phase 2.
          this.hp = 0;
          phase = 2;   // set closure var so _applyPhase applies phase 2 after gap
          this.phase = 2;  // sync object property for renderer/HUD
          _beginTransition();
          this.transitioning = true;
        }
        return;
      }

      // Phases 2 & 3: direct core damage.
      this.hp = Math.max(0, this.hp - dmg);

      if (this.hp <= 0) {
        if (phase === 2) {
          // Transition to phase 3.
          this.hp = 0;
          phase = 3;   // closure var
          this.phase = 3;  // sync object property
          _beginTransition();
          this.transitioning = true;
        } else {
          // Phase 3 hp depleted → begin explosion sequence.
          this.hp = 0;
          exploding = true;
          this.exploding = true;
          explodeTimer = EXPLODE_DUR;
          explodeT = 0;
          this.explodeT = 0;
          // NOTE: death SFX hook — trigger explosion audio here when audio is wired.
        }
      }
    },
  };
}
