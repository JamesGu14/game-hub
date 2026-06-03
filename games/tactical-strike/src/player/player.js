import * as THREE from 'three';
import { getCamera } from '../engine/scene.js';
import { checkAABB, getGroundY, getCeilingY } from '../engine/collision.js';
import * as audio from '../audio/audio.js';
import { getYawPitch } from './camera.js';

// --- Internal state ---
const _state = {
  hp: 100,
  armor: 0,
  alive: true,
  faction: 'CT',
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  activeWeaponIdx: 0,
  lastFootstepAt: 0,
  // Jump / vertical physics
  velocityY:  0,
  onGround:   true,
  // Crouch
  isCrouched:      false,
  eyeHeight:       1.7,
  targetEyeHeight: 1.7,
};

const PLAYER_RADIUS   = 0.4;
const WALK_SPEED      = 5;
const SPRINT_SPEED    = 8;
const FOOTSTEP_INTERVAL = 0.4; // seconds

// Reusable scratch vectors
const _moveDir   = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _camRight   = new THREE.Vector3();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function _pickSpawn(faction, spawnPoints) {
  const candidates = spawnPoints.filter(s => s.faction === faction);
  if (candidates.length === 0) return spawnPoints[0];
  return candidates[0];
}

// ─────────────────────────────────────────────
// initPlayer
// ─────────────────────────────────────────────
export function initPlayer(faction, spawnPoints) {
  _state.faction = faction;
  _state.hp = 100;
  _state.armor = 0;
  _state.alive = true;
  _state.velocity.set(0, 0, 0);
  _state.activeWeaponIdx = 0;
  _state.lastFootstepAt = 0;
  _state.velocityY       = 0;
  _state.onGround        = true;
  _state.isCrouched      = false;
  _state.eyeHeight       = 1.7;
  _state.targetEyeHeight = 1.7;

  const spawn = _pickSpawn(faction, spawnPoints);
  if (spawn) {
    _state.position.copy(spawn.position ?? new THREE.Vector3(0, 0, 0));
  }

  // Sync camera
  _syncCamera();
}

// ─────────────────────────────────────────────
// updatePlayer
// ─────────────────────────────────────────────
export function updatePlayer(delta, inputState, mapBoxes) {
  if (!_state.alive) return;

  // --- Movement direction relative to camera yaw ---
  const { yaw } = getYawPitch();

  _camForward.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  _camRight.set(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();

  _moveDir.set(0, 0, 0);
  if (inputState.forward) _moveDir.addScaledVector(_camForward,  1);
  if (inputState.back)    _moveDir.addScaledVector(_camForward, -1);
  if (inputState.right)   _moveDir.addScaledVector(_camRight,    1);
  if (inputState.left)    _moveDir.addScaledVector(_camRight,   -1);

  // --- Crouch state ---
  _state.isCrouched = !!(inputState.crouch && _state.onGround);
  _state.targetEyeHeight = _state.isCrouched ? 1.1 : 1.7;

  // Lerp eye height toward target (rate = 1/0.15 per second)
  const EYE_LERP_RATE = 1 / 0.15;
  const eyeDiff = _state.targetEyeHeight - _state.eyeHeight;
  const maxStep = EYE_LERP_RATE * delta;
  if (Math.abs(eyeDiff) <= maxStep) {
    _state.eyeHeight = _state.targetEyeHeight;
  } else {
    _state.eyeHeight += Math.sign(eyeDiff) * maxStep;
  }

  // --- Speed (crouch overrides sprint) ---
  let speed;
  if (_state.isCrouched) {
    speed = 2.2;
  } else {
    speed = inputState.sprint ? SPRINT_SPEED : WALK_SPEED;
  }

  const isMoving = _moveDir.lengthSq() > 0;

  if (isMoving) {
    _moveDir.normalize().multiplyScalar(speed * delta);
  }

  // --- Collision-resolved horizontal movement ---
  const currentHeight = _state.isCrouched ? 1.1 : 1.7;
  if (isMoving) {
    const newPos = _state.position.clone().add(_moveDir);
    const resolved = checkAABB(newPos, PLAYER_RADIUS, currentHeight, mapBoxes);
    _state.position.copy(resolved);
  }

  // --- Vertical physics (jump & gravity) ---
  const GRAVITY = -22;

  // Jump: only when on ground and jump input fired
  if (inputState.jump && _state.onGround) {
    _state.velocityY = 7;
    _state.onGround  = false;
  }

  // Apply gravity
  _state.velocityY += GRAVITY * delta;

  // Move vertically
  const oldY = _state.position.y;
  _state.position.y += _state.velocityY * delta;

  if (_state.velocityY > 0) {
    const ceilY = getCeilingY(_state.position, PLAYER_RADIUS, currentHeight, oldY, mapBoxes);
    if (_state.position.y + currentHeight > ceilY) {
      _state.position.y = ceilY - currentHeight;
      _state.velocityY = 0;
    }
  }

  const groundY = getGroundY(_state.position, PLAYER_RADIUS, oldY, mapBoxes);

  // Ground clamp
  if (_state.position.y <= groundY) {
    _state.position.y = groundY;
    if (_state.velocityY < 0) _state.velocityY = 0;
    _state.onGround = true;
  } else {
    _state.onGround = false;
  }

  // --- Footstep audio ---
  if (isMoving && _state.onGround) {
    const now = performance.now() / 1000;
    if (now - _state.lastFootstepAt >= FOOTSTEP_INTERVAL) {
      _state.lastFootstepAt = now;
      audio.playFootstep();
    }
  }

  // --- Sync camera to player head position ---
  _syncCamera();
}

function _syncCamera() {
  const cam = getCamera();
  if (cam) {
    cam.position.set(
      _state.position.x,
      _state.position.y + _state.eyeHeight,
      _state.position.z
    );
  }
}

// ─────────────────────────────────────────────
// getPlayerState
// ─────────────────────────────────────────────
// Returns a shallow snapshot with LIVE references to position/velocity vectors.
// Callers must not mutate these — they are the player's authoritative state.
export function getPlayerState() {
  return {
    hp:              _state.hp,
    armor:           _state.armor,
    alive:           _state.alive,
    faction:         _state.faction,
    position:        _state.position,
    velocity:        _state.velocity,
    activeWeaponIdx: _state.activeWeaponIdx,
    isCrouched:      _state.isCrouched,
    eyeHeight:       _state.eyeHeight,
    onGround:        _state.onGround,
  };
}

// ─────────────────────────────────────────────
// takeDamage
// ─────────────────────────────────────────────
export function takeDamage(amount, isHeadshot) {
  if (!_state.alive) return;

  let dmg = isHeadshot ? amount * 2 : amount;

  // Armor absorbs damage first
  if (_state.armor > 0) {
    const absorbed = Math.min(_state.armor, dmg);
    _state.armor -= absorbed;
    dmg -= absorbed;
  }

  _state.hp -= dmg;

  audio.playPlayerHit();

  if (_state.hp <= 0) {
    _state.hp = 0;
    _state.alive = false;
    window.dispatchEvent(new Event('playerDied'));
  }
}

// ─────────────────────────────────────────────
// respawnPlayer
// ─────────────────────────────────────────────
export function respawnPlayer(spawnPoints) {
  _state.hp = 100;
  _state.armor = 0;
  _state.alive = true;
  _state.velocity.set(0, 0, 0);
  _state.lastFootstepAt = 0;

  const spawn = _pickSpawn(_state.faction, spawnPoints);
  if (spawn) {
    _state.position.copy(spawn.position ?? new THREE.Vector3(0, 0, 0));
  }

  _syncCamera();
}
