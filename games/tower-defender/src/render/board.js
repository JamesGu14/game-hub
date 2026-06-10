// render/board.js — 盘面：棋盘格 + 弯曲蜀道 + 将位 + 成都 + 敌营（建筑贴图，缺图回退色块）。只读 state。
// 约定：调用方已把 ctx 变换设到「板像素坐标」（见 main.js camera）。
import { BAL } from '../data/balance.js';
import { tintOf } from '../data/factions.js';
import { assets } from '../core/assets.js';
import { aspect } from './entityRenderer.js';
import { plateRect } from './plate.js';

const C = BAL.CELL;

export function drawBoard(ctx, state) {
  const { cols, rows, paths, slots, castle, camps } = state.level;
  const tint = tintOf(state.level.faction);     // [P3] 势力盘面色调(南蛮绿/东吴青/曹魏冷灰)

  // 棋盘格草地
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = ((r + c) & 1) ? tint.grassA : tint.grassB;
      ctx.fillRect(c * C, r * C, C, C);
    }
  }

  drawTerrainBase(ctx, state);   // [地形] 基底层：路压河上=渡口浮桥视觉天然成立(spec §5 顺序)

  // 弯曲蜀道（沿 waypoint 画粗线）
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const id in paths) {
    const wp = paths[id];
    ctx.beginPath();
    ctx.moveTo(wp[0].x * C + C / 2, wp[0].y * C + C / 2);
    for (let i = 1; i < wp.length; i++) ctx.lineTo(wp[i].x * C + C / 2, wp[i].y * C + C / 2);
    ctx.strokeStyle = tint.road; ctx.lineWidth = C * 0.72; ctx.stroke();
    ctx.strokeStyle = tint.road2; ctx.lineWidth = C * 0.58; ctx.stroke();
  }

  drawTerrainFx(ctx, state);   // [地形] 特效层：压在路上(落石警示圈/落石尘圈/火谷火苗/浅滩波光;spec §5 顺序)

  // 将位（未占用 = 虚线绿框）
  ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.strokeStyle = '#9be07a';
  for (const s of slots) {
    if (state.towers.some((t) => t.slot.x === s.x && t.slot.y === s.y)) continue;
    ctx.strokeRect(s.x * C + 4, s.y * C + 4, C - 8, C - 8);
  }
  ctx.setLineDash([]);

  // 敌营：势力城堡贴图（building_wei/wu/...；缺图回退色块+旗）+ 城名牌
  const campImg = assets.images['building_' + state.level.faction];
  for (const cp of camps) {
    const ccx = cp.c * C + C / 2, footY = cp.r * C + C - 1;
    if (campImg) {
      drawBuilding(ctx, campImg, ccx, footY, 1.6);
    } else {
      ctx.fillStyle = '#4a3550'; ctx.fillRect(cp.c * C + 3, cp.r * C + 3, C - 6, C - 6);
      ctx.fillStyle = '#b3243a'; ctx.fillRect(cp.c * C + C / 2 - 1, cp.r * C + 4, 8, 5);
    }
    if (cp.cityName) drawPlate(ctx, cp.cityName, ccx, footY + 1);
  }

  // 成都：蜀汉大城楼贴图（缺图回退色块）+ 金红名牌 + 受损烟雾
  const castleImg = assets.images.building_chengdu;
  const kcx = (castle.c + castle.w / 2) * C, kFootY = (castle.r + castle.h) * C - 2;
  if (castleImg) {
    drawBuilding(ctx, castleImg, kcx, kFootY, 2.7);
  } else {
    ctx.fillStyle = '#9aa0a8';
    ctx.fillRect(castle.c * C + 2, castle.r * C + 2, castle.w * C - 4, castle.h * C - 4);
    ctx.strokeStyle = '#5f6268'; ctx.lineWidth = 2;
    ctx.strokeRect(castle.c * C + 2, castle.r * C + 2, castle.w * C - 4, castle.h * C - 4);
  }
  drawPlate(ctx, '成都', kcx, kFootY + 1, true);
  drawCastleSmoke(ctx, state, kcx, castleImg ? kFootY - C * 2.7 : castle.r * C + 4);
}

// 建筑 billboard：底边锚 footY、高 hCells 格、按图片纵横比定宽 + 椭圆投影（同 entityRenderer 约定）
function drawBuilding(ctx, img, cx, footY, hCells) {
  const h = C * hCells, w = h / aspect(img);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(cx, footY, w * 0.36, w * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(img, cx - w / 2, footY - h, w, h);
}

// 城名牌：敌营=深底白字；gold=true 成都金红款（spec §6 配色）
function drawPlate(ctx, text, cx, footY, gold = false) {
  ctx.save();   // 字体/对齐/线宽等全局 ctx 状态不外溢（质量审 Important 修复）
  const r = plateRect(text, cx, footY, C, gold ? 1.3 : 1);
  ctx.fillStyle = gold ? 'rgba(94,18,22,.85)' : 'rgba(20,16,24,.78)';
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 4); ctx.fill();
  ctx.strokeStyle = gold ? '#e8c06a' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = gold ? '#ffe9b0' : '#f5edd8';
  ctx.font = `bold ${r.fontPx}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, r.textX, r.textY);
  ctx.restore();
}

// —— [板型+地形] terrain 基底(spec §5)：river 蓝带波纹 / shallow 亮蓝 / plateau 黄土台描边 /
//     mountain 深岩棱线 / firegully 橙红焦地 / rockfall 碎石警示底。章 faction tint 之上叠加。——
const TERRAIN_FILL = {
  river: '#3d6e9e', shallow: '#5da7c9', plateau: '#c9a85c',
  mountain: '#4a4640', firegully: '#8a3a24', rockfall: '#6e645a',
};

function drawTerrainBase(ctx, state) {
  const zones = state.level.terrain;
  if (!zones || !zones.length) return;
  const t = state.time || 0;
  ctx.save();
  for (const z of zones) {
    ctx.fillStyle = TERRAIN_FILL[z.type] || '#888';
    for (const c of z.cells) ctx.fillRect(c.x * C, c.y * C, C, C);
    if (z.type === 'river' || z.type === 'shallow') {
      // 波纹线：每格两道正弦短横线，相位随 time 流动
      ctx.strokeStyle = z.type === 'river' ? 'rgba(220,235,255,.28)' : 'rgba(255,255,255,.35)';
      ctx.lineWidth = 1.5;
      for (const c of z.cells) {
        const ph = t * 1.2 + (c.x * 7 + c.y * 13) * 0.7;
        const dy = Math.sin(ph) * 2;
        ctx.beginPath();
        ctx.moveTo(c.x * C + 6, c.y * C + C * 0.35 + dy); ctx.lineTo(c.x * C + C - 6, c.y * C + C * 0.35 + dy);
        ctx.moveTo(c.x * C + 9, c.y * C + C * 0.7 - dy); ctx.lineTo(c.x * C + C - 9, c.y * C + C * 0.7 - dy);
        ctx.stroke();
      }
    } else if (z.type === 'plateau') {
      // 黄土台：亮顶边+暗底边的"抬升"描边
      for (const c of z.cells) {
        ctx.strokeStyle = 'rgba(255,235,180,.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(c.x * C + 1, c.y * C + 1); ctx.lineTo(c.x * C + C - 1, c.y * C + 1); ctx.stroke();
        ctx.strokeStyle = 'rgba(70,50,20,.55)';
        ctx.beginPath(); ctx.moveTo(c.x * C + 1, c.y * C + C - 1); ctx.lineTo(c.x * C + C - 1, c.y * C + C - 1); ctx.stroke();
      }
    } else if (z.type === 'mountain') {
      // 岩壁棱线：对角短笔触
      ctx.strokeStyle = 'rgba(160,150,135,.45)'; ctx.lineWidth = 2;
      for (const c of z.cells) {
        ctx.beginPath();
        ctx.moveTo(c.x * C + 5, c.y * C + C - 7); ctx.lineTo(c.x * C + C * 0.45, c.y * C + 6);
        ctx.lineTo(c.x * C + C - 5, c.y * C + C - 7);
        ctx.stroke();
      }
    } else if (z.type === 'firegully') {
      // 焦地裂纹（静态；火苗动效段2）
      ctx.strokeStyle = 'rgba(255,150,60,.4)'; ctx.lineWidth = 1.5;
      for (const c of z.cells) {
        ctx.beginPath();
        ctx.moveTo(c.x * C + 5, c.y * C + C * 0.55); ctx.lineTo(c.x * C + C * 0.5, c.y * C + C * 0.4);
        ctx.lineTo(c.x * C + C - 5, c.y * C + C * 0.6);
        ctx.stroke();
      }
    } else if (z.type === 'rockfall') {
      // 碎石点（警示圈动效段2）
      ctx.fillStyle = 'rgba(40,35,30,.45)';
      for (const c of z.cells) {
        ctx.beginPath(); ctx.arc(c.x * C + C * 0.3, c.y * C + C * 0.62, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(c.x * C + C * 0.66, c.y * C + C * 0.34, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}

// —— [板型+地形] terrain 特效层(路之上):火谷火苗/浅滩波光/落石警示与落石。time 驱动,零随机。——
function drawTerrainFx(ctx, state) {
  const zones = state.level.terrain;
  if (!zones || !zones.length || !state.terrain) return;
  const t = state.time || 0;
  const disabled = state.terrain.disabled || new Set();
  ctx.save();
  for (const z of zones) {
    if (z.type === 'firegully' && !disabled.has('firegully')) {
      // 火苗:每格一簇,高度/横摆随 time 摆动(L50 大雨禁用时不画=被浇灭,焦地基底仍在)
      for (const c of z.cells) {
        const ph = t * 6 + (c.x * 11 + c.y * 17) * 0.9;
        const h = 5 + Math.sin(ph) * 3;
        const bx = c.x * C + C / 2 + Math.sin(ph * 0.7) * 3;
        const grd = ctx.createLinearGradient(bx, c.y * C + C - 4, bx, c.y * C + C - 4 - h * 2);
        grd.addColorStop(0, 'rgba(255,180,60,.85)'); grd.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(bx - 4, c.y * C + C - 4);
        ctx.quadraticCurveTo(bx, c.y * C + C - 4 - h * 2.2, bx + 4, c.y * C + C - 4);
        ctx.fill();
      }
    } else if (z.type === 'shallow') {
      // 波光点:间歇高光(减速带的可读暗示)
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (const c of z.cells) {
        const ph = t * 2 + (c.x * 5 + c.y * 3);
        if (Math.sin(ph) > 0.55) ctx.fillRect(c.x * C + C * 0.42, c.y * C + C * 0.45, 4, 2);
      }
    }
  }
  // 落石:前摇警示圈(急促脉动) + 落石瞬间(0.4s 内石块坠落+尘圈扩散)
  for (const rf of state.terrain.rockfalls) {
    const zone = state.level.terrain[rf.zoneIdx];
    if (!zone) continue;
    const toStrike = rf.nextStrikeAt - t;
    if (toStrike > 0 && toStrike <= BAL.ROCKFALL_WARN) {
      const a = 0.25 + 0.35 * Math.abs(Math.sin(t * 10));
      ctx.strokeStyle = `rgba(255,80,40,${a.toFixed(3)})`; ctx.lineWidth = 2.5;
      for (const c of zone.cells) {
        ctx.beginPath(); ctx.arc(c.x * C + C / 2, c.y * C + C / 2, C * 0.42, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const sinceStrike = t - rf.lastStrikeAt;
    if (sinceStrike >= 0 && sinceStrike < 0.4) {
      const k = sinceStrike / 0.4;                            // 0→1
      for (const c of zone.cells) {
        const cx = c.x * C + C / 2, cy = c.y * C + C / 2;
        ctx.fillStyle = `rgba(90,80,70,${(1 - k).toFixed(3)})`;   // 石块坠落淡出
        ctx.beginPath(); ctx.arc(cx, cy - (1 - k) * C * 0.8, C * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(180,165,140,${(0.6 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, C * (0.2 + k * 0.45), 0, Math.PI * 2); ctx.stroke();   // 尘圈扩散
      }
    }
  }
  ctx.restore();
}

// —— L50 大雨(disableTerrain 含 firegully 的关;实体层之上,main.js 调;板坐标系)——
export function drawWeather(ctx, state) {
  if (!state.terrain || !state.terrain.disabled || !state.terrain.disabled.has('firegully')) return;
  const t = state.time || 0;
  const { cols, rows } = state.level;
  const W = cols * C, H = rows * C;
  ctx.save();
  ctx.strokeStyle = 'rgba(180,200,230,.35)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const seed = i * 7919 % 997;                              // 固定伪随机(零 Math.random)
    const x = ((seed * 13 + t * 260) % (W + 80)) - 40;
    const y = ((seed * 31 + t * 640) % (H + 40)) - 20;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40,60,90,.10)'; ctx.fillRect(0, 0, W, H);   // 雨幕压暗
  ctx.restore();
}

// 成都受损烟雾（spec §4）：HP<50% 灰烟 2 缕、HP<25% 橙红 3 缕；脉动用 state.time（gameLoop 累计秒）
function drawCastleSmoke(ctx, state, cx, topY) {
  const ratio = state.castleHp / state.castleMaxHp;
  if (!(ratio < 0.5)) return;
  const t = state.time || 0, fire = ratio < 0.25, n = fire ? 3 : 2;
  ctx.save();   // lineCap/strokeStyle 不外溢
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ph = t * 0.9 + i * 2.1;
    const sway = Math.sin(ph) * C * 0.18;
    const a = 0.25 + 0.15 * Math.sin(ph * 1.7);
    ctx.strokeStyle = fire ? `rgba(224,122,42,${a.toFixed(3)})` : `rgba(90,90,100,${a.toFixed(3)})`;
    ctx.lineWidth = C * (0.16 - i * 0.03);
    const bx = cx + (i - 1) * C * 0.35;
    ctx.beginPath();
    ctx.moveTo(bx, topY);
    ctx.bezierCurveTo(bx + sway, topY - C * 0.5, bx - sway, topY - C * 0.9, bx + sway * 1.4, topY - C * 1.3);
    ctx.stroke();
  }
  ctx.restore();
}
