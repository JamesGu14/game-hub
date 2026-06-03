// games/turbo-drift/src/player.js
import { PHYSICS, NITRO, DRIFT } from './config.js';
import { clamp, lerp } from './util/math.js';

// 单步推进玩家。返回新的 state（不可变更原对象）。
export function stepPlayer(state, input, ctx, dt) {
  let { z, x, speed, spinTimer } = state;
  const car = ctx.car;
  const baseTop = PHYSICS.maxSpeed * car.top;
  const top = input.nitro ? baseTop * NITRO.speedMul : baseTop;
  const topEff = ctx.onRoad ? top : top * PHYSICS.offRoadMul;

  if (spinTimer > 0) {
    spinTimer = Math.max(0, spinTimer - dt);
    speed = Math.max(PHYSICS.cruise * 0.4, speed - PHYSICS.brake * 1.4 * dt);
    z += speed * dt;
    return { z, x, speed, spinTimer };
  }

  // 纵向：油门加速 / 松油回落到巡航底速（绝不熄火）
  const accel = PHYSICS.accel * car.accel * (input.nitro ? NITRO.accelMul : 1);
  if (input.throttle) {
    speed += accel * dt;
  } else {
    if (speed > PHYSICS.cruise) speed -= PHYSICS.brake * 0.35 * dt;
    else speed += PHYSICS.accel * 0.5 * dt;
  }
  speed = clamp(speed, PHYSICS.cruise, topEff); // 巡航底速：松油也不低于 cruise（绝不熄火）

  // 横向：平滑的车头朝向 steerAngle（也用于渲染让车头可见旋转）→ 朝车头方向横移
  const steerAngle = lerp(state.steerAngle ?? 0, input.steer, Math.min(1, 10 * dt));
  const speedRatio = speed / baseTop;
  const driftMul = input.drifting ? DRIFT.steerBoost : 1;
  let dx = steerAngle * PHYSICS.steer * driftMul * speedRatio * dt;   // 朝车头方向横移
  dx -= ctx.curve * PHYSICS.centrifugal * speed * dt;                 // 弯道离心：把车拉向弯外（需朝弯内打方向跟住）
  if (ctx.assist) {
    dx += ctx.curve * PHYSICS.centrifugal * speed * PHYSICS.assistSteer * dt; // 轻度辅助
    if (Math.abs(input.steer) < 0.1) dx -= x * (PHYSICS.recenter || 0) * dt;  // 松方向温和回正
  }
  dx *= (2 - car.grip);                                              // 抓地差→更滑
  x = clamp(x + dx, -0.98, 0.98);                                    // 收紧边界：按死方向最多到路沿就停，永远飞不出去
  if (Math.abs(x) > 0.92) x -= Math.sign(x) * 1.2 * dt;              // 接近路沿时温和往回带，避免一直贴边
  z += speed * dt;
  return { z, x, speed, spinTimer, steerAngle };
}

export function chargeToTier(charge) {
  const th = DRIFT.tierThresholds;
  if (charge >= th[2]) return 3;
  if (charge >= th[1]) return 2;
  if (charge >= th[0]) return 1;
  return 0;
}

// 漂移步进：返回 { state:{charge,active}, released:{tier,nitroDur}|null }
export function driftStep(drift, input, dt) {
  const engaging = input.drifting && Math.abs(input.steer) >= DRIFT.enterSteer;
  if (engaging) {
    const charge = Math.min(DRIFT.maxCharge, drift.charge + DRIFT.chargeRate * dt);
    return { state: { charge, active: true }, released: null };
  }
  if (drift.active) {
    const tier = chargeToTier(drift.charge);
    return { state: { charge: 0, active: false }, released: { tier, nitroDur: NITRO.durationByTier[tier] } };
  }
  return { state: { charge: 0, active: false }, released: null };
}
