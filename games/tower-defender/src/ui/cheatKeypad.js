// ui/cheatKeypad.js — [作弊] canvas 数字键盘(替原生 window.prompt，全屏不被弹出)。
// layout/hit/draw 单一来源；木牌风格与 cheatPanel.js 同套。
// 4行键盘：[1 2 3][4 5 6][7 8 9][✕ 0 ⌫] + 整宽「确定」按钮。
import { panel, button, FONT, PAL } from './theme.js';

const PW = 340;          // 面板宽
const PAD = 20;          // 内边距
const TITLE_H = 52;      // 标题区高度
const DISP_H = 52;       // 输入显示区高度
const DISP_GAP = 10;     // 标题→显示区间距
const KEY_ROWS = 4;      // 数字键行数
const KEY_H = 52;        // 单个键高度
const KEY_GAP = 8;       // 键间隙
const OK_H = 50;         // 确定键高度
const OK_GAP = 10;       // 键盘→确定键间距
const BOTTOM_PAD = 16;   // 面板底部内边距

// 面板总高 = 标题 + 显示区间距 + 显示区 + 4行键(+间隙) + 确定键 + 底部边距
const PH = TITLE_H + DISP_GAP + DISP_H + KEY_ROWS * KEY_H + (KEY_ROWS - 1) * KEY_GAP
         + OK_GAP + OK_H + BOTTOM_PAD;

// 键宽：3列等分(含间隙)
const KEY_W = (PW - PAD * 2 - KEY_GAP * 2) / 3;

// 4行键映射：[key, col(0-2), row(0-3)]
const KEY_DEFS = [
  ['1', 0, 0], ['2', 1, 0], ['3', 2, 0],
  ['4', 0, 1], ['5', 1, 1], ['6', 2, 1],
  ['7', 0, 2], ['8', 1, 2], ['9', 2, 2],
  ['cancel', 0, 3], ['0', 1, 3], ['back', 2, 3],
];

/**
 * cheatKeypadLayout(view) → { panel, display, keys, ok, titleY }
 * 面板水平+垂直居中于 view。
 */
export function cheatKeypadLayout(view) {
  const px = (view.w - PW) / 2;
  const py = (view.h - PH) / 2;

  const keyAreaTop = py + TITLE_H + DISP_GAP + DISP_H;

  const keys = KEY_DEFS.map(([key, col, row]) => ({
    key,
    x: px + PAD + col * (KEY_W + KEY_GAP),
    y: keyAreaTop + row * (KEY_H + KEY_GAP),
    w: KEY_W,
    h: KEY_H,
  }));

  const okY = keyAreaTop + KEY_ROWS * KEY_H + (KEY_ROWS - 1) * KEY_GAP + OK_GAP;

  return {
    panel: { x: px, y: py, w: PW, h: PH },
    display: { x: px + PAD, y: py + TITLE_H + DISP_GAP, w: PW - PAD * 2, h: DISP_H },
    keys,
    ok: { x: px + PAD, y: okY, w: PW - PAD * 2, h: OK_H },
    titleY: py + TITLE_H / 2,
  };
}

/**
 * hitCheatKeypad(view, sx, sy) → token | null
 * '0'..'9' | 'cancel' | 'back' | 'ok' | 'panel' | null
 */
export function hitCheatKeypad(view, sx, sy) {
  const L = cheatKeypadLayout(view);
  const hit = (b) => sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h;

  for (const k of L.keys) {
    if (hit(k)) return k.key;
  }
  if (hit(L.ok)) return 'ok';
  if (hit(L.panel)) return 'panel';
  return null;
}

/**
 * drawCheatKeypad(ctx, view, title, value)
 * 纯绘制：遮罩 + 木牌面板 + 标题 + 输入显示区 + 12键 + 确定键。
 * ctx.save/restore 包裹所有状态改动。
 */
export function drawCheatKeypad(ctx, view, title, value) {
  ctx.save();

  const L = cheatKeypadLayout(view);

  // 模态遮罩
  ctx.fillStyle = 'rgba(8,5,3,.55)';
  ctx.fillRect(0, 0, view.w, view.h);

  // 木牌面板
  panel(ctx, L.panel.x, L.panel.y, L.panel.w, L.panel.h, { variant: 'wood', r: 14 });

  // 标题
  ctx.fillStyle = PAL.goldBright;
  ctx.font = FONT.head(22);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, view.w / 2, L.titleY);

  // 输入显示区背景（竹简浅色凹槽）
  const d = L.display;
  ctx.save();
  ctx.fillStyle = 'rgba(8,5,3,.45)';
  const dr = 8;
  ctx.beginPath();
  ctx.roundRect(d.x, d.y, d.w, d.h, dr);
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = PAL.gold;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.restore();

  // 输入值（数字）
  ctx.fillStyle = value ? PAL.goldBright : PAL.dim;
  ctx.font = FONT.body(26, 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value || '', view.w / 2, d.y + d.h / 2);

  // 数字键盘按键
  for (const k of L.keys) {
    if (k.key === 'cancel') {
      button(ctx, k, { label: '✕', variant: 'danger' });
    } else if (k.key === 'back') {
      button(ctx, k, { label: '⌫', variant: 'wood' });
    } else {
      button(ctx, k, { label: k.key, variant: 'wood' });
    }
  }

  // 确定键
  button(ctx, L.ok, { label: '确定', variant: 'gold' });

  ctx.restore();
}
