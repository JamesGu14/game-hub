// systems/terrainSystem.js — 地形系统（板型+地形 spec §4）。
// 段1:静态助手(plateau 射程加成查询);段2:terrainSystem(state) 每步 tick(浅滩/火谷/落石)。
// 铁律:render-free;查询 O(1) 走 level.terrainAt(boardVariants 加载期烘焙)。
import { BAL } from '../data/balance.js';
import { applySlow } from './combat/statusEffects.js';

// 格地形类型（无 level / 无 terrainAt 的合成关/测试关 → null，全部行为退化为平地）
export function terrainTypeAt(level, x, y) {
  return (level && level.terrainAt && level.terrainAt[y] && level.terrainAt[y][x]) || null;
}

// 将位射程加成:高台 +0.5,否则 0。建塔(economySystem)与续玩重建(main.applyResume)共用 → 快照零迁移。
export function rangeBonusFor(level, slot) {
  return terrainTypeAt(level, slot.x, slot.y) === 'plateau' ? BAL.PLATEAU_RANGE_BONUS : 0;
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
  // —— rockfall 结算（落石任务填）——
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
