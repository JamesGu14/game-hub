// core/gameLoop.js — 固定步长循环 + [P0-1] 累加器封顶 + visibility 重置 + [P0-3] 相位守卫 + [N1] 步末 flush。
// 单一时钟：速度倍率经 dt*speed 注入，各系统不各自乘 speed。render 不在 step 内（逻辑/渲染解耦）。
import { BAL } from '../data/balance.js';
import { bus } from './eventBus.js';
import { waveSystem } from '../systems/waveSystem.js';
import { pathSystem } from '../systems/pathSystem.js';
import { bossSystem } from '../systems/bossSystem.js';
import { targetingSystem } from '../systems/targetingSystem.js';
import { combatSystem } from '../systems/combatSystem.js';
import { statusSystem } from '../systems/statusSystem.js';
import { economySystem } from '../systems/economySystem.js';
import { victorySystem } from '../systems/victorySystem.js';
import { updateProjectiles } from '../systems/combat/projectileManager.js';

export function step(state, dt) {
  state.time += dt;
  if (state.phase === 'won' || state.phase === 'lost') { bus.flush(); return; }
  waveSystem(state, dt);          // prep & combat（自身判相位）
  pathSystem(state, dt);          // ↓ 各系统入口 if(phase!=='combat')return
  bossSystem(state, dt);          // [P3] 司马懿召兵/震将（targeting 前：召出兵当帧可被锁）
  targetingSystem(state, dt);
  combatSystem(state, dt);
  statusSystem(state, dt);        // [P2] 灼烧 DoT / 治疗 / 净值 / DoT 致死
  economySystem(state, dt);
  victorySystem(state, dt);
  cleanup(state, dt);             // housekeeping
  bus.flush();                    // [N1/P0-2] 步末统一派发通知
}

function cleanup(state, dt) {
  if (state.enemies.length) state.enemies = state.enemies.filter((e) => e.alive);
  updateProjectiles(state, dt);
  for (let i = state.fx.length - 1; i >= 0; i--) {
    state.fx[i].ttl -= dt;
    if (state.fx[i].ttl <= 0) state.fx.splice(i, 1);
  }
}

// 把「按真实帧时长推进固定步」抽成可测纯逻辑（含 [P0-1] 封顶）。
export function advance(state, frameDtSec, stepFn = step) {
  state._acc = Math.min((state._acc || 0) + frameDtSec * state.speed, BAL.FIXED_DT * BAL.MAX_STEPS);
  let n = 0;
  while (state._acc >= BAL.FIXED_DT) { stepFn(state, BAL.FIXED_DT); state._acc -= BAL.FIXED_DT; n++; }
  return n;
}

export function makeLoop(state, render, isActive = () => true) {
  let last = 0, raf = 0, running = false;
  state._acc = 0;
  function frame(now) {
    if (!running) return;
    // [P4] 非游戏屏(选关/结算)或暂停 → 不推进模拟,仅渲染。
    if (!isActive() || state.paused) { last = now; render(state); raf = requestAnimationFrame(frame); return; }
    const frameDt = (now - last) / 1000; last = now;
    advance(state, frameDt);
    render(state);
    raf = requestAnimationFrame(frame);
  }
  return {
    start() { running = true; last = performance.now(); state._acc = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    onVisible() { if (!document.hidden) { state._acc = 0; last = performance.now(); } }, // [P0-1]
  };
}
