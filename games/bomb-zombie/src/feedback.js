// feedback.js — 飘字格式化与配色（render 消费）。纯函数。
export const floaterColor = (crit) => (crit ? '#ffd23f' : '#ffffff');
export const floaterSize = (crit) => (crit ? 26 : 16);
export function formatAmount(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
