// systems/combat/statusEffects.js — 状态机纯助手（§17.3）。
// until 一律存「绝对游戏时间」(state.time)，到期惰性判定(until > now)，无需逐帧递减。
// 规则：减速取最强不叠加 · 灼烧最多 3 层各自计时 · 定身时移动=0（减速计时继续）。
// 治疗（方士）不在此，由 statusSystem 按净值处理。
import { BAL } from '../../data/balance.js';

// 减速：取最强 pct，持续取较晚 until（刷新）。
export function applySlow(e, pct, dur, now) {
  const c = e.statuses.slow;
  if (!c || c.until <= now) e.statuses.slow = { pct, until: now + dur };
  else e.statuses.slow = { pct: Math.max(pct, c.pct), until: Math.max(c.until, now + dur) };
}

// 定身：取较晚 until（不缩短现有）。
export function applyStun(e, dur, now) {
  const u = now + dur;
  if (!e.statuses.stun || e.statuses.stun.until < u) e.statuses.stun = { until: u };
}

// 灼烧：每层独立计时，最多 BURN_MAX_STACKS 层；满层则刷新最早到期的一层。记来源将 src（成就归因）。
export function applyBurn(e, dps, dur, now, src = null, max = BAL.BURN_MAX_STACKS) {
  const arr = (e.statuses.burn || []).filter((b) => b.until > now);
  if (arr.length < max) arr.push({ dps, until: now + dur, src });
  else { arr.sort((a, b) => a.until - b.until); arr[0] = { dps, until: now + dur, src }; }
  e.statuses.burn = arr;
}

// 当前有效速度：定身=0；否则 speed×(1-最强减速)。
export function effectiveSpeed(e, now) {
  const s = e.statuses;
  if (s.stun && s.stun.until > now) return 0;
  const slow = (s.slow && s.slow.until > now) ? s.slow.pct : 0;
  return e.speed * (1 - slow);
}
