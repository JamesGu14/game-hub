import { WORM } from './config.js';
export function makeWorm(id, team, x, y) {
  return { id, team, x, y, vx: 0, vy: 0, hp: WORM.hpMax, facing: team === 0 ? 1 : -1, alive: true, onGround: false };
}
export function makeTeam(id, name, color, isAI, worms, ammo = {}) {
  return { id, name, color, isAI, worms, ammo };
}
