// ui/heroCard.js — [检查点A] 建造栏悬停英雄卡浮窗（屏幕坐标，render-only，不改 state）。
// 布局：左上头像 + 右侧生平简介 ｜ 分割线 ｜ 武将特性 ｜ 分割线 ｜ 升级增益。
// lore（生平/特性白话）是展示文案，置于本 UI 层，不污染 data/generals。
import { GENERALS } from '../data/generals.js';
import { generalSprite } from '../core/assets.js';
import { BAL } from '../data/balance.js';
import { panel, roundRect, FONT, PAL } from './theme.js';

const CW = 300, PAD = 14, PORT = 56, LH = 16;

// 十二将 lore：生平简介（史实向、一年级能懂）+ 武将特性（招牌技白话）。
const HERO_LORE = {
  huang: { bio: '蜀汉五虎上将。老当益壮的神射手，年过六旬仍冲锋陷阵，定军山一战斩魏将夏侯渊。', trait: '百步穿杨：有几率射出暴击，伤害大增且无视护甲。' },
  zhang: { bio: '蜀汉五虎上将。豹头环眼、声若巨雷的猛将，长坂桥一声怒吼吓退曹军。', trait: '当阳怒吼：震慑周围地面敌军，使其短暂定身。' },
  guan: { bio: '蜀汉五虎上将、忠义武圣。红脸长髯、手持青龙偃月刀，水淹七军威震华夏。', trait: '水淹七军：放水重创并大幅减速一片敌军。' },
  zhao: { bio: '蜀汉五虎上将。长坂坡七进七出、单骑救回幼主阿斗的常胜将军。', trait: '七进七出：击杀敌人后立刻连射下一个目标。' },
  ma: { bio: '蜀汉五虎上将。西凉锦马超，骁勇的铁骑统帅，杀得曹操割须弃袍。', trait: '西凉突阵：沿路冲锋穿透多个敌人，并把锋尖之敌击退。' },
  zhuge: { bio: '蜀汉丞相、传奇军师。羽扇纶巾、神机妙算，火烧赤壁、七擒孟获，鞠躬尽瘁。', trait: '火烧藤甲：纵火持续灼烧掉血，专克怕火的藤甲兵。' },
  liao: { bio: '蜀汉先锋老将。从黄巾打到蜀汉末年的"常青树",俗话说:蜀中无大将,廖化作先锋。', trait: '速射弓手:出手快、造价低,还能射飞鸟,最实惠的入门武将。' },
  zhou: { bio: '关羽的忠心护卫,黑面虬髯、力大无穷,一生为关公扛青龙偃月刀。', trait: '大刀横扫:一刀劈一片,克制扎堆的地面敌军。' },
  madai: { bio: '马超的从弟,西凉骑兵出身,沉稳可靠,后来一刀斩了反叛的魏延。', trait: '轻骑冲锋:沿蜀道冲杀,一次贯穿两个敌人。' },
  guanping: { bio: '关羽义子,白袍小将,随父镇守荆州,父子并肩作战。', trait: '小水攻:谋略伤害无视护甲,还能减慢敌人脚步。' },
  zhangbao: { bio: '张飞长子,继承父亲的丈八蛇矛,虎父无犬子的猛小伙。', trait: '蛇矛重击:单发伤害高,适合对付皮厚的敌人。' },
  yueying: { bio: '诸葛亮之妻,传说中的发明家,木牛流马、诸葛连弩都有她的巧思。', trait: '机关火弩:射出火羽箭持续灼烧敌人,专克藤甲兵。' },
};

const UPGRADE_TEXT_SIG = `升级(最高 L${BAL.MAX_TOWER_LEVEL}):每级 伤害↑ 射程↑ 攻速↑;升到 L${BAL.SIGNATURE_LEVEL} 解锁招牌技,之后继续变强。`;
const UPGRADE_TEXT_PLAIN = `升级(最高 L${BAL.MAX_TOWER_LEVEL}):每级 伤害↑ 射程↑ 攻速↑。`;

// 按字符宽度折行（中文友好）。
function wrap(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; }
    else line += ch;
  }
  if (line) out.push(line);
  return out;
}

function divider(ctx, x, y, w) {
  ctx.strokeStyle = 'rgba(120,90,50,.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
}

// anchor = 被悬停的建造栏 item 矩形 {x,y,w,h}（卡片浮其上方居中）；可缺省。
export function drawHeroCard(ctx, view, generalId, anchor) {
  const g = GENERALS[generalId];
  if (!g) return;
  const lore = HERO_LORE[generalId] || { bio: '', trait: '' };
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.font = FONT.body(12);
  const bioLines = wrap(ctx, lore.bio, CW - PAD * 2 - PORT - 10);
  const traitLines = wrap(ctx, '★ ' + lore.trait, CW - PAD * 2);
  const upLines = wrap(ctx, g.signature ? UPGRADE_TEXT_SIG : UPGRADE_TEXT_PLAIN, CW - PAD * 2);

  const headH = Math.max(PORT, bioLines.length * LH + 20);
  const H = PAD + headH + 8 + 12 + traitLines.length * LH + 6 + 12 + upLines.length * LH + PAD;

  let x = (anchor ? anchor.x + anchor.w / 2 : view.w / 2) - CW / 2;
  x = Math.max(8, Math.min(view.w - CW - 8, x));
  let y = (anchor ? anchor.y : view.h - 90) - H - 10;
  y = Math.max(8, y);

  panel(ctx, x, y, CW, H, { variant: 'parch', r: 12 });

  // 头像（左上）
  const px = x + PAD, py = y + PAD;
  roundRect(ctx, px, py, PORT, PORT, 8); ctx.fillStyle = g.color; ctx.fill();
  const port = generalSprite(generalId, 3);
  if (port) {
    ctx.save(); roundRect(ctx, px, py, PORT, PORT, 8); ctx.clip();
    const ih = PORT * (port.height / port.width || 1.35);
    ctx.drawImage(port, px, py - ih * 0.04, PORT, ih); ctx.restore();
  }
  roundRect(ctx, px, py, PORT, PORT, 8); ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.parchEdge; ctx.stroke();

  // 名 + 生平（头像右侧）
  const tx = px + PORT + 10;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAL.ink; ctx.font = FONT.head(16);
  ctx.fillText(g.name, tx, py + 15);
  ctx.fillStyle = 'rgba(60,46,26,.92)'; ctx.font = FONT.body(12);
  bioLines.forEach((ln, i) => ctx.fillText(ln, tx, py + 34 + i * LH));

  let yy = y + PAD + headH + 8;
  // 分割线 + 武将特性
  divider(ctx, x + PAD, yy, CW - PAD * 2); yy += 12;
  ctx.fillStyle = '#7a3a12'; ctx.font = FONT.body(12, 700);
  traitLines.forEach((ln, i) => ctx.fillText(ln, x + PAD, yy + i * LH));
  yy += traitLines.length * LH + 6;
  // 分割线 + 升级增益
  divider(ctx, x + PAD, yy, CW - PAD * 2); yy += 12;
  ctx.fillStyle = PAL.dim; ctx.font = FONT.body(11);
  upLines.forEach((ln, i) => ctx.fillText(ln, x + PAD, yy + i * LH));
}
