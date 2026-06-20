// spawn.js — 波次调度。把 wave 脚本按时间吐成 enemy。纯逻辑（注入 rng）。
import { makeEnemy } from './enemies.js';
import { LANES } from './config.js';

export function makeSpawner(waves, rng) {
  // 展平成有序队列：每只怪记录其触发时间（绝对秒）。
  const queue = [];
  let t = 0;
  for (const w of waves) {
    t += w.startDelay || 0;
    let waveT = t, maxGroup = 0;
    for (const g of w.enemies) {
      let gt = waveT;
      for (let i = 0; i < g.count; i++) {
        queue.push({ time: gt, type: g.type, lane: w.lane });
        gt += g.interval;
      }
      maxGroup = Math.max(maxGroup, gt - waveT);
    }
    t = waveT + maxGroup;   // 下波接在本波最长组之后
  }
  queue.sort((a, b) => a.time - b.time);
  return { queue, idx: 0, clock: 0, rng, nextId: 1 };
}

export function tickSpawner(sp, dt) {
  sp.clock += dt;
  const out = [];
  while (sp.idx < sp.queue.length && sp.queue[sp.idx].time <= sp.clock) {
    const item = sp.queue[sp.idx++];
    const lane = Number.isInteger(item.lane) ? item.lane : Math.floor(sp.rng() * LANES);
    out.push(makeEnemy(item.type, lane, sp.nextId++));
  }
  return out;
}

export const spawnerDrained = (sp) => sp.idx >= sp.queue.length;
export const isLevelComplete = (sp, live) => spawnerDrained(sp) && live.length === 0;
