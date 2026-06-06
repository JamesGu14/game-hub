// systems/combat/projectileManager.js — 纯表现弹道：开火产轨迹（对象池），按 ttl 老化。
import { makePool } from '../../core/pool.js';
import { newProjectile, resetProjectile } from '../../entities/projectile.js';

const pool = makePool(newProjectile, resetProjectile);

export function spawnTracer(state, tower, enemy, color) {
  state.projectiles.push(pool.acquire(tower.px, tower.py, enemy.px, enemy.py, color));
}

export function updateProjectiles(state, dt) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.ttl -= dt;
    if (p.ttl <= 0) { state.projectiles.splice(i, 1); pool.release(p); }
  }
}
