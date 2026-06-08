// ui/storyCard.js — [检查点A·§7] 开场图文故事卡（屏幕坐标 layout/hit/draw）。
// 混合式：章·战役名 + 故事钩子（楷体）+ 小档案（年/地点/双方/结果/成语）+ 统一话术声明 + 可选头像 + 继续/续玩。
// copy-and-own theme.js（panel/title/button）。render-only，不改 state。
import { backdrop, panel, title, button, roundRect, FONT, PAL } from './theme.js';
import { assets } from '../core/assets.js';
import { CHAPTERS } from '../data/campaign.js';

const PW = 560, PH = 460, BTN_W = 200, BTN_H = 52, GAP = 20;

// 统一话术（内容铁律：避免误导孩子把"守成都"当史实）
const DISCLAIMER = '历史上这是真实的大战；游戏里，我们想象蜀汉六将来守护这片战场。';

export function storyCardLayout(view, hasResume) {
  const x = (view.w - PW) / 2, y = (view.h - PH) / 2;
  const by = y + PH - BTN_H - 28;
  let buttons;
  if (hasResume) {
    const totalW = BTN_W * 2 + GAP, bx = (view.w - totalW) / 2;
    buttons = [
      { id: 'resume', x: bx, y: by, w: BTN_W, h: BTN_H },
      { id: 'restart', x: bx + BTN_W + GAP, y: by, w: BTN_W, h: BTN_H },
    ];
  } else {
    buttons = [{ id: 'continue', x: (view.w - BTN_W) / 2, y: by, w: BTN_W, h: BTN_H }];
  }
  return { panel: { x, y, w: PW, h: PH }, buttons };
}

export function hitStoryCard(view, hasResume, sx, sy) {
  for (const b of storyCardLayout(view, hasResume).buttons) {
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return b.id;
  }
  return null;
}

export function drawStoryCard(ctx, view, level, hasResume) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(ctx, view.w, view.h);
  const L = storyCardLayout(view, hasResume);
  const P = L.panel;
  panel(ctx, P.x, P.y, P.w, P.h, { variant: 'parch', r: 16 });

  const chapter = CHAPTERS.find((c) => c.id === level.chapter);
  const cx = view.w / 2;
  let y = P.y + 46;

  // 章号 + 章名
  ctx.fillStyle = PAL.parchEdge; ctx.font = FONT.body(14, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`第 ${level.chapter} 章 · ${chapter ? chapter.title : ''}`, cx, y); y += 30;
  // 战役名（金标题）
  title(ctx, level.name, cx, y + 8, 38); y += 48;

  const st = level.story || {};
  // 故事钩子（楷体大字）
  ctx.fillStyle = '#7a3a12'; ctx.font = FONT.head(20);
  ctx.fillText(st.hook || '', cx, y); y += 38;

  // 小档案（左对齐两列）
  const items = [
    ['年代', st.year], ['地点', st.place], ['双方', st.sides], ['结果', st.result], ['成语', st.idiom],
  ].filter(([, v]) => v);
  ctx.textAlign = 'left'; ctx.font = FONT.body(15, 600);
  const colX = P.x + 56;
  for (const [k, v] of items) {
    ctx.fillStyle = PAL.parchEdge; ctx.fillText(k, colX, y);
    ctx.fillStyle = PAL.ink; ctx.fillText(String(v), colX + 56, y);
    y += 26;
  }
  y += 6;

  // 可选头像（复用六将立绘缩略；portrait=null 则跳过）
  if (st.portrait) {
    const img = assets.images['gen_' + st.portrait];
    if (img) {
      const ps = 64, pxR = P.x + P.w - 56 - ps, pyT = P.y + 120;
      ctx.save(); roundRect(ctx, pxR, pyT, ps, ps, 8); ctx.clip();
      const ih = ps * ((img.height / img.width) || 1.35);
      ctx.drawImage(img, pxR, pyT - ih * 0.04, ps, ih); ctx.restore();
      roundRect(ctx, pxR, pyT, ps, ps, 8); ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.parchEdge; ctx.stroke();
    }
  }

  // 统一话术声明（小字，框底上方）
  ctx.fillStyle = 'rgba(60,46,26,.72)'; ctx.font = FONT.body(12, 600); ctx.textAlign = 'center';
  ctx.fillText(DISCLAIMER, cx, P.y + P.h - BTN_H - 50);

  // 按钮
  const labels = { continue: '继续 ▶', resume: '续上次 ▶', restart: '重头开始' };
  const variants = { continue: 'gold', resume: 'jade', restart: 'wood' };
  for (const b of L.buttons) button(ctx, b, { label: labels[b.id], variant: variants[b.id] });
}
