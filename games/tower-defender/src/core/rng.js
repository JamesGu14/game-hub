// core/rng.js — 确定性伪随机（mulberry32）。copy-and-own 自 caocao-zhuan/src/core/rng.js。
// 契约: export function makeRng(seed) -> () => float[0,1)  可复现（暴击/出兵种子化、单测可定值）。

function hashStringToInt(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a;
  if (typeof seed === 'string') a = hashStringToInt(seed);
  else if (typeof seed === 'number' && Number.isFinite(seed)) a = seed >>> 0;
  else a = (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
  if (a === 0) a = 0x9e3779b9;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
