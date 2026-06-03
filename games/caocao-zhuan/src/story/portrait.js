// story/portrait.js — 程序化国风/低多边形武将立绘（纯 canvas，无 Three.js）
//
// 契约（plan §1.8）：
//   export function portraitDataURL(appearance) -> string   // PNG dataURL
//
// 思路：按 appearance 的颜色（armor / accent / skin / helmet / banner）+ 由
//   appearance.portraitSeed 派生的确定性种子，画一张写意半身像：
//     朱/墨渐变背景 → 旗号印章（banner.char）→ 披风/铠甲（armor+accent）→
//     颈 → 面（skin，眉/眼/须随种子微变）→ 头盔（helmet：crest 盔缨 / cap 巾帻 /
//     plume 翎羽 / 默认 简盔）。
//   同一 portraitSeed 必定得到同一张图（face/brow 由种子决定），并按 seed 缓存。
//
// 仅在浏览器环境绘制（document/canvas）；node --check 仅校验语法。

// --- 确定性 RNG（mulberry32 + 字符串 hash 取种）------------------------------
function hashSeed(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- 颜色工具 -----------------------------------------------------------------
function hex(c, fallback) {
  const n = typeof c === 'number' ? c : fallback;
  return '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
}

// 整数色按 factor 调亮(>1)/调暗(<1)
function shade(c, factor) {
  const n = (typeof c === 'number' ? c : 0x808080) >>> 0;
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r * factor)));
  g = Math.max(0, Math.min(255, Math.round(g * factor)));
  b = Math.max(0, Math.min(255, Math.round(b * factor)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

const W = 220;
const H = 260;

// dataURL 缓存（key = portraitSeed，回退到颜色组合）
const cache = new Map();

function cacheKey(appearance) {
  const a = appearance || {};
  return (
    a.portraitSeed != null
      ? String(a.portraitSeed)
      : `${a.armor}|${a.accent}|${a.skin}|${a.helmet}|${a.banner && a.banner.char}`
  );
}

/**
 * 生成一张武将半身立绘并返回 PNG dataURL（同一 seed 缓存复用）。
 * @param {object} appearance generals.js 中的 appearance 对象
 * @returns {string} data:image/png;base64,...
 */
export function portraitDataURL(appearance) {
  const a = appearance || {};
  const key = cacheKey(a);
  const cached = cache.get(key);
  if (cached) return cached;

  // 非浏览器环境（node --check 之外不会走到）兜底返回空字符串。
  if (typeof document === 'undefined' || !document.createElement) return '';

  const seedStr = a.portraitSeed != null ? a.portraitSeed : key;
  const rnd = mulberry32(hashSeed(seedStr));

  const armor = typeof a.armor === 'number' ? a.armor : 0x2a3550;
  const accent = typeof a.accent === 'number' ? a.accent : 0xb8902c;
  const skin = typeof a.skin === 'number' ? a.skin : 0xe7b98a;
  const helmet = a.helmet || 'cap';
  const banner = a.banner || {};
  const bannerColor = typeof banner.color === 'number' ? banner.color : armor;
  const bannerChar = typeof banner.char === 'string' ? banner.char : '';

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const x = cv.getContext('2d');

  // ── 背景：墨夜径向 + 旗号印章 ──────────────────────────────
  const bg = x.createRadialGradient(W * 0.5, H * 0.42, 20, W * 0.5, H * 0.5, H * 0.72);
  bg.addColorStop(0, shade(bannerColor, 0.9));
  bg.addColorStop(0.6, shade(0x161d2e, 1.0));
  bg.addColorStop(1, '#0c1018');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);

  // 写意笔触光晕（种子微扰位置）
  x.globalAlpha = 0.12;
  x.fillStyle = hex(accent, 0xb8902c);
  for (let i = 0; i < 5; i++) {
    const px = W * (0.2 + rnd() * 0.6);
    const py = H * (0.1 + rnd() * 0.5);
    const rr = 26 + rnd() * 40;
    x.beginPath();
    x.arc(px, py, rr, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;

  // 右上角旗号印章（朱底白字）
  if (bannerChar) {
    const bx = W - 46;
    const by = 16;
    x.fillStyle = hex(bannerColor, armor);
    roundRect(x, bx, by, 34, 38, 5);
    x.fill();
    x.strokeStyle = 'rgba(255,246,224,0.55)';
    x.lineWidth = 2;
    roundRect(x, bx, by, 34, 38, 5);
    x.stroke();
    x.fillStyle = '#fff6e0';
    x.font = 'bold 26px "STKaiti","KaiTi","Songti SC","STSong",serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(bannerChar[0], bx + 17, by + 21);
  }

  // ── 披风（armor 暗）+ 双肩甲（accent）──────────────────────
  const shoulderY = H * 0.66;
  const neckX = W * 0.5;

  // 披风：从颈部张开到底边
  x.fillStyle = shade(armor, 0.78);
  x.beginPath();
  x.moveTo(neckX - 16, shoulderY - 34);
  x.lineTo(W * 0.06, H);
  x.lineTo(W * 0.94, H);
  x.lineTo(neckX + 16, shoulderY - 34);
  x.closePath();
  x.fill();

  // 内袍（accent 暗），呈梯形胸甲
  x.fillStyle = shade(accent, 0.6);
  x.beginPath();
  x.moveTo(neckX - 38, H);
  x.lineTo(neckX - 26, shoulderY - 16);
  x.lineTo(neckX + 26, shoulderY - 16);
  x.lineTo(neckX + 38, H);
  x.closePath();
  x.fill();

  // 胸甲护片（armor）+ 金边（accent）
  x.fillStyle = hex(armor, 0x2a3550);
  x.beginPath();
  x.moveTo(neckX - 30, H);
  x.lineTo(neckX - 22, shoulderY - 6);
  x.lineTo(neckX + 22, shoulderY - 6);
  x.lineTo(neckX + 30, H);
  x.closePath();
  x.fill();
  x.strokeStyle = hex(accent, 0xb8902c);
  x.lineWidth = 3;
  x.stroke();

  // 双肩低多边形护肩
  x.fillStyle = hex(accent, 0xb8902c);
  polygon(x, [
    [neckX - 52, shoulderY + 2],
    [neckX - 18, shoulderY - 18],
    [neckX - 14, shoulderY + 16],
    [neckX - 48, shoulderY + 28],
  ]);
  polygon(x, [
    [neckX + 52, shoulderY + 2],
    [neckX + 18, shoulderY - 18],
    [neckX + 14, shoulderY + 16],
    [neckX + 48, shoulderY + 28],
  ]);

  // ── 颈 + 面 ───────────────────────────────────────────────
  const faceCx = neckX;
  const faceCy = H * 0.4;
  const faceW = 56;
  const faceH = 70;

  // 颈
  x.fillStyle = shade(skin, 0.86);
  x.fillRect(faceCx - 13, faceCy + faceH * 0.32, 26, 32);

  // 面（低多边形：略带棱角的六边脸，下巴宽窄由种子定）
  const jaw = 0.78 + rnd() * 0.22; // 下巴宽度系数
  x.fillStyle = hex(skin, 0xe7b98a);
  polygon(x, [
    [faceCx, faceCy - faceH * 0.5],
    [faceCx + faceW * 0.5, faceCy - faceH * 0.18],
    [faceCx + faceW * 0.42 * jaw, faceCy + faceH * 0.36],
    [faceCx, faceCy + faceH * 0.52],
    [faceCx - faceW * 0.42 * jaw, faceCy + faceH * 0.36],
    [faceCx - faceW * 0.5, faceCy - faceH * 0.18],
  ]);
  // 颧骨高光（种子定侧）
  x.globalAlpha = 0.25;
  x.fillStyle = shade(skin, 1.12);
  const hl = rnd() < 0.5 ? -1 : 1;
  x.beginPath();
  x.ellipse(faceCx + hl * 14, faceCy + 4, 12, 18, 0, 0, Math.PI * 2);
  x.fill();
  x.globalAlpha = 1;

  // 眉（粗细/倾角随种子；浓眉/剑眉之别）
  const browTilt = -0.18 + rnd() * 0.5; // 上扬程度
  const browThick = 3 + Math.round(rnd() * 3);
  x.strokeStyle = shade(skin, 0.32);
  x.lineWidth = browThick;
  x.lineCap = 'round';
  for (const s of [-1, 1]) {
    const ex = faceCx + s * 15;
    const ey = faceCy - 8;
    x.beginPath();
    x.moveTo(ex - s * 11, ey + s * 0 + browTilt * 6);
    x.lineTo(ex + s * 9, ey - browTilt * 6);
    x.stroke();
  }

  // 眼（瞳偏移随种子，写意一抹）
  const eyeGaze = (rnd() - 0.5) * 4;
  x.fillStyle = '#2a2018';
  for (const s of [-1, 1]) {
    const ex = faceCx + s * 14;
    const ey = faceCy + 1;
    x.beginPath();
    x.ellipse(ex, ey, 5.5, 3.4, 0, 0, Math.PI * 2);
    x.fillStyle = '#fffdf5';
    x.fill();
    x.beginPath();
    x.ellipse(ex + eyeGaze, ey, 2.6, 2.8, 0, 0, Math.PI * 2);
    x.fillStyle = '#241a12';
    x.fill();
  }

  // 鼻 + 口（写意短线）
  x.strokeStyle = shade(skin, 0.6);
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(faceCx, faceCy + 4);
  x.lineTo(faceCx - 3, faceCy + 16);
  x.lineTo(faceCx + 3, faceCy + 17);
  x.stroke();
  x.strokeStyle = shade(skin, 0.45);
  x.beginPath();
  x.moveTo(faceCx - 8, faceCy + 26);
  x.quadraticCurveTo(faceCx, faceCy + 29 + rnd() * 2, faceCx + 8, faceCy + 26);
  x.stroke();

  // 须（种子决定有无 / 浓淡：渠帅/力士可能无须）
  const beardKind = rnd();
  if (beardKind > 0.45) {
    x.fillStyle = shade(skin, 0.28);
    x.globalAlpha = 0.85;
    // 颔下短须
    polygon(x, [
      [faceCx - 12, faceCy + 28],
      [faceCx + 12, faceCy + 28],
      [faceCx + 6, faceCy + 30 + (beardKind > 0.8 ? 26 : 12)],
      [faceCx - 6, faceCy + 30 + (beardKind > 0.8 ? 26 : 12)],
    ]);
    x.globalAlpha = 1;
  }

  // ── 头盔 / 巾帻 ───────────────────────────────────────────
  drawHelmet(x, helmet, faceCx, faceCy, faceW, faceH, armor, accent, rnd);

  // 写意金色描边镜框
  x.strokeStyle = hex(accent, 0xb8902c);
  x.lineWidth = 5;
  x.strokeRect(3, 3, W - 6, H - 6);

  const url = cv.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

// --- 头盔绘制（按 helmet 类型）------------------------------------------------
function drawHelmet(x, helmet, cx, cy, fw, fh, armor, accent, rnd) {
  const topY = cy - fh * 0.5;
  // 盔体：盖住额头的弧形帽（armor 亮一档）
  x.fillStyle = shade(armor, 1.12);
  x.beginPath();
  x.moveTo(cx - fw * 0.52, topY + 12);
  x.quadraticCurveTo(cx, topY - fh * 0.42, cx + fw * 0.52, topY + 12);
  x.lineTo(cx + fw * 0.42, topY + 18);
  x.quadraticCurveTo(cx, topY - 4, cx - fw * 0.42, topY + 18);
  x.closePath();
  x.fill();
  // 盔额金饰
  x.fillStyle = hex(accent, 0xb8902c);
  x.beginPath();
  x.arc(cx, topY + 2, 6, 0, Math.PI * 2);
  x.fill();

  if (helmet === 'crest') {
    // 盔缨：顶部一束朱红/金缨随种子摆向
    const sway = (rnd() - 0.5) * 10;
    x.fillStyle = hex(accent, 0xb8902c);
    polygon(x, [
      [cx - 5, topY - 6],
      [cx + 5, topY - 6],
      [cx + 9 + sway, topY - 34],
      [cx + sway, topY - 40],
      [cx - 9 + sway, topY - 34],
    ]);
    x.fillStyle = shade(accent, 1.25);
    polygon(x, [
      [cx - 2, topY - 8],
      [cx + 2, topY - 8],
      [cx + 4 + sway, topY - 30],
      [cx - 4 + sway, topY - 30],
    ]);
  } else if (helmet === 'plume') {
    // 翎羽：两侧斜插长翎
    x.strokeStyle = shade(accent, 1.15);
    x.lineWidth = 4;
    x.lineCap = 'round';
    for (const s of [-1, 1]) {
      x.beginPath();
      x.moveTo(cx + s * 16, topY - 2);
      x.quadraticCurveTo(cx + s * 34, topY - 30, cx + s * 26, topY - 48 - rnd() * 8);
      x.stroke();
    }
  } else if (helmet === 'cap') {
    // 巾帻：布巾，盔体上覆一层软帽脚（banner 暗布）
    x.fillStyle = shade(armor, 0.92);
    polygon(x, [
      [cx - fw * 0.5, topY + 10],
      [cx + fw * 0.5, topY + 10],
      [cx + fw * 0.38, topY - 6],
      [cx, topY - 14],
      [cx - fw * 0.38, topY - 6],
    ]);
    // 帻脚（两侧垂带）
    x.fillStyle = shade(armor, 0.8);
    x.fillRect(cx - fw * 0.5, topY + 8, 7, 22);
    x.fillRect(cx + fw * 0.5 - 7, topY + 8, 7, 22);
  }
  // 默认（其它值）：仅简盔，无额外装饰。
}

// --- 小几何工具 ---------------------------------------------------------------
function polygon(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx, rx, ry, rw, rh, r) {
  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
  ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
  ctx.arcTo(rx, ry + rh, rx, ry, r);
  ctx.arcTo(rx, ry, rx + rw, ry, r);
  ctx.closePath();
}

// 立绘画布逻辑尺寸（供 dialogue.js 排版参考）
export const PORTRAIT_W = W;
export const PORTRAIT_H = H;

export default portraitDataURL;
