// tools/play-through.mjs — 自适应通关器("熟练玩家"档,与 sim-economy 的固定贪心档夹逼出人类难度带):
// 真实引擎(step/tryBuild/tryUpgrade)+真实经济,决策层模拟会玩的人:
//   · 威胁识别:按本关全波次构成(类型×数量×HP×抗性)给各将算"对位效率",优先建克制将
//   · 反制建塔:读即将到来的波(打过一遍的玩家都知道),装甲路补火/谋略,飞兵关在"营→城直线"上补防空
//   · 目标模式:方士波→快攻塔切「最弱」点杀;boss/副将波→重炮塔切「最强」;平时「最前」
//   · 布位:路径进度加权覆盖(守汇聚点)+ 高台射程加成计入 + 飞兵直线覆盖单算
//   · 花钱节奏:prep 购满→提前出兵;主力先 L3 → 铺到 TARGET → 升满 L5 → 盈余填将位
// 不做:卖塔套利/逐关硬编码脚本(那是作弊,不是平衡测试)。
// 用法: node tools/play-through.mjs [--levels 25,28] [--verbose]
import { newGameState } from '../src/core/gameState.js';
import { LEVELS } from '../src/data/levels.js';
import { step } from '../src/core/gameLoop.js';
import { tryBuild, tryUpgrade, canUpgrade, upgradeCost } from '../src/systems/economySystem.js';
import { GENERALS, towerStats } from '../src/data/generals.js';
import { ENEMIES } from '../src/data/enemies.js';
import { rangeBonusFor } from '../src/systems/terrainSystem.js';
import { makeRng } from '../src/core/rng.js';
import { unlockedGenerals } from '../src/data/unlocks.js';

const PREMIUM = ['huang', 'zhuge', 'guan', 'zhao', 'ma', 'zhang'];
const CHEAP = ['liao', 'yueying', 'guanping', 'zhangbao', 'zhou', 'madai'];
const ARMOR = new Set(['heavy', 'tengjia']);

function loadoutFor(levelId) {
  // 全部已解锁将(≤12):游戏建造栏本就全开放,6人编队是winnable测试惯例非玩法限制——
  // 真人后期照样用廖化/关平等便宜将铺早期多路身位
  const un = unlockedGenerals({ unlockedLevel: levelId });
  return [...PREMIUM.filter((id) => un.has(id)), ...CHEAP.filter((id) => un.has(id))];
}

// —— 威胁画像:本关全波次 类型→有效HP占比(数量×HP,boss 按 hpMult) ——
function threatProfile(level) {
  const w = {};
  for (const wave of level.waves) for (const sp of wave.spawns) {
    const e = ENEMIES[sp.enemyType];
    const hp = e.hp * (sp.hpMult || 1);
    w[sp.enemyType] = (w[sp.enemyType] || 0) + sp.count * hp;
  }
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(w)) w[k] /= total;
  return w;   // { footman:0.4, heavy:0.2, flyer:0.1, ... }
}

// 将 vs 类型 的伤害效率(抗性×对空可达×攻击形态近似)
function effMult(g, type) {
  const e = ENEMIES[type];
  if (e.flying && g.targets === 'ground') return 0;
  const resist = (e.resist && e.resist[g.dmgType]) ?? 1;
  return resist;
}
function dpsApprox(g) {
  const st = towerStats(g, 3);                       // 以 L3 为代表档
  let dps = g.attack === 'burn' ? st.dmg * 1.6 : st.dmg / st.interval;   // burn≈可叠~1.6层持续
  if (g.attack === 'splash') dps *= 1.7;             // 溅射/贯穿对密集流的近似乘子
  if (g.attack === 'charge') dps *= 1.6;
  return dps;
}
// 本关对位总分(建塔选将用)
function generalScore(g, profile) {
  let s = 0;
  for (const [type, share] of Object.entries(profile)) s += share * effMult(g, type) * dpsApprox(g);
  return s;
}

// —— 覆盖表:地面路(进度加权)+ 飞兵直线(营→城) ——
function samplePts(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.25));
    for (let k = 0; k < n; k++) out.push({ x: a.x + (b.x - a.x) * (k / n), y: a.y + (b.y - a.y) * (k / n) });
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function coverageTable(level) {
  const lanes = Object.keys(level.paths);
  const laneS = Object.fromEntries(lanes.map((id) => [id, samplePts(level.paths[id])]));
  const cc = { x: level.castle.c + level.castle.w / 2, y: level.castle.r + level.castle.h / 2 };
  const flyS = Object.fromEntries(level.camps.map((cp) => [cp.id, samplePts([{ x: cp.c + 0.5, y: cp.r + 0.5 }, cc])]));   // 营坐标是 {c,r}(列/行)!
  return level.slots.map((sl) => {
    const cx = sl.x + 0.5, cy = sl.y + 0.5;
    const R = 3.0 + rangeBonusFor(level, sl);        // 高台加成计入布位价值
    const perLane = {}, perFly = {};
    let total = 0;
    for (const id of lanes) {
      let w = 0;
      const pts = laneS[id];
      for (let i = 0; i < pts.length; i++) if (Math.hypot(pts[i].x - cx, pts[i].y - cy) <= R) w += 0.3 + 0.7 * (i / pts.length);
      perLane[id] = w; total += w;
    }
    for (const [cid, pts] of Object.entries(flyS)) {
      let c = 0;
      for (const p of pts) if (Math.hypot(p.x - cx, p.y - cy) <= R) c++;
      perFly[cid] = c;
    }
    return { slot: sl, perLane, perFly, total };
  });
}

function playLevel(level, { verbose = false } = {}) {
  const squad = loadoutFor(level.id);
  const profile = threatProfile(level);
  const hasFly = !!profile.flyer, hasShaman = !!profile.shaman;
  const byScore = ABLATE.has('score')
    ? [...squad].sort((a, b) => GENERALS[b].cost - GENERALS[a].cost)
    : [...squad].sort((a, b) => generalScore(GENERALS[b], profile) - generalScore(GENERALS[a], profile));
  const antiAir = squad.filter((g) => GENERALS[g].targets === 'both');
  const antiArmor = squad.filter((g) => ['fire', 'strategy'].includes(GENERALS[g].dmgType));
  const bigGun = [...squad].sort((a, b) => towerStats(GENERALS[b], 3).dmg - towerStats(GENERALS[a], 3).dmg);
  const cov = coverageTable(level);
  const lanes = Object.keys(level.paths);
  const TARGET = Math.min(level.slots.length, lanes.length * 2 + 2);

  const s = newGameState(level, { unlocked: unlockedGenerals({ unlockedLevel: level.id }) });
  s.rng = makeRng(level.id);
  const used = new Set();
  const key = (sl) => `${sl.x},${sl.y}`;
  const free = () => cov.filter((c) => !used.has(key(c.slot)));
  const entryOf = (t) => cov.find((c) => c.slot.x === t.slot.x && c.slot.y === t.slot.y);

  const waveAt = (i) => level.waves[Math.min(i, level.waves.length - 1)];
  const upcoming = () => waveAt(s.waveIndex);
  const actLanes = () => new Set(upcoming().spawns.map((sp) => sp.pathId));
  // 活跃路只作微调(0.35),全局汇聚点(城门)主导——1.5×曾把塔全吸到首波路的弯道,其余路整波裸漏(L12 w3/w5 -6/-7)
  const slotScore = (e, act) => { let a = 0; for (const id of act) a += e.perLane[id] || 0; return e.total + 0.35 * a; };

  const buildAt = (gid, e) => !!(e && s.gold >= GENERALS[gid].cost && tryBuild(s, e.slot, gid) && used.add(key(e.slot)));
  const countOf = (gid) => s.towers.filter((t) => t.generalId === gid).length;
  const buildBest = (pool, scorer) => {
    // 同将 ≤3 强制混编(真人不会清一色);全被上限卡住时放开兜底
    const gid = pool.find((g) => s.gold >= GENERALS[g].cost && countOf(g) < 3)
      || pool.find((g) => s.gold >= GENERALS[g].cost);
    if (!gid) return false;
    const cands = free().sort((a, b) => scorer(b) - scorer(a));
    return cands.length ? buildAt(gid, cands[0]) : false;
  };
  const upgradeBest = (act, capLv, filter = () => true) => {
    const ranked = s.towers.filter(filter).map((t) => ({ t, sc: slotScore(entryOf(t) || { perLane: {}, total: 0 }, act) }))
      .sort((a, b) => b.sc - a.sc);
    for (const { t } of ranked) if (t.level < capLv && canUpgrade(s, t) && s.gold >= upgradeCost(t)) { tryUpgrade(s, t); return true; }
    return false;
  };

  // —— 目标模式调度(免费,每波切换) ——
  let modeLog = 0;
  function tuneModes() {
    const w = upcoming();
    const types = new Set(w.spawns.map((sp) => sp.enemyType));
    const act = actLanes();
    const fast = [...s.towers].sort((a, b) => GENERALS[a.generalId].interval - GENERALS[b.generalId].interval);
    for (const t of s.towers) t.mode = 'first';
    if (types.has('shaman')) {                       // 点杀奶妈:快攻塔切最弱(方士全场最低血档)
      let n = 0;
      for (const t of fast) {
        const e = entryOf(t);
        if (e && [...act].some((id) => e.perLane[id] > 0)) { t.mode = 'weakest'; if (++n >= 3) break; }
      }
      modeLog++;
    }
    if (types.has('boss')) {                          // 锁主将:重炮塔切最强
      let n = 0;
      for (const gid of bigGun) {
        for (const t of s.towers) if (t.generalId === gid && n < 2) { t.mode = 'strongest'; n++; }
        if (n >= 2) break;
      }
      modeLog++;
    }
  }

  // —— 反制建塔需求检查 ——
  let counterBuilds = 0;
  function counterNeeds(act) {
    const w = upcoming();
    // 装甲路:该路上的火/谋略覆盖不足 → 补反甲将(或升已有反甲塔)
    for (const sp of w.spawns) {
      if (!ARMOR.has(sp.enemyType)) continue;
      const lane = sp.pathId;
      const have = s.towers.filter((t) => antiArmor.includes(t.generalId))
        .reduce((sum, t) => sum + ((entryOf(t) || { perLane: {} }).perLane[lane] || 0), 0);
      if (have < 8) {
        if (upgradeBest(new Set([lane]), 5, (t) => antiArmor.includes(t.generalId) && ((entryOf(t) || { perLane: {} }).perLane[lane] || 0) > 0)) { counterBuilds++; return true; }
        if (buildBest(antiArmor.filter((g) => s.gold >= GENERALS[g].cost), (e) => e.perLane[lane] || 0)) { counterBuilds++; return true; }
      }
    }
    // 飞兵:出飞兵的营 直线防空覆盖不足 → 在直线上补对空将
    for (const sp of w.spawns) {
      if (sp.enemyType !== 'flyer') continue;
      const have = s.towers.filter((t) => GENERALS[t.generalId].targets === 'both')
        .reduce((sum, t) => sum + ((entryOf(t) || { perFly: {} }).perFly[sp.campId] || 0), 0);
      if (have < 10) {
        if (buildBest(antiAir.filter((g) => s.gold >= GENERALS[g].cost), (e) => e.perFly[sp.campId] || 0)) { counterBuilds++; return true; }
        if (upgradeBest(actLanes(), 5, (t) => GENERALS[t.generalId].targets === 'both' && ((entryOf(t) || { perFly: {} }).perFly[sp.campId] || 0) > 0)) { counterBuilds++; return true; }
      }
    }
    return false;
  }

  // 铺位种子:广度档=路数×0.75(大板先有身位),深度档(--depth)=2(先把主力磨到L3);最优解逐关不同,组合档取每关最好
  const SEED = ABLATE.has('depth') ? 2 : Math.min(Math.max(2, Math.ceil(lanes.length * 0.75)), TARGET);
  function decide() {
    const act = actLanes();
    if (s.towers.length < SEED && buildBest(byScore, (e) => slotScore(e, act))) return true;
    if (!ABLATE.has('counter') && counterNeeds(act)) return true;
    if (upgradeBest(act, 3)) return true;                                   // 主力先 L3
    if (s.towers.length < TARGET && buildBest(byScore, (e) => slotScore(e, act))) return true;
    if (upgradeBest(act, 99)) return true;                                  // 升满 L5
    return s.gold >= 300 && buildBest(byScore, (e) => slotScore(e, act));   // 盈余填位(500曾让L12揣着483金看着城破)
  }

  const hpAtWave = [];
  let lastWave = -1, g = 0, tick = 0;
  const guard = Math.max(400000, level.waves.length * 20000);
  while (s.phase !== 'won' && s.phase !== 'lost' && g < guard) {
    if (s.waveIndex !== lastWave) { lastWave = s.waveIndex; hpAtWave.push([s.waveIndex + 1, s.castleHp]); if (!ABLATE.has('modes')) tuneModes(); }
    let acted = false;
    if (tick % 30 === 0) { let n = 0; while (decide() && ++n < 24) acted = true; }
    if (s.phase === 'prep' && tick % 30 === 0 && !acted) s.earlyRequested = true;
    step(s, 1 / 60);
    g++; tick++;
  }
  const drops = [];
  for (let i = 1; i < hpAtWave.length; i++) {
    const d = hpAtWave[i - 1][1] - hpAtWave[i][1];
    if (d > 0) drops.push([hpAtWave[i - 1][0], d]);
  }
  const tail = hpAtWave.length ? hpAtWave[hpAtWave.length - 1][1] - s.castleHp : 0;
  if (tail > 0) drops.push([hpAtWave[hpAtWave.length - 1][0], tail]);
  const stars = s.phase !== 'won' ? 0 : (s.castleHp === s.castleMaxHp ? 3 : (s.castleHp >= s.castleMaxHp / 2 ? 2 : 1));
  return {
    id: level.id, phase: s.phase, castleHp: s.castleHp, stars,
    waveReached: lastWave + 1, waves: level.waves.length,
    towers: s.towers.length, levels: s.towers.map((t) => t.level).join(''),
    comp: [...new Set(s.towers.map((t) => t.generalId))].join('/'),
    goldLeft: Math.round(s.gold), drops, counterBuilds, modeLog,
    timeline: verbose ? hpAtWave : null,
  };
}

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const ABLATE = new Set((args[args.indexOf('--ablate') + 1] || '').split(','));   // score|modes|counter 消融定位用
const only = args.includes('--levels') ? args[args.indexOf('--levels') + 1].split(',').map(Number) : null;
let lost = 0;
const starsSum = [];
for (const level of LEVELS) {
  if (only && !only.includes(level.id)) continue;
  const r = playLevel(level, { verbose: VERBOSE });
  if (r.phase !== 'won') lost++;
  starsSum.push(r.stars);
  const worst = r.drops.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, d]) => `w${w}:-${d}`).join(' ');
  console.log(`${r.phase === 'won' ? 'ok ' : '✗✗ '}L${String(r.id).padEnd(2)} ${'★'.repeat(r.stars).padEnd(3, '·')} 城防${String(r.castleHp).padStart(3)}/20 波${String(r.waveReached).padStart(2)}/${r.waves} 塔${String(r.towers).padStart(2)}[${r.levels}] 反制${r.counterBuilds} 余金${String(r.goldLeft).padStart(4)} ${worst}`);
  if (VERBOSE && r.timeline) console.log('   ' + r.timeline.map(([w, hp]) => `w${w}=${hp}`).join(' '));
}
if (!only) {
  const dist = [0, 1, 2, 3].map((n) => starsSum.filter((x) => x === n).length);
  console.log(`—— 熟练玩家档:${LEVELS.length - lost}/${LEVELS.length} 过 | ★分布 0★=${dist[0]} 1★=${dist[1]} 2★=${dist[2]} 3★=${dist[3]} ——`);
}
