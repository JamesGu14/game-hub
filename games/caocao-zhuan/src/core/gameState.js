// core/gameState.js — 全局游戏状态 + 存档（localStorage）
//
// 契约（plan §1.8）：
//   export const game = {
//     state,                          // {chapter,battleIndex,roster[],inventory[],storyFlags,settings}
//     newGame(), save(slot), load(slot), listSaves(),
//     roster,                         // 玩家武将（带升级持久化）
//   }
//
// 持久化键：`save_caocao_v1_slot${n}`（JSON）。
// roster 条目持久化：generalId / level / exp / items / skillsLearned / curHp。
// 本模块不得 import three，不得触碰 DOM（localStorage 除外）。

const SAVE_PREFIX = 'save_caocao_v1_slot';
const SAVE_VERSION = 1;

function defaultSettings() {
  return { muted: false, difficulty: 'normal', textSpeed: 1 };
}

function defaultState() {
  return {
    chapter: 1,
    battleIndex: 0,
    roster: [], // RosterEntry[]：{ generalId, level, exp, items, skillsLearned, curHp }
    inventory: [],
    storyFlags: {},
    settings: defaultSettings(),
  };
}

// 仅取持久化字段，避免把运行态（pos/hasMoved 等）写进存档
function serializeRosterEntry(e) {
  return {
    generalId: e.generalId,
    level: e.level ?? 1,
    exp: e.exp ?? 0,
    items: Array.isArray(e.items) ? [...e.items] : [],
    skillsLearned: Array.isArray(e.skillsLearned) ? [...e.skillsLearned] : [],
    curHp: e.curHp ?? null, // null = 满血（载入战斗时由 maxHp 补齐）
  };
}

function normalizeRosterEntry(e) {
  return {
    generalId: e.generalId,
    level: typeof e.level === 'number' ? e.level : 1,
    exp: typeof e.exp === 'number' ? e.exp : 0,
    items: Array.isArray(e.items) ? [...e.items] : [],
    skillsLearned: Array.isArray(e.skillsLearned) ? [...e.skillsLearned] : [],
    curHp: typeof e.curHp === 'number' ? e.curHp : null,
  };
}

// localStorage 安全访问（Node 单测/隐私模式下可能缺失）
function getStore() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (_) {
    /* 访问被禁 */
  }
  return null;
}

export const game = {
  state: defaultState(),

  // roster 访问器：契约里 game.roster 直接可读，等同 state.roster
  get roster() {
    return this.state.roster;
  },
  set roster(v) {
    this.state.roster = Array.isArray(v) ? v : [];
  },

  newGame() {
    this.state = defaultState();
    return this.state;
  },

  // 把一名武将加入常驻 roster（剧情登场加入；客将不走此路）。
  // 幂等：已在 roster 则不重复；新加入者按 1 级满血基线（curHp=null）。
  // 返回新加入的 RosterEntry，或已存在时返回其现有条目（不变更）。
  addToRoster(generalId, init = {}) {
    if (!generalId) return null;
    if (!Array.isArray(this.state.roster)) this.state.roster = [];
    const existing = this.state.roster.find((e) => e && e.generalId === generalId);
    if (existing) return existing;
    const entry = normalizeRosterEntry({
      generalId,
      level: init.level,
      exp: init.exp,
      items: init.items,
      skillsLearned: init.skillsLearned,
      curHp: init.curHp,
    });
    this.state.roster.push(entry);
    return entry;
  },

  save(slot) {
    const store = getStore();
    if (!store) return false;
    const snapshot = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      chapter: this.state.chapter,
      battleIndex: this.state.battleIndex,
      roster: (this.state.roster || []).map(serializeRosterEntry),
      inventory: [...(this.state.inventory || [])],
      storyFlags: { ...(this.state.storyFlags || {}) },
      settings: { ...defaultSettings(), ...(this.state.settings || {}) },
    };
    try {
      store.setItem(SAVE_PREFIX + slot, JSON.stringify(snapshot));
      return true;
    } catch (err) {
      console.error('[gameState] save failed:', err);
      return false;
    }
  },

  load(slot) {
    const store = getStore();
    if (!store) return false;
    const raw = store.getItem(SAVE_PREFIX + slot);
    if (raw == null) return false;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.error('[gameState] load failed (bad JSON):', err);
      return false;
    }
    this.state = {
      chapter: typeof data.chapter === 'number' ? data.chapter : 1,
      battleIndex: typeof data.battleIndex === 'number' ? data.battleIndex : 0,
      roster: Array.isArray(data.roster) ? data.roster.map(normalizeRosterEntry) : [],
      inventory: Array.isArray(data.inventory) ? [...data.inventory] : [],
      storyFlags: data.storyFlags && typeof data.storyFlags === 'object' ? { ...data.storyFlags } : {},
      settings: { ...defaultSettings(), ...(data.settings || {}) },
    };
    return true;
  },

  // 返回存档槽元信息列表：[{slot, chapter, battleIndex, savedAt, rosterCount}]
  listSaves() {
    const store = getStore();
    const out = [];
    if (!store) return out;
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key || !key.startsWith(SAVE_PREFIX)) continue;
      const slot = key.slice(SAVE_PREFIX.length);
      try {
        const data = JSON.parse(store.getItem(key));
        out.push({
          slot,
          chapter: data.chapter ?? null,
          battleIndex: data.battleIndex ?? null,
          savedAt: data.savedAt ?? null,
          rosterCount: Array.isArray(data.roster) ? data.roster.length : 0,
        });
      } catch (_) {
        out.push({ slot, corrupt: true });
      }
    }
    out.sort((a, b) => String(a.slot).localeCompare(String(b.slot)));
    return out;
  },
};

// --- 自检（newGame → save → load 往返）---------------------------------------
// 浏览器 console 验收：
//   import { game } from './src/core/gameState.js';
//   game.newGame();
//   game.state.roster.push({ generalId:'caocao', level:3, exp:40, items:['sword'],
//                            skillsLearned:['heal'], curHp:42 });
//   game.state.storyFlags.started = true;
//   game.save(1);            // -> true，写入 localStorage['save_caocao_v1_slot1']
//   game.newGame();          // 清空到默认
//   game.load(1);            // -> true，恢复
//   console.assert(game.state.roster[0].generalId === 'caocao'
//                  && game.state.roster[0].level === 3
//                  && game.state.storyFlags.started === true, 'round-trip ok');
//   game.listSaves();        // -> [{slot:'1', chapter:1, battleIndex:0, ...}]
