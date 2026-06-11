// render/ground.js — [背景spec] 章节化地表:布点纯函数 + 离屏烘焙 + 轻动效。
// 布点零 canvas/DOM(node 可单测);seed='ground-'+level.id 走 makeRng,零 Math.random。
// 烘焙只持当前关 1 张(≈7MB,防 50 关全缓存 OOM);BAL.GROUND_THEMES=false 时本模块不被触达。
import { BAL } from '../data/balance.js';
import { makeRng } from '../core/rng.js';
import { themeOf } from '../data/chapterThemes.js';
import { terrainTypeAt } from '../systems/terrainSystem.js';

const C = BAL.CELL;
const key = (x, y) => x + ',' + y;

// —— 布点助手(spec §5.1):路径格展开 / 硬禁区 / 软禁区(沿路 8 邻 1 格) ——
// 注:路径段须轴对齐(dx/dy 必有一为零,50关数据均满足);对角段会步进不达终点,勿喂斜段。
export function pathCellSet(level) {
  const set = new Set();
  for (const id in level.paths) {
    const wp = level.paths[id];
    for (let i = 1; i < wp.length; i++) {
      const a = wp[i - 1], b = wp[i];
      const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
      let x = a.x, y = a.y;
      set.add(key(x, y));
      while (x !== b.x || y !== b.y) { x += dx; y += dy; set.add(key(x, y)); }
    }
  }
  return set;
}

export function hardBanSet(level, pathSet) {
  const ban = new Set(pathSet);
  for (const s of level.slots) ban.add(key(s.x, s.y));
  const { c, r, w, h } = level.castle;
  for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) ban.add(key(x, y));
  for (let x = c; x < c + w; x++) ban.add(key(x, r + h));                  // 城名牌行(spec §5.1)
  for (const cp of level.camps) {
    ban.add(key(cp.c, cp.r));
    if (cp.r + 1 < level.rows) ban.add(key(cp.c, cp.r + 1));   // 名牌格盘内才加(底行营无名牌行,防越界key埋雷)
  }
  for (let y = 0; y < level.rows; y++) for (let x = 0; x < level.cols; x++) {
    if (terrainTypeAt(level, x, y)) ban.add(key(x, y));                    // 玩法地形:复用 terrainAt,不造第二套索引
  }
  return ban;
}

// 注:边缘路径格的8邻会产生越界/负坐标 key;布点扫描只走盘内格,越界 key 静默无害。
export function softBanSet(level, pathSet) {
  const soft = new Set();
  for (const k of pathSet) {
    const [x, y] = k.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k2 = key(x + dx, y + dy);
      if (!pathSet.has(k2)) soft.add(k2);
    }
  }
  return soft;
}

// —— 布点主算法(spec §5):顺序 禁区→抖动→地标→拼块→小景→动效;先布者抢位(占用集) ——
// 输出全部格坐标制(cell 单位,可含小数);像素换算只在绘制侧 ×C。纯函数,node 可单测。
export function computeGroundLayout(level) {
  const theme = themeOf(level.chapter);
  const rng = makeRng('ground-' + level.id);
  const pathSet = pathCellSet(level);
  const hard = hardBanSet(level, pathSet);
  const soft = softBanSet(level, pathSet);
  const occupied = new Set();
  const free = [], strictFree = [];
  for (let y = 0; y < level.rows; y++) for (let x = 0; x < level.cols; x++) {
    const k = key(x, y);
    if (hard.has(k)) continue;
    free.push({ x, y });
    if (!soft.has(k)) strictFree.push({ x, y });
  }
  // ① 色抖动:自由格 12-18% 种子抽样
  const jitterCells = [];
  const rate = 0.12 + rng() * 0.06;
  for (const c0 of free) {
    if (rng() < rate) jitterCells.push({ x: c0.x, y: c0.y, colorIdx: Math.floor(rng() * theme.jitter.length) });
  }
  // ② 地标最先落(候选约束最严,优先抢位;spec §5.0)
  const landmark = placeLandmark(level, theme, rng, hard, soft, occupied, pathSet);
  // ③ 拼块 2-4
  const patches = placePatches(level, theme, rng, hard, occupied, strictFree, free);
  // ④ 小景 10-16
  const decors = placeDecors(theme, rng, occupied, free);
  // ⑤ 轻动效 2-3(从实际布上的可动项挑;不足减量,0 合法)
  const accents = pickAccents(theme, rng, patches, decors, landmark);
  return { jitterCells, patches, decors, landmark, accents };
}

// 2×2 块自由:界内、非硬禁区、非占用;checkSoft=true 时还须非软禁区
function blockFree(x, y, level, hard, soft, occupied, checkSoft) {
  for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
    const X = x + dx, Y = y + dy;
    if (X < 0 || Y < 0 || X >= level.cols || Y >= level.rows) return false;
    const k = key(X, Y);
    if (hard.has(k) || occupied.has(k) || (checkSoft && soft.has(k))) return false;
  }
  return true;
}

// 地标:种子选型 → 全盘扫描候选(硬+软禁区外/距城堡切比雪夫>4/2×2自由),取离路最远者(严格>,平手保行序首个)
function placeLandmark(level, theme, rng, hard, soft, occupied, pathSet) {
  const kind = theme.landmarks[Math.floor(rng() * theme.landmarks.length)];
  const ccx = level.castle.c + level.castle.w / 2, ccy = level.castle.r + level.castle.h / 2;
  const pathCells = [...pathSet].map((k) => k.split(',').map(Number));
  let best = null, bestD = -1;
  for (let y = 0; y < level.rows - 1; y++) for (let x = 0; x < level.cols - 1; x++) {
    if (Math.max(Math.abs(x + 0.5 - ccx), Math.abs(y + 0.5 - ccy)) <= 4) continue;
    if (!blockFree(x, y, level, hard, soft, occupied, true)) continue;
    let d = Infinity;
    for (const [px, py] of pathCells) {
      const dd = Math.max(Math.abs(px - x), Math.abs(py - y));
      if (dd < d) d = dd;
    }
    if (d > bestD) { bestD = d; best = { kind, x, y }; }
  }
  if (best) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) occupied.add(key(best.x + dx, best.y + dy));
  return best;   // null = 该关无地标(合法,spec §5.5)
}

// 瓣外接矩形覆盖的格(cell 坐标制)
function lobeCells(cx, cy, rx, ry) {
  const cells = [];
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry) - 1; y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx) - 1; x++) cells.push([x, y]);
  return cells;
}

// 拼块:锚点(硬+软+占用之外,2×2 自由,重试≤20)→ 2-3 椭圆瓣;瓣触硬禁区/占用 → 半径×0.7 重试≤3 → 放弃瓣。
// ch2 亲水(spec §5.6):waterAffinity 拼块的锚点池里,8 邻邻水候选重复入池 3 次(=权重×3,纯种子抽样)。
function placePatches(level, theme, rng, hard, occupied, strictFree, free) {
  const patches = [];
  const want = 2 + Math.floor(rng() * 3);                                  // 2-4
  for (let p = 0; p < want; p++) {
    // 首块强制 accentPatch(若有):保证该章可动拼块必在,动效数量下限有保障(spec §5.7 工程落地)
    const kind = (p === 0 && theme.accentPatch) ? theme.accentPatch : theme.patches[Math.floor(rng() * theme.patches.length)];
    let pool = strictFree;
    if (theme.waterAffinity.includes(kind)) {
      pool = [];
      for (const c0 of strictFree) {
        pool.push(c0);
        let waterside = false;
        for (let dy = -1; dy <= 1 && !waterside; dy++) for (let dx = -1; dx <= 1; dx++) {
          const t = terrainTypeAt(level, c0.x + dx, c0.y + dy);
          if (t === 'river' || t === 'shallow') { waterside = true; break; }
        }
        if (waterside) pool.push(c0, c0);
      }
    }
    if (!pool.length && !free.length) continue;   // 仅两池全空才放弃(稠密板 strictFree 可为空,L36/47)
    let anchor = null;
    if (pool.length) for (let tr = 0; tr < 20 && !anchor; tr++) {          // 选位重试 ≤20(spec §5.3)
      const c0 = pool[Math.floor(rng() * pool.length)];
      if (blockFree(c0.x, c0.y, level, hard, null, occupied, false)) anchor = c0;
    }
    // [spec §5.3 偏差·缩量前最后努力] 严格池(硬+软之外)20次全败 → 放开软禁区从 free 再试20次;
    // 瓣的硬禁区零接触不变(lobe 检查未动),仅锚点可落软缓冲,视觉=拼块贴路,低对比无害。
    for (let tr = 0; tr < 20 && !anchor; tr++) {
      const c0 = free[Math.floor(rng() * free.length)];
      if (blockFree(c0.x, c0.y, level, hard, null, occupied, false)) anchor = c0;
    }
    // [缩量第三级] 2×2 锚两轮全败(稠密板:将位+路网+地形切碎空间)→ 单自由格作小拼块锚,
    // 锚须距地图边缘≥1格(保证 rx≤1.0 的瓣不出界);blob 中心=格中心;瓣偏移=0、rx 压≤1.0;
    // 拼块"小而有"优于"无";瓣硬禁区检查不变,不变量不破。
    let small = false;
    for (let tr = 0; tr < 20 && !anchor; tr++) {
      const c0 = free[Math.floor(rng() * free.length)];
      if (!occupied.has(key(c0.x, c0.y)) &&
          c0.x >= 1 && c0.y >= 1 && c0.x <= level.cols - 2 && c0.y <= level.rows - 2) {
        anchor = c0; small = true;
      }
    }
    if (!anchor) continue;
    const cx = anchor.x + (small ? 0.5 : 1), cy = anchor.y + (small ? 0.5 : 1);   // 2×2 块中心 / 小锚=格中心
    const lobes = [];
    const nLobes = 2 + (rng() < 0.5 ? 0 : 1);                              // 2-3 瓣
    for (let i = 0; i < nLobes; i++) {
      const dxRaw = rng() * 1.6 - 0.8, dyRaw = rng() * 1.6 - 0.8;
      const dx = small ? 0 : dxRaw;                                        // 小锚:瓣贴格中心,零偏移免出界
      const dy = small ? 0 : dyRaw;
      let rx = 1.2 + rng() * 1.3;
      if (small) rx = 0.49;                                                // 小锚:瓣=锚格本身(单格确保非hard),免碰禁
      for (let s = 0; s <= 3; s++) {
        const ry = rx * (i % 2 ? 0.85 : 0.6);                              // 交替扁圆(确定性,不耗 rng)
        const bad = lobeCells(cx + dx, cy + dy, rx, ry).some(([X, Y]) =>
          X < 0 || Y < 0 || X >= level.cols || Y >= level.rows || hard.has(key(X, Y)) || occupied.has(key(X, Y)));
        if (!bad) { lobes.push({ dx, dy, rx, ry }); break; }
        rx *= 0.7;                                                          // 触禁 → 收缩重试(spec §5.3)
      }
    }
    if (!lobes.length) {
      // [缩量终防线] 2×2 锚成立但大瓣全灭(偏移探进周边硬禁区/占用)→ 锚格自身单格小瓣保底,
      // 锚格已经 blockFree/选格验证 free+未占,单格瓣(中心=锚格中心,rx0.49)数学上必不触禁。
      lobes.push({ dx: small ? 0 : -0.5, dy: small ? 0 : -0.5, rx: 0.49, ry: 0.42 });
    }
    patches.push({ kind, cx, cy, lobes });
    for (const lb of lobes) for (const [X, Y] of lobeCells(cx + lb.dx, cy + lb.dy, lb.rx, lb.ry)) {
      if (X >= 0 && Y >= 0 && X < level.cols && Y < level.rows) occupied.add(key(X, Y));   // 拼块内部=占用(散布小景避开)
    }
  }
  return patches;
}

// 小景:章池种子抽,自由格(软禁区可入)、非占用,每格≤1,重试≤20/个
function placeDecors(theme, rng, occupied, free) {
  const decors = [];
  const want = 10 + Math.floor(rng() * 7);                                 // 10-16
  for (let i = 0; i < want; i++) {
    const kind = theme.decors[Math.floor(rng() * theme.decors.length)];
    for (let tr = 0; tr < 20; tr++) {
      const c0 = free[Math.floor(rng() * free.length)];
      const k = key(c0.x, c0.y);
      if (occupied.has(k)) continue;
      decors.push({ kind, x: c0.x, y: c0.y, variant: Math.floor(rng() * 3) });
      occupied.add(k);
      break;
    }
  }
  return decors;
}

// 轻动效:候选=实际布上的可动项(spec §5.7);ch4 狼烟仅石塔,无则退蕨丛;无放回抽 2-3 个
function pickAccents(theme, rng, patches, decors, landmark) {
  const cands = [];
  if (theme.accent === 'flowerTwinkle') {
    for (const p of patches) if (p.kind === 'flowerField') for (const lb of p.lobes) cands.push({ kind: 'flowerTwinkle', x: p.cx + lb.dx, y: p.cy + lb.dy });
    for (const d of decors) if (d.kind === 'flower') cands.push({ kind: 'flowerTwinkle', x: d.x + 0.5, y: d.y + 0.5 });
  } else if (theme.accent === 'reedSway') {
    for (const p of patches) if (p.kind === 'reedCluster') for (const lb of p.lobes) {
      cands.push({ kind: 'reedSway', x: p.cx + lb.dx - lb.rx * 0.35, y: p.cy + lb.dy });
      cands.push({ kind: 'reedSway', x: p.cx + lb.dx + lb.rx * 0.35, y: p.cy + lb.dy + lb.ry * 0.25 });   // 每瓣2点,候选密度×2(同瓣不同位,防动效叠点)
    }
  } else if (theme.accent === 'bambooSway') {
    for (const p of patches) if (p.kind === 'bamboo') for (const lb of p.lobes) {
      cands.push({ kind: 'bambooSway', x: p.cx + lb.dx - lb.rx * 0.35, y: p.cy + lb.dy });
      cands.push({ kind: 'bambooSway', x: p.cx + lb.dx + lb.rx * 0.35, y: p.cy + lb.dy + lb.ry * 0.25 });
    }
  } else if (theme.accent === 'smokeRise') {
    for (const d of decors) if (d.kind === 'fern') cands.push({ kind: 'fernSway', x: d.x + 0.5, y: d.y + 0.5 });   // 蕨丛微动(狼烟降级/补足,spec §7)
  } else if (theme.accent === 'leafDrift') {
    for (const d of decors) if (d.kind === 'leaf') cands.push({ kind: 'leafDrift', x: d.x + 0.5, y: d.y + 0.5 });
  }
  const accents = [];
  if (theme.accent === 'smokeRise' && landmark && landmark.kind === 'stoneTower') {
    accents.push({ kind: 'smokeRise', x: landmark.x + 1, y: landmark.y + 1, phase: rng() * Math.PI * 2 });   // 狼烟保底(地标卖点不进抽样池)
  }
  // want 可为 0(狼烟保底已占预算);负不可达——保底恒≤1。
  const want = Math.min(2 + Math.floor(rng() * 2) - accents.length, cands.length);   // 总量仍 2-3,不足减量,0 合法
  for (let i = 0; i < want; i++) {
    const idx = Math.floor(rng() * cands.length);
    accents.push({ ...cands.splice(idx, 1)[0], phase: rng() * Math.PI * 2 });
  }
  return accents;
}

// —— 元素小件(拼块 painter 与段2小景/动效共用;描边+投影规格与建筑同族,spec 精修②) ——
const SHADOW = 'rgba(0,0,0,.18)';
function ellipseFill(ctx, x, y, rx, ry, fill, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = fill;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
function shadowAt(ctx, x, y, rx) { ellipseFill(ctx, x, y, rx, rx * 0.32, SHADOW); }
// 软边椭圆:优先 ctx.filter(只在烘焙用);不支持(旧 iPad Safari<17.4)→ 同心三层退化(spec §3)
function softEllipse(ctx, x, y, rx, ry, fill, blurOk) {
  if (blurOk) {
    ctx.filter = 'blur(3px)';
    ellipseFill(ctx, x, y, rx, ry, fill, 0.9);
    ctx.filter = 'none';
  } else {
    ellipseFill(ctx, x, y, rx * 1.15, ry * 1.15, fill, 0.25);
    ellipseFill(ctx, x, y, rx * 1.07, ry * 1.07, fill, 0.35);
    ellipseFill(ctx, x, y, rx, ry, fill, 0.85);
  }
}
function softLobes(ctx, p, fills, blurOk) {   // fills:单色 [c] 或按瓣交替 [c1,c2]
  p.lobes.forEach((lb, i) =>
    softEllipse(ctx, (p.cx + lb.dx) * C, (p.cy + lb.dy) * C, lb.rx * C, lb.ry * C, fills[i % fills.length], blurOk));
}
// 瓣内确定性散点 k 个:角度黄金角递进+半径分层(零 rng → 烘焙可复现;像素坐标)
function lobeSpots(p, lb, k) {
  const spots = [];
  for (let i = 0; i < k; i++) {
    const ang = i * 2.4 + p.cx * 0.7 + p.cy * 1.3;
    const rad = 0.25 + 0.55 * ((i % 3) / 2);
    spots.push({ x: (p.cx + lb.dx + Math.cos(ang) * lb.rx * rad) * C, y: (p.cy + lb.dy + Math.sin(ang) * lb.ry * rad) * C });
  }
  return spots;
}
function flowerAt(ctx, x, y, col) {
  ctx.strokeStyle = col.stem; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y); ctx.stroke();
  ctx.fillStyle = col.petal;
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = col.flowerCore; ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
}
function crownAt(ctx, x, y, r, fill, outline) {
  ctx.fillStyle = fill; ctx.strokeStyle = outline; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
function treeAt(ctx, x, y, r, crownFill, col) {        // 圆冠树(grove/孤树)
  shadowAt(ctx, x, y + r * 1.5, r * 1.3);
  ctx.fillStyle = col.trunk; ctx.strokeStyle = col.trunkOutline; ctx.lineWidth = 1;
  ctx.fillRect(x - 2, y + r * 0.5, 4, r * 0.9); ctx.strokeRect(x - 2, y + r * 0.5, 4, r * 0.9);
  crownAt(ctx, x, y, r, crownFill, col.crownOutline);
  ellipseFill(ctx, x - r * 0.3, y - r * 0.4, r * 0.4, r * 0.32, col.crownHi, 0.85);
}
function pineAt(ctx, x, y, h, fill, col) {             // 松(三角冠)
  shadowAt(ctx, x, y + h * 0.55, h * 0.45);
  ctx.fillStyle = col.trunk; ctx.fillRect(x - 1.5, y + h * 0.35, 3, h * 0.2);
  ctx.fillStyle = fill; ctx.strokeStyle = col.pineOutline; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - h * 0.32, y + h * 0.4); ctx.lineTo(x + h * 0.32, y + h * 0.4); ctx.lineTo(x, y - h * 0.5); ctx.closePath();
  ctx.fill(); ctx.stroke();
}
function rockAt(ctx, x, y, r, col) {                   // 岩块(三角面)
  shadowAt(ctx, x, y + r * 0.5, r);
  ctx.fillStyle = col.rock; ctx.strokeStyle = col.rockOutline; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - r, y + r * 0.5); ctx.lineTo(x - r * 0.2, y - r * 0.7); ctx.lineTo(x + r * 0.9, y + r * 0.5); ctx.closePath();
  ctx.fill(); ctx.stroke();
}
function reedAt(ctx, x, y, col, sway) {                // 芦苇(sway=苇顶 x 偏移;烘焙传 0,动效传 sin)
  ctx.strokeStyle = col.reed; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sway, y - 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x - 5 + sway, y - 8, x - 8 + sway, y - 12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.quadraticCurveTo(x + 5 + sway, y - 8, x + 8 + sway, y - 12); ctx.stroke();
  ctx.fillStyle = col.reedHead;
  ctx.beginPath(); ctx.ellipse(x + sway, y - 16, 1.5, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'butt'; ctx.lineWidth = 1;             // 复位中性值,防下游首笔串扰(质量审 M-2)
}

// —— 拼块 painter 注册表(spec §2/§4):签名 (ctx, patch, theme.colors, blurOk);取色只准经 colors ——
const PATCH_PAINTERS = {
  meadow(ctx, p, col, blurOk) {                        // ch1/ch4 共用(各章 colors.meadow 不同)
    softLobes(ctx, p, [col.meadow], blurOk);
    const lb = p.lobes[0];
    softEllipse(ctx, (p.cx + lb.dx - lb.rx * 0.25) * C, (p.cy + lb.dy - lb.ry * 0.3) * C, lb.rx * 0.5 * C, lb.ry * 0.45 * C, col.meadowHi, blurOk);
  },
  flowerField(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.field, col.fieldB], blurOk);
    for (const lb of p.lobes) for (const s of lobeSpots(p, lb, 4)) flowerAt(ctx, s.x, s.y, col);
  },
  grove(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.groveBase], blurOk);
    for (const lb of p.lobes) {
      const s = lobeSpots(p, lb, 2);
      treeAt(ctx, s[0].x, s[0].y, C * 0.30, col.crownA, col);
      treeAt(ctx, s[1].x, s[1].y, C * 0.24, col.crownB, col);
    }
  },
  sandbar(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.sandbar], blurOk);
    const lb = p.lobes[0];
    softEllipse(ctx, (p.cx + lb.dx) * C, (p.cy + lb.dy - lb.ry * 0.3) * C, lb.rx * 0.6 * C, lb.ry * 0.4 * C, col.sandbarHi, blurOk);
  },
  reedCluster(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.reedBase], blurOk);
    for (const lb of p.lobes) for (const s of lobeSpots(p, lb, 3)) reedAt(ctx, s.x, s.y, col, 0);
  },
  dryField(ctx, p, col) {                              // 旱田:瓣外接盒转圆角矩形+横垄
    for (const lb of p.lobes) {
      const x = (p.cx + lb.dx - lb.rx) * C, y = (p.cy + lb.dy - lb.ry) * C, w = lb.rx * 2 * C, h = lb.ry * 2 * C;
      ctx.fillStyle = col.dryField;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
      ctx.strokeStyle = col.furrow; ctx.lineWidth = 2;
      for (let fy = y + 6; fy < y + h - 3; fy += 7) { ctx.beginPath(); ctx.moveTo(x + 5, fy); ctx.lineTo(x + w - 5, fy); ctx.stroke(); }
    }
  },
  bamboo(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.bambooBase], blurOk);
    ctx.strokeStyle = col.stalk; ctx.lineCap = 'round';
    for (const lb of p.lobes) for (const s of lobeSpots(p, lb, 4)) {
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(s.x, s.y + C * 0.4); ctx.lineTo(s.x, s.y - C * 0.45); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x, s.y - C * 0.3); ctx.lineTo(s.x + 6, s.y - C * 0.42); ctx.stroke();
    }
  },
  paddy(ctx, p, col) {                                 // 稻田:圆角矩形+水线+苗点
    for (const lb of p.lobes) {
      const x = (p.cx + lb.dx - lb.rx) * C, y = (p.cy + lb.dy - lb.ry) * C, w = lb.rx * 2 * C, h = lb.ry * 2 * C;
      ctx.fillStyle = col.paddy;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
      ctx.strokeStyle = col.waterLine; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
      for (let fy = y + 8; fy < y + h - 4; fy += 10) { ctx.beginPath(); ctx.moveTo(x + 5, fy); ctx.lineTo(x + w - 5, fy); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.fillStyle = col.sprout;
      for (const s of lobeSpots(p, lb, 4)) { ctx.beginPath(); ctx.arc(s.x, s.y, 1.4, 0, Math.PI * 2); ctx.fill(); }
    }
  },
  wetland(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.wetland], blurOk);
    ctx.fillStyle = col.wetDot; ctx.globalAlpha = 0.7;
    for (const lb of p.lobes) for (const s of lobeSpots(p, lb, 3)) { ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  },
  pineWood(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.pineWoodBase], blurOk);
    for (const lb of p.lobes) {
      const s = lobeSpots(p, lb, 2);
      pineAt(ctx, s[0].x, s[0].y, C * 0.55, col.pineA, col);
      pineAt(ctx, s[1].x, s[1].y, C * 0.42, col.pineB, col);
    }
  },
  rockSlope(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.rockSlope], blurOk);
    for (const lb of p.lobes) {
      const s = lobeSpots(p, lb, 2);
      rockAt(ctx, s[0].x, s[0].y, C * 0.3, col);
      rockAt(ctx, s[1].x, s[1].y, C * 0.22, col);
    }
  },
  mapleWood(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.mapleBase], blurOk);
    for (const lb of p.lobes) {
      const s = lobeSpots(p, lb, 3);
      crownAt(ctx, s[0].x, s[0].y, C * 0.28, col.crownA, col.crownOutline);
      crownAt(ctx, s[1].x, s[1].y, C * 0.33, col.crownB, col.crownOutline);
      crownAt(ctx, s[2].x, s[2].y, C * 0.24, col.crownC, col.crownOutline);
    }
  },
  scorch(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.scorch], blurOk);
    ctx.fillStyle = col.ash;
    for (const lb of p.lobes) for (const s of lobeSpots(p, lb, 4)) { ctx.beginPath(); ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2); ctx.fill(); }
  },
  dryGrass(ctx, p, col, blurOk) {
    softLobes(ctx, p, [col.dryGrass], blurOk);
    const lb = p.lobes[0];
    softEllipse(ctx, (p.cx + lb.dx) * C, (p.cy + lb.dy - lb.ry * 0.25) * C, lb.rx * 0.55 * C, lb.ry * 0.4 * C, col.dryGrassHi, blurOk);
  },
};

// —— 小景 painter(spec §2 各章 decors):签名 (ctx, px, py, variant, colors);variant 0-2 控大小/数量 ——
function fernAt(ctx, x, y, col, sway) {                // 蕨丛(sway 供动效;烘焙传 0)
  ctx.strokeStyle = col.fern; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (const k of [-1, 0, 1]) {
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + k * 5 + sway, y - 7, x + k * 8 + sway, y - 10 + Math.abs(k) * 3);
    ctx.stroke();
  }
  ctx.lineCap = 'butt'; ctx.lineWidth = 1;             // 复位中性值(同 reedAt 惯例,防下游首笔串扰)
}
function leafAt(ctx, x, y, col, rot) {                 // 单片红叶(rot 弧度;动效复用)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = col.leaf;
  ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
const DECOR_PAINTERS = {
  tuft(ctx, x, y, v, col) {
    const s = 0.85 + v * 0.15;
    ctx.strokeStyle = col.tuft; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 3 * s, y - 6 * s, x - 6 * s, y - 8 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 12 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 3 * s, y - 6 * s, x + 6 * s, y - 8 * s); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.lineWidth = 1;
  },
  flower(ctx, x, y, v, col) { flowerAt(ctx, x, y, col); },
  haystack(ctx, x, y, v, col) {
    const r = 7 + v;
    shadowAt(ctx, x, y + 2, r);
    ctx.fillStyle = col.haystack; ctx.strokeStyle = col.haystackOutline; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y); ctx.stroke();
  },
  stone(ctx, x, y, v, col) {
    shadowAt(ctx, x + 2, y + 4, 8);
    ctx.fillStyle = col.stone; ctx.strokeStyle = col.stoneOutline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, 7, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (v > 0) { ctx.beginPath(); ctx.ellipse(x + 9, y + 3, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = col.stoneHi; ctx.beginPath(); ctx.arc(x - 2, y - 2, 1.5, 0, Math.PI * 2); ctx.fill();
  },
  deadBranch(ctx, x, y, v, col) {
    ctx.strokeStyle = col.deadBranch; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 7, y + 3); ctx.lineTo(x + 7, y - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 4); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.lineWidth = 1;
  },
  lotus(ctx, x, y, v, col) {
    ctx.fillStyle = col.lotus; ctx.strokeStyle = col.lotusOutline; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 5 + v, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 9, y + 3, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y - 2); ctx.stroke();   // 叶脉缺口
  },
  bambooShoot(ctx, x, y, v, col) {
    ctx.fillStyle = col.shoot; ctx.strokeStyle = col.bambooBase; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 3, y + 4); ctx.lineTo(x + 3, y + 4); ctx.lineTo(x, y - 7 - v); ctx.closePath();
    ctx.fill(); ctx.stroke();
  },
  lonePine(ctx, x, y, v, col) { pineAt(ctx, x, y, C * (0.5 + v * 0.1), col.pineA, col); },
  rock(ctx, x, y, v, col) { rockAt(ctx, x, y, C * (0.22 + v * 0.05), col); },
  fern(ctx, x, y, v, col) { fernAt(ctx, x, y, col, 0); },
  charStump(ctx, x, y, v, col) {
    shadowAt(ctx, x, y + 5, 6);
    ctx.fillStyle = col.charStump;
    ctx.fillRect(x - 3, y - 6 - v, 6, 11 + v);
    ctx.beginPath(); ctx.ellipse(x, y - 6 - v, 3, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col.ash; ctx.beginPath(); ctx.arc(x + 5, y + 4, 1.5, 0, Math.PI * 2); ctx.fill();
  },
  leaf(ctx, x, y, v, col) { leafAt(ctx, x, y, col, v * 0.6); },
};

// —— 烘焙(spec §3):2× 板像素一次性离屏;只持当前关 1 张(防 50 关全缓存 OOM) ——
let cache = { id: -1, canvas: null, layout: null, vignette: null };

export function bakeGround(level) {
  if (cache.id === level.id && cache.canvas) return cache;
  const t0 = performance.now();
  const layout = computeGroundLayout(level);
  const theme = themeOf(level.chapter);
  const cv = document.createElement('canvas');
  cv.width = level.cols * C * 2; cv.height = level.rows * C * 2;
  const ctx = cv.getContext('2d');
  ctx.scale(2, 2);
  ctx.filter = 'blur(1px)';                            // 软边能力检测(spec §3 兼容退化)
  const blurOk = ctx.filter === 'blur(1px)';
  ctx.filter = 'none';
  paintBase(ctx, level, theme, layout);
  for (const p of layout.patches) {
    const painter = PATCH_PAINTERS[p.kind];
    if (painter) painter(ctx, p, theme.colors, blurOk);
  }
  for (const d of layout.decors) {
    const painter = DECOR_PAINTERS[d.kind];
    if (painter) painter(ctx, (d.x + 0.5) * C, (d.y + 0.6) * C, d.variant, theme.colors);
  }
  cache = { id: level.id, canvas: cv, layout, vignette: null };
  const ms = performance.now() - t0;
  if (ms > 30) console.warn(`[ground] bake L${level.id} ${ms.toFixed(1)}ms > 30ms 预算`);
  return cache;
}

function paintBase(ctx, level, theme, layout) {        // 弱格子 + 种子色抖动
  const [gA, gB] = theme.grass;
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) {
    ctx.fillStyle = ((r + c) & 1) ? gA : gB;
    ctx.fillRect(c * C, r * C, C, C);
  }
  ctx.globalAlpha = 0.3;
  for (const j of layout.jitterCells) {
    ctx.fillStyle = theme.jitter[j.colorIdx];
    ctx.fillRect(j.x * C, j.y * C, C, C);
  }
  ctx.globalAlpha = 1;
}

// 战斗帧:贴 1 张烘焙图(板坐标;比旧版每帧 336 个 fillRect 快)
export function drawGround(ctx, state) {
  const lvl = state.level;
  const { canvas } = bakeGround(lvl);                  // 兜底懒烘(enterLevel 已预烘则直接命中)
  ctx.drawImage(canvas, 0, 0, lvl.cols * C, lvl.rows * C);
}

// 暗角:帧内 1 次填充;渐变对象进关缓存(spec §3,画在路之后压住路的边角)
export function drawVignette(ctx, state) {
  const lvl = state.level;
  const entry = bakeGround(lvl);
  const W = lvl.cols * C, H = lvl.rows * C;
  // 渐变缓存假设:全游戏单 canvas 单 ctx(main.js 加载期 getContext 一次,resize 只改宽高不重建)——
  // CanvasGradient 绑定创建它的 ctx,若未来重建 canvas 元素须在此清 entry.vignette。
  if (!entry.vignette) {
    const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.45, W / 2, H * 0.45, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, themeOf(lvl.chapter).vignette);
    entry.vignette = g;
  }
  ctx.save();   // 主战斗 ctx:fillStyle 不外溢(项目惯例,质量审 I-1)
  ctx.fillStyle = entry.vignette;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
