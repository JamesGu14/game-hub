// story/dialogue.js — 底部对话框 + 立绘 + 打字机演出（DOM 覆盖层）
//
// 契约（plan §1.8）：
//   export function play(scenario, opts) -> Promise<void>
//
// 渲染进 #dialogue：
//   - 'say'  : 立绘（portrait.js 用 GENERALS[who].appearance）+ 姓名/字 + 打字机文本，
//              点击 / Enter / 空格推进；打字未完点击则瞬显全文。
//   - 'narrate'（无 who）：居中旁白条（无立绘）。
//   - 'choice': 渲染选项按钮，点选后把该项 setFlag 写入 game.state.storyFlags 并推进。
//   文本速度遵循 game.settings.textSpeed（>1 更快）。
//   所有 step 消费完后隐藏 #dialogue 并 resolve。
//
// 仅 'narrate' / 'say' / 'choice' 三类在本模块内消费；其余类型（camera/setFlag）
// 由 scenarioRunner 处理——本模块的 play() 也容忍传入混合 steps：遇到非对话类
// step 时跳过（交由上层），保证既可被 scenarioRunner 逐步驱动，也可独立播放纯对白。

import { GENERALS } from '../data/generals.js';
import { game } from '../core/gameState.js';
import { portraitDataURL } from './portrait.js';

const ROOT_ID = 'dialogue';
const BASE_CHAR_MS = 34; // textSpeed=1 时每字毫秒；textSpeed 越大越快

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const css = `
  #${ROOT_ID} .ccz-scrim{position:absolute;inset:0;background:linear-gradient(180deg,
    rgba(12,16,24,0) 40%, rgba(12,16,24,.55) 100%);}
  #${ROOT_ID} .ccz-dlg{position:absolute;left:0;right:0;bottom:0;display:flex;
    align-items:flex-end;gap:14px;padding:18px clamp(14px,4vw,60px) 26px;}
  #${ROOT_ID} .ccz-portrait{flex:0 0 auto;width:clamp(96px,16vw,168px);
    border-radius:14px;overflow:hidden;border:3px solid var(--gold,#d4af37);
    box-shadow:0 10px 30px rgba(0,0,0,.55);background:#0c1018;align-self:flex-end;}
  #${ROOT_ID} .ccz-portrait img{display:block;width:100%;height:auto;}
  #${ROOT_ID} .ccz-box{flex:1 1 auto;min-height:118px;position:relative;
    border-radius:16px;padding:14px 20px 18px;
    background:linear-gradient(180deg, rgba(35,44,69,.96), rgba(15,19,32,.97));
    border:3px solid var(--gold,#d4af37);
    box-shadow:0 14px 40px rgba(0,0,0,.55), inset 0 0 0 1px rgba(212,175,55,.25);}
  #${ROOT_ID} .ccz-name{display:inline-flex;align-items:baseline;gap:8px;
    font-weight:900;font-size:clamp(17px,2.6vw,22px);color:var(--gold,#d4af37);
    text-shadow:0 2px 0 var(--vermilion,#7a1f1f);letter-spacing:.06em;margin-bottom:8px;}
  #${ROOT_ID} .ccz-name small{font-size:.62em;font-weight:600;color:var(--gold-soft,#e7cf7a);opacity:.85;}
  #${ROOT_ID} .ccz-text{font-size:clamp(15px,2.3vw,19px);line-height:1.7;
    color:var(--parchment,#efe3c4);min-height:1.7em;white-space:pre-wrap;}
  #${ROOT_ID} .ccz-text .cur{opacity:.55;animation:cczBlink 1s steps(1) infinite;}
  #${ROOT_ID} .ccz-next{position:absolute;right:16px;bottom:10px;color:var(--gold-soft,#e7cf7a);
    font-size:13px;opacity:.0;transition:opacity .2s;}
  #${ROOT_ID} .ccz-next.show{opacity:.9;animation:cczBob 1.1s ease-in-out infinite;}
  #${ROOT_ID} .ccz-narr{position:absolute;left:50%;bottom:clamp(60px,16vh,140px);
    transform:translateX(-50%);width:min(86vw,720px);text-align:center;
    padding:18px 26px;border-radius:14px;
    background:linear-gradient(180deg, rgba(15,19,32,.86), rgba(12,16,24,.92));
    border:1px solid rgba(212,175,55,.45);box-shadow:0 12px 36px rgba(0,0,0,.5);}
  #${ROOT_ID} .ccz-narr .ccz-text{font-style:normal;color:var(--gold-soft,#e7cf7a);
    font-size:clamp(15px,2.4vw,20px);}
  #${ROOT_ID} .ccz-choices{position:absolute;left:50%;bottom:clamp(150px,30vh,280px);
    transform:translateX(-50%);display:flex;flex-direction:column;gap:12px;
    width:min(86vw,520px);}
  #${ROOT_ID} .ccz-prompt{text-align:center;margin-bottom:6px;color:var(--gold-soft,#e7cf7a);
    font-size:clamp(15px,2.4vw,19px);text-shadow:0 2px 8px rgba(0,0,0,.6);}
  #${ROOT_ID} .ccz-opt{display:block;width:100%;padding:13px 20px;cursor:pointer;
    font:800 clamp(15px,2.3vw,18px)/1.3 inherit;color:#fff;border-radius:12px;
    border:2px solid var(--gold,#d4af37);
    background:linear-gradient(180deg, var(--vermilion-soft,#a23030), var(--vermilion,#7a1f1f));
    box-shadow:0 5px 0 #4d1212, 0 10px 18px rgba(0,0,0,.35);transition:transform .07s, box-shadow .07s;}
  #${ROOT_ID} .ccz-opt:hover{filter:brightness(1.08);}
  #${ROOT_ID} .ccz-opt:active{transform:translateY(4px);box-shadow:0 1px 0 #4d1212;}
  @keyframes cczBlink{50%{opacity:0;}}
  @keyframes cczBob{0%,100%{transform:translateY(0);}50%{transform:translateY(3px);}}`;
  const el = document.createElement('style');
  el.id = 'ccz-dialogue-style';
  el.textContent = css;
  document.head.appendChild(el);
}

function root() {
  return typeof document !== 'undefined' ? document.getElementById(ROOT_ID) : null;
}

function show(el) {
  if (el) el.classList.add('show');
}
function hide(el) {
  if (el) {
    el.classList.remove('show');
    el.innerHTML = '';
  }
}

function charDelay() {
  const ts = (game && game.state && game.state.settings && game.state.settings.textSpeed) || 1;
  // textSpeed: 1 = 基准；2 ≈ 两倍快；最快下限 6ms/字
  return Math.max(6, BASE_CHAR_MS / Math.max(0.25, ts));
}

// 等待一次「推进」输入（点击 / Enter / Space）。返回可取消的 promise。
function waitAdvance(container) {
  return new Promise((resolve) => {
    function done() {
      cleanup();
      resolve();
    }
    function onKey(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        done();
      }
    }
    function cleanup() {
      container.removeEventListener('click', done);
      window.removeEventListener('keydown', onKey);
    }
    container.addEventListener('click', done);
    window.addEventListener('keydown', onKey);
  });
}

// 打字机：把 full 逐字写入 textEl；可被 skip() 提前显示全文。
// 返回 { promise, skip } —— promise 在打字完成或被 skip 后 resolve（true=被跳过）。
function typewriter(textEl, full) {
  let i = 0;
  let skipped = false;
  let timer = null;
  let resolveFn = null;
  const cur = '<span class="cur">▍</span>';

  function skip() {
    if (skipped || resolveFn === null) return;
    skipped = true;
    if (timer) clearTimeout(timer);
    textEl.innerHTML = escapeHtml(full);
    const r = resolveFn;
    resolveFn = null;
    r(true);
  }

  const promise = new Promise((resolve) => {
    resolveFn = resolve;
    function finish(wasSkipped) {
      if (resolveFn === null) return;
      const r = resolveFn;
      resolveFn = null;
      r(wasSkipped);
    }
    function step() {
      i++;
      textEl.innerHTML = escapeHtml(full.slice(0, i)) + (i < full.length ? cur : '');
      if (i >= full.length) {
        finish(false);
        return;
      }
      timer = setTimeout(step, charDelay());
    }
    if (!full) {
      textEl.innerHTML = '';
      finish(false);
      return;
    }
    timer = setTimeout(step, charDelay());
  });

  return { promise, skip };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 渲染一条 say/narrate，处理打字机 + 推进（首次点击若打字未完则瞬显，再次点击推进）。
function renderLine(host, step) {
  return new Promise((resolve) => {
    const who = step.who;
    const def = who ? GENERALS[who] : null;
    let textEl;

    if (def) {
      // 立绘对白
      const wrap = document.createElement('div');
      wrap.className = 'ccz-dlg';
      const purl = portraitDataURL(def.appearance);
      const pHtml = purl
        ? `<div class="ccz-portrait"><img alt="${escapeHtml(def.name)}" src="${purl}"></div>`
        : '';
      const title = def.title ? `<small>${escapeHtml(def.title)}</small>` : '';
      wrap.innerHTML =
        pHtml +
        `<div class="ccz-box">
           <div class="ccz-name">${escapeHtml(def.name)}${title}</div>
           <div class="ccz-text"></div>
           <div class="ccz-next">▼ 点击 / Enter</div>
         </div>`;
      host.appendChild(wrap);
      textEl = wrap.querySelector('.ccz-text');
      runTyper(wrap, wrap.querySelector('.ccz-next'), textEl);
    } else {
      // 旁白
      const wrap = document.createElement('div');
      wrap.className = 'ccz-narr';
      wrap.innerHTML = `<div class="ccz-text"></div><div class="ccz-next">▼ 点击 / Enter</div>`;
      host.appendChild(wrap);
      textEl = wrap.querySelector('.ccz-text');
      runTyper(wrap, wrap.querySelector('.ccz-next'), textEl);
    }

    async function runTyper(clickTarget, nextHint, tEl) {
      // 整个对话层都可点（覆盖背景推进体验更顺手）
      const stage = host;
      const tw = typewriter(tEl, step.text || '');
      let typing = true;
      tw.promise.then(() => {
        typing = false;
        if (nextHint) nextHint.classList.add('show');
      });

      // 第一次输入：若仍在打字 → 跳到全文；否则推进。之后输入 → 推进。
      while (true) {
        await waitAdvance(stage);
        if (typing) {
          tw.skip();
          typing = false;
          if (nextHint) nextHint.classList.add('show');
          continue;
        }
        break;
      }
      resolve();
    }
  });
}

// 渲染 choice，返回被选 option（已应用 setFlag）。
function renderChoice(host, step) {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'ccz-choices';
    const prompt = step.prompt ? `<div class="ccz-prompt">${escapeHtml(step.prompt)}</div>` : '';
    box.innerHTML = prompt;
    const options = Array.isArray(step.options) ? step.options : [];
    if (options.length === 0) {
      // 无选项的 choice：当作单击推进
      resolve(null);
      return;
    }
    options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ccz-opt';
      btn.textContent = opt.text != null ? opt.text : `选项 ${idx + 1}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyFlag(opt.setFlag);
        resolve(opt);
      });
      box.appendChild(btn);
    });
    host.appendChild(box);
  });
}

function applyFlag(setFlag) {
  if (!setFlag || typeof setFlag !== 'object') return;
  if (!game.state.storyFlags || typeof game.state.storyFlags !== 'object') {
    game.state.storyFlags = {};
  }
  Object.assign(game.state.storyFlags, setFlag);
}

// 是否为本模块消费的对话类 step
function isDialogStep(step) {
  return step && (step.type === 'narrate' || step.type === 'say' || step.type === 'choice');
}

/**
 * 播放一段剧本中的对白（自动跳过 camera/setFlag 等非对白 step）。
 * @param {object|Array} scenario  { steps:[...] } 或直接 steps 数组
 * @param {object} [opts]          预留（如 {keepOpen:true} 不在结束时隐藏）
 * @returns {Promise<void>}
 */
export async function play(scenario, opts = {}) {
  injectStyles();
  const host = root();
  const steps = Array.isArray(scenario) ? scenario : (scenario && scenario.steps) || [];
  if (!host) {
    // 无 DOM（如纯逻辑环境）：仅应用 choice 的默认 setFlag，立即返回。
    for (const s of steps) {
      if (s && s.type === 'choice' && Array.isArray(s.options) && s.options[0]) {
        applyFlag(s.options[0].setFlag);
      }
    }
    return;
  }

  show(host);
  try {
    for (const step of steps) {
      if (!isDialogStep(step)) continue; // camera/setFlag 等交给 scenarioRunner
      host.innerHTML = '';
      const scrim = document.createElement('div');
      scrim.className = 'ccz-scrim';
      host.appendChild(scrim);
      if (step.type === 'choice') {
        await renderChoice(host, step);
      } else {
        await renderLine(host, step);
      }
    }
  } finally {
    if (!opts.keepOpen) hide(host);
  }
}

/**
 * 播放单个 step（供 scenarioRunner 逐步驱动）。返回 choice 选中项或 undefined。
 * 不在结束时隐藏对话框（由 runner 统一收尾）。
 * @param {object} step
 * @returns {Promise<object|undefined>}
 */
export async function playStep(step) {
  injectStyles();
  const host = root();
  if (!isDialogStep(step)) return undefined;
  if (!host) {
    if (step.type === 'choice' && Array.isArray(step.options) && step.options[0]) {
      applyFlag(step.options[0].setFlag);
      return step.options[0];
    }
    return undefined;
  }
  show(host);
  host.innerHTML = '';
  const scrim = document.createElement('div');
  scrim.className = 'ccz-scrim';
  host.appendChild(scrim);
  if (step.type === 'choice') {
    return await renderChoice(host, step);
  }
  await renderLine(host, step);
  return undefined;
}

/** 关闭并清空对话框（供 runner 收尾）。 */
export function hideDialogue() {
  hide(root());
}

export default play;
