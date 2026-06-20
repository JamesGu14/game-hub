// config.js — 全部可调数值表（纯数据，可被 node:test import）。平衡模拟器是这些数的裁判。
export const FIELD = { W: 540, H: 960 };
export const LANES = 5;                                   // 僵尸下行通道数
export const WALL = { y: 760, maxHp: 2500, heroY: 880 };  // 墙在 y=760，角色在 y=880

// 英雄基础武器面板（局内卡片/局外养成在此之上叠加；阶段1局外恒0）
export const HERO = {
  damage: 12, fireInterval: 0.40, bulletSpeed: 720,
  pierce: 0, multishot: 1, critRate: 0.05, critMult: 2.0, splash: 0,
};
export const BULLET = { r: 5, life: 2.0 };

// 兵种表。atk=单次啃墙伤害；attackInterval=啃咬间隔(秒)；xp=击杀经验；r=碰撞半径。
export const ENEMIES = {
  normal:   { hp: 22,  speed: 42, atk: 4,  attackInterval: 1.0, xp: 6,  r: 13, color: '#8bbf6a' },
  fast:     { hp: 13,  speed: 95, atk: 3,  attackInterval: 0.8, xp: 8,  r: 11, color: '#b6e36a' },
  tank:     { hp: 130, speed: 22, atk: 10, attackInterval: 1.3, xp: 24, r: 19, color: '#5a7a4a' },
  exploder: { hp: 18,  speed: 55, atk: 0,  attackInterval: 1.0, xp: 12, r: 14, color: '#d98b3a', explodeDmg: 35, explodeR: 60 },
  shielded: { hp: 42,  speed: 30, atk: 6,  attackInterval: 1.1, xp: 16, r: 15, color: '#6a8fbf', frontShield: 0.5 },
  spitter:  { hp: 26,  speed: 28, atk: 3,  attackInterval: 1.0, xp: 14, r: 13, color: '#9a6abf', range: 320, spitDmg: 6, spitInterval: 2.0 },
  summoner: { hp: 64,  speed: 18, atk: 3,  attackInterval: 1.2, xp: 30, r: 17, color: '#bf6a8f', summonInterval: 3.0, summonType: 'normal' },
};

// 经验曲线：升 n→n+1 所需经验 = round(base * growth^(n-1))。目标单关 ~15-22 级（sim 校准）。
export const XP = { base: 3, growth: 1.17 };

// 三选一稀有度权重（draw3 用）
export const CARD_RARITY = { common: 60, uncommon: 25, rare: 12, epic: 3 };

export const STORAGE_KEY = 'save_bz_v1';
