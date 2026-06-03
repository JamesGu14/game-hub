// ui/duelView.js — 电影化单挑界面（DOM 覆盖层 + 三维运镜演出）
//
// 契约（plan §1 / 任务 D3）：
//   export async function run(duel, ctx) -> Promise<duelOutcome>
//   ctx = { sceneManager, camera, fx, audio }
//
// 职责（纯呈现，不含战斗规则——规则全在 battle/duel.js）：
//   - 开场：camera.cinematic 框住两名 3D 单位（用 sceneManager.unitGroup(id).position 取世界坐标），
//     拉起上下黑边 letterbox + 「⚔ 单挑」字幕，播放 audio.select()。
//   - 对决 HUD：双方程序化立绘（portrait.js，取 GENERALS[id].appearance 回退 unit.appearance）、
//     姓名/字、两条 HP 条（aHp/maxA、bHp/maxB）、行动按钮（duel.actions()）、滚动战报（state.log）。
//   - 每次点行动：duel.step(id) → 据 RoundResult 让两 3D 单位互相 lunge（group.position 位移 + fx.hitFlash）、
//     fx.floatText 双侧伤害、audio.hit()、更新 HP 条与战报；动画期间禁用按钮。
//   - 若 result.over：「胜负已分 · <winner>胜」横幅 + 胜者高亮一下 → camera.reset()/setIso() 回沙盘，
//     移除覆盖层，resolve(duelOutcome(duel))。
//
// 仅触碰 DOM + 通过 ctx 调 render3d；不直接 import three（世界坐标由 group.position 提供，
// 偏移用本地标量计算，不构造 THREE.Vector3）。fx.floatText 接受 {x,y,z} 普通对象。

import { duelOutcome } from '../battle/duel.js';
import { GENERALS } from '../data/generals.js';
import { portraitDataURL } from '../story/portrait.js';

const LUNGE_DIST = 0.45; // 互冲位移（世界单位）
const LUNGE_MS = 240; // 单程冲刺时长
const ROUND_LOCK_MS = 560; // 一回合演出锁定时长（按钮禁用窗口）

// ---------------------------------------------------------------------------
// 样式（一次性注入）
// ---------------------------------------------------------------------------
let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const css = `
.ccz-letterbox{ position:fixed; left:0; right:0; height:11vh; z-index:40;
  background:linear-gradient(180deg,#05070c,#05070c); pointer-events:none;
  transition:transform .5s cubic-bezier(.2,.8,.2,1); }
.ccz-letterbox.top{ top:0; transform:translateY(-100%); }
.ccz-letterbox.bot{ bottom:0; transform:translateY(100%); }
.ccz-duel.show .ccz-letterbox.top{ transform:translateY(0); }
.ccz-duel.show .ccz-letterbox.bot{ transform:translateY(0); }

.ccz-duel{ position:fixed; inset:0; z-index:42; pointer-events:none;
  font:14px/1.5 "Songti SC","STSong",serif; color:var(--parchment,#efe3c4); }
.ccz-duel .ccz-duel-title{ position:absolute; top:13vh; left:50%; transform:translateX(-50%) scale(.6);
  font-size:clamp(34px,7vw,60px); font-weight:900; letter-spacing:.3em; color:var(--gold,#d4af37);
  text-shadow:0 2px 0 var(--vermilion,#7a1f1f),0 8px 30px rgba(0,0,0,.7);
  opacity:0; transition:opacity .45s ease,transform .45s cubic-bezier(.2,.8,.2,1); white-space:nowrap; }
.ccz-duel.show .ccz-duel-title{ opacity:1; transform:translateX(-50%) scale(1); }

/* 双方立绘 + 名牌（左=玩家侧 a / 右=对手 b），底部居中行动区 */
.ccz-duel-fighter{ position:absolute; bottom:14vh; width:min(34vw,200px); pointer-events:none;
  opacity:0; transition:opacity .4s ease,transform .4s ease; }
.ccz-duel-fighter.a{ left:3vw; transform:translateX(-20px); }
.ccz-duel-fighter.b{ right:3vw; transform:translateX(20px); }
.ccz-duel.show .ccz-duel-fighter{ opacity:1; transform:translateX(0); }
.ccz-duel-fighter img{ width:96px; height:auto; border-radius:10px; display:block;
  border:2px solid var(--gold,#d4af37); box-shadow:0 8px 24px rgba(0,0,0,.6);
  background:#0c1018; }
.ccz-duel-fighter.b img{ margin-left:auto; transform:scaleX(-1); }
.ccz-duel-fighter .ccz-duel-name{ font-size:18px; font-weight:900; color:var(--gold,#d4af37);
  text-shadow:0 1px 0 var(--vermilion,#7a1f1f); margin-top:6px; }
.ccz-duel-fighter.b .ccz-duel-name{ text-align:right; }
.ccz-duel-fighter .ccz-duel-name small{ font-size:12px; color:var(--gold-soft,#e7cf7a); font-weight:600; margin-left:4px; }
.ccz-duel-fighter .ccz-duel-hp{ height:11px; border-radius:6px; overflow:hidden; margin-top:5px;
  background:rgba(0,0,0,.5); border:1px solid rgba(212,175,55,.5); }
.ccz-duel-fighter .ccz-duel-hp-fill{ height:100%; border-radius:6px;
  background:linear-gradient(90deg,#3fae5a,#8fd66a); transition:width .3s ease; }
.ccz-duel-fighter.b .ccz-duel-hp-fill{ float:right; }
.ccz-duel-hp-fill.mid{ background:linear-gradient(90deg,#d9a514,#e7cf7a); }
.ccz-duel-hp-fill.low{ background:linear-gradient(90deg,#c0392b,#e07b39); }
.ccz-duel-fighter .ccz-duel-hp-txt{ font-size:11px; color:#cdd5e6; margin-top:3px; }
.ccz-duel-fighter.b .ccz-duel-hp-txt{ text-align:right; }
.ccz-duel-fighter.winner img{ border-color:#ffe27a;
  box-shadow:0 0 0 3px rgba(255,226,122,.7),0 8px 30px rgba(255,200,80,.5); }

/* 战报面板 */
.ccz-duel-log{ position:absolute; left:50%; bottom:13vh; transform:translateX(-50%);
  width:min(72vw,520px); max-height:18vh; overflow:hidden; pointer-events:none;
  padding:8px 14px; border-radius:10px; text-align:center;
  background:linear-gradient(180deg,rgba(15,19,32,.82),rgba(12,16,24,.92));
  border:1px solid rgba(212,175,55,.35); opacity:0; transition:opacity .4s ease; }
.ccz-duel.show .ccz-duel-log{ opacity:1; }
.ccz-duel-log .ll{ font-size:13px; line-height:1.6; color:#cdd5e6;
  border-bottom:1px dashed rgba(212,175,55,.14); padding:1px 0; }
.ccz-duel-log .ll:last-child{ border-bottom:0; color:var(--parchment,#efe3c4); }

/* 行动按钮行 */
.ccz-duel-actions{ position:absolute; left:50%; bottom:3.5vh; transform:translateX(-50%);
  display:flex; gap:8px; flex-wrap:wrap; justify-content:center; pointer-events:auto;
  width:min(94vw,620px); opacity:0; transition:opacity .4s ease; }
.ccz-duel.show .ccz-duel-actions{ opacity:1; }
.ccz-duel-act{ appearance:none; flex:1 1 auto; min-width:84px; padding:10px 8px; border-radius:9px;
  border:2px solid var(--gold,#d4af37); cursor:pointer; font:800 15px/1.1 inherit; color:#fff;
  background:linear-gradient(180deg,var(--vermilion-soft,#a23030),var(--vermilion,#7a1f1f));
  box-shadow:0 4px 0 #4d1212; transition:transform .07s ease,box-shadow .07s ease,opacity .15s ease; }
.ccz-duel-act small{ display:block; font-weight:500; font-size:10px; opacity:.78; margin-top:2px; }
.ccz-duel-act:hover{ filter:brightness(1.1); }
.ccz-duel-act:active{ transform:translateY(3px); box-shadow:0 1px 0 #4d1212; }
.ccz-duel-act.disabled{ opacity:.45; cursor:not-allowed; pointer-events:none; }

/* 胜负横幅 */
.ccz-duel-verdict{ position:absolute; top:42%; left:50%; transform:translate(-50%,-50%) scale(.7);
  font-size:clamp(30px,6vw,52px); font-weight:900; letter-spacing:.16em; color:var(--gold,#d4af37);
  text-shadow:0 2px 0 var(--vermilion,#7a1f1f),0 8px 30px rgba(0,0,0,.7); white-space:nowrap;
  opacity:0; transition:opacity .4s ease,transform .4s cubic-bezier(.2,.8,.2,1); pointer-events:none; }
.ccz-duel-verdict.show{ opacity:1; transform:translate(-50%,-50%) scale(1); }
`;
  const tag = document.createElement('style');
  tag.id = 'ccz-duel-styles';
  tag.textContent = css;
  document.head.appendChild(tag);
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function hpClass(cur, max) {
  const pct = max > 0 ? cur / max : 0;
  if (pct <= 0.3) return 'low';
  if (pct <= 0.6) return 'mid';
  return '';
}

// 取武将立绘（优先档案 GENERALS[id].appearance，回退运行态 unit.appearance）。
function appearanceOf(unit) {
  const g = unit && unit.id != null ? GENERALS[unit.id] : null;
  return (g && g.appearance) || (unit && unit.appearance) || {};
}

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// group.position 的 {x,y,z} 安全读取。
function posOf(group) {
  if (group && group.position) {
    const p = group.position;
    return { x: p.x || 0, y: p.y || 0, z: p.z || 0 };
  }
  return { x: 0, y: 0, z: 0 };
}

// 两点中点（运镜聚焦用）。
function midpoint(p, q) {
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2 };
}

// 让 group 朝 toward 方向 lunge 后归位（纯三维位移，rAF 驱动，自结束）。
function lunge(group, toward, dist, onPeak) {
  if (!group || !group.position) {
    if (onPeak) onPeak();
    return Promise.resolve();
  }
  const base = posOf(group);
  // 水平方向单位向量（仅 x/z；y 不动）。
  let dx = (toward.x || 0) - base.x;
  let dz = (toward.z || 0) - base.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const start = performance.now();
  let peaked = false;
  return new Promise((resolve) => {
    function tick(now) {
      const t = Math.min(1, (now - start) / (LUNGE_MS * 2));
      // 0→1→0 的冲刺-回拉曲线。
      const k = Math.sin(t * Math.PI);
      group.position.x = base.x + dx * dist * k;
      group.position.z = base.z + dz * dist * k;
      if (!peaked && t >= 0.5) {
        peaked = true;
        if (onPeak) onPeak();
      }
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        group.position.x = base.x;
        group.position.z = base.z;
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------
/**
 * 运行一场单挑的电影化呈现。
 * @param {import('../battle/duel.js').Duel} duel  已构造好的 Duel（state 持有 a/b/HP/log）
 * @param {{sceneManager:object, camera:object, fx:object, audio?:object}} ctx
 * @returns {Promise<{winnerId,loserId,loserHpAfter,fled,expGain}>} duelOutcome(duel)
 */
export async function run(duel, ctx = {}) {
  const { sceneManager, camera, fx, audio } = ctx;
  const s = duel.state;

  // 非浏览器环境（理论上不会走到）：直接跑完逻辑兜底，避免悬挂。
  if (typeof document === 'undefined') {
    while (!duel.state.over) {
      const acts = duel.actions();
      duel.step((acts[0] && acts[0].id) || 'attack');
    }
    return duelOutcome(duel);
  }

  ensureStyles();

  const groupA = sceneManager ? sceneManager.unitGroup(s.aId) : null;
  const groupB = sceneManager ? sceneManager.unitGroup(s.bId) : null;

  // floatText 的 ctx（投影世界坐标到屏幕；overlay 用 body 保持在黑边之上）。
  const fxCtx = {
    camera: sceneManager ? sceneManager.camera : null,
    renderer: sceneManager ? sceneManager.renderer : null,
    overlay: document.body,
  };

  // --- 开场运镜：框住两名单位 ---
  const pA = posOf(groupA);
  const pB = posOf(groupB);
  const focus = midpoint(pA, pB);
  if (camera && typeof camera.cinematic === 'function') {
    camera.cinematic({ focus, zoom: 1.9 });
  }
  if (audio && typeof audio.select === 'function') audio.select();

  // --- 构建覆盖层 DOM ---
  const root = el('div', 'ccz-duel');
  root.appendChild(el('div', 'ccz-letterbox top'));
  root.appendChild(el('div', 'ccz-letterbox bot'));
  root.appendChild(el('div', 'ccz-duel-title', '⚔ 单挑'));

  const fighterA = buildFighter('a', s.a, s.aHp, s.maxA);
  const fighterB = buildFighter('b', s.b, s.bHp, s.maxB);
  root.appendChild(fighterA.node);
  root.appendChild(fighterB.node);

  const logBox = el('div', 'ccz-duel-log');
  root.appendChild(logBox);

  const actionsRow = el('div', 'ccz-duel-actions');
  root.appendChild(actionsRow);

  const verdict = el('div', 'ccz-duel-verdict');
  root.appendChild(verdict);

  document.body.appendChild(root);
  // 触发入场过渡（黑边/立绘/字幕）。
  requestAnimationFrame(() => root.classList.add('show'));

  renderLog(logBox, s.log);

  // --- 行动按钮 ---
  const buttons = [];
  for (const a of duel.actions()) {
    const btn = el('button', 'ccz-duel-act');
    btn.type = 'button';
    btn.innerHTML = `${escapeHtml(a.label)}<small>${escapeHtml(a.desc || '')}</small>`;
    btn.addEventListener('click', () => onAction(a.id));
    actionsRow.appendChild(btn);
    buttons.push(btn);
  }

  let busy = false; // 动画/结算窗口锁

  function setButtonsDisabled(disabled) {
    for (const b of buttons) b.classList.toggle('disabled', disabled);
  }

  // 单回合：推进逻辑 → 演出 → 更新界面。
  async function onAction(actionId) {
    if (busy || s.over) return;
    busy = true;
    setButtonsDisabled(true);

    const r = duel.step(actionId);

    // 互冲演出：a 冲向 b、b 冲向 a；冲刺峰值时套受击闪 + 飘字 + 命中音。
    await playRound(r);

    // 更新 HP 条 + 战报。
    fighterA.setHp(r.aHp, s.maxA);
    fighterB.setHp(r.bHp, s.maxB);
    renderLog(logBox, s.log);

    if (r.over) {
      await finishDuel(r);
      return;
    }
    busy = false;
    setButtonsDisabled(false);
  }

  // 演出一回合：双方 lunge + 在峰值套 fx（仅在有伤害/命中时）。
  async function playRound(r) {
    const dealtToEnemy = r.dmgToEnemy > 0;
    const dealtToPlayer = r.dmgToPlayer > 0;

    const aPos = posOf(groupA);
    const bPos = posOf(groupB);

    // a 冲向 b。
    const lungeA = lunge(groupA, bPos, LUNGE_DIST, () => {
      if (dealtToEnemy) {
        if (fx && typeof fx.hitFlash === 'function') fx.hitFlash(groupB);
        if (fx && typeof fx.floatText === 'function') {
          fx.floatText(fxCtx, liftPos(bPos, 1.4), `${r.dmgToEnemy}`, '#ff5b5b');
        }
        if (audio && typeof audio.hit === 'function') audio.hit();
      }
    });
    // b 冲向 a（撤退/防御等无伤时仅做轻微逼近表演）。
    const lungeB = lunge(groupB, aPos, r.fled ? LUNGE_DIST * 0.4 : LUNGE_DIST, () => {
      if (dealtToPlayer) {
        if (fx && typeof fx.hitFlash === 'function') fx.hitFlash(groupA);
        if (fx && typeof fx.floatText === 'function') {
          fx.floatText(fxCtx, liftPos(aPos, 1.4), `${r.dmgToPlayer}`, '#ffd95e');
        }
        if (audio && typeof audio.hit === 'function') audio.hit();
      }
    });

    await Promise.all([lungeA, lungeB]);
    // 给 HP 条/飘字留一点观感停顿。
    await delay(Math.max(0, ROUND_LOCK_MS - LUNGE_MS * 2));
  }

  // 收尾：胜负横幅 + 胜者高亮 → 回沙盘 → resolve outcome。
  async function finishDuel(r) {
    setButtonsDisabled(true);
    const winnerId = r.winner;
    const winnerUnit = winnerId === s.aId ? s.a : winnerId === s.bId ? s.b : null;
    if (r.fled) {
      verdict.textContent = '⚐ 全身而退';
    } else if (winnerUnit) {
      verdict.textContent = `胜负已分 · ${winnerUnit.name || ''}胜`;
      const winFighter = winnerId === s.aId ? fighterA : fighterB;
      winFighter.node.classList.add('winner');
      const wGroup = winnerId === s.aId ? groupA : groupB;
      if (fx && typeof fx.hitFlash === 'function') fx.hitFlash(wGroup, 0xffe27a);
    } else {
      verdict.textContent = '胜负已分';
    }
    verdict.classList.add('show');
    if (audio) {
      if (r.fled && typeof audio.select === 'function') audio.select();
      else if (winnerUnit && typeof audio.win === 'function') audio.win();
    }

    await delay(1100);

    // 退场：收黑边/界面 → 回等距沙盘。
    root.classList.remove('show');
    if (camera && typeof camera.reset === 'function') camera.reset();
    else if (camera && typeof camera.setIso === 'function') camera.setIso();

    await delay(520);
    if (root.parentNode) root.parentNode.removeChild(root);

    resolveOutcome(duelOutcome(duel));
  }

  // Promise 化整个对决。
  let resolveOutcome;
  const outcomePromise = new Promise((res) => {
    resolveOutcome = res;
  });
  return outcomePromise;
}

// 抬升世界坐标的 y（飘字浮在单位头顶）。
function liftPos(p, lift) {
  return { x: p.x, y: (p.y || 0) + lift, z: p.z };
}

// 构建一名战斗者的 DOM（立绘 + 名牌 + HP 条），返回 {node,setHp}。
function buildFighter(side, unit, hp, maxHp) {
  const node = el('div', `ccz-duel-fighter ${side}`);
  const ap = appearanceOf(unit);
  const purl = portraitDataURL(ap);
  const name = (unit && unit.name) || '';
  const title = unit && unit.title ? `<small>「${escapeHtml(unit.title)}」</small>` : '';
  const cur = Math.max(0, hp);
  const pct = maxHp > 0 ? Math.round((cur / maxHp) * 100) : 0;

  node.innerHTML =
    (purl ? `<img alt="${escapeHtml(name)}" src="${purl}">` : '') +
    `<div class="ccz-duel-name">${escapeHtml(name)}${title}</div>
     <div class="ccz-duel-hp"><div class="ccz-duel-hp-fill ${hpClass(cur, maxHp)}" style="width:${pct}%"></div></div>
     <div class="ccz-duel-hp-txt">兵力 ${cur} / ${maxHp}</div>`;

  const fill = node.querySelector('.ccz-duel-hp-fill');
  const txt = node.querySelector('.ccz-duel-hp-txt');

  function setHp(curHp, max) {
    const c = Math.max(0, Math.round(curHp));
    const p = max > 0 ? Math.round((c / max) * 100) : 0;
    if (fill) {
      fill.style.width = p + '%';
      fill.className = 'ccz-duel-hp-fill ' + hpClass(c, max);
    }
    if (txt) txt.textContent = `兵力 ${c} / ${max}`;
  }

  return { node, setHp };
}

// 渲染战报（取尾部若干行，最新在底）。
function renderLog(box, log) {
  const lines = Array.isArray(log) ? log : [];
  const tail = lines.slice(-5);
  box.innerHTML = tail.map((l) => `<div class="ll">${escapeHtml(l)}</div>`).join('');
}

export const duelView = { run };
export default duelView;
