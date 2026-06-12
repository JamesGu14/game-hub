// tools/sim-economy.mjs — 真实经济模拟(与 levels-winnable 的「无限金钱满级」理论天花板互补):
// 用游戏真实系统(step/tryBuild/tryUpgrade)+ 贪心建塔 AI,在 startGold+击杀掉金的真实约束下跑关,
// 输出 胜负/剩余城防/逐波掉血,定位"理论可通关但实玩是墙"的关(2026-06-13 James L11 第15波重甲墙)。
// AI 策略(模拟合格玩家,确定性,不读未来波):
//   ①每条路先铺 1 座最便宜可负担将(覆盖该路采样点最多的空将位)
//   ②补塔到 TARGET=min(将位数, 路数×2+2):买得起的最贵编队将,放全局覆盖最高空位
//   ③之后金币全部用于升级(优先覆盖分最高的塔)
//   prep 一律提前出兵(同 winnable,奖励封顶 30)。
// 用法: node tools/sim-economy.mjs [--levels 11,18] [--verbose]
import { newGameState } from '../src/core/gameState.js';
import { LEVELS } from '../src/data/levels.js';
import { step } from '../src/core/gameLoop.js';
import { tryBuild, tryUpgrade, canUpgrade, upgradeCost } from '../src/systems/economySystem.js';
import { GENERALS } from '../src/data/generals.js';
import { makeRng } from '../src/core/rng.js';
import { unlockedGenerals } from '../src/data/unlocks.js';

const PREMIUM_PRIORITY = ['huang', 'zhuge', 'guan', 'zhao', 'ma', 'zhang'];          // 同 winnable
const CHEAP_PRIORITY = ['liao', 'yueying', 'guanping', 'zhangbao', 'zhou', 'madai'];
function loadoutFor(levelId) {
  const un = unlockedGenerals({ unlockedLevel: levelId });
  return [...PREMIUM_PRIORITY.filter((id) => un.has(id)), ...CHEAP_PRIORITY.filter((id) => un.has(id))].slice(0, 6);
}

// 路采样(0.25 步,同 verify 口径)→ 将位覆盖分(基础射程 3.0 格,够相对排序用)
function samplePath(path) {
  const pts = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(segLen / 0.25));
    for (let k = 0; k < n; k++) pts.push({ x: a.x + (b.x - a.x) * (k / n), y: a.y + (b.y - a.y) * (k / n) });
  }
  pts.push(path[path.length - 1]);
  return pts;
}
function coverageTable(level) {
  const lanes = Object.keys(level.paths);
  const samples = Object.fromEntries(lanes.map((id) => [id, samplePath(level.paths[id])]));
  const R = 3.0;
  return level.slots.map((sl) => {
    const cx = sl.x + 0.5, cy = sl.y + 0.5;
    const perLane = {};        // 路 → 进度加权覆盖分(末端近城权重高:守汇聚点=人类打法)
    let total = 0;
    for (const id of lanes) {
      const pts = samples[id];
      let w = 0;
      for (let i = 0; i < pts.length; i++) {
        if (Math.hypot(pts[i].x - cx, pts[i].y - cy) <= R) w += 0.3 + 0.7 * (i / pts.length);
      }
      perLane[id] = w; total += w;
    }
    return { slot: sl, perLane, total };
  });
}

function simLevel(level, { verbose = false } = {}) {
  const squad = loadoutFor(level.id);
  const cheapFirst = [...squad].sort((a, b) => GENERALS[a].cost - GENERALS[b].cost);
  let richFirst = [...squad].sort((a, b) => GENERALS[b].cost - GENERALS[a].cost);
  // 本关有装甲兵(heavy/tengjia)→ 反甲将(火/谋略)提到第2-3位优先落地(人类看到重甲会补克制塔)
  const hasArmor = level.waves.some((w) => w.spawns.some((sp) => sp.enemyType === 'heavy' || sp.enemyType === 'tengjia'));
  if (hasArmor) {
    const anti = richFirst.filter((g) => ['fire', 'strategy'].includes(GENERALS[g].dmgType));
    const rest = richFirst.filter((g) => !anti.includes(g));
    richFirst = [rest[0], ...anti, ...rest.slice(1)].filter(Boolean);
  }
  const cov = coverageTable(level);
  const lanes = Object.keys(level.paths);
  const TARGET = Math.min(level.slots.length, lanes.length * 2 + 2);

  const s = newGameState(level, { unlocked: unlockedGenerals({ unlockedLevel: level.id }) });
  s.rng = makeRng(level.id);

  const slotKey = (sl) => `${sl.x},${sl.y}`;
  const used = new Set();
  const freeCov = () => cov.filter((c) => !used.has(slotKey(c.slot)));
  const build = (gid, entry) => {
    if (entry && tryBuild(s, entry.slot, gid)) { used.add(slotKey(entry.slot)); return true; }
    return false;
  };
  const coveredLanes = () => {
    const got = new Set();
    for (const t of s.towers) {
      const e = cov.find((c) => c.slot.x === t.slot.x && c.slot.y === t.slot.y);
      if (e) for (const id of lanes) if (e.perLane[id] > 0) got.add(id);
    }
    return got;
  };

  // 当前/即将到来波的活跃路(人类反应式打法:敌从哪来往哪补防)
  const activeLanes = () => {
    const w = level.waves[Math.min(s.waveIndex, level.waves.length - 1)];
    return new Set(w ? w.spawns.map((sp) => sp.pathId) : []);
  };
  const score = (entry, act) => {
    let a = 0;
    for (const id of act) a += entry.perLane[id] || 0;
    return entry.total + 1.5 * a;                 // 全局覆盖 + 活跃路加权
  };

  const rankedTowers = (act) => [...s.towers].map((t) => ({
    t, sc: score(cov.find((c) => c.slot.x === t.slot.x && c.slot.y === t.slot.y) || { perLane: {}, total: 0 }, act),
  })).sort((a, b) => b.sc - a.sc);
  const buildOne = (act) => {
    const gid = richFirst.find((g) => s.gold >= GENERALS[g].cost);
    if (!gid) return false;
    const cands = freeCov().sort((a, b) => score(b, act) - score(a, act));
    return build(gid, cands[0]);
  };
  const upgradeOne = (act, capLv) => {
    for (const { t } of rankedTowers(act)) {
      if (t.level < capLv && canUpgrade(s, t) && s.gold >= upgradeCost(t)) { tryUpgrade(s, t); return true; }
    }
    return false;
  };

  function decide() {     // 返回 true=本次花了钱(调用方循环到花不动;人类=prep 一口气摆完)
    const act = activeLanes();
    // 人类节奏:①先有 2 座塔 ②主力塔冲 L3(升级性价比>摊大饼) ③扩到 TARGET ④全员升满 ⑤钱多继续填满将位
    if (s.towers.length < Math.min(2, TARGET) && buildOne(act)) return true;
    if (upgradeOne(act, 3)) return true;
    if (s.towers.length < TARGET && buildOne(act)) return true;
    if (upgradeOne(act, 99)) return true;
    return s.gold >= 500 && buildOne(act);   // 金额闸门:不让扩编稀释升级(后期盈余才填将位)
  }

  const hpAtWave = [];     // 每波开打时记录 [waveId, castleHp]
  let lastWave = -1;
  const guard = Math.max(400000, level.waves.length * 20000);
  let g = 0, tick = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && g < guard) {
    let acted = false;
    if (tick % 30 === 0) { let n = 0; while (decide() && ++n < 24) acted = true; }   // 每 0.5s 把能花的花完
    if (s.phase === 'prep' && tick % 30 === 0 && !acted) s.earlyRequested = true;    // 摆无可摆才提前出兵(人类节奏)
    if (s.waveIndex !== lastWave) { lastWave = s.waveIndex; hpAtWave.push([s.waveIndex + 1, s.castleHp]); }
    step(s, 1 / 60);
    g++; tick++;
  }
  // 掉血波 = 相邻记录 hp 差
  const dmgWaves = [];
  for (let i = 1; i < hpAtWave.length; i++) {
    const d = hpAtWave[i - 1][1] - hpAtWave[i][1];
    if (d > 0) dmgWaves.push(`w${hpAtWave[i - 1][0]}:-${d}`);
  }
  const finalDrop = hpAtWave.length ? hpAtWave[hpAtWave.length - 1][1] - s.castleHp : 0;
  if (finalDrop > 0) dmgWaves.push(`w${hpAtWave[hpAtWave.length - 1][0]}+:-${finalDrop}`);
  const lv = s.towers.map((t) => t.level).join('');
  return {
    id: level.id, phase: s.phase, castleHp: s.castleHp, waveReached: lastWave + 1, waves: level.waves.length,
    towers: s.towers.length, levels: lv, goldLeft: Math.round(s.gold), dmgWaves,
    timeline: verbose ? hpAtWave : null,
  };
}

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const lvArg = args[args.indexOf('--levels') + 1];
const only = args.includes('--levels') ? lvArg.split(',').map(Number) : null;

let lost = 0;
for (const level of LEVELS) {
  if (only && !only.includes(level.id)) continue;
  const r = simLevel(level, { verbose: VERBOSE });
  const mark = r.phase === 'won' ? 'ok ' : '✗✗ ';
  if (r.phase !== 'won') lost++;
  console.log(`${mark}L${String(r.id).padEnd(2)} ${r.phase.padEnd(4)} 城防${String(r.castleHp).padStart(3)}/20 波${String(r.waveReached).padStart(2)}/${r.waves} 塔${r.towers}[${r.levels}] 余金${String(r.goldLeft).padStart(4)} ${r.dmgWaves.join(' ')}`);
  if (VERBOSE && r.timeline) console.log('   timeline: ' + r.timeline.map(([w, hp]) => `w${w}=${hp}`).join(' '));
}
console.log(only ? '' : `—— 真实经济模拟:${LEVELS.length - lost}/${LEVELS.length} 过,${lost} 关失守 ——`);
