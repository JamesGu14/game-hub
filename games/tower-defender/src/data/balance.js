// data/balance.js — 全局平衡常量（单一调参入口；§17.1/17.2/17.3 起点）
// 铁律：所有平衡魔数集中于此；系统/实体内不得硬编码数值。
export const BAL = {
  FIXED_DT: 1 / 60,        // 固定步长（秒）
  MAX_STEPS: 3,           // [P0-1] 累加器封顶 = FIXED_DT * MAX_STEPS（防螺旋死亡）
  CELL: 36,               // 格 → 像素（更小更密）
  PREP_SECONDS: 30,       // 备战倒计时
  EARLY_BONUS_PER_SEC: 2, // 提前出兵奖励 / 剩余秒
  EARLY_BONUS_CAP: 30,    // [漏洞#4] 提前出兵单波封顶
  WAVE_CLEAR_BONUS: 15,   // 清波奖励

  // —— wave 关内难度递增（每关独立·叠在 level.scale 上；§spec 2026-06-08）——
  WAVE_HP_RAMP_MAX: 1.5,   // 末波单兵 HP = 首波 ×1.5（默认上限；可被 level.rampMax 覆盖。2.0 时 L47/48/50 满防不可通关，实测回调）
  WAVE_DEF_RAMP_MIN: 0.85, // 末波受伤 ×0.85（=15% 减伤；t² 后置）

  // —— Phase 2：升级 / 拆除（§17.1）——
  MAX_TOWER_LEVEL: 5,         // 原地升级 L1→L5（封顶/满级判定用此）
  SIGNATURE_LEVEL: 3,         // 招牌技解锁/充能门槛（与封顶解耦；勿混用 MAX）
  UPGRADE_DMG_MULT: 1.5,      // [重排spec §2.3] 每级伤害 ×1.5（原1.6）
  UPGRADE_RANGE_ADD: 0.5,     // 每级射程 +0.5 格
  UPGRADE_INTERVAL_MULT: 0.9, // 每级攻击间隔 ×0.9
  UPGRADE_COST_L2: 1.0,       // L2 造价 = 基础 cost ×1.0
  UPGRADE_COST_L3: 1.6,       // L3 造价 = 基础 cost ×1.6
  UPGRADE_COST_L4: 2.0,       // L4 造价 = 基础 cost ×2.0（保守起点；balance-report 跑完再上调）
  UPGRADE_COST_L5: 2.8,       // L5 造价 = 基础 cost ×2.8（同上）
  UPGRADE_DMG_MULT_SOFT: 1.3,      // [§5.3+重排spec] L3→L5 软坡 ×1.3（原1.35）
  UPGRADE_INTERVAL_MULT_SOFT: 0.95,// [§5.3] L3→L5 软坡：每级间隔 ×0.95
  SELL_REFUND: 0.6,           // 拆除返还 = 总投入 ×0.6

  // —— Phase 2：暴击（黄忠 L3 百步穿杨）——
  CRIT_CHANCE: 0.25,          // 25% 必定暴击
  CRIT_MULT: 2.5,             // ×2.5 且无视护甲

  // —— Phase 2：治疗（方士；§17.3）——
  HEAL_CAP_PER_SEC: 24,       // 每目标每秒回血封顶

  // —— Phase 2：灼烧（诸葛；§17.3）——
  BURN_MAX_STACKS: 3,         // 灼烧最多叠 3 层

  // —— Phase 3：司马懿终 BOSS 主动技（§17.3）——
  BOSS_SUMMON_CD: 15,         // 每 15s 召唤
  BOSS_SUMMON_COUNT: 2,       // 每次召 2 名魏卒
  BOSS_STUN_CD: 8,            // 每 8s 震慑一座将塔
  BOSS_STUN_DUR: 2,           // 被震慑停火 2s

  // —— 板型+地形（spec §6）——
  PLATEAU_RANGE_BONUS: 0.5,   // 高台将位射程 +0.5 格
};
