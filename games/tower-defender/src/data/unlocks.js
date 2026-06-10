// data/unlocks.js — 按章解锁日程(spec §3):纯派生自 save.unlockedLevel,零 schema 迁移。
// 语义:save.unlockedLevel = 最高可玩关号 ⇒ 已通关 afterLevel ⇔ unlockedLevel > afterLevel。
// 剧情呼应:L10→赵/张(长坂坡)、L20→诸葛/关(赤壁)、L30→黄/马(定军山·西川)。
export const BASE_ROSTER = ['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying'];

export const UNLOCKS = [
  { afterLevel: 10, generals: ['zhao', 'zhang'] },
  { afterLevel: 20, generals: ['zhuge', 'guan'] },
  { afterLevel: 30, generals: ['huang', 'ma'] },
];

// save → 已解锁将 id 集合。save 缺失/脏值 → 新档(仅新6将)。
export function unlockedGenerals(save) {
  const lvl = (save && Number.isInteger(save.unlockedLevel) && save.unlockedLevel >= 1) ? save.unlockedLevel : 1;
  const set = new Set(BASE_ROSTER);
  for (const u of UNLOCKS) if (lvl > u.afterLevel) for (const id of u.generals) set.add(id);
  return set;
}

// 跨门槛差集:prev/next 为通关前后的 unlockedLevel(供结算面板"新武将来援"提示)。
export function newlyUnlocked(prevLevel, nextLevel) {
  const out = [];
  for (const u of UNLOCKS) if (prevLevel <= u.afterLevel && nextLevel > u.afterLevel) out.push(...u.generals);
  return out;
}
