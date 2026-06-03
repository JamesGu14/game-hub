// Pure ballistic integration. No DOM. gravity & wind are accelerations (px/s^2).
export function stepBallistic(s, dt, gravity, wind) {
  const vx = s.vx + wind * dt;
  const vy = s.vy + gravity * dt;
  return { x: s.x + vx * dt, y: s.y + vy * dt, vx, vy };
}

// Trace a trajectory until hitTest(x,y)->true or maxSteps. Returns {points, last, hit}.
export function simulate(start, vel, { gravity, wind, dt, maxSteps }, hitTest) {
  let s = { x: start.x, y: start.y, vx: vel.x, vy: vel.y };
  const points = [{ x: s.x, y: s.y }];
  for (let i = 0; i < maxSteps; i++) {
    s = stepBallistic(s, dt, gravity, wind);
    points.push({ x: s.x, y: s.y });
    if (hitTest(s.x, s.y)) return { points, last: s, hit: true };
  }
  return { points, last: s, hit: false };
}
