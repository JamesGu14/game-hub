// systems/terrainSystem.js — 地形系统（板型+地形 spec §4）。
// 段1:静态助手(plateau 射程加成查询);段2:terrainSystem(state) 每步 tick(浅滩/火谷/落石)。
// 铁律:render-free;查询 O(1) 走 level.terrainAt(boardVariants 加载期烘焙)。
import { BAL } from '../data/balance.js';

// 格地形类型（无 level / 无 terrainAt 的合成关/测试关 → null，全部行为退化为平地）
export function terrainTypeAt(level, x, y) {
  return (level && level.terrainAt && level.terrainAt[y] && level.terrainAt[y][x]) || null;
}

// 将位射程加成:高台 +0.5,否则 0。建塔(economySystem)与续玩重建(main.applyResume)共用 → 快照零迁移。
export function rangeBonusFor(level, slot) {
  return terrainTypeAt(level, slot.x, slot.y) === 'plateau' ? BAL.PLATEAU_RANGE_BONUS : 0;
}
