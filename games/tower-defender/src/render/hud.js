// render/hud.js — [P5] 顶部木匾 HUD（屏幕坐标）：城防/金/波/相位 图标芯片 + 右侧可点 ⏸/0×/⏩/⛶ 铜牌。
// 只读 state。布局走 layout/hit/draw 三件套：hudButtons 单一来源，hit 与 draw 共用。
// HUD_H 导出供 main.js resize 同源（board 顶部留白 = HUD_H + 余量）。
// [全屏] fs 钮几何在此、API 调用在 main（本模块不触 document，stub ctx 单测可跑）。
import { panel, button, statChip, FONT, PAL } from '../ui/theme.js';

export const HUD_H = 50;             // HUD 占据的屏幕顶部高度（含上边距）
const M = 8, BAR_H = 38;             // 木匾边距 / 高度（M + BAR_H = 46 < HUD_H）
const LEFT_PAD = 68;                 // 左端留给 #back-to-hub DOM 链接
const BTN_W = 52, BTN_H = 28, BTN_GAP = 8;
const FS_W = 36;                     // ⛶ 全屏方钮（图标无副文案，取窄宽）

// 右侧铜牌按钮矩形（屏幕坐标，右起 ⛶/⏩/0×/⏸）。hit 与 draw 共用（导出供命中测试取坐标）。
// [0×/实测④] freeze 在 ⏸ 与速度钮之间:战术冻结(模拟停摆但可建/升/拆),与 ⏸(整屏菜单)语义互补。
export function hudButtons(view) {
  const by = M + (BAR_H - BTN_H) / 2;
  const fsX = view.w - M - 12 - FS_W;
  const speedX = fsX - BTN_GAP - BTN_W;
  const freezeX = speedX - BTN_GAP - BTN_W;
  const pauseX = freezeX - BTN_GAP - BTN_W;
  return {
    pause: { id: 'pause', x: pauseX, y: by, w: BTN_W, h: BTN_H },
    freeze: { id: 'freeze', x: freezeX, y: by, w: BTN_W, h: BTN_H },
    speed: { id: 'speed', x: speedX, y: by, w: BTN_W, h: BTN_H },
    fs: { id: 'fs', x: fsX, y: by, w: FS_W, h: BTN_H },
  };
}

// 命中 → 'pause' | 'freeze' | 'speed' | 'fs' | null。
export function hitHud(view, sx, sy) {
  const b = hudButtons(view);
  for (const k of ['pause', 'freeze', 'speed', 'fs']) {
    const r = b[k];
    if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return k;
  }
  return null;
}

// fs = { supported, active } | null：全屏按钮状态由 main 注入（render 层不触 document）。
export function drawHud(ctx, state, view, fs = null) {
  const x = M, y = M, w = view.w - M * 2, h = BAR_H;
  panel(ctx, x, y, w, h, { variant: 'wood', r: 10 });

  // —— 图标数值芯片（自适应宽度，依次右排）——
  const ch = 26, cy = y + (h - ch) / 2;
  let cx = x + LEFT_PAD;
  const waveTotal = state.level.waves.length;
  const waveNow = Math.min(state.waveIndex + 1, waveTotal);
  const lowHp = state.castleHp <= state.castleMaxHp * 0.34;
  const phaseChip = state.phase === 'prep'
    ? { icon: '⏱', text: `备战 ${Math.max(0, Math.ceil(state.prepTimer))}s`, color: PAL.cream }
    : { icon: '⚔', text: '交战', color: PAL.sealBright };
  const chips = [
    { icon: '❤', text: `${state.castleHp}/${state.castleMaxHp}`, color: lowHp ? PAL.warn : '#ff9e9e' },
    { icon: '💰', text: `${state.gold}`, color: PAL.goldBright },
    { icon: '🌊', text: `${waveNow}/${waveTotal}`, color: '#bcd6ff' },
    phaseChip,
  ];
  const btnLeft = hudButtons(view).pause.x;
  for (const c of chips) {
    ctx.font = FONT.body(ch * 0.46, 700);
    const cw = ch * 0.98 + ctx.measureText(c.text).width + ch * 0.5;
    if (cx + cw > btnLeft - 8) break;              // 窄屏保护：不画到按钮区
    statChip(ctx, cx, cy, cw, ch, c.icon, c.text, c.color);
    cx += cw + 8;
  }

  // —— 右侧 ⏸/▶ + 0× 冻结 + 速度 + ⛶ 全屏（不支持的环境不画）——
  // [0×] 冻结时 0× 钮玉色高亮;速度钮显示"待恢复速度"(speedPrev),点击即以该速解冻。
  const b = hudButtons(view);
  const frozen = state.speed === 0;
  button(ctx, b.pause, { label: state.paused ? '▶' : '⏸', variant: state.paused ? 'jade' : 'wood', active: state.paused });
  button(ctx, b.freeze, { label: '0×', variant: frozen ? 'jade' : 'wood', active: frozen });
  const shown = frozen ? (state.speedPrev || 1) : state.speed;
  button(ctx, b.speed, { label: `${shown}×`, variant: 'wood', active: state.speed === 2 });
  if (fs && fs.supported) button(ctx, b.fs, { label: '⛶', variant: fs.active ? 'jade' : 'wood', active: fs.active });
}
