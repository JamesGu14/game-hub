// ui/cheatPanel.js — [作弊] 隐藏作弊菜单(模态盖选关屏)。layout/hit/draw 单一来源;木牌风格。
// 四组(前三纯内存刷新即还原,见 core/cheats.js):①解锁所有关卡(切换)②设初始金币/还原 ③解锁所有武将(切换)
// ④重置真实进度(写盘,二次确认):清 unlockedLevel/stars 回初始,修复作弊跳关泄漏到存档的进度。
import { panel, button, FONT, PAL } from './theme.js';

const PW = 440, ROW_H = 58, BTN_W = 100, BTN_H = 40, PAD = 24, TITLE_H = 54, CLOSE_H = 48, GAP = 10;

// 面板矩形 + 各按钮矩形(屏幕坐标,居中)。rowY(i):第 i 行顶。
export function cheatPanelLayout(view) {
  const rows = 4;
  const ph = TITLE_H + rows * ROW_H + CLOSE_H + PAD;
  const px = (view.w - PW) / 2, py = (view.h - ph) / 2;
  const rowY = (i) => py + TITLE_H + i * ROW_H;
  const rightBtn = (i) => ({ x: px + PW - PAD - BTN_W, y: rowY(i) + (ROW_H - BTN_H) / 2, w: BTN_W, h: BTN_H });
  const midBtn = (i) => ({ x: px + PW - PAD - BTN_W * 2 - GAP, y: rowY(i) + (ROW_H - BTN_H) / 2, w: BTN_W, h: BTN_H });
  return {
    panel: { x: px, y: py, w: PW, h: ph },
    levelsToggle: rightBtn(0),    // 行0:解锁所有关卡(单按钮切换)
    goldSet: midBtn(1),           // 行1:设置
    goldReset: rightBtn(1),       // 行1:还原
    generalsToggle: rightBtn(2),  // 行2:解锁所有武将(切换)
    progressReset: rightBtn(3),   // 行3:重置真实进度(二次确认,写盘)
    close: { x: px + (PW - 180) / 2, y: py + ph - CLOSE_H + 4, w: 180, h: CLOSE_H - 12 },
    rowY,
  };
}

// 命中 → action。面板内空白='panel'(模态吞点击);面板外=null。
export function hitCheatPanel(view, sx, sy) {
  const L = cheatPanelLayout(view);
  const hit = (b) => b && sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h;
  if (hit(L.levelsToggle)) return 'levels-toggle';
  if (hit(L.goldSet)) return 'gold-set';
  if (hit(L.goldReset)) return 'gold-reset';
  if (hit(L.generalsToggle)) return 'generals-toggle';
  if (hit(L.progressReset)) return 'progress-reset';
  if (hit(L.close)) return 'close';
  if (hit(L.panel)) return 'panel';
  return null;
}

// 绘制(屏幕坐标);开关态用 jade 高亮反映 cheats。opts.resetArmed=重置已武装(待二次确认)。
export function drawCheatPanel(ctx, view, cheats, opts = {}) {
  const { resetArmed = false } = opts;
  const L = cheatPanelLayout(view);
  ctx.fillStyle = 'rgba(8,5,3,.55)'; ctx.fillRect(0, 0, view.w, view.h);   // 模态遮罩
  panel(ctx, L.panel.x, L.panel.y, L.panel.w, L.panel.h, { variant: 'wood', r: 14 });
  // 标题
  ctx.fillStyle = PAL.goldBright; ctx.font = FONT.head(24);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('作弊菜单', view.w / 2, L.panel.y + 30);
  // 行标签(左对齐)
  ctx.textAlign = 'left'; ctx.font = FONT.head(17); ctx.fillStyle = PAL.cream;
  const lx = L.panel.x + PAD;
  ctx.fillText('解锁所有关卡', lx, L.rowY(0) + ROW_H / 2);
  ctx.fillText('初始金币：' + (cheats.goldOverride != null ? cheats.goldOverride : '未设'), lx, L.rowY(1) + ROW_H / 2);
  ctx.fillText('解锁所有武将', lx, L.rowY(2) + ROW_H / 2);
  ctx.fillStyle = resetArmed ? PAL.sealBright : PAL.cream;
  ctx.fillText(resetArmed ? '重置真实进度(再点确认)' : '重置真实进度', lx, L.rowY(3) + ROW_H / 2);
  // 按钮(开关态 jade 高亮)
  button(ctx, L.levelsToggle, { label: cheats.allLevels ? '已解锁' : '解锁', variant: cheats.allLevels ? 'jade' : 'wood' });
  button(ctx, L.goldSet, { label: '设置', variant: cheats.goldOverride != null ? 'jade' : 'wood' });
  button(ctx, L.goldReset, { label: '还原', variant: 'wood' });
  button(ctx, L.generalsToggle, { label: cheats.allGenerals ? '已解锁' : '解锁', variant: cheats.allGenerals ? 'jade' : 'wood' });
  button(ctx, L.progressReset, { label: resetArmed ? '确认' : '重置', variant: 'danger', active: resetArmed });
  button(ctx, L.close, { label: '关闭', variant: 'gold' });
}
