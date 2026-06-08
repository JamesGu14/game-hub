// entities/enemy.js — 敌实例工厂。[P1] level.scale 在此落点（HP/掉金 × scale）。
// [P3] opts={faction,name,bossSkills,hpMult}：势力换皮（仅 name/color）+ BOSS 血量倍率/主动技。
import { ENEMIES } from '../data/enemies.js';
import { BAL } from '../data/balance.js';
import { skinOf } from '../data/factions.js';

let _id = 0;

export function createEnemy(type, pathId, path, scale = 1, opts = {}) {
  const def = ENEMIES[type];
  const s = path[0];
  const skin = opts.faction ? skinOf(opts.faction, type) : null;   // [P3] 换皮：仅覆盖 name/color
  const hpMult = opts.hpMult || 1;                                  // [P3] BOSS 血量倍率
  const rampHp = opts.rampHp || 1;                                  // wave 关内 HP ramp（与 boss hpMult 相乘）
  const hp = def.hp * scale * hpMult * rampHp;
  const bossSkills = opts.bossSkills || null;                       // [P3] 主动技（仅司马懿）
  return {
    id: ++_id, type, pathId,
    hp, maxHp: hp, gold: Math.round(def.gold * scale),
    speed: def.speed, flying: !!def.flying,
    color: (skin && skin.color) || def.color,
    name: opts.name || (skin && skin.name) || def.name,            // [P3] 显示名（BOSS名/皮名/原型名）
    resist: def.resist || null,                    // 抗性矩阵 resist[dmgType]
    tag: def.tag || null,                          // 'tengjia'/'heavy'（克制键）
    heal: def.heal || null,                        // 方士治疗光环 {range,perSec}
    isBoss: !!def.isBoss,
    rampHp,                                        // wave HP 倍率（召唤/分裂可继承）
    dmgTakenMult: opts.dmgTakenMult || 1,          // wave 末段波全局减伤（damageCalc 直伤消费）
    bossId: opts.bossId || null,                   // [P6] 名将 id（mulu/wutugu…）→ boss sprite 映射；缺则 null
    bossSkills,                                    // [P3] ['summon','stunTower'] | null
    skillTimers: bossSkills
      ? Object.fromEntries(bossSkills.map((k) => [k, k === 'summon' ? BAL.BOSS_SUMMON_CD : BAL.BOSS_STUN_CD]))
      : null,                                      // [P3] 各技独立倒计时（出场即=CD，故首发在 CD 后）
    seg: 0, t: 0,                                  // 当前段起点 index + 段内进度
    progress: 0,                                   // 统一沿路进度（地面=seg+t；飞兵=直线行程分数）
    knockback: 0,                                  // 待消费后退格数（马超 L3）
    gx: s.x, gy: s.y,                              // 格坐标（float）
    px: s.x * BAL.CELL + BAL.CELL / 2, py: s.y * BAL.CELL + BAL.CELL / 2, // 像素中心
    alive: true,
    statuses: {},                                  // { slow:{pct,until}, burn:[{dps,until}], stun:{until} } until=绝对游戏时间
  };
}
