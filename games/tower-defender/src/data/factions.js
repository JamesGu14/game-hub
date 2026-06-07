// data/factions.js — 三势力皮肤层（§5 换皮）。皮肤只覆盖 name/color（显示层）；
// hp/speed/resist 永远来自 enemies.js prototype。新势力/新皮只改这里。
// tint = 盘面草地/蜀道配色（board.js 用），让三段战役观感各异（sprite 仍留 Phase 6）。
export const FACTIONS = {
  nanman: {
    name: '南蛮',
    tint: { grassA: '#4f7a39', grassB: '#588a3e', road: '#7a5e34', road2: '#b58f54' },
    skin: {
      footman: { name: '蛮兵', color: '#c0392b' },
      wolf: { name: '狼骑', color: '#e67e22' },
      tengjia: { name: '藤甲兵', color: '#6b8e23' },
      boss: { color: '#5b3a2e' },
    },
  },
  wu: {
    name: '东吴',
    tint: { grassA: '#3f6f6a', grassB: '#487f78', road: '#6b6a34', road2: '#a8a154' },
    skin: {
      footman: { name: '吴卒', color: '#2e86c1' },
      wolf: { name: '江东轻骑', color: '#48c9b0' },
      heavy: { name: '楼船甲士', color: '#5d6d7e' },
      flyer: { name: '飞鸢', color: '#aed6f1' },
      shaman: { name: '吴术士', color: '#e84393' },
      boss: { color: '#1a5276' },
    },
  },
  wei: {
    name: '曹魏',
    tint: { grassA: '#5a5f4a', grassB: '#666b54', road: '#6e5f44', road2: '#9b8b6b' },
    skin: {
      footman: { name: '魏卒', color: '#7b241c' },
      wolf: { name: '虎豹骑', color: '#a04000' },
      heavy: { name: '重甲铁骑', color: '#566573' },
      flyer: { name: '斥候鹰', color: '#d5dbdb' },
      shaman: { name: '军师', color: '#c0392b' },
      boss: { color: '#2c2c54' },
    },
  },
};

// 取某势力对某 prototype 的皮肤（无则 null → 工厂回退 prototype 默认 name/color）。
export function skinOf(faction, type) {
  return FACTIONS[faction]?.skin?.[type] || null;
}

// 盘面 tint（未知势力回退南蛮）。
export function tintOf(faction) {
  return (FACTIONS[faction] || FACTIONS.nanman).tint;
}
