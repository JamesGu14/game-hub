import { CONFIG } from '../config';
import type { Vec2 } from '../util/math';
import type { Snake } from './snake';
import type { SpatialHash } from './collision';

export interface Bullet {
  pos: Vec2;
  vx: number;
  vy: number;
  rangeLeft: number;
  owner: Snake;
  color: string;
  alive: boolean;
}

export type KillFn = (victim: Snake, killer: Snake | null) => void;

/**
 * 子弹系统：
 * - 限制每条蛇同时在场子弹数量
 * - 命中其他蛇头 = 击杀（owner 视为击杀者）
 * - 命中其他蛇身 = 子弹消失（无伤害）
 * - 不会误伤 owner 自己
 * - 出射程或出地图 = 消失
 * - 持盾的蛇免疫（碰到子弹时子弹直接消失）
 */
export class BulletManager {
  bullets: Bullet[] = [];
  private ownerCounts = new Map<Snake, number>();

  spawn(owner: Snake, pos: Vec2, angle: number): boolean {
    const count = this.ownerCounts.get(owner) ?? 0;
    if (count >= CONFIG.BULLET_MAX_PER_OWNER) return false;
    const speed = CONFIG.SNAKE_BASE_SPEED * CONFIG.BULLET_SPEED_MULTIPLIER;
    this.bullets.push({
      pos: { x: pos.x, y: pos.y },
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rangeLeft: CONFIG.BULLET_RANGE,
      owner,
      color: owner.color,
      alive: true,
    });
    this.ownerCounts.set(owner, count + 1);
    return true;
  }

  update(dt: number, hash: SpatialHash, killSnake: KillFn): void {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      const prevX = b.pos.x;
      const prevY = b.pos.y;
      b.pos.x += b.vx * dt;
      b.pos.y += b.vy * dt;
      const moved = Math.hypot(b.pos.x - prevX, b.pos.y - prevY);
      b.rangeLeft -= moved;

      // World boundary
      if (Math.hypot(b.pos.x, b.pos.y) > CONFIG.WORLD_RADIUS) {
        b.alive = false;
        continue;
      }
      // Range exhausted
      if (b.rangeLeft <= 0) {
        b.alive = false;
        continue;
      }

      // Hit detection
      let victim: Snake | null = null;
      let bodyHit = false;
      hash.forEachInRadius(b.pos, CONFIG.BULLET_HIT_RADIUS, (ref) => {
        if (ref.snake === b.owner) return false;
        if (!ref.snake.alive) return false;
        if (ref.snake.invincibleTimer > 0) return false;
        if (ref.snake.hasShield) {
          bodyHit = true;
          return false;
        }
        if (ref.index === 0) {
          victim = ref.snake;
          return true;
        }
        bodyHit = true;
        return false;
      });

      if (victim) {
        killSnake(victim, b.owner);
        b.alive = false;
      } else if (bodyHit) {
        b.alive = false;
      }
    }

    // Sweep dead bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      if (this.bullets[i].alive) continue;
      const owner = this.bullets[i].owner;
      this.ownerCounts.set(owner, Math.max(0, (this.ownerCounts.get(owner) ?? 0) - 1));
      const last = this.bullets.pop()!;
      if (i < this.bullets.length) this.bullets[i] = last;
    }
  }

  /** Remove all bullets owned by snake (used when snake dies). */
  clearOwner(owner: Snake): void {
    for (const b of this.bullets) {
      if (b.owner === owner) b.alive = false;
    }
    this.ownerCounts.set(owner, 0);
  }
}
