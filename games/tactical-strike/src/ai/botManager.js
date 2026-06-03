import * as THREE from 'three';
import { getScene, getMapBoundingBoxes } from '../engine/scene.js';
import { checkAABB } from '../engine/collision.js';
import { getWaypoints } from './waypoints.js';
import { createBot, updateBot, botTakeDamage } from './bot.js';

const BOT_SPAWN_RADIUS = 0.5;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------
let _bots = [];
let _aliveMeshes = []; // cached alive bot meshes; rebuilt only on spawn/death
let _difficulty = 'normal';
let _opposingFaction = 'T';
let _applyPlayerDamage = null;
let _allDefeatedDispatched = false;

// ---------------------------------------------------------------------------
// Spawn position tables
// ---------------------------------------------------------------------------
// Warehouse map spawns.
// T spawns: east end (attackers); CT spawns: west end (defenders)
const SPAWN_POSITIONS_T = [
  new THREE.Vector3( 27, 0, -3),
  new THREE.Vector3( 27, 0,  0),
  new THREE.Vector3( 27, 0,  3),
  new THREE.Vector3( 24, 0, -5),
  new THREE.Vector3( 24, 0,  5),
];

const SPAWN_POSITIONS_CT = [
  new THREE.Vector3(-27, 0, -3),
  new THREE.Vector3(-27, 0,  0),
  new THREE.Vector3(-27, 0,  3),
  new THREE.Vector3(-24, 0, -5),
  new THREE.Vector3(-24, 0,  5),
];

const DIFFICULTY_BOT_COUNT = { tutorial: 2, easy: 3, normal: 4, hard: 5 };

// ---------------------------------------------------------------------------
// initBots
// ---------------------------------------------------------------------------
/**
 * @param {number|null} n            — override bot count; null = use difficulty default
 * @param {'easy'|'normal'|'hard'} difficulty
 * @param {'CT'|'T'} opposingFaction
 * @param {(damage:number, isHeadshot:boolean)=>void} applyPlayerDamageFn
 */
export function initBots(n, difficulty, opposingFaction, applyPlayerDamageFn) {
  resetBots();

  _difficulty          = difficulty || 'normal';
  _opposingFaction     = opposingFaction || 'T';
  _applyPlayerDamage   = applyPlayerDamageFn;

  const count = (n != null && n > 0)
    ? n
    : (DIFFICULTY_BOT_COUNT[_difficulty] || 4);

  const spawnPool = _opposingFaction === 'T' ? SPAWN_POSITIONS_T : SPAWN_POSITIONS_CT;
  const waypoints = getWaypoints();
  const scene     = getScene();

  const mapBoxes = getMapBoundingBoxes() || [];

  for (let i = 0; i < count; i++) {
    const spawnPos = spawnPool[i % spawnPool.length].clone();
    // Very small jitter so bots don't stack
    spawnPos.x += (Math.random() - 0.5) * 0.4;
    spawnPos.z += (Math.random() - 0.5) * 0.4;

    // Safety: push spawn out of any wall the jitter pushed it into
    if (mapBoxes.length > 0) {
      const corrected = checkAABB(spawnPos, BOT_SPAWN_RADIUS, 1.5, mapBoxes);
      spawnPos.copy(corrected);
    }

    const bot = createBot(spawnPos, _opposingFaction);

    // Flanking: alternate north/south squad assignments
    bot.squad = i % 2;

    // Spread starting waypoint so bots don't all follow the same path
    bot.currentWaypointIdx = i % waypoints.length;

    scene.add(bot.mesh);
    _bots.push(bot);
    _aliveMeshes.push(bot.mesh);
  }
}

// ---------------------------------------------------------------------------
// updateBots
// ---------------------------------------------------------------------------
/**
 * @param {number} delta       — seconds
 * @param {THREE.Vector3} playerPos
 * @param {THREE.Box3[]} mapBoxes
 */
export function updateBots(delta, playerPos, mapBoxes) {
  const waypoints = getWaypoints();

  for (const bot of _bots) {
    if (!bot.alive) continue;
    updateBot(bot, delta, playerPos, mapBoxes, waypoints, _difficulty, _applyPlayerDamage);
  }

  // Check all-defeated condition
  if (!_allDefeatedDispatched && _bots.length > 0 && _bots.every(b => !b.alive)) {
    _allDefeatedDispatched = true;
    window.dispatchEvent(new CustomEvent('allBotsDefeated'));
  }
}

// ---------------------------------------------------------------------------
// resetBots
// ---------------------------------------------------------------------------
export function resetBots() {
  const scene = getScene();
  for (const bot of _bots) {
    if (bot.mesh && bot.mesh.parent) {
      scene && scene.remove(bot.mesh);
    }
  }
  _bots = [];
  _aliveMeshes = [];
  _allDefeatedDispatched = false;
}

// ---------------------------------------------------------------------------
// getAliveCount
// ---------------------------------------------------------------------------
export function getAliveCount() {
  return _aliveMeshes.length;
}

// Returns root meshes of alive bots (for player raycast). Live reference —
// callers may iterate but must not mutate the array.
export function getBotMeshes() {
  return _aliveMeshes;
}

export function damageBotByMesh(meshRoot, amount) {
  for (const bot of _bots) {
    if (bot.alive && bot.mesh === meshRoot) {
      const died = botTakeDamage(bot, amount);
      if (died) {
        const i = _aliveMeshes.indexOf(meshRoot);
        if (i !== -1) _aliveMeshes.splice(i, 1);
      }
      return died;
    }
  }
  return false;
}
