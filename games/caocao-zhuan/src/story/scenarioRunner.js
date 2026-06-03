// story/scenarioRunner.js — 剧本解释器（驱动 dialogue + camera + flags）
//
// 契约（plan §1.8）：
//   export function run(scenario, ctx) -> Promise<void>
//
// 解释 scenario.steps（见 b1_chenliu.story.js / plan §1.7）：
//   'narrate' / 'say' / 'choice' -> 交给 dialogue（playStep）
//   'camera'  -> ctx.camera?.setIso() 或 ctx.camera?.cinematic(preset/focus/zoom)
//   'setFlag' -> 写 game.state.storyFlags
//   'duel'    -> { type:'duel', a, b, forced:true } 剧情指定的强制单挑（如三英战吕布）：
//                按 id 从 ctx.controller.units（或 ctx.units）解析双方 → new Duel(a,b,{rng})
//                → await ctx.duelView.run(duel, {sceneManager,camera,fx,audio})
//                → ctx.controller.applyDuelOutcome(outcome) → 继续剧本。
//   其它未知类型 -> 跳过（向前兼容）
// 结束时关闭对话框并在 bus 上 emit 'scenario:done' { scenarioId }。
//
// scenario 入参可为：
//   - 对象 { id, steps:[...] }
//   - 字符串 id（如 'ch01_b1_intro' / 'ch01_b1_reinforce'）→ 从 STORY 解析
// ctx = { camera, sceneManager, controller?, duelView?, fx?, audio?, rng? }
//   （均可选；纯过场无渲染时 camera 为 undefined；duel 步需要 controller + duelView）。

import { bus } from '../core/eventBus.js';
import { game } from '../core/gameState.js';
import { playStep, hideDialogue } from './dialogue.js';
import { Duel } from '../battle/duel.js';
import DEFAULT_STORY from '../data/chapters/ch01/b1_chenliu.story.js';

// 当前活动战役的 STORY（章节循环逐战切换）。默认 b1 以兼容单战旧路径/单测。
// 集成层（main.js）每进入一战前调用 setActiveStory(battle.story)，使触发器按
// scenarioId 解析时命中本战的 intro/outro/scenarios，而非永远落到 b1。
let STORY = DEFAULT_STORY;

/**
 * 切换当前活动战役剧本。供章节循环每战调用一次。
 * @param {object} story  { id?, intro, outro, scenarios?, triggers? }
 */
export function setActiveStory(story) {
  STORY = story || DEFAULT_STORY;
}

// 把字符串 id 解析为 scenario 对象（intro/outro/scenarios[id]/triggers→scenarioId）。
function resolveScenario(scenario) {
  if (!scenario) return null;
  if (typeof scenario === 'object') {
    // 已是 scenario（有 steps）直接用；否则当作没有 steps 的空场景。
    if (Array.isArray(scenario.steps)) return scenario;
    return { id: scenario.id, steps: [] };
  }
  if (typeof scenario === 'string') {
    return findScenarioById(scenario);
  }
  return null;
}

// 在 STORY 中按 id 找 scenario：intro / outro / scenarios{} / triggers[].scenarioId。
function findScenarioById(id) {
  const S = STORY || {};
  if (S.intro && S.intro.id === id) return S.intro;
  if (S.outro && S.outro.id === id) return S.outro;
  if (S.scenarios && S.scenarios[id]) return S.scenarios[id];
  // 直接键名兜底（如 STORY.intro 这种 key）
  if (S[id] && Array.isArray(S[id].steps)) return S[id];
  return null;
}

function applyFlag(flag) {
  if (!flag || typeof flag !== 'object') return;
  if (!game.state.storyFlags || typeof game.state.storyFlags !== 'object') {
    game.state.storyFlags = {};
  }
  Object.assign(game.state.storyFlags, flag);
}

// 处理 'camera' step：优先 preset，再 focus/zoom 走 cinematic。
function applyCamera(step, ctx) {
  const camera = ctx && ctx.camera;
  if (!camera) return; // 纯过场 / 渲染未就绪：静默忽略
  try {
    const preset = step.preset;
    if (preset === 'iso') {
      if (typeof camera.setIso === 'function') camera.setIso();
      return;
    }
    if (preset === 'reset') {
      if (typeof camera.reset === 'function') camera.reset();
      else if (typeof camera.setIso === 'function') camera.setIso();
      return;
    }
    // 'cinematic' / 含 focus|zoom：进入运镜
    if (typeof camera.cinematic === 'function') {
      const arg = {};
      if (step.focus) arg.focus = step.focus;
      if (typeof step.zoom === 'number') arg.zoom = step.zoom;
      camera.cinematic(arg);
    } else if (typeof camera.setIso === 'function') {
      camera.setIso();
    }
    // 同时广播运镜请求，便于 UI/letterbox 等独立响应
    bus.emit('camera:cinematic', { focus: step.focus, zoom: step.zoom, preset });
  } catch (err) {
    console.error('[scenarioRunner] camera step failed:', err);
  }
}

// 在活动战场里按 id 解析单位（优先 ctx.controller.units，其次 ctx.units / ctx.lookup）。
function resolveUnit(id, ctx) {
  if (id == null) return null;
  // 已经是 unit 对象（带 id 字段）直接用。
  if (typeof id === 'object') return id;
  const controller = ctx && ctx.controller;
  if (controller && Array.isArray(controller.units)) {
    const u = controller.units.find((x) => x.id === id);
    if (u) return u;
  }
  if (ctx && Array.isArray(ctx.units)) {
    const u = ctx.units.find((x) => x && x.id === id);
    if (u) return u;
  }
  if (ctx && typeof ctx.lookup === 'function') {
    return ctx.lookup(id) || null;
  }
  return null;
}

// 处理 'duel' step（剧情指定的强制单挑）：解析双方 → Duel → duelView.run → applyDuelOutcome。
// 缺少 controller / duelView（纯过场或未集成）时静默跳过，保持向前兼容。
async function applyDuel(step, ctx) {
  const controller = ctx && ctx.controller;
  const duelView = ctx && ctx.duelView;
  if (!controller || !duelView || typeof duelView.run !== 'function') return;

  const a = resolveUnit(step.a, ctx);
  const b = resolveUnit(step.b, ctx);
  if (!a || !b) {
    console.warn('[scenarioRunner] duel step: 无法解析双方单位', step.a, step.b);
    return;
  }

  const rng = (ctx && ctx.rng) || (controller && controller.rng) || Math.random;
  const duel = new Duel(a, b, { rng });
  bus.emit('duel:start', { aId: a.id, bId: b.id, forced: !!step.forced });

  const outcome = await duelView.run(duel, {
    sceneManager: ctx.sceneManager,
    camera: ctx.camera,
    fx: ctx.fx,
    audio: ctx.audio,
  });

  if (typeof controller.applyDuelOutcome === 'function') {
    controller.applyDuelOutcome(outcome);
  }
}

/**
 * 运行一段剧本。
 * @param {object|string} scenario  scenario 对象或其 id
 * @param {object} [ctx]            { camera, sceneManager, controller?, duelView?, fx?, audio?, rng? }（可选）
 * @returns {Promise<void>}
 */
export async function run(scenario, ctx = {}) {
  const sc = resolveScenario(scenario);
  const scenarioId = (sc && sc.id) || (typeof scenario === 'string' ? scenario : undefined);
  const steps = (sc && Array.isArray(sc.steps) && sc.steps) || [];

  try {
    for (const step of steps) {
      if (!step || typeof step !== 'object') continue;
      switch (step.type) {
        case 'narrate':
        case 'say':
        case 'choice': {
          // dialogue.playStep 内部已对 choice 应用 setFlag
          await playStep(step);
          break;
        }
        case 'camera':
          applyCamera(step, ctx);
          break;
        case 'setFlag':
          applyFlag(step.flag || step.setFlag);
          break;
        case 'duel':
          await applyDuel(step, ctx);
          break;
        default:
          // 未知 step：忽略以保持向前兼容
          break;
      }
    }
  } finally {
    hideDialogue();
    bus.emit('scenario:done', { scenarioId });
  }
}

// 便利：按触发条件查匹配的触发器（供 battleController 在事件时机调用）。
// triggers: [{ on, turn?, generalId?, c?, r?, by?, scenarioId }]
export function triggersFor(on) {
  const list = (STORY && STORY.triggers) || [];
  return list.filter((t) => t && t.on === on);
}

export { resolveScenario, findScenarioById };
export default run;
