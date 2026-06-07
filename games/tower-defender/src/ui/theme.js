// ui/theme.js — 成都保卫战 · 三国主题 UI 视觉系统（Phase 5）。
// 单一来源：配色 PAL / 楷体栈 FONT / 绘制 helpers（roundRect·panel·button·title·seal·statChip）。
// 全部 UI 模块（hud/buildBar/towerPanel/pauseMenu/levelSelect/resultPanel）统一调用本模块，
// 不再各自散落 rgba / 字号 / 描边宽。纯 Canvas2D，零依赖、零外部字体（资源管线=Phase 6）。
// 铁律：凡用 shadowBlur / clip / globalAlpha 的 helper，内部 save/restore 自管复位，绝不污染后续绘制。

export const PAL = {
  // 木 / 漆（深色面板主体）
  woodA: '#4d3a24', woodB: '#241812', woodEdge: '#150d06',
  // 竹简 / 羊皮（浅色面板）
  parch: '#ecdcb4', parch2: '#d6bf90', parchEdge: '#7c5f34',
  // 金 / 铜（描边 · 标题 · 高光）
  gold: '#d4af37', goldBright: '#ffe6a0', goldDim: '#9a782e',
  // 玉 / 朱（强调 · 印章）
  jade: '#3fa37a', jadeBright: '#74d2a8', jadeDim: '#2a6b50',
  seal: '#b3242f', sealBright: '#dd5048', sealDim: '#7c1820',
  // 文字
  ink: '#2b2118', cream: '#f3ead4', dim: '#a7b0c0', warn: '#ff9a9a',
};

// 楷体栈 → Mac/iOS 直出书法感（James 设备 Mac）；缺失自动回退 serif。body 用 system-ui（数字清晰）。
export const FONT = {
  head: (px) => `700 ${px}px "STKaiti","KaiTi","Kaiti SC","STKaiti SC","Songti SC",serif`,
  body: (px, w = 600) => `${w} ${px}px system-ui,"PingFang SC",sans-serif`,
};

// 铜牌按钮配色表：top/bot=底渐变；H 后缀=高亮(hover/active)；edge=描边；text/sub=文字。
const BTN = {
  gold:   { top: '#caa44a', bot: '#9a782e', topH: '#f0cf72', botH: '#bd9540', edge: '#5e4716', edgeH: PAL.goldBright, text: '#2b1d08', sub: '#4a3410' },
  jade:   { top: '#4cb288', bot: '#2c6f53', topH: '#74d2a8', botH: '#3a8c69', edge: '#194f3a', edgeH: PAL.jadeBright, text: '#f3ffe9', sub: '#d6f0e2' },
  wood:   { top: '#5a4631', bot: '#33251a', topH: '#705740', botH: '#41301f', edge: '#150d06', edgeH: PAL.gold, text: '#f3ead4', sub: '#c8b48e' },
  danger: { top: '#c0414a', bot: '#7c1820', topH: '#dd5e58', botH: '#9a2630', edge: '#4d0f14', edgeH: PAL.sealBright, text: '#fff0ee', sub: '#f4c9c4' },
  ghost:  { top: 'rgba(58,46,30,.5)', bot: 'rgba(28,20,11,.5)', topH: 'rgba(80,64,44,.66)', botH: 'rgba(44,32,20,.66)', edge: 'rgba(212,175,55,.4)', edgeH: PAL.gold, text: '#e8dcc0', sub: '#b8a98c' },
};

// 圆角矩形路径（不填充/描边，仅建路径，供 fill/stroke/clip 复用）。
export function roundRect(ctx, x, y, w, h, r = 8) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 质感面板：渐变底 + 投影 + 顶部受光高光 + 外深描边 + 内金细框。
// variant: 'wood'(深木·默认) | 'parch'(竹简浅) | 'ink'(半透深，叠盘面上)。glow: 真值=金框更亮+投影更大（高亮卡）。
export function panel(ctx, x, y, w, h, opts = {}) {
  const { variant = 'wood', r = 10, glow = false, shadow = true } = opts;
  ctx.save();
  // 1) 投影（仅作用于主体填充）
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = glow ? 26 : 16; ctx.shadowOffsetY = 7; }
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (variant === 'parch') { g.addColorStop(0, PAL.parch); g.addColorStop(1, PAL.parch2); }
  else if (variant === 'ink') { g.addColorStop(0, 'rgba(38,26,14,.95)'); g.addColorStop(1, 'rgba(16,10,5,.96)'); }
  else { g.addColorStop(0, PAL.woodA); g.addColorStop(1, PAL.woodB); }
  ctx.fillStyle = g; ctx.fill();
  // 关影：后续描边/高光不带投影
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // 2) 顶部受光高光（clip 在面板内）
  ctx.save();
  roundRect(ctx, x, y, w, h, r); ctx.clip();
  const hl = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
  hl.addColorStop(0, variant === 'parch' ? 'rgba(255,255,255,.5)' : 'rgba(255,226,160,.16)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(x, y, w, h * 0.55);
  ctx.restore();
  // 3) 外深描边
  roundRect(ctx, x, y, w, h, r);
  ctx.lineWidth = 2; ctx.strokeStyle = variant === 'parch' ? PAL.parchEdge : PAL.woodEdge; ctx.stroke();
  // 4) 内金细框
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 4));
  ctx.lineWidth = 1.25; ctx.strokeStyle = glow ? PAL.goldBright : PAL.gold;
  ctx.globalAlpha = glow ? 1 : 0.82; ctx.stroke();
  ctx.restore();
}

// 铜牌按钮。b={x,y,w,h}。opts: {label, sub, variant, disabled, active, hover}。
// 有 sub → 主名(楷体)在上、副值(数字 body)在下；无 sub → 居中楷体。
export function button(ctx, b, opts = {}) {
  const { label = '', sub = '', variant = 'gold', disabled = false, active = false, hover = false } = opts;
  const V = BTN[variant] || BTN.gold;
  const bright = !disabled && (active || hover);
  const r = Math.min(9, b.h / 2);
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.42;
  // 底渐变 + 轻投影
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  roundRect(ctx, b.x, b.y, b.w, b.h, r);
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, bright ? V.topH : V.top); g.addColorStop(1, bright ? V.botH : V.bot);
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // 顶高光
  ctx.save();
  roundRect(ctx, b.x, b.y, b.w, b.h, r); ctx.clip();
  const hl = ctx.createLinearGradient(0, b.y, 0, b.y + b.h * 0.6);
  hl.addColorStop(0, 'rgba(255,255,255,.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(b.x, b.y, b.w, b.h * 0.6);
  ctx.restore();
  // 描边
  roundRect(ctx, b.x, b.y, b.w, b.h, r);
  ctx.lineWidth = bright ? 2 : 1.4; ctx.strokeStyle = bright ? V.edgeH : V.edge; ctx.stroke();
  // 文字
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cx = b.x + b.w / 2;
  if (sub) {
    ctx.fillStyle = V.text; ctx.font = FONT.head(Math.min(16, b.h * 0.4));
    ctx.fillText(label, cx, b.y + b.h * 0.37);
    ctx.fillStyle = V.sub; ctx.font = FONT.body(Math.min(12, b.h * 0.27), 700);
    ctx.fillText(sub, cx, b.y + b.h * 0.72);
  } else {
    ctx.fillStyle = V.text; ctx.font = FONT.head(Math.min(18, b.h * 0.46));
    ctx.fillText(label, cx, b.y + b.h / 2 + 1);
  }
  ctx.restore();
}

// 楷体金标题：深描边/投影 + 竖向金渐变填充。x 为水平中心。
export function title(ctx, text, x, y, px = 40) {
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = FONT.head(px);
  ctx.lineJoin = 'round';
  // 投影
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = px * 0.18; ctx.shadowOffsetY = px * 0.06;
  ctx.lineWidth = Math.max(3, px * 0.1); ctx.strokeStyle = 'rgba(20,12,4,.9)';
  ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // 金渐变填充
  const g = ctx.createLinearGradient(0, y - px * 0.6, 0, y + px * 0.6);
  g.addColorStop(0, PAL.goldBright); g.addColorStop(0.5, PAL.gold); g.addColorStop(1, PAL.goldDim);
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  ctx.restore();
}

// 朱红印章：圆/方底 + 白留白边 + 印文。用于 胜/败/锁/关号 点缀。
export function seal(ctx, cx, cy, r, text = '', opts = {}) {
  const { shape = 'circle', color = PAL.seal, textColor = '#fff1ee' } = opts;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillStyle = color;
  if (shape === 'square') { roundRect(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.26); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // 白留白边
  ctx.lineWidth = Math.max(1.5, r * 0.09); ctx.strokeStyle = 'rgba(255,250,245,.6)';
  if (shape === 'square') { const i = r * 0.2; roundRect(ctx, cx - r + i, cy - r + i, (r - i) * 2, (r - i) * 2, r * 0.18); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.stroke(); }
  // 印文（楷体）
  if (text) {
    ctx.fillStyle = textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = FONT.head(r * (text.length > 1 ? 0.66 : 1.05));
    ctx.fillText(text, cx, cy + r * 0.04);
  }
  ctx.restore();
}

// HUD 图标数值芯片：胶囊底（深木+金细边）+ emoji 图标 + 数值。x,y=左上；w,h=尺寸。
export function statChip(ctx, x, y, w, h, icon, text, color = PAL.cream) {
  ctx.save();
  roundRect(ctx, x, y, w, h, h / 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(64,46,26,.92)'); g.addColorStop(1, 'rgba(28,18,9,.92)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(212,175,55,.5)'; ctx.stroke();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = FONT.body(h * 0.5);
  ctx.fillText(icon, x + h * 0.3, y + h / 2 + 0.5);
  ctx.fillStyle = color; ctx.font = FONT.body(h * 0.46, 700);
  ctx.fillText(text, x + h * 0.98, y + h / 2 + 0.5);
  ctx.restore();
}

// 全屏深木背景：中心略暖、四周更深（替代纯色填充，让棋盘四周留白有氛围）。
export function backdrop(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h * 0.44, Math.min(w, h) * 0.08, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  g.addColorStop(0, '#241812'); g.addColorStop(1, '#0d0805');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// 屏幕暗角：中央透明 → 四周半透黑，聚焦战场。须在 entities 之后、HUD 之前画。
export function vignette(ctx, w, h, strength = 0.4) {
  ctx.save();
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(8,5,3,${strength})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
