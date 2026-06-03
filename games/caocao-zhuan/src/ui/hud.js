// ui/hud.js — 战场 HUD：单位信息卡 / 行动菜单 / 回合横幅（DOM 覆盖层，国风主题）
//
// 渲染目标（index.html 已存在）：
//   #hud         单位信息卡 + 行动菜单的挂载层（pointer-events:none，子元素 auto）
//   #turn-banner 短暂的回合 / 相位横幅
//
// 契约（plan §1.8 / 任务 C3）：
//   showUnit(unit)              -> 渲染单位信息卡（名/号、HP 条、等级、兵种中文、属性、计略）
//   hideUnit()                  -> 隐藏信息卡
//   actionMenu(actions)         -> Promise<choiceId>（右键 / Esc 取消 → resolve 'cancel'）
//   turnBanner(text[, ms])      -> 短暂横幅（"我军回合"/"敌军回合"/"第N回合"）
//   classLabel(classId)         -> 兵种中文标签
//
// 仅触碰 DOM（不 import three）。计略 / 兵种中文从 data 层取，保持单一事实来源。

import { CLASSES } from '../data/classes.js';
import { SKILLS } from '../data/skills.js';

// 兵种 id -> 中文标签（优先取 data/classes.js 的 name，附兜底，满足契约枚举）。
const CLASS_LABELS = {
  infantry: '步兵',
  spear: '枪兵',
  cavalry: '骑兵',
  archer: '弓兵',
  strategist: '谋士',
  leader: '主将',
};

export function classLabel(classId) {
  const def = CLASSES[classId];
  if (def && def.name) return def.name;
  return CLASS_LABELS[classId] || classId || '—';
}

function skillLabel(skillId) {
  const def = SKILLS[skillId];
  return (def && def.name) || skillId;
}

// --- DOM 句柄（惰性获取，便于 Node --check / 无 DOM 环境下被 import 也不抛错）-------
let hudRoot = null;
let bannerRoot = null;
let cardEl = null; // 单位信息卡
let menuEl = null; // 行动浮动菜单
let bannerTimer = null;

function getHud() {
  if (!hudRoot && typeof document !== 'undefined') hudRoot = document.getElementById('hud');
  return hudRoot;
}
function getBanner() {
  if (!bannerRoot && typeof document !== 'undefined') {
    bannerRoot = document.getElementById('turn-banner');
  }
  return bannerRoot;
}

function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

// 一次性注入 HUD 专属样式（信息卡 / 行动菜单 / HP 条）。复用 style.css 的国风变量。
let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const css = `
.ccz-unit-card{
  position:absolute; left:16px; bottom:16px; width:min(86vw,300px);
  padding:14px 16px 16px; border-radius:14px; color:var(--parchment);
  background:linear-gradient(180deg,rgba(35,44,69,.96),rgba(15,19,32,.96));
  border:2px solid var(--gold); box-shadow:0 10px 30px rgba(0,0,0,.55),
  inset 0 0 0 1px rgba(212,175,55,.22); font-size:13px; line-height:1.5;
  animation:ccz-fade .18s ease;
}
.ccz-unit-card.foe{ border-color:var(--vermilion-soft);
  box-shadow:0 10px 30px rgba(0,0,0,.55), inset 0 0 0 1px rgba(162,48,48,.3); }
.ccz-uc-head{ display:flex; align-items:baseline; gap:8px; margin-bottom:8px; }
.ccz-uc-name{ font-size:20px; font-weight:900; color:var(--gold);
  letter-spacing:.04em; text-shadow:0 1px 0 var(--vermilion); }
.ccz-uc-title{ font-size:12px; color:var(--gold-soft); }
.ccz-uc-tags{ margin-left:auto; font-size:11px; color:#cdd5e6; text-align:right; }
.ccz-uc-tags b{ color:var(--gold-soft); font-weight:700; }
.ccz-hp{ margin:4px 0 10px; }
.ccz-hp-row{ display:flex; justify-content:space-between; font-size:11px;
  color:#cdd5e6; margin-bottom:3px; }
.ccz-hp-row b{ color:#fff; }
.ccz-hp-bar{ height:10px; border-radius:6px; overflow:hidden;
  background:rgba(0,0,0,.45); border:1px solid rgba(212,175,55,.4); }
.ccz-hp-fill{ height:100%; border-radius:6px;
  background:linear-gradient(90deg,#3fae5a,#8fd66a); transition:width .25s ease; }
.ccz-hp-fill.low{ background:linear-gradient(90deg,#c0392b,#e07b39); }
.ccz-hp-fill.mid{ background:linear-gradient(90deg,#d9a514,#e7cf7a); }
.ccz-stats{ display:grid; grid-template-columns:repeat(3,1fr); gap:4px 8px; }
.ccz-stat{ display:flex; justify-content:space-between;
  padding:2px 6px; border-radius:6px; background:rgba(0,0,0,.25); }
.ccz-stat span{ color:#aeb7cc; }
.ccz-stat b{ color:#fff; font-weight:700; }
.ccz-skills{ margin-top:9px; font-size:12px; color:#cdd5e6; }
.ccz-skills .lbl{ color:var(--gold-soft); margin-right:4px; }
.ccz-skill-chip{ display:inline-block; margin:2px 4px 0 0; padding:1px 9px;
  border-radius:999px; background:rgba(212,175,55,.16);
  border:1px solid rgba(212,175,55,.45); color:var(--gold-soft); font-size:11px; }

.ccz-action-menu{
  position:absolute; min-width:148px; padding:8px; border-radius:12px;
  background:linear-gradient(180deg,rgba(35,44,69,.98),rgba(15,19,32,.98));
  border:2px solid var(--gold); box-shadow:0 12px 30px rgba(0,0,0,.6);
  display:flex; flex-direction:column; gap:6px; animation:ccz-fade .14s ease;
}
.ccz-action-btn{
  appearance:none; width:100%; padding:9px 14px; border-radius:8px;
  border:2px solid var(--gold); cursor:pointer; font:800 15px/1 inherit;
  color:#fff; text-align:center;
  background:linear-gradient(180deg,var(--vermilion-soft),var(--vermilion));
  box-shadow:0 4px 0 #4d1212; transition:transform .07s ease, box-shadow .07s ease;
}
.ccz-action-btn:hover{ filter:brightness(1.1); }
.ccz-action-btn:active{ transform:translateY(3px); box-shadow:0 1px 0 #4d1212; }
.ccz-action-btn.disabled{ opacity:.45; cursor:not-allowed; pointer-events:none; }
.ccz-action-btn.cancel{ background:rgba(22,29,46,.7); color:var(--gold);
  border-color:rgba(212,175,55,.5); box-shadow:0 4px 0 #2a2410; }
`;
  const tag = el('style');
  tag.id = 'ccz-hud-styles';
  tag.textContent = css;
  document.head.appendChild(tag);
}

// --- 单位信息卡 ----------------------------------------------------------------

function hpClass(cur, max) {
  const pct = max > 0 ? cur / max : 0;
  if (pct <= 0.3) return 'low';
  if (pct <= 0.6) return 'mid';
  return '';
}

/**
 * 渲染单位信息卡。读取运行态 Unit（battleController 生成）的顶层有效属性。
 * @param {object} unit Unit：{name,title,faction,classId,level,maxHp,curHp,atk,def,int,spd,mov,skills:[id]}
 */
export function showUnit(unit) {
  const hud = getHud();
  if (!hud || !unit) return;
  ensureStyles();

  const max = unit.maxHp ?? 0;
  const cur = Math.max(0, unit.curHp ?? 0);
  const pct = max > 0 ? Math.round((cur / max) * 100) : 0;
  const isFoe = unit.faction === 'foe';

  const skills = Array.isArray(unit.skills) ? unit.skills : [];
  const skillChips = skills.length
    ? skills.map((s) => `<span class="ccz-skill-chip">${skillLabel(s)}</span>`).join('')
    : '<span style="color:#7e879c">无</span>';

  if (!cardEl) {
    cardEl = el('div', 'ccz-unit-card');
    hud.appendChild(cardEl);
  }
  cardEl.className = 'ccz-unit-card' + (isFoe ? ' foe' : '');
  cardEl.innerHTML = `
    <div class="ccz-uc-head">
      <span class="ccz-uc-name">${unit.name ?? '—'}</span>
      ${unit.title ? `<span class="ccz-uc-title">「${unit.title}」</span>` : ''}
      <span class="ccz-uc-tags"><b>${classLabel(unit.classId)}</b><br>Lv.${unit.level ?? 1}</span>
    </div>
    <div class="ccz-hp">
      <div class="ccz-hp-row"><span>兵力</span><b>${cur} / ${max}</b></div>
      <div class="ccz-hp-bar"><div class="ccz-hp-fill ${hpClass(cur, max)}" style="width:${pct}%"></div></div>
    </div>
    <div class="ccz-stats">
      <div class="ccz-stat"><span>攻</span><b>${unit.atk ?? 0}</b></div>
      <div class="ccz-stat"><span>防</span><b>${unit.def ?? 0}</b></div>
      <div class="ccz-stat"><span>智</span><b>${unit.int ?? 0}</b></div>
      <div class="ccz-stat"><span>速</span><b>${unit.spd ?? 0}</b></div>
      <div class="ccz-stat"><span>移</span><b>${unit.mov ?? 0}</b></div>
      <div class="ccz-stat"><span>阵营</span><b>${isFoe ? '敌' : '我'}</b></div>
    </div>
    <div class="ccz-skills"><span class="lbl">计略</span>${skillChips}</div>
  `;
  cardEl.style.display = 'block';
}

export function hideUnit() {
  if (cardEl) cardEl.style.display = 'none';
}

// --- 行动菜单 ------------------------------------------------------------------

// 当前打开菜单的清理函数（保证同时只有一个菜单 / 不泄漏监听）。
let menuCleanup = null;

function closeMenu() {
  if (menuCleanup) {
    menuCleanup();
    menuCleanup = null;
  }
  if (menuEl) {
    menuEl.remove();
    menuEl = null;
  }
}

/**
 * 浮动行动菜单。
 * @param {Array<{id,label,disabled?}>} actions 例：
 *   [{id:'move',label:'移动'},{id:'attack',label:'攻击'},
 *    {id:'skill',label:'计略'},{id:'wait',label:'待机'}]
 * @param {{x?:number,y?:number}} [anchor] 屏幕坐标（缺省右下角附近）
 * @returns {Promise<string>} 选中的动作 id；右键 / Esc / 点击空白 → 'cancel'
 */
export function actionMenu(actions, anchor = {}) {
  const hud = getHud();
  if (!hud || typeof document === 'undefined') return Promise.resolve('cancel');
  ensureStyles();
  closeMenu();

  const list = Array.isArray(actions) ? actions : [];

  return new Promise((resolve) => {
    let done = false;
    const finish = (choice) => {
      if (done) return;
      done = true;
      closeMenu();
      resolve(choice);
    };

    menuEl = el('div', 'ccz-action-menu');

    for (const a of list) {
      const btn = el('button', 'ccz-action-btn' + (a.disabled ? ' disabled' : ''));
      btn.type = 'button';
      btn.textContent = a.label ?? a.id;
      if (!a.disabled) {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          finish(a.id);
        });
      }
      menuEl.appendChild(btn);
    }

    // 显式取消项
    const cancelBtn = el('button', 'ccz-action-btn cancel');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      finish('cancel');
    });
    menuEl.appendChild(cancelBtn);

    hud.appendChild(menuEl);

    // 定位：优先用 anchor；否则贴右下，留出信息卡空间。
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    const rect = menuEl.getBoundingClientRect();
    let x = typeof anchor.x === 'number' ? anchor.x : vw - rect.width - 24;
    let y = typeof anchor.y === 'number' ? anchor.y : vh - rect.height - 24;
    // 夹在视口内
    x = Math.max(8, Math.min(x, vw - rect.width - 8));
    y = Math.max(8, Math.min(y, vh - rect.height - 8));
    menuEl.style.left = x + 'px';
    menuEl.style.top = y + 'px';

    // 取消手势：Esc / 右键 / 点击菜单外空白
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish('cancel');
      }
    };
    const onContext = (e) => {
      e.preventDefault();
      finish('cancel');
    };
    const onDocClick = (e) => {
      if (menuEl && !menuEl.contains(e.target)) finish('cancel');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('contextmenu', onContext);
    // 延后绑定，避免开菜单的同一次点击立即关掉它
    setTimeout(() => window.addEventListener('mousedown', onDocClick), 0);

    menuCleanup = () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('contextmenu', onContext);
      window.removeEventListener('mousedown', onDocClick);
    };
  });
}

// --- 回合 / 相位横幅 -----------------------------------------------------------

/**
 * 短暂横幅（"我军回合" / "敌军回合" / "第N回合"）。
 * @param {string} text
 * @param {number} [ms=1100] 显示时长（毫秒）；<=0 表示常驻直到下次调用 / hideBanner。
 * @returns {Promise<void>} 横幅消失后 resolve（便于编排）。
 */
export function turnBanner(text, ms = 1100) {
  const banner = getBanner();
  if (!banner) return Promise.resolve();
  if (bannerTimer) {
    clearTimeout(bannerTimer);
    bannerTimer = null;
  }
  banner.innerHTML = `<span>${text ?? ''}</span>`;
  banner.classList.add('show');
  return new Promise((resolve) => {
    if (ms > 0) {
      bannerTimer = setTimeout(() => {
        banner.classList.remove('show');
        bannerTimer = null;
        resolve();
      }, ms);
    } else {
      resolve();
    }
  });
}

export function hideBanner() {
  const banner = getBanner();
  if (banner) banner.classList.remove('show');
  if (bannerTimer) {
    clearTimeout(bannerTimer);
    bannerTimer = null;
  }
}

export const hud = {
  showUnit,
  hideUnit,
  actionMenu,
  turnBanner,
  hideBanner,
  classLabel,
};

export default hud;
