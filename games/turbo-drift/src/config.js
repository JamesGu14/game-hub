// games/turbo-drift/src/config.js
export const VIEW = { W: 640, H: 360 };

export const RENDER = {
  segLen: 200,      // 每段世界长度
  roadW: 2000,      // 赛道半宽（世界单位）
  camDepth: 0.84,   // 1/tan(fov/2)
  camH: 1500,       // 相机高度
  drawDist: 160,    // 绘制段数
  rumble: 5,        // 每几段一节路肩
};

export const PHYSICS = {
  maxSpeed: 12000,    // 基准极速（世界单位/秒）
  accel: 9000,        // 加速度
  brake: 16000,       // 主动减速
  cruise: 2600,       // 自动巡航底速（绝不熄火）
  offRoadMul: 0.5,    // 出界时的极速倍率
  steer: 2.4,         // 横向转向系数
  centrifugal: 0.00004,// 弯道把车甩向外侧的强度（乘 speed*curve）
  assistSteer: 0.8,   // 辅助转向强度（0..1，抵消大部分离心力，过弯不易冲出）
  recenter: 1.8,      // 松方向时自动把车拉回路中的强度（儿童友好：不会卡在草地）
};

export const DRIFT = {
  enterSteer: 0.35,        // 触发漂移的最小转向量
  chargeRate: 1.0,         // 每秒攒气
  tierThresholds: [0.5, 1.1, 1.8], // 1/2/满 档位的秒数
  maxCharge: 1.8,
  steerBoost: 1.5,         // 漂移时转向更灵
};

export const NITRO = {
  speedMul: 1.5,           // 氮气期间极速倍率
  accelMul: 2.2,
  durationByTier: [0, 0.8, 1.4, 2.4], // tier 0/1/2/3 的氮气时长（秒）
};

export const RACE = { laps: 3, racers: 4, countdownSec: 3 };

export const AI = {
  baseSkill: [0.9, 0.94, 0.98], // 三个对手的极速比例
  rubberAheadEase: 0.86,        // 玩家落后时，领先 AI 极速 ×
  rubberBehindBoost: 1.18,      // 玩家领先时，落后 AI 极速 ×（追赶，保持焦灼）
  rubberDeadZone: 1600,         // 里程差死区（之内不触发）
  itemUseChance: 0.5,
};

export const ITEMS = {
  boost:   { dur: 1.2, mul: 1.4 },
  shield:  { dur: 6 },
  oil:     { life: 8, spinDur: 1.0 },
  shrink:  { dur: 2.5, slowMul: 0.7 },
  missile: { spinDur: 1.0, speed: 26000 },
};
export const ITEM_KINDS = ['boost', 'shield', 'oil', 'shrink', 'missile'];
