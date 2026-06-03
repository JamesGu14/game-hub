// viewmodel.js — first-person weapon viewmodels for all weapon types
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';

let _camera = null;
const _models = { knife: null, pistol: null, smg: null, rifle: null, sniper: null };
let _muzzleFlash = null;
let _muzzleTimer = 0;
let _activeType = 'pistol';
let _swayPhase = 0;
let _scoped = false;

const OVERLAY_RO = 999;
// Use unlit MeshBasicMaterial so viewmodels always render at their assigned
// color regardless of scene lighting (which doesn't reach overlay-rendered
// items reliably).
const OL = (color) => {
  const m = new THREE.MeshBasicMaterial({ color });
  m.depthTest = false; m.depthWrite = false;
  return m;
};
const apply = (group) => {
  group.renderOrder = OVERLAY_RO;
  group.traverse((c) => {
    c.renderOrder = OVERLAY_RO;
    if (c.material) { c.material.depthTest = false; c.material.depthWrite = false; }
  });
};

function _buildKnife() {
  // Knife is built with its rest pose flat to the right, blade pointing forward (-Z).
  // The group itself is rotated/translated outside this function to position in viewport.
  const g = new THREE.Group();

  // ── Hand (glove) at root, holding the handle ──
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.16), OL(0x1a1a1a));
  hand.position.set(0, -0.05, 0.05);
  g.add(hand);

  // ── Handle (wrapped grip) ──
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.22), OL(0x4a3018));
  handle.position.set(0, 0.04, -0.05);
  g.add(handle);
  // Grip ridges
  for (let i = -2; i <= 2; i++) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.062, 0.012), OL(0x2a1808));
    ridge.position.set(0, 0.04, -0.05 + i * 0.035);
    g.add(ridge);
  }

  // ── Cross-guard ──
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), OL(0x2a2a30));
  guard.position.set(0, 0.04, -0.18);
  g.add(guard);

  // ── Blade (clearly visible silver) ──
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.018, 0.32), OL(0xdcdfe5));
  blade.position.set(0, 0.04, -0.36);
  g.add(blade);

  // Blade fuller (groove highlight)
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.020, 0.28), OL(0xa8acb2));
  fuller.position.set(0, 0.04, -0.36);
  g.add(fuller);

  // Blade edge (lighter strip on bottom)
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.012, 0.32), OL(0xffffff));
  edge.position.set(0, 0.030, -0.36);
  g.add(edge);

  // Tapered tip (small triangle-ish wedge)
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.018, 0.08), OL(0xdcdfe5));
  tip.position.set(0, 0.04, -0.54);
  tip.rotation.y = 0.0;
  g.add(tip);

  // Pommel (bottom of handle)
  const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.05), OL(0x2a2a30));
  pommel.position.set(0, 0.04, 0.07);
  g.add(pommel);

  apply(g);
  return g;
}

function _buildPistol() {
  const g = new THREE.Group();
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.26), OL(0x2a2a2a));
  slide.position.set(0, 0.03, -0.06); g.add(slide);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.20), OL(0x1a1a1a));
  frame.position.set(0, -0.02, -0.04); g.add(frame);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.10, 10), OL(0x2a2a2a));
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, -0.22); g.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.10), OL(0x2a2218));
  grip.position.set(0, -0.10, 0.04); grip.rotation.x = -0.20; g.add(grip);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.16, 0.10), OL(0x141414));
  hand.position.set(0, -0.13, 0.04); g.add(hand);
  apply(g); return g;
}

function _buildSMG() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.10, 0.36), OL(0x1a1a1a)); g.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.20, 10), OL(0x0a0a0a));
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.30); g.add(barrel);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), OL(0x202020));
  mag.position.set(0, -0.16, 0.05); g.add(mag);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.07), OL(0x1a1a1a));
  grip.position.set(0, -0.09, 0.15); g.add(grip);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.18), OL(0x2a2a2a));
  stock.position.set(0, 0, 0.26); g.add(stock);
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.15, 0.10), OL(0x141414));
  handR.position.set(0, -0.13, 0.15); g.add(handR);
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.13, 0.10), OL(0x141414));
  handL.position.set(0, -0.10, -0.18); g.add(handL);
  apply(g); return g;
}

function _buildRifle() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.13, 0.55), OL(0x1a1a1a)); g.add(body);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.45), OL(0x444444));
  rail.position.set(0, 0.075, -0.02); g.add(rail);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 12), OL(0x0a0a0a));
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.015, -0.42); g.add(barrel);
  const muzzleDev = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.07, 10), OL(0x0a0a0a));
  muzzleDev.rotation.x = Math.PI / 2; muzzleDev.position.set(0, 0.015, -0.64); g.add(muzzleDev);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 12), OL(0x0a0a0a));
  scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.11, -0.05); g.add(scope);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), OL(0x1a3050));
  lens.position.set(0, 0.11, 0.03); g.add(lens);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.20, 0.10), OL(0x202020));
  mag.position.set(0, -0.15, 0.05); g.add(mag);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.08), OL(0x1a1a1a));
  grip.position.set(0, -0.10, 0.18); grip.rotation.x = -0.25; g.add(grip);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.28), OL(0x3a2818));
  stock.position.set(0, 0, 0.40); g.add(stock);
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.15, 0.12), OL(0x141414));
  handR.position.set(0, -0.16, 0.18); g.add(handR);
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.15, 0.12), OL(0x141414));
  handL.position.set(0, -0.12, -0.18); g.add(handL);
  apply(g); return g;
}

function _buildSniper() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.13, 0.70), OL(0x1a1a1a)); g.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.62, 12), OL(0x0a0a0a));
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.015, -0.55); g.add(barrel);
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.10, 10), OL(0x0a0a0a));
  brake.rotation.x = Math.PI / 2; brake.position.set(0, 0.015, -0.90); g.add(brake);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.040, 0.32, 14), OL(0x0a0a0a));
  scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.13, -0.05); g.add(scope);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.035, 14), OL(0x2050a0));
  lens.position.set(0, 0.13, 0.10); g.add(lens);
  const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), OL(0x202020));
  bipodL.rotation.z = 0.4; bipodL.position.set(-0.06, -0.12, -0.45); g.add(bipodL);
  const bipodR = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), OL(0x202020));
  bipodR.rotation.z = -0.4; bipodR.position.set(0.06, -0.12, -0.45); g.add(bipodR);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.10), OL(0x202020));
  mag.position.set(0, -0.14, 0.10); g.add(mag);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.08), OL(0x1a1a1a));
  grip.position.set(0, -0.10, 0.22); grip.rotation.x = -0.20; g.add(grip);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.30), OL(0x3a2818));
  stock.position.set(0, 0, 0.45); g.add(stock);
  const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.20), OL(0x3a2818));
  cheek.position.set(0, 0.06, 0.40); g.add(cheek);
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.15, 0.12), OL(0x141414));
  handR.position.set(0, -0.16, 0.22); g.add(handR);
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.15, 0.12), OL(0x141414));
  handL.position.set(0, -0.12, -0.28); g.add(handL);
  apply(g); return g;
}

function _buildMuzzleFlash() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffe080, transparent: true, opacity: 0.95,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  g.add(core);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xff9020, transparent: true, opacity: 0.5,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  g.add(halo);
  g.visible = false;
  g.renderOrder = OVERLAY_RO + 1;
  return g;
}

// Knife slash animation state
let _knifeSwingTimer = 0;
const KNIFE_SWING_DURATION = 0.25;
let _knifeSwingDir = 1; // alternates each swing

// Reload sink/dip animation state — gun drops down and tilts, then returns at the end
let _reloadTimer = 0;     // counts down to 0
let _reloadDuration = 0;  // full reload window in seconds (matches weapon reloadMs)
const RELOAD_DIP = {
  pistol: { y: -0.14, z:  0.06, pitch: 0.35 },
  smg:    { y: -0.16, z:  0.06, pitch: 0.40 },
  rifle:  { y: -0.18, z:  0.08, pitch: 0.45 },
  sniper: { y: -0.22, z:  0.10, pitch: 0.55 },
};

const BASE = {
  knife:  { pos: [0.22, -0.18, -0.45], rot: [0.05, -0.15, 0] },
  pistol: { pos: [0.22, -0.22, -0.42], rot: [0.05, -0.10, 0] },
  smg:    { pos: [0.26, -0.22, -0.50], rot: [0.05, -0.10, 0] },
  rifle:  { pos: [0.28, -0.24, -0.55], rot: [0.05, -0.12, 0] },
  sniper: { pos: [0.30, -0.26, -0.65], rot: [0.05, -0.08, 0] },
};

const MUZZLE = {
  pistol: [0.22, -0.20, -0.66],
  smg:    [0.26, -0.21, -0.86],
  rifle:  [0.28, -0.22, -1.21],
  sniper: [0.30, -0.24, -1.50],
};

// Per-weapon recoil impulse magnitudes (visual kick only — does not steer aim).
const RECOIL = {
  pistol: { kickZ: 0.045, kickY: 0.018, kickP: 0.07 },
  smg:    { kickZ: 0.030, kickY: 0.012, kickP: 0.05 },
  rifle:  { kickZ: 0.055, kickY: 0.022, kickP: 0.09 },
  sniper: { kickZ: 0.110, kickY: 0.040, kickP: 0.18 },
};

// Critically-damped springs so kicks return without overshoot in ~150-220ms.
function makeSpring(stiffness, damping) {
  return { pos: 0, vel: 0, target: 0, stiffness, damping };
}
function springUpdate(s, dt) {
  const force = -s.stiffness * (s.pos - s.target);
  const damp  = -s.damping  * s.vel;
  s.vel += (force + damp) * dt;
  s.pos += s.vel * dt;
  return s.pos;
}
const _recoilZ = makeSpring(220, 22);
const _recoilY = makeSpring(220, 22);
const _recoilP = makeSpring(260, 22);

export function initViewmodel(camera) {
  _camera = camera;
  _models.knife  = _buildKnife();
  _models.pistol = _buildPistol();
  _models.smg    = _buildSMG();
  _models.rifle  = _buildRifle();
  _models.sniper = _buildSniper();
  for (const type of Object.keys(_models)) {
    const m = _models[type];
    m.position.set(...BASE[type].pos);
    m.rotation.set(...BASE[type].rot);
    m.visible = false;
    camera.add(m);
  }
  _muzzleFlash = _buildMuzzleFlash();
  camera.add(_muzzleFlash);
  setActiveViewmodel('pistol');
}

export function setActiveViewmodel(typeOrKey) {
  let type = typeOrKey;
  if (WEAPONS[typeOrKey]) type = WEAPONS[typeOrKey].type;
  if (!_models[type]) return;
  for (const k of Object.keys(_models)) {
    _models[k].visible = (k === type) && !(type === 'sniper' && _scoped);
  }
  _activeType = type;
}

export function triggerMuzzleFlash() {
  if (!_muzzleFlash || _activeType === 'knife') return;
  const offset = MUZZLE[_activeType] || MUZZLE.rifle;
  _muzzleFlash.position.set(...offset);
  _muzzleFlash.visible = true;
  _muzzleTimer = 0.06;
}

/** Inject a visual recoil impulse for the given weapon type. */
export function triggerRecoil(type) {
  const r = RECOIL[type];
  if (!r) return;
  // Add to current pos so rapid-fire stacks instead of resetting.
  _recoilZ.pos += r.kickZ;
  _recoilY.pos += r.kickY;
  _recoilP.pos += r.kickP;
}

/** Trigger reload sink/dip — gun lowers off-screen while mag is changed, then returns. */
export function triggerReload(type, durationSec) {
  if (!RELOAD_DIP[type]) return;
  _reloadDuration = Math.max(0.2, durationSec || 1.5);
  _reloadTimer = _reloadDuration;
}

/** Trigger knife slash animation. Alternates left/right swings. */
export function triggerKnifeSlash() {
  if (_activeType !== 'knife') return;
  _knifeSwingTimer = KNIFE_SWING_DURATION;
  _knifeSwingDir *= -1;
}

export function updateViewmodel(delta, isMoving, isSprinting) {
  if (!_camera) return;
  if (_muzzleTimer > 0) {
    _muzzleTimer -= delta;
    if (_muzzleTimer <= 0 && _muzzleFlash) _muzzleFlash.visible = false;
  }
  const active = _models[_activeType];
  if (!active) return;

  // Knife: slash animation overrides sway
  if (_activeType === 'knife') {
    const [baseX, baseY, baseZ] = BASE.knife.pos;
    const [baseRX, baseRY, baseRZ] = BASE.knife.rot;
    if (_knifeSwingTimer > 0) {
      _knifeSwingTimer -= delta;
      const t = 1 - (_knifeSwingTimer / KNIFE_SWING_DURATION); // 0..1
      // Slash arc: rotate Y from baseRY to baseRY ± 1.2 rad, then back. Bell curve.
      const arc = Math.sin(t * Math.PI);
      active.rotation.set(
        baseRX - arc * 0.35,                      // pitch forward
        baseRY + _knifeSwingDir * arc * 1.20,     // yaw across screen
        baseRZ + _knifeSwingDir * arc * 0.30,     // slight roll
      );
      active.position.set(
        baseX - _knifeSwingDir * arc * 0.10,
        baseY + arc * 0.05,
        baseZ - arc * 0.10,
      );
    } else {
      // Idle bob
      _swayPhase += delta * (isMoving ? 6 : 1.5);
      const a = isMoving ? 0.010 : 0.003;
      active.position.set(baseX + Math.cos(_swayPhase) * a, baseY + Math.abs(Math.sin(_swayPhase)) * -a, baseZ);
      active.rotation.set(baseRX, baseRY, baseRZ);
    }
    return;
  }

  _swayPhase += delta * (isSprinting ? 14 : isMoving ? 8 : 2);
  const ampY = isMoving ? (isSprinting ? 0.025 : 0.015) : 0.004;
  const ampX = isMoving ? (isSprinting ? 0.020 : 0.012) : 0.003;
  const [baseX, baseY, baseZ] = BASE[_activeType].pos;
  const [baseRX, baseRY, baseRZ] = BASE[_activeType].rot;

  // Spring-driven recoil offsets (decay toward 0 each frame).
  const kZ = springUpdate(_recoilZ, delta);
  const kY = springUpdate(_recoilY, delta);
  const kP = springUpdate(_recoilP, delta);

  // Reload dip: 0..0.15 sink down, 0.15..0.85 hold low, 0.85..1.0 return up.
  let dipY = 0, dipZ = 0, dipP = 0;
  if (_reloadTimer > 0 && _reloadDuration > 0) {
    _reloadTimer -= delta;
    if (_reloadTimer < 0) _reloadTimer = 0;
    const t = 1 - (_reloadTimer / _reloadDuration); // 0..1 progress
    let env;
    if (t < 0.15) env = t / 0.15;              // ease in
    else if (t < 0.85) env = 1;                // hold
    else env = 1 - (t - 0.85) / 0.15;          // ease out
    env = Math.max(0, Math.min(1, env));
    const dip = RELOAD_DIP[_activeType];
    if (dip) {
      dipY = dip.y * env;
      dipZ = dip.z * env;
      dipP = dip.pitch * env;
    }
  }

  active.position.x = baseX + Math.cos(_swayPhase) * ampX;
  active.position.y = baseY + Math.abs(Math.sin(_swayPhase)) * -ampY + kY + dipY;
  active.position.z = baseZ + kZ + dipZ;
  active.rotation.set(baseRX - kP + dipP, baseRY, baseRZ);
}

let _baseFov = null;
export function setScoped(isScoped, scopeFov) {
  _scoped = !!isScoped;
  if (_activeType === 'sniper' && _models.sniper) {
    _models.sniper.visible = !_scoped;
  }
  if (!_camera) return;
  const overlay = document.getElementById('scope-overlay');
  if (_scoped && typeof scopeFov === 'number') {
    if (_baseFov === null) _baseFov = _camera.fov;
    _camera.fov = scopeFov;
    _camera.updateProjectionMatrix();
    overlay?.classList.remove('hidden');
  } else {
    if (_baseFov !== null) {
      _camera.fov = _baseFov;
      _camera.updateProjectionMatrix();
      _baseFov = null;
    }
    overlay?.classList.add('hidden');
  }
}
