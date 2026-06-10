// ui/buildBar.js — [P5/重排spec §5] 底部建造栏:单行(第1章新6将)/两行(解锁五虎后,上排五虎+诸葛)。
// 木牌=头像+楷体将名+金价;锁定将灰底🔒。layout/hit 单一来源;热键映射 HOTKEYS 供 main 消费。
import { GENERALS } from '../data/generals.js';
import { generalSprite } from '../core/assets.js';
import { panel, roundRect, FONT, PAL } from './theme.js';

export const ROW_CHEAP = ['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying'];   // 价格升序
export const ROW_PREMIUM = ['huang', 'zhang', 'guan', 'ma', 'zhuge', 'zhao'];            // 价格升序
export const HOTKEYS = {
  1: 'liao', 2: 'zhou', 3: 'madai', 4: 'guanping', 5: 'zhangbao', 6: 'yueying',
  q: 'huang', w: 'zhang', e: 'guan', r: 'ma', t: 'zhuge', y: 'zhao',
};
const KEY_OF = Object.fromEntries(Object.entries(HOTKEYS).map(([k, id]) => [id, String(k).toUpperCase()]));
const UNLOCK_HINT = { huang: '过30关', zhang: '过10关', guan: '过20关', ma: '过30关', zhuge: '过20关', zhao: '过10关' };

const BW = 74, BH = 70, GAP = 8, ROW_GAP = 6;

// 布局:返回 [{id,x,y,w,h,row:'cheap'|'premium',locked,key}]。
// unlocked=null → 全解锁;上排仅在「任一五虎已解锁」后出现(第1章=单行,spec §5)。
export function buildBarLayout(view, state) {
  const unlocked = state && state.unlocked;
  const has = (id) => !unlocked || unlocked.has(id);
  const showPremium = ROW_PREMIUM.some(has);
  const rowX = (n) => (view.w - (n * (BW + GAP) - GAP)) / 2;
  const out = [];
  const cheapY = view.h - BH - 12;
  let x = rowX(ROW_CHEAP.length);
  for (const id of ROW_CHEAP) { out.push({ id, x, y: cheapY, w: BW, h: BH, row: 'cheap', locked: !has(id), key: KEY_OF[id] }); x += BW + GAP; }
  if (showPremium) {
    const py = cheapY - BH - ROW_GAP;
    x = rowX(ROW_PREMIUM.length);
    for (const id of ROW_PREMIUM) { out.push({ id, x, y: py, w: BW, h: BH, row: 'premium', locked: !has(id), key: KEY_OF[id] }); x += BW + GAP; }
  }
  return out;
}

// 命中:锁定将返回 null(静默,与买不起置灰同范式)。
export function hitBuildBar(view, state, sx, sy) {
  for (const b of buildBarLayout(view, state)) {
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return b.locked ? null : b.id;
  }
  return null;
}

export function drawBuildBar(ctx, state, view, selected) {
  for (const b of buildBarLayout(view, state)) {
    const g = GENERALS[b.id];
    const afford = state.gold >= g.cost;
    const sel = b.id === selected && !b.locked;
    panel(ctx, b.x, b.y, b.w, b.h, { variant: 'wood', r: 9, glow: sel });

    ctx.save();
    if (b.locked) ctx.globalAlpha = 0.42;
    else if (!afford) ctx.globalAlpha = 0.55;
    // 头像牌:将色底+上亮下暗叠层(有立绘裁入框,缺则白字描边将名首字)
    const aw = b.w - 18, ah = 24, ax = b.x + 9, ay = b.y + 7;
    const portrait = generalSprite(b.id, 1);          // [形象演进] 建造栏=1阶(所购即所得)
    roundRect(ctx, ax, ay, aw, ah, 5);
    ctx.fillStyle = g.color; ctx.fill();
    const sh = ctx.createLinearGradient(0, ay, 0, ay + ah);
    sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(1, 'rgba(0,0,0,.34)');
    roundRect(ctx, ax, ay, aw, ah, 5); ctx.fillStyle = sh; ctx.fill();
    if (portrait) {
      ctx.save();
      roundRect(ctx, ax, ay, aw, ah, 5); ctx.clip();
      const iw = aw, ih = iw * (portrait.height / portrait.width || 1.35);
      ctx.drawImage(portrait, ax, ay - ih * 0.04, iw, ih);
      ctx.restore();
    }
    roundRect(ctx, ax, ay, aw, ah, 5);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
    if (!portrait) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = FONT.head(15); ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(20,12,4,.7)'; ctx.strokeText(g.name[0], ax + aw / 2, ay + ah / 2 + 0.5);
      ctx.fillStyle = '#fff'; ctx.fillText(g.name[0], ax + aw / 2, ay + ah / 2 + 0.5);
    }
    // 将名(楷体居中)
    ctx.fillStyle = sel ? PAL.goldBright : PAL.cream; ctx.font = FONT.head(13);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(g.name, b.x + b.w / 2, b.y + 45);
    ctx.restore();

    if (b.locked) {
      // 锁定:🔒+解锁条件(给娃可见的收集目标,spec §5)
      ctx.fillStyle = 'rgba(232,222,200,.92)'; ctx.font = FONT.body(11, 700);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔒 ' + (UNLOCK_HINT[b.id] || ''), b.x + b.w / 2, b.y + b.h - 11);
    } else {
      // 金价(买不起标红)
      ctx.fillStyle = afford ? PAL.goldBright : PAL.warn; ctx.font = FONT.body(11, 700);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💰' + g.cost, b.x + b.w / 2, b.y + b.h - 11);
    }

    // 左上热键角标
    ctx.fillStyle = 'rgba(20,13,6,.78)';
    roundRect(ctx, b.x + 4, b.y + 4, 14, 13, 3); ctx.fill();
    ctx.fillStyle = PAL.gold; ctx.font = FONT.body(9, 700); ctx.textAlign = 'center';
    ctx.fillText(b.key, b.x + 11, b.y + 11);
  }
}
