// src/core/achievements.js — 成就/图鉴存档（注入式纯函数 + browser 包装）。copy-pattern 自 core/save.js。
// render-free、可单测。key: save_td_ach_v1（独立于进度档 save_td_v1）。
// schema: { version, kills:{generalId:n}, seen:{enemyId:true}, namedDefeats:n, earned:{achId:true} }
const KEY = 'save_td_ach_v1';
export const ACH_VERSION = 1;

// 改 schema 时：①ACH_VERSION+1 ②注册 MIGRATIONS[from]=(d)=>d'。归一化(loadAch 末段)是兜底，不替代迁移。
const MIGRATIONS = {};
export function _applyAchMigrations(d, migrations = MIGRATIONS, current = ACH_VERSION) {
  let v = Number.isInteger(d.version) ? d.version : 0, out = d;
  while (v < current && migrations[v]) { out = migrations[v](out); v++; }
  return out;
}

// 段位阶梯（spec §7）。门槛=累计击杀，常量表可调。
export const TIERS = [
  { key: 'bronze',  name: '青铜', min: 0 },
  { key: 'silver',  name: '白银', min: 50 },
  { key: 'gold',    name: '黄金', min: 150 },
  { key: 'diamond', name: '钻石', min: 400 },
  { key: 'glory',   name: '荣耀', min: 1000 },
  { key: 'king',    name: '王者', min: 2500 },
];
export function tierIndex(kills) {
  const k = kills || 0; let t = 0;
  for (let i = 0; i < TIERS.length; i++) if (k >= TIERS[i].min) t = i;
  return t;
}

export function defaultAch() {
  return { version: ACH_VERSION, kills: {}, seen: {}, namedDefeats: 0, earned: {} };
}

export function loadAch(storage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return defaultAch();
    const d = _applyAchMigrations(JSON.parse(raw));
    return {
      version: ACH_VERSION,
      kills: d.kills && typeof d.kills === 'object' && !Array.isArray(d.kills)
        ? Object.fromEntries(Object.keys(d.kills).map((k) => [k, Number.isInteger(d.kills[k]) && d.kills[k] >= 0 ? d.kills[k] : 0]))
        : {},
      seen: d.seen && typeof d.seen === 'object' ? { ...d.seen } : {},
      namedDefeats: Number.isInteger(d.namedDefeats) && d.namedDefeats >= 0 ? d.namedDefeats : 0,
      earned: d.earned && typeof d.earned === 'object' ? { ...d.earned } : {},
    };
  } catch { return defaultAch(); }
}

export function writeAch(storage, ach) {
  try { storage.setItem(KEY, JSON.stringify(ach)); } catch { /* 隐私模式/配额 → 忽略 */ }
  return ach;
}

// —— 记录/查询（就地 mutate ach 并返回；非纯函数，调用方持同一引用，链式写法为可选便利；无 IO）——
export function recordKill(ach, generalId) {
  if (!generalId) return ach;
  ach.kills[generalId] = (ach.kills[generalId] || 0) + 1;
  return ach;
}
export function recordDefeatedEnemy(ach, enemyId) {
  if (!enemyId) return ach;
  ach.namedDefeats = (ach.namedDefeats || 0) + 1;   // 累计（含重复）
  if (!ach.seen[enemyId]) ach.seen[enemyId] = true; // 唯一集合
  return ach;
}
export function totalKills(ach) { let n = 0; for (const k in ach.kills) n += ach.kills[k]; return n; }
export function cardTier(ach, generalId) { return tierIndex(ach.kills[generalId] || 0); }

export const browserLoadAch = () => loadAch(window.localStorage);
export const browserWriteAch = (a) => writeAch(window.localStorage, a);
