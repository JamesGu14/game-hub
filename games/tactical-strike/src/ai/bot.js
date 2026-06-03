import * as THREE from 'three';
import { checkAABB } from '../engine/collision.js';
import { getScene } from '../engine/scene.js';

// ---------------------------------------------------------------------------
// Audio helper — gracefully falls back if module not yet present
// ---------------------------------------------------------------------------
let audio = null;
async function _loadAudio() {
  try {
    audio = await import('../audio/audio.js');
  } catch (_) {
    // audio module not available; silently skip
    audio = { playGunshot: () => {}, playBotDeath: () => {} };
  }
}
_loadAudio();

// ---------------------------------------------------------------------------
// Difficulty tables
// ---------------------------------------------------------------------------
const DIFFICULTY_CONFIG = {
  // Tutorial: enemies only wander, never chase or shoot. Slow speed for easy aiming.
  tutorial: { spread: 1.0, shootInterval: 999999, speed: { patrol: 1.5, chase: 1.5 }, passive: true },
  easy:     { spread: 0.14, shootInterval: 1.2, speed: { patrol: 2.0, chase: 3.0 } },
  normal:   { spread: 0.07, shootInterval: 0.9, speed: { patrol: 2.5, chase: 3.5 } },
  hard:     { spread: 0.025, shootInterval: 0.6, speed: { patrol: 2.5, chase: 3.5 } },
};

const BOT_RADIUS = 0.4;
const BOT_HEIGHT = 1.5;
const PATROL_SPEED = 2.5;
const CHASE_SPEED  = 3.5;
const LOS_RANGE    = 25;
const CHASE_RANGE  = 25;
const ATTACK_RANGE = 12;
const LOST_SIGHT_TIMEOUT = 3.0; // seconds
const DAMAGE_PER_SHOT    = 12;
const WAYPOINT_ARRIVE_DIST = 1.2;

// ---------------------------------------------------------------------------
// createBot
// ---------------------------------------------------------------------------
/**
 * @param {THREE.Vector3} startPosition
 * @param {'CT'|'T'} faction
 * @returns bot object
 */

const _sharedGeos = {};
function getGeo(key, ctor) {
  if (!_sharedGeos[key]) _sharedGeos[key] = ctor();
  return _sharedGeos[key];
}

const _sharedMats = {};
function getMat(color) {
  if (color == null) return null;
  if (!_sharedMats[color]) _sharedMats[color] = new THREE.MeshLambertMaterial({ color });
  return _sharedMats[color];
}

export function createBot(startPosition, faction) {
  const isCT = faction === 'CT';

  // ── Faction palettes ────────────────────────────────────────────────────
  // CT (SWAT-style police): navy + tactical black, light-blue accent, white badge
  // T  (terrorist/militant): olive-tan + black balaclava, red bandana accent
  const pal = isCT ? {
    uniform: 0x1f2e44, vest: 0x10182a, accent: 0x4a8fd9, badge: 0xe8c947,
    pants:   0x192230, knee: 0x0c1220, boot:  0x0a0a0a, glove: 0x121212,
    mask:    null,     bandana: null,   helmet: 0x1f2e44, visor: 0x2a4a6e,
    rig:     0x0a1422, pouch:  0x14233a,
  } : {
    uniform: 0x4f4a2d, vest: 0x2c2614, accent: 0xa6442c, badge: null,
    pants:   0x3b3520, knee: 0x1c1810, boot:  0x191108, glove: 0x141414,
    mask:    0x121212, bandana: 0x882622, helmet: null,  visor: null,
    rig:     0x1a1408, pouch:  0x2a2310,
  };
  const skin  = 0xc9a07a;
  const metal = 0x1a1a1a;
  const metalDark = 0x0a0a0a;

  const mat = getMat;
  const M = {
    uniform: mat(pal.uniform), vest: mat(pal.vest),  accent: mat(pal.accent),
    pants:   mat(pal.pants),   knee: mat(pal.knee),  boot:   mat(pal.boot),
    glove:   mat(pal.glove),   skin: mat(skin),      rig:    mat(pal.rig),
    pouch:   mat(pal.pouch),   metal: mat(metal),    metalD: mat(metalDark),
    helmet:  pal.helmet  != null ? mat(pal.helmet)  : null,
    visor:   pal.visor   != null ? mat(pal.visor)   : null,
    mask:    pal.mask    != null ? mat(pal.mask)    : null,
    bandana: pal.bandana != null ? mat(pal.bandana) : null,
    badge:   pal.badge   != null ? mat(pal.badge)   : null,
  };

  const rootGroup = new THREE.Group();
  rootGroup.position.copy(startPosition);
  rootGroup.userData.isBot = true;
  rootGroup.userData.headThresholdY = startPosition.y + 1.50;

  function part(geo, material, x, y, z, rotY = 0, head = false, parent = rootGroup) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    if (rotY) m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    if (head) m.userData.isHead = true;
    parent.add(m);
    return m;
  }

  // ── BOOTS (y 0.00–0.10) ─────────────────────────────────────────────────
  part(getGeo('BoxGeometry_0.20_0.10_0.30', () => new THREE.BoxGeometry(0.20, 0.10, 0.30)), M.boot,  0.13, 0.05, 0.04);
  part(getGeo('BoxGeometry_0.20_0.10_0.30', () => new THREE.BoxGeometry(0.20, 0.10, 0.30)), M.boot, -0.13, 0.05, 0.04);

  // ── LEGS (y 0.10–0.85) ──────────────────────────────────────────────────
  part(getGeo('BoxGeometry_0.20_0.75_0.22', () => new THREE.BoxGeometry(0.20, 0.75, 0.22)), M.pants,  0.13, 0.475, 0);
  part(getGeo('BoxGeometry_0.20_0.75_0.22', () => new THREE.BoxGeometry(0.20, 0.75, 0.22)), M.pants, -0.13, 0.475, 0);
  // Knee pads
  part(getGeo('BoxGeometry_0.22_0.10_0.24', () => new THREE.BoxGeometry(0.22, 0.10, 0.24)), M.knee,   0.13, 0.45, 0.01);
  part(getGeo('BoxGeometry_0.22_0.10_0.24', () => new THREE.BoxGeometry(0.22, 0.10, 0.24)), M.knee,  -0.13, 0.45, 0.01);
  // Cargo pockets on thighs
  part(getGeo('BoxGeometry_0.10_0.16_0.04', () => new THREE.BoxGeometry(0.10, 0.16, 0.04)), M.pouch,  0.18, 0.62, 0.13);
  part(getGeo('BoxGeometry_0.10_0.16_0.04', () => new THREE.BoxGeometry(0.10, 0.16, 0.04)), M.pouch, -0.18, 0.62, 0.13);

  // ── BELT (y 0.85–0.95) ──────────────────────────────────────────────────
  part(getGeo('BoxGeometry_0.50_0.10_0.30', () => new THREE.BoxGeometry(0.50, 0.10, 0.30)), M.metalD, 0, 0.90, 0);
  // Belt buckle
  part(getGeo('BoxGeometry_0.08_0.08_0.02', () => new THREE.BoxGeometry(0.08, 0.08, 0.02)), M.metal,  0, 0.90, 0.16);
  // Mag pouches on belt (front)
  part(getGeo('BoxGeometry_0.10_0.14_0.06', () => new THREE.BoxGeometry(0.10, 0.14, 0.06)), M.pouch,  0.15, 0.96, 0.16);
  part(getGeo('BoxGeometry_0.10_0.14_0.06', () => new THREE.BoxGeometry(0.10, 0.14, 0.06)), M.pouch, -0.15, 0.96, 0.16);

  // ── TORSO (y 0.95–1.45) ─────────────────────────────────────────────────
  // Base shirt
  part(getGeo('BoxGeometry_0.48_0.50_0.30', () => new THREE.BoxGeometry(0.48, 0.50, 0.30)), M.uniform, 0, 1.20, 0);
  // Tactical vest (chest plate)
  part(getGeo('BoxGeometry_0.42_0.46_0.06', () => new THREE.BoxGeometry(0.42, 0.46, 0.06)), M.vest,    0, 1.20, 0.18);
  // Vest top strap
  part(getGeo('BoxGeometry_0.42_0.04_0.08', () => new THREE.BoxGeometry(0.42, 0.04, 0.08)), M.vest,    0, 1.42, 0.17);

  if (isCT) {
    // CT: white "POLICE" badge on chest + radio
    part(getGeo('BoxGeometry_0.12_0.06_0.02', () => new THREE.BoxGeometry(0.12, 0.06, 0.02)), M.accent, -0.10, 1.30, 0.215);
    part(getGeo('BoxGeometry_0.06_0.10_0.02', () => new THREE.BoxGeometry(0.06, 0.10, 0.02)), M.badge,   0.13, 1.30, 0.215); // gold star
    // Radio on left shoulder
    part(getGeo('BoxGeometry_0.06_0.10_0.06', () => new THREE.BoxGeometry(0.06, 0.10, 0.06)), M.metalD, -0.22, 1.40, 0.10);
    // Antenna
    part(getGeo('CylinderGeometry_0.005_0.005_0.18_6', () => new THREE.CylinderGeometry(0.005, 0.005, 0.18, 6)), M.metal, -0.22, 1.55, 0.10);
  } else {
    // T: crossed ammo bandolier
    const bandolier = getGeo('BoxGeometry_0.55_0.05_0.04', () => new THREE.BoxGeometry(0.55, 0.05, 0.04));
    const b1 = new THREE.Mesh(bandolier, M.rig);
    b1.position.set(0, 1.20, 0.21);
    b1.rotation.z =  Math.PI / 5;
    b1.castShadow = true;
    rootGroup.add(b1);
    const b2 = new THREE.Mesh(bandolier, M.rig);
    b2.position.set(0, 1.20, 0.21);
    b2.rotation.z = -Math.PI / 5;
    b2.castShadow = true;
    rootGroup.add(b2);
    // Bullet shells on bandolier (couple of accent dots)
    for (let i = -2; i <= 2; i++) {
      part(getGeo('CylinderGeometry_0.018_0.018_0.04_6', () => new THREE.CylinderGeometry(0.018, 0.018, 0.04, 6)), M.accent,
           i * 0.08, 1.20 + i * 0.04, 0.23, 0, false);
    }
  }
  // Shoulder pads
  part(getGeo('BoxGeometry_0.14_0.10_0.32', () => new THREE.BoxGeometry(0.14, 0.10, 0.32)), M.vest,  0.27, 1.42, 0);
  part(getGeo('BoxGeometry_0.14_0.10_0.32', () => new THREE.BoxGeometry(0.14, 0.10, 0.32)), M.vest, -0.27, 1.42, 0);

  // ── ARMS — held forward in shooting stance ──────────────────────────────
  // We use Groups so we can rotate the arm at the shoulder.
  const rArm = new THREE.Group();
  rArm.position.set(0.27, 1.35, 0);
  rArm.rotation.x = -1.05; // pitch forward (~60°)
  rootGroup.add(rArm);

  const lArm = new THREE.Group();
  lArm.position.set(-0.27, 1.35, 0);
  lArm.rotation.x = -1.15;
  lArm.rotation.z =  0.18;
  rootGroup.add(lArm);

  // Upper arm (sleeves)
  part(getGeo('BoxGeometry_0.14_0.30_0.14', () => new THREE.BoxGeometry(0.14, 0.30, 0.14)), M.uniform, 0, -0.15, 0, 0, false, rArm);
  part(getGeo('BoxGeometry_0.14_0.30_0.14', () => new THREE.BoxGeometry(0.14, 0.30, 0.14)), M.uniform, 0, -0.15, 0, 0, false, lArm);
  // Elbow pad
  part(getGeo('BoxGeometry_0.16_0.06_0.16', () => new THREE.BoxGeometry(0.16, 0.06, 0.16)), M.knee,    0, -0.32, 0, 0, false, rArm);
  part(getGeo('BoxGeometry_0.16_0.06_0.16', () => new THREE.BoxGeometry(0.16, 0.06, 0.16)), M.knee,    0, -0.32, 0, 0, false, lArm);
  // Forearm (extends downward in the rotated frame = forward in world)
  part(getGeo('BoxGeometry_0.13_0.28_0.13', () => new THREE.BoxGeometry(0.13, 0.28, 0.13)), M.uniform, 0, -0.49, 0, 0, false, rArm);
  part(getGeo('BoxGeometry_0.13_0.28_0.13', () => new THREE.BoxGeometry(0.13, 0.28, 0.13)), M.uniform, 0, -0.49, 0, 0, false, lArm);
  // Gloves / hands
  part(getGeo('BoxGeometry_0.14_0.12_0.14', () => new THREE.BoxGeometry(0.14, 0.12, 0.14)), M.glove,   0, -0.69, 0, 0, false, rArm);
  part(getGeo('BoxGeometry_0.14_0.12_0.14', () => new THREE.BoxGeometry(0.14, 0.12, 0.14)), M.glove,   0, -0.69, 0, 0, false, lArm);

  // ── NECK ─────────────────────────────────────────────────────────────────
  part(getGeo('BoxGeometry_0.14_0.08_0.14', () => new THREE.BoxGeometry(0.14, 0.08, 0.14)), M.skin, 0, 1.49, 0);

  // ── HEAD ─────────────────────────────────────────────────────────────────
  const headMesh = new THREE.Mesh(getGeo('SphereGeometry_0.20_18_14', () => new THREE.SphereGeometry(0.20, 18, 14)), M.skin);
  headMesh.position.set(0, 1.65, 0);
  headMesh.castShadow = true;
  headMesh.userData.isHead = true;
  rootGroup.add(headMesh);

  // Eyes (small dark dots)
  part(getGeo('SphereGeometry_0.022_6_6', () => new THREE.SphereGeometry(0.022, 6, 6)), M.metalD, 0.07, 1.66, 0.185, 0, true);
  part(getGeo('SphereGeometry_0.022_6_6', () => new THREE.SphereGeometry(0.022, 6, 6)), M.metalD, -0.07, 1.66, 0.185, 0, true);

  if (isCT) {
    // ── CT: SWAT helmet with visor + ear protectors ──
    const helmetTop = new THREE.Mesh(
      getGeo('SphereGeometry_0.23_18_10_0_Math.PI_2_0_Math.PI_2', () => new THREE.SphereGeometry(0.23, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
      M.helmet,
    );
    helmetTop.position.set(0, 1.66, 0);
    helmetTop.castShadow = true;
    helmetTop.userData.isHead = true;
    rootGroup.add(helmetTop);
    // Visor (clear-blue band)
    part(getGeo('BoxGeometry_0.36_0.07_0.06', () => new THREE.BoxGeometry(0.36, 0.07, 0.06)), M.visor, 0, 1.62, 0.18, 0, true);
    // Helmet front lip
    part(getGeo('BoxGeometry_0.40_0.04_0.10', () => new THREE.BoxGeometry(0.40, 0.04, 0.10)), M.helmet, 0, 1.55, 0.16, 0, true);
    // Ear protectors
    part(getGeo('BoxGeometry_0.06_0.14_0.14', () => new THREE.BoxGeometry(0.06, 0.14, 0.14)), M.metalD,  0.22, 1.62, 0, 0, true);
    part(getGeo('BoxGeometry_0.06_0.14_0.14', () => new THREE.BoxGeometry(0.06, 0.14, 0.14)), M.metalD, -0.22, 1.62, 0, 0, true);
    // Chin strap
    part(getGeo('BoxGeometry_0.18_0.02_0.20', () => new THREE.BoxGeometry(0.18, 0.02, 0.20)), M.metalD, 0, 1.51, 0.05, 0, true);
  } else {
    // ── T: balaclava covering lower face + red bandana on head ──
    // Black balaclava on lower face
    part(getGeo('BoxGeometry_0.32_0.18_0.32', () => new THREE.BoxGeometry(0.32, 0.18, 0.32)), M.mask, 0, 1.56, 0, 0, true);
    // Eye slit (a thin skin-colored strip — eyes already drawn above)
    // (we leave the slit implicit by leaving 1.66 area as skin)
    // Top of head bandana (red)
    const bandanaCap = new THREE.Mesh(
      getGeo('SphereGeometry_0.22_18_10_0_Math.PI_2_0_Math.PI_2.6', () => new THREE.SphereGeometry(0.22, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.6)),
      M.bandana,
    );
    bandanaCap.position.set(0, 1.66, 0);
    bandanaCap.castShadow = true;
    bandanaCap.userData.isHead = true;
    rootGroup.add(bandanaCap);
    // Bandana knot in back
    part(getGeo('BoxGeometry_0.08_0.06_0.08', () => new THREE.BoxGeometry(0.08, 0.06, 0.08)), M.bandana, 0, 1.70, -0.22, 0, true);
    // Bandana tails
    part(getGeo('BoxGeometry_0.03_0.16_0.03', () => new THREE.BoxGeometry(0.03, 0.16, 0.03)), M.bandana, -0.04, 1.62, -0.22, 0, true);
    part(getGeo('BoxGeometry_0.03_0.18_0.03', () => new THREE.BoxGeometry(0.03, 0.18, 0.03)), M.bandana,  0.04, 1.60, -0.22, 0, true);
  }

  // ── RIFLE — held in front of chest, both hands gripping ─────────────────
  const rifle = new THREE.Group();

  const rifleBody = new THREE.Mesh(
    getGeo('BoxGeometry_0.09_0.10_0.50', () => new THREE.BoxGeometry(0.09, 0.10, 0.50)),
    getMat(0x222222),
  );
  rifle.add(rifleBody);

  // Barrel
  const barrel = new THREE.Mesh(
    getGeo('CylinderGeometry_0.022_0.022_0.36_10', () => new THREE.CylinderGeometry(0.022, 0.022, 0.36, 10)),
    getMat(0x111111),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.40;
  rifle.add(barrel);

  // Foregrip
  const foregrip = new THREE.Mesh(
    getGeo('BoxGeometry_0.06_0.10_0.06', () => new THREE.BoxGeometry(0.06, 0.10, 0.06)),
    getMat(0x1a1a1a),
  );
  foregrip.position.set(0, -0.10, -0.10);
  rifle.add(foregrip);

  // Magazine
  const magazine = new THREE.Mesh(
    getGeo('BoxGeometry_0.08_0.18_0.10', () => new THREE.BoxGeometry(0.08, 0.18, 0.10)),
    getMat(0x2a2a2a),
  );
  magazine.position.set(0, -0.14, 0.05);
  rifle.add(magazine);

  // Stock (rear)
  const stock = new THREE.Mesh(
    getGeo('BoxGeometry_0.06_0.10_0.22', () => new THREE.BoxGeometry(0.06, 0.10, 0.22)),
    getMat(0x3a2a18),
  );
  stock.position.set(0, 0.005, 0.32);
  rifle.add(stock);

  // Scope/sight
  const scope = new THREE.Mesh(
    getGeo('CylinderGeometry_0.028_0.028_0.14_10', () => new THREE.CylinderGeometry(0.028, 0.028, 0.14, 10)),
    getMat(0x0a0a0a),
  );
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.085, 0.0);
  rifle.add(scope);

  // Front sight
  part(getGeo('BoxGeometry_0.02_0.05_0.02', () => new THREE.BoxGeometry(0.02, 0.05, 0.02)),
       getMat(0x111111),
       0, 0.075, -0.30, 0, false, rifle);

  rifle.castShadow = true;
  rifle.position.set(0.0, 1.18, -0.35); // in front of chest
  rootGroup.add(rifle);

  const bot = {
    mesh: rootGroup,
    state: 'PATROL',
    hp: 100,
    faction,
    squad: 0,
    shootTimer: 0,
    currentWaypointIdx: 0,
    lostSightTimer: 0,
    alive: true,
    _headMesh: headMesh,
    _rifle: rifle,
    _hasSubGoal: false,
    _subGoalVec: new THREE.Vector3(),
    _scratchHead: new THREE.Vector3(),
  };

  return bot;
}

// ---------------------------------------------------------------------------
// updateBot
// ---------------------------------------------------------------------------
const _rayDir  = new THREE.Vector3();
const _rayOrig = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

// Scratch vectors reused across per-frame helpers (avoid per-frame allocation).
const _moveDirVec = new THREE.Vector3();
const _moveNewPos = new THREE.Vector3();
const _fireHead   = new THREE.Vector3();
const _fireAim    = new THREE.Vector3();
const _fireDir    = new THREE.Vector3();
const _fireClosest = new THREE.Vector3();
const _AXIS_X = new THREE.Vector3(1, 0, 0);
const _AXIS_Y = new THREE.Vector3(0, 1, 0);

/**
 * @param {object} bot
 * @param {number} delta — seconds
 * @param {THREE.Vector3} playerPos
 * @param {THREE.Box3[]} mapBoxes
 * @param {THREE.Vector3[]} waypoints
 * @param {'easy'|'normal'|'hard'} difficulty
 * @param {(damage:number, isHeadshot:boolean)=>void} applyPlayerDamage
 */
export function updateBot(bot, delta, playerPos, mapBoxes, waypoints, difficulty, applyPlayerDamage) {
  if (!bot.alive) return;

  const cfg = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.normal;
  const botPos = bot.mesh.position;

  // Tutorial mode: never chase, never attack — pure patrol target for new players.
  if (cfg.passive) {
    bot.state = 'PATROL';
    _doPatrol(bot, delta, waypoints, cfg, mapBoxes);
    return;
  }

  // ── Head world position ───────────────────────────────────────────────────
  const headWorldPos = new THREE.Vector3(botPos.x, botPos.y + 1.3, botPos.z);

  // ── Line-of-sight check ───────────────────────────────────────────────────
  const hasLOS = _checkLOS(headWorldPos, playerPos, mapBoxes);
  const distToPlayer = botPos.distanceTo(playerPos);

  // ── State machine ─────────────────────────────────────────────────────────
  switch (bot.state) {
    case 'PATROL':
      _doPatrol(bot, delta, waypoints, cfg, mapBoxes);
      if (distToPlayer <= CHASE_RANGE && hasLOS) {
        bot.state = 'CHASE';
        bot.lostSightTimer = 0;
      }
      break;

    case 'CHASE':
      if (hasLOS) {
        bot.lostSightTimer = 0;
      } else {
        bot.lostSightTimer += delta;
        if (bot.lostSightTimer > LOST_SIGHT_TIMEOUT) {
          bot.state = 'PATROL';
          bot.lostSightTimer = 0;
          bot._hasSubGoal = false;
          break;
        }
      }
      if (distToPlayer <= ATTACK_RANGE && hasLOS) {
        bot.state = 'ATTACK';
        bot.shootTimer = 0; // fire immediately on first opportunity
        break;
      }
      const chaseTarget = _getChaseTarget(bot, playerPos, mapBoxes);
      _moveToward(bot, chaseTarget, cfg.speed ? cfg.speed.chase : CHASE_SPEED, delta, mapBoxes);
      // Face the immediate movement target; always face player when near
      _faceTarget(bot, chaseTarget);
      break;

    case 'ATTACK':
      if (!hasLOS || distToPlayer > ATTACK_RANGE * 1.2) {
        bot.state = 'CHASE';
        bot.lostSightTimer = 0;
        break;
      }
      bot.lostSightTimer = 0;
      _faceTarget(bot, playerPos);
      bot.shootTimer -= delta;
      if (bot.shootTimer <= 0) {
        _fireAtPlayer(bot, playerPos, cfg, applyPlayerDamage);
        bot.shootTimer = cfg.shootInterval;
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _checkLOS(fromPos, toPos, mapBoxes) {
  _rayDir.subVectors(toPos, fromPos);
  const dist = _rayDir.length();
  if (dist < 0.01) return true;
  _rayDir.normalize();

  _rayOrig.copy(fromPos);
  _raycaster.set(_rayOrig, _rayDir);
  _raycaster.far = dist;

  // Build a list of dummy meshes from mapBoxes for raycasting
  // Using Box3 directly: check each box for ray intersection
  for (const box of mapBoxes) {
    if (_raycaster.ray.intersectsBox(box)) {
      return false;
    }
  }
  return true;
}

function _doPatrol(bot, delta, waypoints, cfg, mapBoxes) {
  if (!waypoints || waypoints.length === 0) return;

  const target = waypoints[bot.currentWaypointIdx % waypoints.length];
  const botPos  = bot.mesh.position;
  const dist    = botPos.distanceTo(target);

  if (dist < WAYPOINT_ARRIVE_DIST) {
    bot.currentWaypointIdx = (bot.currentWaypointIdx + 1) % waypoints.length;
    return;
  }

  const speed = cfg.speed ? cfg.speed.patrol : PATROL_SPEED;
  _moveToward(bot, target, speed, delta, mapBoxes || []);
  _faceTarget(bot, target);
}

/**
 * Returns the effective chase target for a bot, routing it via the assigned
 * flank corridor (squad 0 = north z≈-15, squad 1 = south z≈+15) when the
 * bot is far from the player and has no direct line-of-sight.
 */
function _getChaseTarget(bot, playerPos, mapBoxes) {
  const botPos = bot.mesh.position;
  const headPos = bot._scratchHead.set(botPos.x, botPos.y + 1.3, botPos.z);

  if (bot._hasSubGoal) {
    const subDist = botPos.distanceTo(bot._subGoalVec);
    if (subDist < 3 || _checkLOS(headPos, playerPos, mapBoxes)) {
      bot._hasSubGoal = false;
    } else {
      return bot._subGoalVec;
    }
  }

  const distToPlayer = botPos.distanceTo(playerPos);
  if (distToPlayer > 15 && !_checkLOS(headPos, playerPos, mapBoxes)) {
    const flankZ = bot.squad === 0 ? -15 : 15;
    bot._subGoalVec.set(0, botPos.y, flankZ);
    bot._hasSubGoal = true;
    return bot._subGoalVec;
  }

  return playerPos;
}

function _moveToward(bot, target, speed, delta, mapBoxes) {
  const botPos = bot.mesh.position;
  _moveDirVec.set(target.x - botPos.x, 0, target.z - botPos.z);
  const dist = _moveDirVec.length();
  if (dist < 0.01) return;

  _moveDirVec.normalize();
  const step = Math.min(speed * delta, dist);
  _moveNewPos.set(
    botPos.x + _moveDirVec.x * step,
    botPos.y,
    botPos.z + _moveDirVec.z * step,
  );

  const corrected = mapBoxes && mapBoxes.length > 0
    ? checkAABB(_moveNewPos, BOT_RADIUS, 1.5, mapBoxes)
    : _moveNewPos;

  bot.mesh.position.set(corrected.x, corrected.y, corrected.z);
  bot.mesh.userData.headThresholdY = corrected.y + 1.4;
}

function _faceTarget(bot, target) {
  const botPos = bot.mesh.position;
  const dx = target.x - botPos.x;
  const dz = target.z - botPos.z;
  if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
    bot.mesh.rotation.y = Math.atan2(dx, dz);
  }
}

function _fireAtPlayer(bot, playerPos, cfg, applyPlayerDamage) {
  if (!applyPlayerDamage) return;

  const spread = cfg.spread;
  const spreadX = (Math.random() - 0.5) * 2 * spread;
  const spreadY = (Math.random() - 0.5) * 2 * spread;

  const bp = bot.mesh.position;
  _fireHead.set(bp.x, bp.y + 1.5, bp.z);

  // Aim at player chest, not feet
  _fireAim.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
  _fireDir.subVectors(_fireAim, _fireHead).normalize();

  _fireDir.addScaledVector(_AXIS_X, spreadX);
  _fireDir.addScaledVector(_AXIS_Y, spreadY);
  _fireDir.normalize();

  const toPlayerDist = _fireHead.distanceTo(_fireAim);
  _fireClosest.copy(_fireHead).addScaledVector(_fireDir, toPlayerDist);
  const missDistance = _fireClosest.distanceTo(_fireAim);

  if (missDistance < 0.5) {
    const playerHeadY = playerPos.y + 1.6;
    const headHit = _fireClosest.y >= playerHeadY - 0.2 && _fireClosest.y <= playerHeadY + 0.4;
    applyPlayerDamage(DAMAGE_PER_SHOT, headHit);
  }

  if (audio && audio.playGunshot) {
    audio.playGunshot('rifle');
  }

  _spawnMuzzleFlash(_fireHead, _fireDir);
  _spawnTracer(_fireHead, _fireDir, toPlayerDist);
}

function _spawnMuzzleFlash(origin, direction) {
  const scene = getScene();
  if (!scene) return;
  const flashPos = origin.clone().addScaledVector(direction, 0.5);
  const geo = new THREE.SphereGeometry(0.15, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.9 });
  const flash = new THREE.Mesh(geo, mat);
  flash.position.copy(flashPos);
  scene.add(flash);
  setTimeout(() => {
    scene.remove(flash);
    geo.dispose();
    mat.dispose();
  }, 70);
}

function _spawnTracer(origin, direction, distance) {
  const scene = getScene();
  if (!scene) return;
  const end = origin.clone().addScaledVector(direction, Math.min(distance, 30));
  const geo = new THREE.BufferGeometry().setFromPoints([origin.clone(), end]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  setTimeout(() => {
    scene.remove(line);
    geo.dispose();
    mat.dispose();
  }, 90);
}

// ---------------------------------------------------------------------------
// botTakeDamage
// ---------------------------------------------------------------------------
/**
 * @param {object} bot
 * @param {number} amount
 * @returns {boolean} true if bot died
 */
export function botTakeDamage(bot, amount) {
  if (!bot.alive) return false;
  bot.hp -= amount;
  if (bot.hp <= 0) {
    bot.alive = false;
    if (bot.mesh.parent) {
      bot.mesh.parent.remove(bot.mesh);
    }
    window.dispatchEvent(
      new CustomEvent('playerKilledBot', { detail: { faction: bot.faction } })
    );
    if (audio && audio.playBotDeath) {
      audio.playBotDeath();
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// getMesh / getBoundingBox
// ---------------------------------------------------------------------------
export function getMesh(bot) {
  return bot.mesh;
}

export function getBoundingBox(bot) {
  const box = new THREE.Box3().setFromObject(bot.mesh);
  return box;
}
