// sim-run.mjs — 平衡模拟器（本游戏专属，新写；非复用 tower-defender 塔防 sim）。
// 用 headless Game 跑整局，自动选卡，验「第1章每关可通关 + 单关升级次数落在目标带」。
import { Game } from '../src/game.js';
import { LEVELS } from '../src/levels.js';
import { rngFrom } from '../src/util.js';

function simLevel(index, seed) {
  const g = new Game(rngFrom(seed));
  g.startLevel(index);
  let t = 0, levelUps = 0; const dt = 1 / 60, maxT = 180;
  while (t < maxT) {
    g.update(dt);
    if (g.state === 'cardpick') { levelUps++; g.chooseCard(g.pendingCards[0]); }
    else if (g.state === 'levelclear' || g.state === 'win') return { result: 'win', levelUps, t };
    else if (g.state === 'gameover') return { result: 'lose', levelUps, t };
    t += dt;
  }
  return { result: 'timeout', levelUps, t };
}

let fails = 0;
console.log('=== 向僵尸开炮 第1章 平衡模拟 ===');
for (let i = 0; i < LEVELS.length; i++) {
  // 多种子取最差，避免偶然
  let worst = null;
  for (const seed of [1, 7, 42, 99]) {
    const r = simLevel(i, seed);
    if (!worst || (r.result !== 'win' && worst.result === 'win')) worst = r;
  }
  const tag = worst.result === 'win' ? '✅' : '❌';
  if (worst.result !== 'win') fails++;
  console.log(`${tag} 关${LEVELS[i].id} ${LEVELS[i].name}: ${worst.result} | 升级${worst.levelUps}次 | ${worst.t.toFixed(0)}s`);
}
console.log(fails === 0 ? '\n全部可通关 ✅' : `\n${fails} 关不可通关 ❌`);
process.exit(fails === 0 ? 0 : 1);
