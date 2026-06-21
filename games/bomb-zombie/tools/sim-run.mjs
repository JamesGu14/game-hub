// sim-run.mjs — 平衡模拟器（本游戏专属）。用 headless Game 跑整局。
// 不止判「能不能赢」，还测「有没有难度」：competent(会选攻击卡) 与 greedy(乱选) 两种打法 +
// 全程城墙最低血量百分比 minWallPct（越低=越惊险）。门禁: competent 必须 10/10 通关(可玩);
// 难度信号: 越往后 minWallPct 应越低; greedy 在后段应被打到很低甚至失败(说明有牙)。
import { Game } from '../src/game.js';
import { LEVELS } from '../src/levels.js';
import { CARD_POOL } from '../src/cards.js';
import { rngFrom } from '../src/util.js';

const CARD = Object.fromEntries(CARD_POOL.map((c) => [c.id, c]));

// competent 玩家的选卡评分：进化>多重>伤害>射速>穿透>暴击>溅射>元素>速度；城墙吃紧时补防御。
function scoreCard(id, wallLow) {
  const c = CARD[id];
  if (!c) return 2;                       // 兜底卡 __gold__/__xp__/__heal__
  if (c.evoFrom) return 100;              // 进化卡永远优先
  let s = 0;
  for (const [k, v] of Object.entries(c.mod || {})) {
    if (k === 'multishotAdd') s += v * 45;
    else if (k === 'damagePct') s += v * 60;
    else if (k === 'fireRatePct') s += v * 50;
    else if (k === 'pierceAdd') s += v * 18;
    else if (k === 'critRatePct') s += v * 10;
    else if (k === 'critMultAdd') s += v * 12;
    else if (k === 'splashAdd') s += v * 2;
    else if (k === 'burnDps' || k === 'poisonDps') s += v * 2.5;
    else if (k === 'bulletSpeedPct') s += v * 6;
    else if (k === 'wallHpPct') s += v * (wallLow ? 80 : 12);
    else if (k === 'wallRegen') s += v * (wallLow ? 8 : 2);
    else s += v * 1;                      // xpPct/goldPct/其它
  }
  return s;
}

function pick(g, strategy) {
  const cards = g.pendingCards;
  if (strategy === 'greedy') return cards[0];
  const wallLow = g.wall.hp / g.wall.maxHp < 0.5;
  let best = cards[0], bs = -Infinity;
  for (const id of cards) { const sc = scoreCard(id, wallLow); if (sc > bs) { bs = sc; best = id; } }
  return best;
}

function simLevel(index, seed, strategy) {
  const g = new Game(rngFrom(seed));
  g.startLevel(index);
  let t = 0, levelUps = 0, minWall = 1; const dt = 1 / 60, maxT = 180;
  while (t < maxT) {
    g.update(dt);
    if (g.wall) minWall = Math.min(minWall, g.wall.hp / g.wall.maxHp);
    if (g.state === 'cardpick') { levelUps++; g.chooseCard(pick(g, strategy)); }
    else if (g.state === 'levelclear' || g.state === 'win') return { result: 'win', levelUps, t, minWall };
    else if (g.state === 'gameover') return { result: 'lose', levelUps, t, minWall: 0 };
    t += dt;
  }
  return { result: 'timeout', levelUps, t, minWall };
}

// 取多种子里最差(最低 minWall / 非胜优先)
function worstOf(index, strategy) {
  let worst = null;
  for (const seed of [1, 7, 42, 99, 123]) {
    const r = simLevel(index, seed, strategy);
    if (!worst) { worst = r; continue; }
    const rBad = r.result !== 'win', wBad = worst.result !== 'win';
    if ((rBad && !wBad) || (rBad === wBad && r.minWall < worst.minWall)) worst = r;
  }
  return worst;
}

console.log('=== 向僵尸开炮 第1章 平衡模拟（competent / greedy，minWall=全程城墙最低血%）===');
let cFails = 0, tooEasy = 0;
for (let i = 0; i < LEVELS.length; i++) {
  const c = worstOf(i, 'competent');
  const gd = worstOf(i, 'greedy');
  if (c.result !== 'win') cFails++;
  // 难度判定：competent 打完城墙还很满 = 太松。早关阈值松、后关严。
  const easyThreshold = i < 3 ? 0.80 : i < 6 ? 0.65 : 0.50;
  const easy = c.result === 'win' && c.minWall > easyThreshold;
  if (easy) tooEasy++;
  const tag = c.result === 'win' ? (easy ? '🟢易' : '✅') : '❌';
  const pct = (x) => (x * 100).toFixed(0) + '%';
  console.log(
    `${tag} 关${LEVELS[i].id} ${LEVELS[i].name.padEnd(5)}: competent ${c.result}(minWall ${pct(c.minWall)},升${c.levelUps}) | greedy ${gd.result}(minWall ${pct(gd.minWall)})`,
  );
}
console.log('');
console.log(cFails === 0 ? 'competent 全可通关 ✅（可玩门禁达成）' : `competent ${cFails} 关不可通关 ❌（不可玩，必须修）`);
console.log(tooEasy === 0 ? '难度合格：competent 各关都被打到有压力 ✅' : `⚠️ ${tooEasy} 关偏松（competent 通关时城墙仍高于阈值）—— 需加压`);
process.exit(cFails === 0 ? 0 : 1);
