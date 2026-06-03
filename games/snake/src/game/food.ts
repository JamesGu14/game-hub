import { CONFIG } from '../config';
import { TAU, type Vec2 } from '../util/math';
import type { Snake } from './snake';

export interface Food {
  pos: Vec2;
  emoji: string;
  /** Length gained when eaten. */
  gain: number;
}

export interface ExpOrb {
  pos: Vec2;
  color: string;
  gain: number;
  /** Seconds remaining before decay. */
  ttl: number;
}

/**
 * 食物 + 经验球管理器。
 * - 普通食物维持 FOOD_COUNT 个常驻
 * - 经验球：蛇死亡时沿身体掉落，30s 后消失
 */
export class FoodManager {
  foods: Food[] = [];
  orbs: ExpOrb[] = [];

  fill(count: number = CONFIG.FOOD_COUNT): void {
    while (this.foods.length < count) this.foods.push(this.spawnOne());
  }

  spawnOne(): Food {
    const angle = Math.random() * TAU;
    const radius = Math.sqrt(Math.random()) * (CONFIG.WORLD_RADIUS - 50);
    const emoji =
      CONFIG.FOOD_EMOJIS[Math.floor(Math.random() * CONFIG.FOOD_EMOJIS.length)];
    return {
      pos: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
      emoji,
      gain: 1,
    };
  }

  /** Add a single food at the given world position (used by boost length drops). */
  addFoodAt(pos: Vec2): void {
    const emoji =
      CONFIG.FOOD_EMOJIS[Math.floor(Math.random() * CONFIG.FOOD_EMOJIS.length)];
    this.foods.push({ pos: { x: pos.x, y: pos.y }, emoji, gain: 1 });
  }

  /** Drop exp orbs along the snake's body. */
  dropOrbsFromSnake(snake: Snake): void {
    const segs = snake.getSegments();
    for (let i = 0; i < segs.length; i += CONFIG.EXP_ORB_EVERY_N_SEGMENTS) {
      this.orbs.push({
        pos: { x: segs[i].x, y: segs[i].y },
        color: snake.color,
        gain: CONFIG.EXP_ORB_GAIN,
        ttl: CONFIG.EXP_ORB_TTL,
      });
    }
  }

  decay(dt: number): void {
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      this.orbs[i].ttl -= dt;
      if (this.orbs[i].ttl <= 0) {
        const last = this.orbs.pop()!;
        if (i < this.orbs.length) this.orbs[i] = last;
      }
    }
  }

  tryEat(snake: Snake): number {
    let totalGain = 0;

    // Regular foods
    const foodDist = CONFIG.HEAD_RADIUS + CONFIG.FOOD_RADIUS;
    const foodDistSq = foodDist * foodDist;
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      const dx = f.pos.x - snake.pos.x;
      const dy = f.pos.y - snake.pos.y;
      if (dx * dx + dy * dy <= foodDistSq) {
        totalGain += f.gain;
        const last = this.foods.pop()!;
        if (i < this.foods.length) this.foods[i] = last;
      }
    }

    // Exp orbs
    const orbDist = CONFIG.HEAD_RADIUS + CONFIG.EXP_ORB_RADIUS;
    const orbDistSq = orbDist * orbDist;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      const dx = o.pos.x - snake.pos.x;
      const dy = o.pos.y - snake.pos.y;
      if (dx * dx + dy * dy <= orbDistSq) {
        totalGain += o.gain;
        const last = this.orbs.pop()!;
        if (i < this.orbs.length) this.orbs[i] = last;
      }
    }

    return totalGain;
  }
}
