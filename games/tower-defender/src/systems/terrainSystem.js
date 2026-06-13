// systems/terrainSystem.js — 地形系统（板型+地形 spec §4）。
// 静态助手:terrainTypeAt / rangeBonusFor(plateau 射程+0.5) / initTerrainState(落石计时+禁用集)。
// terrainSystem(state) 每步 tick:rockfall(while 追赶,相位守卫前·prep 可观察节奏) → 浅滩减速 / 火谷 envBurn(combat 限定)。
// 铁律:render-free;查询 O(1) 走 level.terrainAt(boardVariants 加载期烘焙)。
import { BAL } from '../data/balance.js';
import { applySlow } from './combat/statusEffects.js';
import { killEnemy } from './combat/kill.js';

// 格地形类型（无 level / 无 terrainAt 的合成关/测试关 → null，全部行为退化为平地）
export function terrainTypeAt(level, x, y) {
  return (level && level.terrainAt && level.terrainAt[y] && level.terrainAt[y][x]) || null;
}

// 将位地形加成（建塔(economySystem)与续玩重建(main.applyResume)共用 → 快照零迁移）。
// plateau→射程 / barracks→攻击 / archtower→攻速。
export function terrainBonuses(level, slot) {
  const t = terrainTypeAt(level, slot.x, slot.y);
  return {
    rangeBonus: t === 'plateau' ? BAL.PLATEAU_RANGE_BONUS : 0,
    dmgMult: t === 'barracks' ? BAL.BARRACKS_DMG_MULT : 1,
    intervalMult: t === 'archtower' ? BAL.ARCHTOWER_INTERVAL_MULT : 1,
  };
}
// 薄封装：空将位建造预览（main.js）仅需射程；plateau.test 依赖。
export function rangeBonusFor(level, slot) {
  return terrainBonuses(level, slot).rangeBonus;
}

// 运行时地形状态（gameState.newGameState 调用;resume 重建即重置——v1 续玩回到波首,语义正确）
export function initTerrainState(level) {
  const disabled = new Set(level.disableTerrain || []);
  const rockfalls = [];
  (level.terrain || []).forEach((z, i) => {
    if (z.type === 'rockfall' && !disabled.has('rockfall')) {
      rockfalls.push({ zoneIdx: i, nextStrikeAt: BAL.ROCKFALL_PERIOD, lastStrikeAt: -9 });
    }
  });
  return { rockfalls, disabled };
}

// 每步 tick（gameLoop 在 pathSystem 之后调;位置最新）。
export function terrainSystem(state) {
  const lvl = state.level;
  if (!lvl || !lvl.terrain || !lvl.terrain.length || !state.terrain) return;
  const now = state.time;
  // —— rockfall:每区独立计时,while 追赶(跨周期补结算,确定性不依赖帧率;prep 也走表供观察节奏)——
  // 禁用语义不对称说明:rockfall 被禁用时 initTerrainState 根本不建计时器,此处无需查 disabled;
  // shallow/firegully 是逐格效果,在下方敌循环逐次查 disabled。
  for (const rf of state.terrain.rockfalls) {
    while (now >= rf.nextStrikeAt) {
      const zone = lvl.terrain[rf.zoneIdx];
      for (const e of state.enemies) {
        if (!e.alive || e.flying) continue;                   // 砸"路面"敌人:飞兵豁免
        if (!zone.cellSet.has(`${Math.round(e.gx)},${Math.round(e.gy)}`)) continue;
        e.hp -= BAL.ROCKFALL_DMG * (lvl.scale || 1);
        e.lastHitAt = now;                                    // 受击闪白(纯表现)
        if (e.hp <= 0) killEnemy(state, e);
      }
      rf.lastStrikeAt = rf.nextStrikeAt;                      // 渲染落石动画窗口
      rf.nextStrikeAt += BAL.ROCKFALL_PERIOD;
    }
  }
  if (state.phase !== 'combat') return;          // [P0-3] 相位守卫（效果只作用于交战中的敌）
  const disabled = state.terrain.disabled;
  for (const e of state.enemies) {
    if (!e.alive || e.flying) continue;                       // 飞兵不踩地形
    const ty = terrainTypeAt(lvl, Math.round(e.gx), Math.round(e.gy));
    if (ty === 'shallow' && !disabled.has('shallow')) {
      // 短路:已有更强减速且 until 余量足 → 免每帧新建对象(GC;review 建议)
      const c = e.statuses.slow;
      if (!c || c.until < now + BAL.SHALLOW_SLOW_DUR - 1e-3 || c.pct < BAL.SHALLOW_SLOW_PCT) {
        applySlow(e, BAL.SHALLOW_SLOW_PCT, BAL.SHALLOW_SLOW_DUR, now);
      }
    } else if (ty === 'firegully' && !disabled.has('firegully')) {
      // 独立环境灼烧单槽:复用对象就地刷新(不占塔 3 层栈;并行结算见 statusSystem)
      const dps = BAL.FIREGULLY_DPS * (lvl.scale || 1);
      if (e.envBurn) { e.envBurn.dps = dps; e.envBurn.until = now + BAL.FIREGULLY_LINGER; }
      else e.envBurn = { dps, until: now + BAL.FIREGULLY_LINGER };
    }
  }
}
