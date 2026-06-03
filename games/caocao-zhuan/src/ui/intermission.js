// ui/intermission.js — 关间「整军」界面（卷轴国风 DOM 覆盖层）
//
// 契约（plan §3）：
//   export async function run(ctx) -> Promise<void>
//     渲染章节地图/卷轴风格的整军界面，列出当前 roster（姓名/字/等级/兵种/HP/属性/
//     已学计略），支持：
//       - 查看武将详情（复用 portrait + statCard 风格）。
//       - 装备/卸下物品与宝物（从 gameState.inventory；写回 roster entry.items）。
//       - 学计略（若有计略书道具：消耗书 → skillsLearned 增加）。
//       - 存档（game.save(slot)）。
//       - 「出征」按钮 → resolve 进入下一战。
//
// 数据来自 gameState（game.state.roster / game.state.inventory）；不依赖具体战斗。
// 渲染进 #menus 层（index.html 已存在 `.menus`），仅触碰 DOM（不 import three）。
// node --check 即可；细节走查实玩。

import { game } from '../core/gameState.js';
import { GENERALS } from '../data/generals.js';
import { CLASSES } from '../data/classes.js';
import { SKILLS } from '../data/skills.js';
import { portraitDataURL } from '../story/portrait.js';

// --- 道具目录（自带；inventory / entry.items 中存的是道具 id 字符串）-----------
//
// 暂无独立 data/items.js 模块。整军界面在此内置一份轻量目录，按 id 解释道具：
//   kind 'weapon'|'armor'|'treasure'：可装备到武将（写回 entry.items），带属性加成 bonus。
//   kind 'book'：计略书，使用后让该武将习得 learn 指定的计略（从 inventory 消耗）。
// 未知 id 仍可装备/卸下（按通用「随身物」处理），保证不因数据缺失而崩。
//
// bonus 键 ∈ {hp,atk,def,int,spd}（hp 加到 maxHp）。
const ITEM_CATALOG = {
  // 兵器
  qinggang_sword: { name: '青釭剑', kind: 'weapon', bonus: { atk: 6 }, note: '锋锐削铁' },
  serpent_spear: { name: '丈八蛇矛', kind: 'weapon', bonus: { atk: 7, spd: 1 }, note: '矛长丈八' },
  heavy_halberd: { name: '重戟', kind: 'weapon', bonus: { atk: 5, def: 1 }, note: '猛士所执' },
  war_bow: { name: '硬弓', kind: 'weapon', bonus: { atk: 4, spd: 2 }, note: '开如满月' },
  // 防具
  iron_armor: { name: '玄铁铠', kind: 'armor', bonus: { def: 5, hp: 8 }, note: '坚不可摧' },
  silk_robe: { name: '锦袍', kind: 'armor', bonus: { def: 2, int: 3 }, note: '谋士所披' },
  // 宝物
  warhorse: { name: '良驹', kind: 'treasure', bonus: { spd: 4 }, note: '日行千里' },
  jade_seal: { name: '虎符', kind: 'treasure', bonus: { int: 4, hp: 6 }, note: '号令三军' },
  tiger_talisman: { name: '护身玉', kind: 'treasure', bonus: { def: 3, hp: 10 }, note: '辟邪安神' },
  // 计略书（使用后习得对应计略）
  book_fire: { name: '火攻策', kind: 'book', learn: 'fire', note: '习「火计」' },
  book_heal: { name: '医典', kind: 'book', learn: 'heal', note: '习「治疗」' },
  book_guard: { name: '守御要略', kind: 'book', learn: 'guard', note: '习「防御」' },
};

// 解析任意 inventory/items 条目为 { id, def }。条目可为字符串 id，亦兼容对象 {id,...}。
function resolveItem(entry) {
  const id = typeof entry === 'string' ? entry : entry && (entry.id || entry.itemId);
  if (!id) return { id: String(entry), def: null };
  return { id, def: ITEM_CATALOG[id] || null };
}

function itemName(entry) {
  const { id, def } = resolveItem(entry);
  return def ? def.name : id;
}

function itemKindLabel(def) {
  if (!def) return '随身';
  switch (def.kind) {
    case 'weapon':
      return '兵器';
    case 'armor':
      return '防具';
    case 'treasure':
      return '宝物';
    case 'book':
      return '兵书';
    default:
      return '随身';
  }
}

// 把 bonus 对象（hp/atk/def/int/spd）拼成可读串，如 "攻+6 速+1"。
const STAT_ZH = { hp: 'HP', atk: '攻', def: '防', int: '智', spd: '速' };
function bonusText(bonus) {
  if (!bonus) return '';
  const parts = [];
  for (const k of ['hp', 'atk', 'def', 'int', 'spd']) {
    if (bonus[k]) parts.push(`${STAT_ZH[k]}+${bonus[k]}`);
  }
  return parts.join(' ');
}

// --- 武将有效属性（与 battleController.makeUnit 同口径）--------------------------
// effective = base + growth*(level-1) + Σ 装备 bonus；hp -> maxHp。

function growthOf(def) {
  if (def && def.growth) return def.growth;
  const cls = def && CLASSES[def.classId];
  return (cls && cls.growth) || { hp: 0, atk: 0, def: 0, int: 0, spd: 0 };
}

function computeStats(entry) {
  const def = GENERALS[entry.generalId];
  if (!def) {
    return { maxHp: 0, atk: 0, def: 0, int: 0, spd: 0, mov: 0, itemBonus: {} };
  }
  const base = def.base || {};
  const level = entry.level || 1;
  const g = growthOf(def);
  const lv = Math.max(0, level - 1);

  const stats = {
    maxHp: (base.hp || 0) + (g.hp || 0) * lv,
    atk: (base.atk || 0) + (g.atk || 0) * lv,
    def: (base.def || 0) + (g.def || 0) * lv,
    int: (base.int || 0) + (g.int || 0) * lv,
    spd: (base.spd || 0) + (g.spd || 0) * lv,
    mov: base.mov || 0,
  };

  // 叠加已装备道具加成。
  const itemBonus = { hp: 0, atk: 0, def: 0, int: 0, spd: 0 };
  for (const it of entry.items || []) {
    const { def: idef } = resolveItem(it);
    const b = idef && idef.bonus;
    if (!b) continue;
    for (const k of ['hp', 'atk', 'def', 'int', 'spd']) itemBonus[k] += b[k] || 0;
  }
  stats.maxHp += itemBonus.hp;
  stats.atk += itemBonus.atk;
  stats.def += itemBonus.def;
  stats.int += itemBonus.int;
  stats.spd += itemBonus.spd;
  stats.itemBonus = itemBonus;
  return stats;
}

function classLabel(classId) {
  const cls = CLASSES[classId];
  return (cls && cls.name) || classId || '—';
}

function skillName(sid) {
  const s = SKILLS[sid];
  return (s && s.name) || sid;
}

// --- DOM 小工具 ----------------------------------------------------------------
function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mkBtn(label, cls, onClick) {
  const b = el('button', 'big-btn' + (cls ? ' ' + cls : ''));
  b.type = 'button';
  b.textContent = label;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

function getRoot() {
  return typeof document !== 'undefined' ? document.getElementById('menus') : null;
}

// --- 样式（一次性注入；卷轴国风，复用 style.css 的 --gold/--vermilion 等变量）----
let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const css = `
.ccz-int-scroll{ width:min(96vw,920px); max-height:90vh; display:flex; flex-direction:column;
  border-radius:16px; color:var(--parchment);
  background:linear-gradient(180deg,#262d44 0%, var(--ink-2) 100%);
  border:3px solid var(--gold); box-shadow:0 18px 50px rgba(0,0,0,.55),
  inset 0 0 0 1px rgba(212,175,55,.25); overflow:hidden; }
.ccz-int-head{ position:relative; padding:16px 22px 14px; text-align:center;
  background:linear-gradient(180deg, rgba(122,31,31,.55), rgba(122,31,31,0));
  border-bottom:2px solid rgba(212,175,55,.4); }
.ccz-int-head .ti{ font-size:clamp(22px,4vw,32px); font-weight:900; color:var(--gold);
  letter-spacing:.14em; text-shadow:0 2px 0 var(--vermilion); }
.ccz-int-head .sub{ margin-top:4px; font-size:13px; color:var(--gold-soft); }
.ccz-int-head .scroll-knob{ position:absolute; top:50%; width:14px; height:64px; transform:translateY(-50%);
  border-radius:8px; background:linear-gradient(180deg,#caa64a,#7a5a1a);
  box-shadow:inset 0 0 0 2px rgba(0,0,0,.25); }
.ccz-int-head .scroll-knob.l{ left:-7px; } .ccz-int-head .scroll-knob.r{ right:-7px; }

.ccz-int-body{ display:flex; gap:14px; padding:16px 20px; overflow:hidden; flex:1 1 auto; min-height:0; }

/* 左：名册列表 */
.ccz-roster{ flex:0 0 clamp(220px,34%,320px); display:flex; flex-direction:column; gap:8px;
  overflow:auto; padding-right:4px; }
.ccz-rcard{ display:flex; align-items:center; gap:10px; padding:8px 10px; cursor:pointer;
  border-radius:10px; background:rgba(22,29,46,.6); border:2px solid rgba(212,175,55,.32);
  transition:border-color .1s, background .1s; text-align:left; }
.ccz-rcard:hover{ border-color:var(--gold); background:rgba(122,31,31,.3); }
.ccz-rcard.sel{ border-color:var(--gold); background:rgba(122,31,31,.42);
  box-shadow:0 0 0 1px var(--gold) inset; }
.ccz-rcard img{ width:46px; height:54px; object-fit:cover; border-radius:6px;
  border:2px solid var(--gold); background:#0c1018; flex:0 0 auto; }
.ccz-rcard .ri{ flex:1 1 auto; min-width:0; }
.ccz-rcard .rname{ font-weight:800; color:#fff; font-size:15px; }
.ccz-rcard .rname small{ font-size:.72em; color:var(--gold-soft); font-weight:600; margin-left:5px; }
.ccz-rcard .rmeta{ font-size:12px; color:#aeb7cc; margin-top:2px; }

/* 右：详情面板 */
.ccz-detail{ flex:1 1 auto; min-width:0; overflow:auto; padding-left:4px; }
.ccz-detail .d-top{ display:flex; gap:14px; }
.ccz-detail .d-portrait{ width:clamp(96px,18vw,132px); height:auto; border-radius:12px;
  border:3px solid var(--gold); background:#0c1018; flex:0 0 auto; }
.ccz-detail .d-portrait img{ display:block; width:100%; height:auto; border-radius:9px; }
.ccz-detail .d-head{ flex:1 1 auto; min-width:0; }
.ccz-detail .d-name{ font-size:clamp(20px,3.4vw,28px); font-weight:900; color:var(--gold);
  text-shadow:0 2px 0 var(--vermilion); letter-spacing:.05em; }
.ccz-detail .d-name small{ font-size:.55em; color:var(--gold-soft); font-weight:600; margin-left:8px; }
.ccz-detail .d-tag{ margin-top:6px; font-size:13px; color:var(--gold-soft); }

.ccz-stats{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:10px; }
.ccz-stat{ padding:7px 10px; border-radius:9px; background:rgba(0,0,0,.28);
  border:1px solid rgba(212,175,55,.3); }
.ccz-stat .k{ font-size:11px; color:#aeb7cc; letter-spacing:.08em; }
.ccz-stat .v{ font-size:19px; font-weight:800; color:var(--parchment); }
.ccz-stat .v em{ font-style:normal; font-size:12px; color:var(--gold-soft); margin-left:4px; }

.ccz-sec{ margin-top:14px; }
.ccz-sec .sec-h{ font-size:14px; font-weight:800; color:var(--gold-soft); letter-spacing:.06em;
  margin-bottom:6px; border-bottom:1px dashed rgba(212,175,55,.3); padding-bottom:4px; }
.ccz-list{ display:flex; flex-direction:column; gap:6px; }
.ccz-li{ display:flex; align-items:center; gap:8px; padding:6px 9px; border-radius:8px;
  background:rgba(22,29,46,.55); border:1px solid rgba(212,175,55,.22); }
.ccz-li .li-main{ flex:1 1 auto; min-width:0; }
.ccz-li .li-name{ font-weight:700; color:#fff; font-size:14px; }
.ccz-li .li-name .kind{ font-size:11px; color:var(--gold-soft); margin-right:6px;
  border:1px solid rgba(212,175,55,.4); border-radius:5px; padding:0 5px; }
.ccz-li .li-sub{ font-size:12px; color:#aeb7cc; margin-top:1px; }
.ccz-li .empty{ color:#7e87a0; font-size:13px; padding:4px 2px; }
.ccz-mini{ flex:0 0 auto; padding:5px 12px; border-radius:8px; cursor:pointer;
  font:700 13px/1 inherit; color:#fff; border:2px solid var(--gold);
  background:linear-gradient(180deg, var(--vermilion-soft), var(--vermilion));
  box-shadow:0 3px 0 #4d1212; transition:transform .07s, box-shadow .07s; }
.ccz-mini:hover{ filter:brightness(1.08); }
.ccz-mini:active{ transform:translateY(3px); box-shadow:0 1px 0 #4d1212; }
.ccz-mini.ghost{ color:var(--gold); background:rgba(22,29,46,.6); box-shadow:0 3px 0 #3a2c12; }

.ccz-empty-detail{ display:flex; align-items:center; justify-content:center; height:100%;
  color:#7e87a0; font-size:15px; }

/* 底部行动条 */
.ccz-int-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:14px 22px; border-top:2px solid rgba(212,175,55,.4);
  background:linear-gradient(0deg, rgba(122,31,31,.4), rgba(122,31,31,0)); }
.ccz-int-foot .foot-l{ display:flex; gap:10px; }
.ccz-foot-btn{ padding:11px 22px; border-radius:10px; cursor:pointer;
  font:800 16px/1 inherit; color:#fff; border:2px solid var(--gold);
  background:linear-gradient(180deg, var(--vermilion-soft), var(--vermilion));
  box-shadow:0 5px 0 #4d1212, 0 8px 16px rgba(0,0,0,.3); transition:transform .08s, box-shadow .08s; }
.ccz-foot-btn:active{ transform:translateY(4px); box-shadow:0 1px 0 #4d1212; }
.ccz-foot-btn.ghost{ color:var(--gold); background:rgba(22,29,46,.6); box-shadow:0 5px 0 #3a2c12; }
.ccz-foot-btn.march{ font-size:18px; min-width:150px; letter-spacing:.1em; }

.ccz-toast{ position:absolute; left:50%; bottom:78px; transform:translateX(-50%);
  padding:8px 18px; border-radius:999px; font-size:13px; color:var(--ink);
  background:var(--gold); box-shadow:0 6px 18px rgba(0,0,0,.4); opacity:0;
  transition:opacity .2s; pointer-events:none; white-space:nowrap; z-index:5; }
.ccz-toast.show{ opacity:1; }

@media (max-width:640px){
  .ccz-int-body{ flex-direction:column; }
  .ccz-roster{ flex:0 0 auto; max-height:34vh; }
}
`;
  const tag = el('style');
  tag.id = 'ccz-intermission-styles';
  tag.textContent = css;
  document.head.appendChild(tag);
}

// --- 主入口 --------------------------------------------------------------------
/**
 * 关间整军界面。渲染进 #menus，返回 Promise，在玩家点「出征」时 resolve。
 * @param {object} [ctx] 预留上下文（如 {battleIndex, nextBattleName}），仅用于文案。
 * @returns {Promise<void>}
 */
export async function run(ctx = {}) {
  const root = getRoot();
  // 无 DOM（node --check / 纯逻辑环境）：直接 resolve，不阻塞流程。
  if (!root) return;

  ensureStyles();

  return new Promise((resolve) => {
    let selectedId = null; // 当前选中的 roster generalId
    let toastTimer = null;

    // 当前 roster（直接引用 game.state；改动写回同一引用即可持久化）。
    const roster = () => (Array.isArray(game.state.roster) ? game.state.roster : []);
    const inventory = () => {
      if (!Array.isArray(game.state.inventory)) game.state.inventory = [];
      return game.state.inventory;
    };

    // ---- 构建骨架 ----
    const scroll = el('div', 'ccz-int-scroll');

    const head = el('div', 'ccz-int-head');
    head.appendChild(el('div', 'scroll-knob l'));
    head.appendChild(el('div', 'scroll-knob r'));
    head.appendChild(el('div', 'ti', '整 军'));
    const nextName = ctx && ctx.nextBattleName ? `　下一战 · ${esc(ctx.nextBattleName)}` : '';
    head.appendChild(el('div', 'sub', '点将查阅 · 装备宝物 · 研习计略' + nextName));
    scroll.appendChild(head);

    const body = el('div', 'ccz-int-body');
    const rosterCol = el('div', 'ccz-roster');
    const detailCol = el('div', 'ccz-detail');
    body.appendChild(rosterCol);
    body.appendChild(detailCol);
    scroll.appendChild(body);

    const foot = el('div', 'ccz-int-foot');
    const footL = el('div', 'foot-l');
    const saveBtn = el('button', 'ccz-foot-btn ghost');
    saveBtn.type = 'button';
    saveBtn.textContent = '存档';
    saveBtn.addEventListener('click', openSavePicker);
    footL.appendChild(saveBtn);
    foot.appendChild(footL);

    const marchBtn = el('button', 'ccz-foot-btn march');
    marchBtn.type = 'button';
    marchBtn.textContent = '出 征';
    marchBtn.addEventListener('click', () => {
      cleanup();
      resolve();
    });
    foot.appendChild(marchBtn);
    scroll.appendChild(foot);

    const toast = el('div', 'ccz-toast');
    scroll.appendChild(toast);

    // ---- 渲染：名册列表 ----
    function renderRoster() {
      rosterCol.innerHTML = '';
      const list = roster();
      if (list.length === 0) {
        rosterCol.appendChild(el('div', 'ccz-li', '<span class="empty">军中暂无将领。</span>'));
        return;
      }
      for (const entry of list) {
        const def = GENERALS[entry.generalId];
        if (!def) continue;
        const stats = computeStats(entry);
        const card = el('div', 'ccz-rcard' + (entry.generalId === selectedId ? ' sel' : ''));
        const purl = portraitDataURL(def.appearance);
        const img = purl ? `<img alt="${esc(def.name)}" src="${purl}">` : '<div class="img"></div>';
        const title = def.title ? `<small>${esc(def.title)}</small>` : '';
        card.innerHTML =
          img +
          `<div class="ri">
             <div class="rname">${esc(def.name)}${title}</div>
             <div class="rmeta">Lv.${entry.level || 1} · ${esc(classLabel(def.classId))} · HP ${stats.maxHp}</div>
           </div>`;
        card.addEventListener('click', () => {
          selectedId = entry.generalId;
          renderRoster();
          renderDetail();
        });
        rosterCol.appendChild(card);
      }
    }

    // ---- 渲染：武将详情 ----
    function renderDetail() {
      detailCol.innerHTML = '';
      const entry = roster().find((e) => e.generalId === selectedId);
      if (!entry) {
        detailCol.appendChild(el('div', 'ccz-empty-detail', '← 点选一名将领以查阅军册'));
        return;
      }
      const def = GENERALS[entry.generalId];
      if (!def) {
        detailCol.appendChild(el('div', 'ccz-empty-detail', '（未知武将）'));
        return;
      }
      const stats = computeStats(entry);

      // 顶部：立绘 + 名号 + 兵种/等级
      const top = el('div', 'd-top');
      const purl = portraitDataURL(def.appearance);
      const pHtml = purl ? `<img alt="${esc(def.name)}" src="${purl}">` : '';
      top.appendChild(el('div', 'd-portrait', pHtml));
      const dhead = el('div', 'd-head');
      const title = def.title ? `<small>${esc(def.title)}</small>` : '';
      dhead.appendChild(el('div', 'd-name', `${esc(def.name)}${title}`));
      dhead.appendChild(
        el(
          'div',
          'd-tag',
          `${esc(classLabel(def.classId))} · Lv.${entry.level || 1} · 经验 ${entry.exp || 0}/100`,
        ),
      );

      // 属性网格（HP/攻/防/智/速/移；装备加成以 (+n) 标出）
      const grid = el('div', 'ccz-stats');
      const ib = stats.itemBonus || {};
      const statRows = [
        ['HP', stats.maxHp, ib.hp],
        ['攻', stats.atk, ib.atk],
        ['防', stats.def, ib.def],
        ['智', stats.int, ib.int],
        ['速', stats.spd, ib.spd],
        ['移', stats.mov, 0],
      ];
      for (const [k, v, bonus] of statRows) {
        const cell = el('div', 'ccz-stat');
        const extra = bonus ? `<em>(+${bonus})</em>` : '';
        cell.innerHTML = `<div class="k">${k}</div><div class="v">${v}${extra}</div>`;
        grid.appendChild(cell);
      }
      dhead.appendChild(grid);
      top.appendChild(dhead);
      detailCol.appendChild(top);

      // 已学计略
      const skSec = el('div', 'ccz-sec');
      skSec.appendChild(el('div', 'sec-h', '已习计略'));
      const skList = el('div', 'ccz-list');
      const learned = Array.isArray(entry.skillsLearned) ? entry.skillsLearned : [];
      if (learned.length === 0) {
        skList.appendChild(el('div', 'ccz-li', '<span class="empty">尚未习得计略。</span>'));
      } else {
        for (const sid of learned) {
          const s = SKILLS[sid];
          const li = el('div', 'ccz-li');
          const sub = s ? `${kindZh(s.kind)} · 威力 ${s.power} · 用 ${s.uses}` : '';
          li.innerHTML = `<div class="li-main"><div class="li-name">${esc(skillName(sid))}</div><div class="li-sub">${esc(sub)}</div></div>`;
          skList.appendChild(li);
        }
      }
      skSec.appendChild(skList);
      detailCol.appendChild(skSec);

      // 已装备物品（可卸下）
      const eqSec = el('div', 'ccz-sec');
      eqSec.appendChild(el('div', 'sec-h', '随身装备'));
      const eqList = el('div', 'ccz-list');
      const items = Array.isArray(entry.items) ? entry.items : [];
      if (items.length === 0) {
        eqList.appendChild(el('div', 'ccz-li', '<span class="empty">未携带任何物品。</span>'));
      } else {
        items.forEach((it, idx) => {
          const { def: idef } = resolveItem(it);
          const li = el('div', 'ccz-li');
          const bt = idef ? bonusText(idef.bonus) : '';
          const note = idef && idef.note ? idef.note : '';
          const sub = [bt, note].filter(Boolean).join(' · ');
          li.innerHTML = `<div class="li-main"><div class="li-name"><span class="kind">${esc(
            itemKindLabel(idef),
          )}</span>${esc(itemName(it))}</div>${
            sub ? `<div class="li-sub">${esc(sub)}</div>` : ''
          }</div>`;
          const btn = el('button', 'ccz-mini ghost');
          btn.type = 'button';
          btn.textContent = '卸下';
          btn.addEventListener('click', () => unequip(entry, idx));
          li.appendChild(btn);
          eqList.appendChild(li);
        });
      }
      eqSec.appendChild(eqList);
      detailCol.appendChild(eqSec);

      // 军备库（inventory：可装备 / 计略书可研习）
      const invSec = el('div', 'ccz-sec');
      invSec.appendChild(el('div', 'sec-h', '军备库'));
      const invList = el('div', 'ccz-list');
      const inv = inventory();
      if (inv.length === 0) {
        invList.appendChild(el('div', 'ccz-li', '<span class="empty">军备库空空如也。</span>'));
      } else {
        inv.forEach((it, idx) => {
          const { id, def: idef } = resolveItem(it);
          const li = el('div', 'ccz-li');
          const isBook = idef && idef.kind === 'book';
          const bt = idef ? bonusText(idef.bonus) : '';
          const note = idef && idef.note ? idef.note : '';
          const sub = [bt, note].filter(Boolean).join(' · ');
          li.innerHTML = `<div class="li-main"><div class="li-name"><span class="kind">${esc(
            itemKindLabel(idef),
          )}</span>${esc(itemName(it))}</div>${
            sub ? `<div class="li-sub">${esc(sub)}</div>` : ''
          }</div>`;
          if (isBook) {
            const learnId = idef.learn;
            const already = (entry.skillsLearned || []).includes(learnId);
            const btn = el('button', 'ccz-mini');
            btn.type = 'button';
            btn.textContent = already ? '已习' : '研习';
            if (already) {
              btn.disabled = true;
              btn.style.opacity = '0.45';
              btn.style.cursor = 'default';
            } else {
              btn.addEventListener('click', () => learnBook(entry, idx, learnId));
            }
            li.appendChild(btn);
          } else {
            const btn = el('button', 'ccz-mini');
            btn.type = 'button';
            btn.textContent = '装备';
            btn.addEventListener('click', () => equip(entry, idx));
            li.appendChild(btn);
          }
          invList.appendChild(li);
          void id;
        });
      }
      invSec.appendChild(invList);
      detailCol.appendChild(invSec);
    }

    // ---- 操作：装备 / 卸下 / 研习 / 存档 ----
    function equip(entry, invIdx) {
      const inv = inventory();
      if (invIdx < 0 || invIdx >= inv.length) return;
      const [it] = inv.splice(invIdx, 1);
      if (!Array.isArray(entry.items)) entry.items = [];
      entry.items.push(it);
      showToast(`${GENERALS[entry.generalId].name} 装备「${itemName(it)}」`);
      renderRoster();
      renderDetail();
    }

    function unequip(entry, itemIdx) {
      if (!Array.isArray(entry.items) || itemIdx < 0 || itemIdx >= entry.items.length) return;
      const [it] = entry.items.splice(itemIdx, 1);
      inventory().push(it);
      showToast(`卸下「${itemName(it)}」`);
      renderRoster();
      renderDetail();
    }

    function learnBook(entry, invIdx, learnId) {
      const inv = inventory();
      if (invIdx < 0 || invIdx >= inv.length) return;
      if (!learnId || !SKILLS[learnId]) {
        showToast('此书无可习之计');
        return;
      }
      if (!Array.isArray(entry.skillsLearned)) entry.skillsLearned = [];
      if (!entry.skillsLearned.includes(learnId)) entry.skillsLearned.push(learnId);
      inv.splice(invIdx, 1); // 消耗兵书
      showToast(`${GENERALS[entry.generalId].name} 习得「${skillName(learnId)}」`);
      renderDetail();
    }

    // 存档：复用 menus.saveLoad 风格在本面板内弹一个简易槽位选择层。
    function openSavePicker() {
      const overlay = el('div', 'ccz-int-scroll');
      overlay.style.position = 'absolute';
      overlay.style.left = '50%';
      overlay.style.top = '50%';
      overlay.style.transform = 'translate(-50%,-50%)';
      overlay.style.width = 'min(86vw,440px)';
      overlay.style.zIndex = '10';

      const h = el('div', 'ccz-int-head');
      h.appendChild(el('div', 'ti', '保存进度'));
      h.appendChild(el('div', 'sub', '选择槽位写入当前军册'));
      overlay.appendChild(h);

      const b = el('div', 'ccz-int-body');
      b.style.flexDirection = 'column';
      const list = el('div', 'ccz-list');
      list.style.width = '100%';
      let saves = [];
      try {
        saves = game.listSaves() || [];
      } catch (_) {
        saves = [];
      }
      const bySlot = new Map();
      for (const s of saves) bySlot.set(String(s.slot), s);
      for (let i = 1; i <= 3; i++) {
        const meta = bySlot.get(String(i));
        const li = el('div', 'ccz-li');
        li.style.cursor = 'pointer';
        const desc =
          meta && !meta.corrupt
            ? `第${meta.chapter ?? 1}章 · 第${(meta.battleIndex ?? 0) + 1}战 · ${meta.rosterCount ?? 0}将`
            : '空槽 · 点击写入';
        li.innerHTML = `<div class="li-main"><div class="li-name">存档 ${i}</div><div class="li-sub">${esc(desc)}</div></div>`;
        li.addEventListener('click', () => {
          const ok = game.save(i);
          showToast(ok ? `已保存至存档 ${i}` : '保存失败');
          closeOverlay();
        });
        list.appendChild(li);
      }
      b.appendChild(list);
      overlay.appendChild(b);

      const f = el('div', 'ccz-int-foot');
      f.appendChild(el('div', 'foot-l'));
      const back = el('button', 'ccz-foot-btn ghost');
      back.type = 'button';
      back.textContent = '返回';
      back.addEventListener('click', closeOverlay);
      f.appendChild(back);
      overlay.appendChild(f);

      // 半透明遮罩 + 居中弹层（覆盖在整军面板之上）。
      const veil = el('div', 'ccz-int-veil');
      veil.style.position = 'fixed';
      veil.style.inset = '0';
      veil.style.zIndex = '9';
      veil.style.background = 'rgba(8,11,18,.6)';
      veil.appendChild(overlay);
      veil.addEventListener('click', (e) => {
        if (e.target === veil) closeOverlay();
      });
      root.appendChild(veil);

      function closeOverlay() {
        if (veil.parentNode) veil.parentNode.removeChild(veil);
      }
    }

    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
    }

    function cleanup() {
      if (toastTimer) clearTimeout(toastTimer);
      root.classList.remove('show');
      root.innerHTML = '';
    }

    // ---- 首屏 ----
    const list = roster();
    selectedId = list.length ? list[0].generalId : null;

    root.innerHTML = '';
    root.appendChild(scroll);
    root.classList.add('show');
    renderRoster();
    renderDetail();
  });
}

function kindZh(kind) {
  switch (kind) {
    case 'support':
      return '辅助';
    case 'magic':
      return '法术';
    case 'self':
      return '自身';
    default:
      return kind || '';
  }
}

export default { run };
