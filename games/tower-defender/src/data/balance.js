// data/balance.js — 全局平衡常量（单一调参入口；§17.1 起点）
export const BAL = {
  FIXED_DT: 1 / 60,        // 固定步长（秒）
  MAX_STEPS: 3,           // [P0-1] 累加器封顶 = FIXED_DT * MAX_STEPS（防螺旋死亡）
  CELL: 36,               // 格 → 像素（更小更密）
  PREP_SECONDS: 30,       // 备战倒计时
  EARLY_BONUS_PER_SEC: 2, // 提前出兵奖励 / 剩余秒
  EARLY_BONUS_CAP: 30,    // [漏洞#4] 提前出兵单波封顶
  WAVE_CLEAR_BONUS: 15,   // 清波奖励
};
