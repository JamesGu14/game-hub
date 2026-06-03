// games/turbo-drift/src/ai.js
import { AI, PHYSICS } from './config.js';
import { clamp, lerp } from './util/math.js';

// 玩家落后 → 领先的 AI 减速等待；玩家领先 → 落后的 AI 加速追赶
export function rubberMul(aiProgress, playerProgress, cfg) {
  const diff = playerProgress - aiProgress; // >0: 玩家领先该 AI
  if (Math.abs(diff) < cfg.rubberDeadZone) return 1;
  if (diff > 0) return cfg.rubberBehindBoost; // 此 AI 落后 → 加速
  return cfg.rubberAheadEase;                 // 此 AI 领先 → 减速
}

// 理想走线：朝弯内切，限制在路面内
export function aiTargetX(curve) {
  return clamp(curve * 0.28, -0.9, 0.9);
}

export function stepAI(state, ctx, dt) {
  let { z, x, speed, spinTimer } = state;
  const car = ctx.car;
  const top = PHYSICS.maxSpeed * car.top * rubberMul(ctx.aiProgress, ctx.playerProgress, AI);

  if (spinTimer > 0) {
    spinTimer = Math.max(0, spinTimer - dt);
    speed = Math.max(PHYSICS.cruise * 0.4, speed - PHYSICS.brake * 1.2 * dt);
    z += speed * dt;
    return { z, x, speed, spinTimer };
  }

  const corner = 1 - Math.min(0.25, Math.abs(ctx.curve) * 0.05); // 过弯轻微减速
  speed += PHYSICS.accel * car.accel * dt;
  speed = clamp(speed, PHYSICS.cruise, top * corner);

  const target = aiTargetX(ctx.curve);
  x = lerp(x, target, Math.min(1, 3 * dt));
  z += speed * dt;
  return { z, x, speed, spinTimer };
}
