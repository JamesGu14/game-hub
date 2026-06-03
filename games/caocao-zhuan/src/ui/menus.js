// ui/menus.js — 全屏菜单层：标题 / 暂停 / 胜负结算 / 存读档（DOM 覆盖层，国风主题）
//
// 渲染目标（index.html 已存在）：
//   #menus  全屏模态层（style.css 的 .menus / .menus.show 控制显隐与遮罩）
//
// 契约（plan §1.8 / 任务 C3）：
//   title({onStart,onContinue})                标题屏（游戏名 + 开始 / 继续；存档存在时启用「继续」）
//   pause({onResume,onRestart[,onMenu]})       暂停覆盖
//   result({win,onNext,onRetry,onMenu,lines})  胜 / 负结算（lines:string[] 升级演出位）
//   saveLoad({mode,onSave,onLoad,onClose})     存 / 读档槽列表（game.listSaves()）
//   close()                                    关闭当前菜单
//
// 复用 style.css 的 .panel / .big-btn / .game-title / .game-sub。仅触碰 DOM（不 import three）。

import { game } from '../core/gameState.js';

const SLOT_COUNT = 3; // v1 三个存档槽

let menusRoot = null;

function getRoot() {
  if (!menusRoot && typeof document !== 'undefined') menusRoot = document.getElementById('menus');
  return menusRoot;
}

function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

function mkBtn(label, cls, onClick) {
  const b = el('button', 'big-btn' + (cls ? ' ' + cls : ''));
  b.type = 'button';
  b.textContent = label;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// 一次性注入 menus 专属样式（按钮纵向排列 / 结算升级行 / 存档槽）。
let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const css = `
.ccz-menu-btns{ display:flex; flex-direction:column; align-items:center; gap:14px; margin-top:24px; }
.ccz-menu-btns .big-btn.disabled{ opacity:.4; pointer-events:none; }
.ccz-result-banner{ font-size:clamp(30px,6vw,46px); font-weight:900; letter-spacing:.12em;
  margin-bottom:6px; }
.ccz-result-banner.win{ color:var(--gold); text-shadow:0 2px 0 var(--vermilion); }
.ccz-result-banner.lose{ color:#cdd5e6; text-shadow:0 2px 10px rgba(0,0,0,.6); }
.ccz-levelups{ margin:18px auto 4px; max-width:440px; text-align:left;
  max-height:34vh; overflow:auto; padding:12px 16px; border-radius:12px;
  background:rgba(0,0,0,.3); border:1px solid rgba(212,175,55,.35); }
.ccz-levelups .lu-head{ color:var(--gold-soft); font-weight:800; margin-bottom:8px;
  text-align:center; letter-spacing:.06em; }
.ccz-levelups .lu-line{ font-size:14px; line-height:1.7; color:var(--parchment);
  border-bottom:1px dashed rgba(212,175,55,.18); padding:2px 2px; }
.ccz-levelups .lu-line:last-child{ border-bottom:0; }
.ccz-slots{ display:flex; flex-direction:column; gap:10px; margin:20px 0 6px; }
.ccz-slot{ display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:10px;
  background:rgba(22,29,46,.6); border:2px solid rgba(212,175,55,.4); cursor:pointer;
  text-align:left; color:var(--parchment); transition:border-color .1s ease, background .1s ease; }
.ccz-slot:hover{ border-color:var(--gold); background:rgba(122,31,31,.35); }
.ccz-slot.empty{ cursor:pointer; opacity:.85; }
.ccz-slot.empty.disabled{ opacity:.4; pointer-events:none; cursor:not-allowed; }
.ccz-slot .slot-no{ font-size:20px; font-weight:900; color:var(--gold); min-width:42px; }
.ccz-slot .slot-meta{ flex:1; }
.ccz-slot .slot-title{ font-size:15px; font-weight:700; color:#fff; }
.ccz-slot .slot-sub{ font-size:12px; color:#aeb7cc; margin-top:2px; }
`;
  const tag = el('style');
  tag.id = 'ccz-menus-styles';
  tag.textContent = css;
  document.head.appendChild(tag);
}

// 把 panel 放入 #menus 并显示（每次替换内容，保证同时仅一个菜单）。
function mount(panel) {
  const root = getRoot();
  if (!root) return null;
  ensureStyles();
  root.innerHTML = '';
  root.appendChild(panel);
  root.classList.add('show');
  return root;
}

export function close() {
  const root = getRoot();
  if (!root) return;
  root.classList.remove('show');
  root.innerHTML = '';
}

function hasAnySave() {
  try {
    return (game.listSaves() || []).length > 0;
  } catch (_) {
    return false;
  }
}

// --- 标题屏 --------------------------------------------------------------------

/**
 * 标题屏：游戏名 + 开始 / 继续。
 * @param {{onStart:Function, onContinue?:Function}} cb
 */
export function title({ onStart, onContinue } = {}) {
  const panel = el('div', 'panel');
  panel.appendChild(el('div', 'game-title', '群雄逐鹿·孟德篇'));
  panel.appendChild(el('div', 'game-sub', '三国战棋 · 回合制 SRPG · 等距 3D'));

  const btns = el('div', 'ccz-menu-btns');
  btns.appendChild(
    mkBtn('开始征途', null, () => {
      close();
      onStart && onStart();
    }),
  );

  const canContinue = hasAnySave();
  const contBtn = mkBtn('继续', 'ghost' + (canContinue ? '' : ' disabled'), () => {
    if (!canContinue) return;
    // 「继续」打开读档菜单；选定后回调 onContinue(slot)。
    saveLoad({
      mode: 'load',
      onLoad: (slot) => {
        close();
        onContinue && onContinue(slot);
      },
      onClose: () => title({ onStart, onContinue }),
    });
  });
  if (!canContinue) contBtn.classList.add('disabled');
  btns.appendChild(contBtn);

  panel.appendChild(btns);
  mount(panel);
}

// --- 暂停 ----------------------------------------------------------------------

/**
 * 暂停覆盖。
 * @param {{onResume:Function, onRestart:Function, onMenu?:Function}} cb
 */
export function pause({ onResume, onRestart, onMenu } = {}) {
  const panel = el('div', 'panel');
  panel.appendChild(el('div', 'game-title', '暂停'));
  panel.appendChild(el('div', 'game-sub', '整顿军容，再赴战阵'));

  const btns = el('div', 'ccz-menu-btns');
  btns.appendChild(
    mkBtn('继续战斗', null, () => {
      close();
      onResume && onResume();
    }),
  );
  btns.appendChild(
    mkBtn('重新开战', 'ghost', () => {
      close();
      onRestart && onRestart();
    }),
  );
  if (onMenu) {
    btns.appendChild(
      mkBtn('回到标题', 'ghost', () => {
        close();
        onMenu();
      }),
    );
  }
  panel.appendChild(btns);
  mount(panel);
}

// --- 胜 / 负结算（含升级演出位）-------------------------------------------------

/**
 * 胜 / 负结算屏。
 * @param {{win:boolean, onNext?:Function, onRetry?:Function, onMenu?:Function,
 *          lines?:string[]}} opts  lines = 升级总结行（如 "曹操 升至 Lv.4（HP+7 攻+3）"）
 */
export function result({ win, onNext, onRetry, onMenu, lines } = {}) {
  const panel = el('div', 'panel');
  panel.appendChild(
    el('div', 'ccz-result-banner ' + (win ? 'win' : 'lose'), win ? '大获全胜' : '兵败如山'),
  );
  panel.appendChild(
    el('div', 'game-sub', win ? '陈留首捷，义旗已张。' : '退守再图，胜败兵家常事。'),
  );

  // 升级演出位：接受字符串数组逐行显示。
  const luLines = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (luLines.length) {
    const box = el('div', 'ccz-levelups');
    box.appendChild(el('div', 'lu-head', '战后历练'));
    for (const line of luLines) box.appendChild(el('div', 'lu-line', line));
    panel.appendChild(box);
  }

  const btns = el('div', 'ccz-menu-btns');
  if (win && onNext) {
    btns.appendChild(
      mkBtn('继续', null, () => {
        close();
        onNext();
      }),
    );
  }
  if (!win && onRetry) {
    btns.appendChild(
      mkBtn('再战一场', null, () => {
        close();
        onRetry();
      }),
    );
  }
  if (onMenu) {
    btns.appendChild(
      mkBtn('回到标题', 'ghost', () => {
        close();
        onMenu();
      }),
    );
  }
  panel.appendChild(btns);
  mount(panel);
}

// --- 存 / 读档 -----------------------------------------------------------------

function fmtTime(ms) {
  if (!ms) return '';
  try {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch (_) {
    return '';
  }
}

/**
 * 存 / 读档槽列表。
 * @param {{mode:'save'|'load', onSave?:(slot)=>void, onLoad?:(slot)=>void,
 *          onClose?:Function}} opts
 *   - mode 'save'：每槽都可点（覆盖写）；调 onSave(slot)。
 *   - mode 'load'：仅有存档的槽可点；调 onLoad(slot)。
 */
export function saveLoad({ mode = 'save', onSave, onLoad, onClose } = {}) {
  const panel = el('div', 'panel');
  panel.appendChild(el('div', 'game-title', mode === 'load' ? '读取存档' : '保存进度'));
  panel.appendChild(
    el('div', 'game-sub', mode === 'load' ? '选择一份军册以继续' : '选择槽位写入当前军册'),
  );

  // listSaves() -> [{slot, chapter, battleIndex, savedAt, rosterCount, corrupt?}]
  let saves = [];
  try {
    saves = game.listSaves() || [];
  } catch (_) {
    saves = [];
  }
  const bySlot = new Map();
  for (const s of saves) bySlot.set(String(s.slot), s);

  const slots = el('div', 'ccz-slots');
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const key = String(i);
    const meta = bySlot.get(key);
    const hasSave = !!meta && !meta.corrupt;

    const slot = el('div', 'ccz-slot' + (hasSave ? '' : ' empty'));
    if (mode === 'load' && !hasSave) slot.classList.add('disabled');

    const no = el('div', 'slot-no', `${i}`);
    const m = el('div', 'slot-meta');
    if (meta && meta.corrupt) {
      m.appendChild(el('div', 'slot-title', '（损坏）'));
      m.appendChild(el('div', 'slot-sub', '存档无法读取'));
      slot.classList.add('disabled');
    } else if (hasSave) {
      m.appendChild(
        el('div', 'slot-title', `第${meta.chapter ?? 1}章 · 第${(meta.battleIndex ?? 0) + 1}战`),
      );
      m.appendChild(
        el('div', 'slot-sub', `武将 ${meta.rosterCount ?? 0} 名 · ${fmtTime(meta.savedAt)}`),
      );
    } else {
      m.appendChild(el('div', 'slot-title', '空槽'));
      m.appendChild(el('div', 'slot-sub', mode === 'save' ? '点击写入' : '无存档'));
    }
    slot.appendChild(no);
    slot.appendChild(m);

    const clickable = mode === 'save' ? true : hasSave;
    if (clickable) {
      slot.addEventListener('click', () => {
        if (mode === 'save') {
          onSave && onSave(i);
          // 重新渲染以反映新写入的时间戳。
          saveLoad({ mode, onSave, onLoad, onClose });
        } else {
          onLoad && onLoad(i);
        }
      });
    }
    slots.appendChild(slot);
  }
  panel.appendChild(slots);

  const btns = el('div', 'ccz-menu-btns');
  btns.appendChild(
    mkBtn('返回', 'ghost', () => {
      close();
      onClose && onClose();
    }),
  );
  panel.appendChild(btns);
  mount(panel);
}

export const menus = { title, pause, result, saveLoad, close };
export default menus;
