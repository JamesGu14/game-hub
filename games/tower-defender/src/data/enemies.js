// data/enemies.js — 敌兵原型。M1 仅步卒（速度=格/秒）。
// Phase 2 补 轻骑/藤甲/飞兵/方士/BOSS + 抗性/特性。
export const ENEMIES = {
  footman: {
    id: 'footman', name: '步卒',
    hp: 60, speed: 0.7, gold: 5, castleDmg: 1, flying: false,
    color: '#c0392b',
  },
};
