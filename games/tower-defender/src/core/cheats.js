// core/cheats.js — [作弊] 隐藏作弊菜单的纯内存叠加层(render-free、可单测;刷新即还原,绝不写存档)。
// 关键设计:作弊不改 save.unlockedLevel(它同时驱动关卡+武将解锁),而是读取时派生 → 关卡/武将独立、还原无损。
import { unlockedGenerals } from '../data/unlocks.js';

export function defaultCheats() {
  return { allLevels: false, allGenerals: false, goldOverride: null };
}
// 有效最高可玩关号:allLevels → 总关数;否则真实存档值。
export function effectiveUnlockedLevel(save, cheats, total) {
  return cheats.allLevels ? total : save.unlockedLevel;
}
// 有效已解锁将集:allGenerals → 全部 id;否则按真实存档派生。allIds 由调用方传 Object.keys(GENERALS)。
export function effectiveRoster(save, cheats, allIds) {
  return cheats.allGenerals ? new Set(allIds) : unlockedGenerals(save);
}
// 有效起始金币:goldOverride 非 null 则覆盖(含 0);否则关卡默认。
export function effectiveStartGold(levelStartGold, cheats) {
  return cheats.goldOverride != null ? cheats.goldOverride : levelStartGold;
}
