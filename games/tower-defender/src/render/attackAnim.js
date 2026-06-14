// render/attackAnim.js — 数据驱动的出手帧序列（可推广，不写死关羽）。
// 某将某级配一组攻击关键帧；出手窗口内按进度返回该帧 asset id，窗口外/无配置 → null（调用方用 idle 立绘）。
// 纯函数：只算字符串与时间，不碰 ctx / assets / state。缺图回退由调用方（generalSprite）负责。

// generalId → level → 帧时间线：按进度 k(0~1) 升序，命中首个 k<until 的帧。
// suffix=null 表示该段回到 idle 立绘（收势）。
// 关羽 L5：曹操传式两态 —— 出手整段显示「刀向下」劈砍帧(atk2)，停留满时长再回 idle 持刀。
export const ATTACK_SEQUENCES = {
  guan: {
    5: [
      { until: 1.0, suffix: 'atk2' },   // 整个出手窗口 = 刀向下(atk2)，不再分引刀/劈出多段
    ],
  },
};

// 劈砍帧停留时长（s）。曹操传式：出手切到「刀向下」并保持 0.45s 再切回持刀（James 实玩定 0.4~0.5s）。
export const ATK_FRAME_DUR = 0.45;

export function hasAttackSequence(generalId, level) {
  return !!(ATTACK_SEQUENCES[generalId] && ATTACK_SEQUENCES[generalId][level]);
}

// 当前应显示的攻击帧 asset id（如 'gen_guan_5_atk1'），或 null（窗口外/无序列 → 用 idle 立绘）。
export function attackFrameId(generalId, level, lastFireAt, now, dur = ATK_FRAME_DUR) {
  const seq = ATTACK_SEQUENCES[generalId] && ATTACK_SEQUENCES[generalId][level];
  if (!seq || lastFireAt == null) return null;
  const k = (now - lastFireAt) / dur;
  if (k < 0 || k >= 1) return null;                  // 窗口外 → idle
  for (const f of seq) {
    if (k < f.until) return f.suffix ? `gen_${generalId}_${level}_${f.suffix}` : null;
  }
  return null;
}
