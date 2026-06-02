// Shared combat helpers for 丛林尖兵 JUNGLE BLITZ.
import { ENEMY_BULLET } from '../config.js';

// Spawn a single enemy bullet from (fromX,fromY) aimed at (toX,toY).
// `overrides` can tweak any bullet field (speed/dmg/color/kind/...).
export function spawnAimedBullet(bullets, fromX, fromY, toX, toY, overrides = {}) {
  const ddx = toX - fromX;
  const ddy = toY - fromY;
  const len = Math.hypot(ddx, ddy) || 1;
  bullets.spawn({
    x: fromX, y: fromY,
    dx: ddx / len, dy: ddy / len,
    speed: ENEMY_BULLET.speed,
    dmg: 1,
    faction: 'enemy',
    kind: 'normal',
    color: ENEMY_BULLET.color,
    ...overrides,
  });
}
