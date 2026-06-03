// core/rng.js — 确定性伪随机数生成器（mulberry32）
//
// 契约（plan §1.8）：
//   export function makeRng(seed){ return ()=>float[0,1) }   // 可复现
//
// mulberry32：32 位状态、快速、分布良好；同一 seed 序列完全可复现，
// 便于战斗结果回放与单元测试中给定固定 rng 校验确定伤害值。
//
// seed 可为数字或字符串（字符串将哈希成 32 位整数）。

function hashStringToInt(str) {
  // xfnv1a 风格哈希，输出无符号 32 位整数
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a;
  if (typeof seed === 'string') {
    a = hashStringToInt(seed);
  } else if (typeof seed === 'number' && Number.isFinite(seed)) {
    a = seed >>> 0;
  } else {
    // 无 seed 时退化为时间种子（非可复现，仅兜底）
    a = (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
  }
  // 避免全 0 初态
  if (a === 0) a = 0x9e3779b9;

  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0,1)
  };
}
