// ui/storyScene.js — [演绎段1] 关前两幕剧情演绎(屏幕坐标 layout/hit/draw + 状态机)。
// 幕1 旁白讲解页(羊皮纸大卡,版式自 storyCard.js 迁入):章名/战役名/narration 楷体/小档案/声明/按钮。
// 幕2 对话演绎(群英传式):底部羊皮纸对话框 + 180×220 立绘(蜀左敌右,说话人全亮非说话人压暗0.45)
//   + 金底楷体名牌 + 打字机逐字(~24字/s,由 nowMs 时间差驱动,rAF 渲染即推进,无 setInterval,降帧不丢字)
//   + 点击①全显/点击②下一句 + ▼ 闪烁 + 右上「跳过演绎 ▶」。
// 状态由 main.js 持有(newStoryState 创建);本模块 render-only + 纯状态推进函数,不触 audio/save。
// content(= storyContentFor 产物)按只读消费,不 push/splice。
// [段2] 语音接线点:toDialogue/advanceDialogue 调用处(main.js)切句播 mp3;fromStory 进战斗前 stopVoice。
// copy-and-own theme.js;立绘经 generalSprite(三阶回退)/assets.images,缺图色块名牌兜底。
import { backdrop, panel, title, button, roundRect, FONT, PAL } from './theme.js';
import { assets, generalSprite } from '../core/assets.js';
import { CHAPTERS } from '../data/campaign.js';
import { CAST } from '../data/cast.js';

const PW = 560, PH = 540, BTN_W = 200, BTN_H = 52, GAP = 20;   // 幕1 羊皮纸卡(PH 较 storyCard +80:narration 多行)
const PORT_W = 180, PORT_H = 220;                               // 幕2 立绘框(spec:180×220 顶对齐)
const CHARS_PER_S = 24;                                         // 打字机速度(纯表现常量,不进单测)
const DIM = 0.45;                                               // 非说话人压暗
const SKIP_W = 132, SKIP_H = 28;

// 统一话术(内容铁律:避免误导孩子把"守成都"当史实)
const DISCLAIMER = '历史上这是真实的大战；游戏里，我们想象蜀汉众将来守护这片战场。';

// —— 状态 ——
// content = storyContentFor(level, roster) 产物;review=重看故事(末了回对局,幕1 单继续钮)
export function newStoryState(content, { hasResume = false, review = false } = {}) {
  return { act: 'narration', lineIdx: 0, lineStart: 0, revealAll: false, content, hasResume, review };
}

export function toDialogue(st, nowMs) {
  st.act = 'dialogue'; st.lineIdx = 0; st.lineStart = nowMs; st.revealAll = false;
}

// 当前句显示字数(时间驱动;revealAll 短路)
function shownChars(st, nowMs) {
  const text = st.content.script[st.lineIdx].text;
  if (st.revealAll) return text.length;
  return Math.min(text.length, Math.floor(Math.max(0, nowMs - st.lineStart) / 1000 * CHARS_PER_S));
}

// 幕2 点击推进:打字中→全显('reveal');已显完→下一句('next');末句显完→'done'(幂等)
export function advanceDialogue(st, nowMs) {
  const script = st.content.script;
  if (st.lineIdx >= script.length - 1 && shownChars(st, nowMs) >= script[st.lineIdx].text.length) return 'done';
  if (shownChars(st, nowMs) < script[st.lineIdx].text.length) { st.revealAll = true; return 'reveal'; }
  st.lineIdx++; st.lineStart = nowMs; st.revealAll = false;
  return 'next';
}

// —— layout(hit 与 draw 共用单一来源)——
export function storySceneLayout(view, st) {
  if (st.act === 'narration') {
    const x = (view.w - PW) / 2, y = (view.h - PH) / 2;
    const by = y + PH - BTN_H - 28;
    let buttons;
    if (st.hasResume && !st.review) {
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
  // 幕2:底部 ~1/3 高对话框;立绘立于框上沿;跳过钮避让右上 ⛶(hud fs 钮 x≈view.w-56)
  const bh = Math.max(200, Math.min(300, Math.round(view.h * 0.32)));
  const box = { x: 24, y: view.h - bh - 16, w: view.w - 48, h: bh };
  return {
    box,
    skip: { x: view.w - 56 - 8 - SKIP_W, y: 13, w: SKIP_W, h: SKIP_H },
    portraits: {
      left: { x: box.x + 40, y: box.y - PORT_H, w: PORT_W, h: PORT_H },
      right: { x: box.x + box.w - 40 - PORT_W, y: box.y - PORT_H, w: PORT_W, h: PORT_H },
    },
  };
}

const inRect = (r, sx, sy) => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;

// 命中:幕1 → 'continue'|'resume'|'restart'|null(按钮制,空白不消费防误触);
//      幕2 → 'skip'|'tap'(全屏任意处推进,kid-friendly)
export function hitStoryScene(view, st, sx, sy) {
  const L = storySceneLayout(view, st);
  if (st.act === 'narration') {
    for (const b of L.buttons) if (inRect(b, sx, sy)) return b.id;
    return null;
  }
  if (inRect(L.skip, sx, sy)) return 'skip';
  return 'tap';
}

// —— 文本换行(measureText 驱动,stub ctx 下宽=len*8 同样工作)——
function wrapLines(ctx, text, maxW) {
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

// —— draw ——
export function drawStoryScene(ctx, view, st, level, nowMs) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(ctx, view.w, view.h);
  if (st.act === 'narration') drawNarration(ctx, view, st, level);
  else drawDialogue(ctx, view, st, level, nowMs);
}

// 幕1 · 旁白讲解页(羊皮纸版式,storyCard 迁入:narration 替代 hook,其余沿用)
function drawNarration(ctx, view, st, level) {
  const L = storySceneLayout(view, st);
  const P = L.panel;
  panel(ctx, P.x, P.y, P.w, P.h, { variant: 'parch', r: 16 });

  const chapter = CHAPTERS.find((c) => c.id === level.chapter);
  const cx = view.w / 2;
  let y = P.y + 46;

  ctx.fillStyle = PAL.parchEdge; ctx.font = FONT.body(14, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`第 ${level.chapter} 章 · ${chapter ? chapter.title : ''}`, cx, y); y += 30;
  title(ctx, level.name, cx, y + 8, 38); y += 52;

  // 旁白讲解词(楷体,自动换行,至多 4 行)。[段2] 进页自动播旁白 mp3,点击打断。
  ctx.fillStyle = '#7a3a12'; ctx.font = FONT.head(19);
  const narr = (st.content && st.content.narration) || (level.story && level.story.hook) || '';
  for (const line of wrapLines(ctx, narr, PW - 104).slice(0, 4)) { ctx.fillText(line, cx, y); y += 30; }
  y += 10;

  // 小档案(左对齐两列;字段沿用 storyCard)
  const s = level.story || {};
  const items = [['年代', s.year], ['地点', s.place], ['双方', s.sides], ['结果', s.result], ['成语', s.idiom]].filter(([, v]) => v);
  ctx.textAlign = 'left'; ctx.font = FONT.body(15, 600);
  const colX = P.x + 56;
  for (const [k, v] of items) {
    ctx.fillStyle = PAL.parchEdge; ctx.fillText(k, colX, y);
    ctx.fillStyle = PAL.ink; ctx.fillText(String(v), colX + 56, y);
    y += 26;
  }

  // 可选头像(沿用 storyCard:story.portrait → 将立绘缩略,三阶回退)
  if (s.portrait) {
    const img = generalSprite(s.portrait, 3);
    if (img) {
      // pyT=P.y+132:PH 460→540 后头像随小档案区下移(storyCard 旧值 120)
      const ps = 64, pxR = P.x + P.w - 56 - ps, pyT = P.y + 132;
      ctx.save(); roundRect(ctx, pxR, pyT, ps, ps, 8); ctx.clip();
      const ih = ps * ((img.height / img.width) || 1.35);
      ctx.drawImage(img, pxR, pyT, ps, ih); ctx.restore();
      roundRect(ctx, pxR, pyT, ps, ps, 8); ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.parchEdge; ctx.stroke();
    }
  }

  ctx.fillStyle = 'rgba(60,46,26,.72)'; ctx.font = FONT.body(12, 600); ctx.textAlign = 'center';
  ctx.fillText(DISCLAIMER, cx, P.y + P.h - BTN_H - 50);

  const labels = { continue: '继续 ▶', resume: '续上次 ▶', restart: '重头开始' };
  const variants = { continue: 'gold', resume: 'jade', restart: 'wood' };
  for (const b of L.buttons) button(ctx, b, { label: labels[b.id], variant: variants[b.id] });
}

// 立绘解析:CAST.portrait → Image|null(我方走 generalSprite 三阶回退;敌将/刘备走 assets.images)
function portraitOf(who) {
  const c = CAST[who];
  if (!c || !c.portrait) return null;
  if (c.portrait.gen) return generalSprite(c.portrait.gen, 3);
  return assets.images[c.portrait.img] || null;
}

// 站位推导(无额外状态):截至当前句,每侧最后一个"有立绘"的说话人
function sideSpeakers(script, lineIdx) {
  const out = { shu: null, enemy: null };
  for (let i = 0; i <= lineIdx; i++) {
    const c = CAST[script[i].who];
    if (c && c.portrait && (c.side === 'shu' || c.side === 'enemy')) out[c.side] = script[i].who;
  }
  return out;
}

// 立绘:按宽 contain 缩放、顶部对齐(头部安全区齐平,骑乘图顶即人头),超框底裁掉;缺图色块+名首字
function drawPortrait(ctx, r, who, bright) {
  ctx.save();
  ctx.globalAlpha = bright ? 1 : DIM;
  roundRect(ctx, r.x, r.y, r.w, r.h, 10); ctx.clip();
  const img = portraitOf(who);
  if (img && img.width) {
    const scale = r.w / img.width;
    ctx.drawImage(img, r.x, r.y, r.w, img.height * scale);
  } else {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, PAL.woodA); g.addColorStop(1, PAL.woodB);
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = PAL.cream; ctx.font = FONT.head(64); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((CAST[who] ? CAST[who].name : '?').slice(0, 1), r.x + r.w / 2, r.y + r.h / 2);
  }
  ctx.restore();
  if (bright) { roundRect(ctx, r.x, r.y, r.w, r.h, 10); ctx.lineWidth = 2; ctx.strokeStyle = PAL.gold; ctx.stroke(); }
}

// 金底楷体名牌
function drawNamePlate(ctx, cx, cy, name, bright) {
  const w = Math.max(96, name.length * 22 + 36), h = 34;
  ctx.save();
  if (!bright) ctx.globalAlpha = 0.6;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 8);
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0, bright ? '#f0cf72' : '#caa44a'); g.addColorStop(1, bright ? '#bd9540' : '#9a782e');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#5e4716'; ctx.stroke();
  ctx.fillStyle = '#2b1d08'; ctx.font = FONT.head(18); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name, cx, cy + 1);
  ctx.restore();
}

// 幕2 · 对话演绎
function drawDialogue(ctx, view, st, level, nowMs) {
  const L = storySceneLayout(view, st);
  const script = st.content.script;
  const line = script[st.lineIdx];
  const cur = CAST[line.who] || { name: line.who, side: 'shu', portrait: null };

  // 战役名小标题(顶部居中,给娃上下文;小窗立绘顶过高时让位,防与立绘重叠)
  if (L.portraits.left.y >= 100) title(ctx, level.name, view.w / 2, 64, 30);

  // 双侧立绘(蜀左敌右;当前说话人全亮,另一侧压暗;齐声/无立绘角色不顶替立绘位)
  const sp = sideSpeakers(script, st.lineIdx);
  if (sp.shu) drawPortrait(ctx, L.portraits.left, sp.shu, cur.side === 'shu' && sp.shu === line.who);
  if (sp.enemy) drawPortrait(ctx, L.portraits.right, sp.enemy, cur.side === 'enemy' && sp.enemy === line.who);

  // 对话框(羊皮纸)
  panel(ctx, L.box.x, L.box.y, L.box.w, L.box.h, { variant: 'parch', r: 14 });

  // 当前说话人名牌(骑框上沿,按阵营靠左/右;无侧别角色居中)
  const plateY = L.box.y;
  const plateX = cur.side === 'enemy' ? L.portraits.right.x + PORT_W / 2 : (cur.side === 'shu' ? L.portraits.left.x + PORT_W / 2 : view.w / 2);
  drawNamePlate(ctx, plateX, plateY, cur.name, true);

  // 台词:打字机逐字(时间差驱动),楷体大字自动换行
  const text = line.text.slice(0, shownChars(st, nowMs));
  ctx.fillStyle = PAL.ink; ctx.font = FONT.head(22); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let ty = L.box.y + 64;
  for (const l of wrapLines(ctx, text, L.box.w - 96)) { ctx.fillText(l, L.box.x + 48, ty); ty += 36; }

  // 整句显完 → 右下 ▼ 闪烁(提示点击下一句);未显完不画(点击=全显)
  if (shownChars(st, nowMs) >= line.text.length) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(nowMs / 280);
    ctx.fillStyle = PAL.parchEdge; ctx.font = FONT.body(18, 700); ctx.textAlign = 'center';
    ctx.fillText('▼', L.box.x + L.box.w - 36, L.box.y + L.box.h - 26);
    ctx.restore();
  }

  // 句序(右上小字,如 3/11)+ 跳过钮(常驻)
  ctx.fillStyle = 'rgba(243,234,212,.5)'; ctx.font = FONT.body(12, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(`${st.lineIdx + 1} / ${script.length}`, L.box.x + L.box.w - 14, L.box.y - 14);
  button(ctx, L.skip, { label: '跳过演绎 ▶', variant: 'ghost' });
}
