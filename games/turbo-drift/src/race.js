// games/turbo-drift/src/race.js
import { wrap } from './util/math.js';

export const progress = (r, trackLen) => r.lap * trackLen + wrap(r.z, trackLen);

export function rank(racers, trackLen) {
  return [...racers]
    .sort((a, b) => progress(b, trackLen) - progress(a, trackLen))
    .map(r => r.id);
}

// 圈数由单调递增的里程 z 直接推导（z 永远前进、从不回绕）。lap 不回退。
export function updateLap(racer, trackLen) {
  const lap = Math.max(racer.lap, Math.floor(racer.z / trackLen));
  return { ...racer, lap, _prevZ: racer.z };
}

export function place(racers, trackLen, id) {
  return rank(racers, trackLen).indexOf(id) + 1;
}

export class RaceClock {
  constructor(countdownSec) {
    this.phase = 'countdown';
    this.countdown = countdownSec;
    this.elapsedMs = 0;
  }
  tick(dt) {
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.phase = 'racing';
    } else if (this.phase === 'racing') {
      this.elapsedMs += dt * 1000;
    }
    return this.phase;
  }
}
