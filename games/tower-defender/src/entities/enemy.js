// entities/enemy.js — 敌实例工厂。[P1] level.scale 在此落点（HP/掉金 × scale）。
import { ENEMIES } from '../data/enemies.js';
import { BAL } from '../data/balance.js';

let _id = 0;

export function createEnemy(type, pathId, path, scale = 1) {
  const def = ENEMIES[type];
  const s = path[0];
  return {
    id: ++_id, type, pathId,
    hp: def.hp * scale, maxHp: def.hp * scale, gold: Math.round(def.gold * scale),
    speed: def.speed, flying: !!def.flying, color: def.color,
    resist: def.resist || null,                    // [P2] 抗性矩阵 resist[dmgType]
    tag: def.tag || null,                          // [P2] 'tengjia' 等（诸葛火烧藤甲键此）
    heal: def.heal || null,                        // [P2] 方士治疗光环 {range,perSec}
    isBoss: !!def.isBoss,
    seg: 0, t: 0,                                  // 当前段起点 index + 段内进度
    progress: 0,                                   // [P2] 统一沿路进度（地面=seg+t；飞兵=直线行程分数）→ targeting 读此
    knockback: 0,                                  // [P2] 待消费后退格数（马超 L3 西凉突阵）
    gx: s.x, gy: s.y,                              // 格坐标（float）
    px: s.x * BAL.CELL + BAL.CELL / 2, py: s.y * BAL.CELL + BAL.CELL / 2, // 像素中心
    alive: true,
    statuses: {},                                  // [P2] { slow:{pct,until}, burn:[{dps,until}], stun:{until} } until=绝对游戏时间
  };
}
