// 群雄逐鹿·孟德篇 — main.js（Task F 章节流程总指挥）
//
// 串起整章流程（CH01「起兵讨董」共 5 战）：
//   标题 →（新游戏 battleIndex=0 / 读档续进）→ 章节循环：
//     intro 剧情 → 建场 → 玩家/敌方相位 → 胜负 → outro 剧情（仅胜）
//     → 应用 joinsAfter（剧情登场加入常驻 roster）→ 若非末战：整军(intermission) + 自动存档
//     → battleIndex++ → 下一战 ；末战胜 → 章末结算字幕 → 返回 hub。
//   战败：结算屏（重打本战 / 返回标题）。
// 逻辑层（battle/*）经 core/eventBus 把状态变化驱动到渲染(render3d/*)、UI(ui/*)、
// 音频(audio/*)、剧情(story/*)。本文件只做编排与「事件→演出」绑定，不内置战斗规则。
//
// 'three' 由 importmap 解析为本地 ./lib/three.module.js（r170）。

import * as THREE from 'three';

import { bus } from './core/eventBus.js';
import { game } from './core/gameState.js';
import { makeRng } from './core/rng.js';

import { GENERALS } from './data/generals.js';
import { CLASSES } from './data/classes.js';
import { SKILLS } from './data/skills.js';
import { CH01 } from './data/chapters/ch01/index.js';

import { BattleController } from './battle/battleController.js';
import { aoeCells } from './battle/skillEngine.js';
import { Duel } from './battle/duel.js';

import { createSceneManager } from './render3d/sceneManager.js';
import { moveAlong, hitFlash, floatText, castFx, setFxScene } from './render3d/fx.js';

import { run as runScenario, setActiveStory } from './story/scenarioRunner.js';
import { duelView } from './ui/duelView.js';
import * as intermission from './ui/intermission.js';

import * as hud from './ui/hud.js';
import * as menus from './ui/menus.js';

import { sfx } from './audio/audio.js';

// ---------------------------------------------------------------------------
// 全局编排状态
// ---------------------------------------------------------------------------
const AUTO_SLOT = 1; // 战后自动存档槽
const CHAPTER = CH01; // 当前章节清单

// 当前战的 map / story / seed（章节循环逐战切换；下方多处沿用模块级 MAP/STORY 引用）。
let currentBattle = null; // CH01.battles[i]
let MAP = null; // 当前战 map（已合并 story.triggers）
let STORY = null; // 当前战 story
let BATTLE_SEED = 'ch01_b1'; // 可复现 rng 种子（按战序变化）
let battleResolver = null; // 当前战的胜负 resolve（runBattle ↔ onBattleEnd）

const canvas = document.getElementById('game');
const dialogueEl = document.getElementById('dialogue');

let sceneManager = null; // createSceneManager() 实例
let cameraRig = null; // 等距相机封装（setIso/cinematic/reset）
let controller = null; // 当前 BattleController

// 玩家相位的交互态。
let selectedUnit = null; // 当前选中的我方单位
let moveCells = []; // 当前移动高亮格 [{c,r}]
let attackCells = []; // 当前攻击高亮格 [{c,r}]
let interactionLocked = true; // 演出/动画/敌方相位期间锁定点选
let cinematicPending = false; // 回合开始触发剧情进行中：由其 handler 独占并在播完后进入玩家相位
let pendingMode = null; // 'attack' | 'skill' | 'duel' 目标选择待定模式
let pendingSkillId = null; // skill 模式下待施放的计略 id
let pendingSkillCells = null; // skill 模式下的合法施法格预览（controller.skillTargetCells 结果）
let skillHoverCell = null; // skill 模式下当前预览 AOE 的目标格 {c,r}
let pendingDuelUnit = null; // duel 模式下发起单挑的我方单位（多目标时点选敌将）

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------
const key = (c, r) => `${c},${r}`;
const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// 取单位三维 group 顶面世界坐标（用于飘字 / 运镜 focus）。
function unitWorldPos(unit, lift = 1.4) {
  if (sceneManager && sceneManager.grid) {
    const w = sceneManager.grid.tileWorld(unit.pos.c, unit.pos.r);
    return new THREE.Vector3(w.x, w.y + lift, w.z);
  }
  return new THREE.Vector3(0, lift, 0);
}

// 取某格地面顶面世界坐标（castFx 的 AOE 用，落在地面而非单位顶面）。
function cellWorldGround(c, r) {
  if (sceneManager && sceneManager.grid) {
    const w = sceneManager.grid.tileWorld(c, r);
    return new THREE.Vector3(w.x, w.y, w.z);
  }
  return new THREE.Vector3(0, 0, 0);
}

// 元素 -> 受击闪色 / 飘字色。
function elementFlashColor(element) {
  return ({ fire: 0xff7a2a, thunder: 0xfff04a, water: 0x49b6ff, dark: 0x9a4fd0 })[element] || 0xff5b5b;
}
function elementTextColor(element) {
  return ({ fire: '#ff9a3c', thunder: '#fff04a', water: '#7fd0ff', dark: '#c79bff' })[element] || '#ff5b5b';
}

// floatText 的 ctx（投影到 #dialogue 同级覆盖层之上）。
function fxCtx() {
  return {
    camera: sceneManager ? sceneManager.camera : null,
    renderer: sceneManager ? sceneManager.renderer : null,
    overlay: document.body,
  };
}

// duelView / scenarioRunner duel 步用的 ctx：把渲染/音频/特效门面打包。
// fx 暴露 duelView 需要的 hitFlash(group,color) 与 floatText(ctx,pos,text,color)。
function duelViewCtx() {
  return {
    sceneManager,
    camera: cameraRig,
    fx: { hitFlash, floatText },
    audio: sfx,
  };
}

// scenarioRunner 的 ctx：含运镜/场景 + 单挑所需（controller/duelView/fx/audio/rng），
// 以支持剧情指定的 { type:'duel', a, b, forced } 步（如第 4 战「三英战吕布」）。
function scenarioCtx() {
  return {
    camera: cameraRig,
    sceneManager,
    controller,
    duelView,
    fx: { hitFlash, floatText },
    audio: sfx,
    rng: controller ? controller.rng : undefined,
  };
}

// 兵种攻击区间（运行态 unit 不带 atkRange；按兵种取，和 data/classes.js 对齐）。
function atkRangeOf(unit) {
  const r = CLASSES[unit.classId] && CLASSES[unit.classId].atkRange;
  return Array.isArray(r) ? r : [1, 1];
}

// 某单位某计略的剩余次数（读控制器懒初始化的运行态；缺省回退 SKILLS[].uses）。
function skillUsesLeft(unit, skillId) {
  if (unit && unit._skillUses && unit._skillUses[skillId] != null) return unit._skillUses[skillId];
  const def = SKILLS[skillId];
  return def && typeof def.uses === 'number' ? def.uses : 0;
}

// 该计略当前是否有合法施法目标（委托控制器，含敌我过滤/射程/次数）。
function skillHasTarget(unit, skillId) {
  const info = controller.skillTargetCells(unit, skillId);
  return info && info.targets && info.targets.length > 0;
}

// 当前可被某单位攻击到的敌人（移动后判定，按曼哈顿区间）。
function attackableEnemiesOf(unit) {
  const [mn, mx] = atkRangeOf(unit);
  const foeFaction = unit.faction === 'wei' ? 'foe' : 'wei';
  return controller.units.filter(
    (u) => u.alive && u.faction === foeFaction && (() => {
      const d = manhattan(unit.pos, u.pos);
      return d >= mn && d <= mx;
    })(),
  );
}

// ---------------------------------------------------------------------------
// 启动 / Boot
// ---------------------------------------------------------------------------
function boot() {
  sceneManager = createSceneManager();
  sceneManager.init(canvas);
  cameraRig = sceneManager.cameraRig;
  sceneManager.start();

  wireMuteButton();
  wireBus();
  wirePointer();

  // 同步初始静音（沿用 A1 占位的 window.__cczMuted 约定 / game.settings）。
  const initialMuted = !!(window.__cczMuted || (game.state.settings && game.state.settings.muted));
  sfx.setMuted(initialMuted);

  showTitle();
  console.log('caocao-zhuan boot ok');
}

// 静音按钮（hub 约定）：接 audio.setMuted + game.settings + 图标。
function wireMuteButton() {
  const btn = document.getElementById('btn-mute');
  const apply = () => {
    const m = sfx.isMuted();
    if (btn) {
      btn.textContent = m ? '🔇' : '🔊';
      btn.classList.toggle('muted', m);
    }
  };
  const toggle = () => {
    sfx.resume();
    sfx.setMuted(!sfx.isMuted());
    apply();
  };
  btn?.addEventListener('click', toggle);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') toggle();
  });
  apply();
}

// ---------------------------------------------------------------------------
// 标题屏
// ---------------------------------------------------------------------------
function showTitle() {
  interactionLocked = true;
  cameraRig && cameraRig.setIso();
  menus.title({
    onStart: () => {
      sfx.resume();
      game.newGame();
      seedRosterFromMap(CHAPTER.battles[0].map);
      game.state.battleIndex = 0;
      runChapter();
    },
    onContinue: (slot) => {
      sfx.resume();
      game.load(slot);
      // 读档若无 roster（异常）：用首战部署补一份基线。
      if (!Array.isArray(game.state.roster) || game.state.roster.length === 0) {
        seedRosterFromMap(CHAPTER.battles[0].map);
      }
      runChapter();
    },
  });
}

// 新游戏：把首战我方武将（map.deploy → wei，且非客将）写入 roster，建立升级持久化基线。
// 客将（仅在某战 deploy、faction 仍为 'wei'）通过 GENERALS[].guest 标记排除——
// 但首战(b1)本无客将，这里仍按标记过滤以稳妥。
function seedRosterFromMap(map) {
  const roster = [];
  for (const d of (map && map.deploy) || []) {
    const def = GENERALS[d.generalId];
    if (!def || def.faction !== 'wei') continue;
    if (def.guest) continue; // 客将不入常驻
    roster.push({
      generalId: d.generalId,
      level: 1,
      exp: 0,
      items: Array.isArray(def.items) ? [...def.items] : [],
      skillsLearned: Array.isArray(def.skills) ? [...def.skills] : [],
      curHp: null,
    });
  }
  game.state.roster = roster;
}

// ---------------------------------------------------------------------------
// 章节循环：从 game.state.battleIndex 续进，逐战编排 intro→战斗→outro→整军。
// ---------------------------------------------------------------------------
async function runChapter() {
  const battles = CHAPTER.battles || [];
  // 钳制起始索引（读档/异常兜底）。
  let idx = clampIndex(game.state.battleIndex || 0, battles.length);

  while (idx < battles.length) {
    game.state.battleIndex = idx;
    const battle = battles[idx];
    const isLast = idx === battles.length - 1;

    // 打一场（返回 true=胜）。失败时 runBattle 内部已弹结算屏（重打/返回）并不 resolve，
    // 由那两个回调接管后续流程；故这里仅在胜利分支继续推进。
    const win = await runBattle(battle);
    if (!win) return; // 败北：结算屏的 onRetry/onMenu 接管，章节循环就此让出。

    // —— 战后：剧情登场加入常驻 roster（客将不在 joinsAfter）——
    applyJoins(battle);

    if (!isLast) {
      // 整军（查看/装备/学计略/存档）。
      try {
        await intermission.run({
          battleIndex: idx,
          nextBattleName: nameOfBattle(battles[idx + 1]),
        });
      } catch (err) {
        console.error('[main] intermission failed:', err);
      }
      // 推进 + 自动存档（续进点）。
      idx += 1;
      game.state.battleIndex = idx;
      game.save(AUTO_SLOT);
    } else {
      // 末战告捷：章末结算字幕 → 返回 hub。
      game.state.battleIndex = battles.length; // 标记本章已通关
      game.save(AUTO_SLOT);
      await showChapterEnd();
      return;
    }
  }

  // 越界（读档指向已通关章节）：直接进章末。
  await showChapterEnd();
}

function clampIndex(i, len) {
  if (!Number.isFinite(i) || i < 0) return 0;
  if (i >= len) return Math.max(0, len - 1);
  return i;
}

function nameOfBattle(battle) {
  return (battle && battle.map && battle.map.name) || '';
}

// 应用 battle.joinsAfter：把剧情登场武将加入常驻 roster（幂等）。
function applyJoins(battle) {
  const joins = (battle && battle.joinsAfter) || [];
  for (const gid of joins) {
    if (!GENERALS[gid]) {
      console.warn('[main] joinsAfter unknown generalId:', gid);
      continue;
    }
    game.addToRoster(gid);
  }
}

// ---------------------------------------------------------------------------
// 开战：剧情 → 建场 → 玩家相位
// ---------------------------------------------------------------------------
// 把一场战斗从「装配 → intro → 玩家相位」串起，返回一个在胜负结算后 resolve(win) 的 Promise。
// onBattleEnd 通过 battleResolver 在胜利（已演完 outro）/失败时 resolve；
// 失败分支由结算屏的 onRetry/onMenu 接管，故 resolve(false) 仅作让出标记。
function runBattle(battle) {
  return new Promise((resolve) => {
    battleResolver = resolve;
    setupBattle(battle).catch((err) => {
      console.error('[main] setupBattle failed:', err);
    });
  });
}

// 当前战的种子：按 map.id 派生（ch01_b1 …），保证可复现且逐战不同。
function seedForBattle(battle) {
  const id = battle && battle.map && battle.map.id;
  return id ? String(id) : 'ch01_battle';
}

// 装配某场战斗：切换 MAP/STORY/seed → 构造 controller → 建场 → intro → 玩家回合。
async function setupBattle(battle) {
  currentBattle = battle;
  STORY = battle.story;
  BATTLE_SEED = seedForBattle(battle);
  // 合并 story.triggers → map.triggers（引擎只读 map.triggers 派发 turnStart）。
  MAP = withMergedTriggers(battle.map, battle.story);
  // 让 scenarioRunner 按本战 STORY 解析 trigger scenarioId（camera:cinematic）。
  setActiveStory(battle.story);

  battleEnded = false;
  interactionLocked = true;
  resetInteraction();

  // 构造控制器（rng 可复现；bus 注入）。
  controller = new BattleController(MAP, game.state.roster, {
    rng: makeRng(BATTLE_SEED),
    bus,
  });

  // 计略次数现由 controller 运行态（unit._skillUses）懒初始化并维护；UI 只读不再镜像。

  // 装配三维战场。
  sceneManager.buildBattle(MAP, controller.units);
  // 注册放置计略三维特效的 scene（castFx 用）。
  setFxScene(sceneManager.scene);
  cameraRig.setIso();

  // 开场剧情（运镜交给 cameraRig；ctx 含单挑钩子以支持剧情强制单挑步）。
  await runScenario(STORY.intro, scenarioCtx());

  // 进入玩家回合。
  await hud.turnBanner(`${MAP.name || '战'} · 我军`, 1200);
  beginPlayerPhase();
}

// 返回一份合并了 story.triggers 的 map 浅拷贝（不改原内容模块）。
// 若 map 已自带 triggers（如 b4/b5），以 map.triggers 为准（避免重复派发）；
// 否则用 story.triggers 填充，使 b1/b2/b3 的 turnStart 小演出也能由引擎触发。
function withMergedTriggers(map, story) {
  if (!map) return map;
  const mapTriggers = Array.isArray(map.triggers) ? map.triggers : null;
  if (mapTriggers && mapTriggers.length) return map; // 已有，原样用
  const storyTriggers = story && Array.isArray(story.triggers) ? story.triggers : [];
  if (!storyTriggers.length) return map;
  return { ...map, triggers: storyTriggers.map((t) => ({ ...t })) };
}

function beginPlayerPhase() {
  controller.phase = 'player';
  interactionLocked = false;
  resetInteraction();
  ensureEndTurnButton();
  hud.turnBanner('我军回合', 900);
}

// ---------------------------------------------------------------------------
// 玩家交互：点选 → 移动 → 行动菜单 → 攻击 / 计略 / 待机
// ---------------------------------------------------------------------------
function wirePointer() {
  canvas.addEventListener('pointerdown', (e) => {
    sfx.resume();
    if (e.button !== 0) return; // 仅左键
    onPick(e.clientX, e.clientY);
  });
  // 计略目标模式：移动指针时预览落点 AOE（金色）。
  canvas.addEventListener('pointermove', (e) => {
    if (pendingMode !== 'skill') return;
    handleSkillHover(e.clientX, e.clientY);
  });
  // 右键 / Esc：在计略目标模式下取消选格，回到该单位的行动菜单。
  canvas.addEventListener('contextmenu', (e) => {
    if (pendingMode === 'skill') {
      e.preventDefault();
      cancelSkillTargeting();
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pendingMode === 'skill') {
      e.preventDefault();
      cancelSkillTargeting();
    }
  });
}

// 取消计略选格：清预览，回到发起单位的行动菜单。
function cancelSkillTargeting() {
  const unit = selectedUnit;
  pendingMode = null;
  pendingSkillId = null;
  pendingSkillCells = null;
  skillHoverCell = null;
  sceneManager.clearHighlight();
  if (unit && unit.alive && !unit.hasActed) {
    openActionMenu(unit);
  } else {
    clearSelection();
  }
}

function onPick(clientX, clientY) {
  if (interactionLocked || !controller || controller.phase !== 'player') return;
  const hitInfo = sceneManager.pick(clientX, clientY);
  if (!hitInfo) {
    // 点空白：取消选中。
    if (!pendingMode) clearSelection();
    return;
  }

  // 目标选择模式（攻击 / 单挑 / 计略）优先消费点击。
  if (pendingMode === 'attack') {
    handleAttackPick(hitInfo);
    return;
  }
  if (pendingMode === 'duel') {
    handleDuelPick(hitInfo);
    return;
  }
  if (pendingMode === 'skill') {
    handleSkillPick(hitInfo);
    return;
  }

  if (hitInfo.kind === 'unit') {
    const u = controller.units.find((x) => x.id === hitInfo.id && x.alive);
    if (!u) return;
    if (u.faction === 'wei' && !u.hasActed) {
      selectUnit(u);
    } else {
      // 点敌方 / 已行动单位：仅展示信息卡。
      hud.showUnit(u);
    }
    return;
  }

  if (hitInfo.kind === 'tile' && selectedUnit) {
    const cell = { c: hitInfo.c, r: hitInfo.r };
    if (moveCells.some((m) => m.c === cell.c && m.r === cell.r)) {
      doMove(selectedUnit, cell);
    }
  }
}

function selectUnit(unit) {
  // 混乱（confuse）：本回合可能行动紊乱。每名单位每回合只判定一次（缓存到 __confuseTurn）。
  const hasConfuse = Array.isArray(unit.statuses) && unit.statuses.some((s) => s.type === 'confuse');
  if (hasConfuse && unit.__confuseTurn !== controller.turn) {
    unit.__confuseTurn = controller.turn;
    unit.__confuseSkip = !controller.canUnitAct(unit);
  }
  if (hasConfuse && unit.__confuseSkip) {
    showSelectedUnitCard(unit);
    hud.turnBanner(`${unit.name || ''} 行动紊乱`, 900);
    floatText(fxCtx(), unitWorldPos(unit, 1.8), '混乱', '#c79bff');
    finishUnitAction(unit);
    return;
  }

  selectedUnit = unit;
  pendingMode = null;
  pendingSkillId = null;
  showSelectedUnitCard(unit);
  sfx.select();

  // 高亮可移动（青）+ 可攻击（红）。定身（immobilize）下不可移动，仅原地。
  sceneManager.clearHighlight();
  moveCells = [{ c: unit.pos.c, r: unit.pos.r }];
  if (controller.canUnitMove(unit)) {
    const reach = controller.selectableTiles(unit); // Map<"c,r",cost>（不含原点）
    for (const k of reach.keys()) {
      const [c, r] = k.split(',').map(Number);
      moveCells.push({ c, r });
    }
  }
  sceneManager.highlight(moveCells, 'move');

  attackCells = attackableEnemiesOf(unit).map((u) => ({ c: u.pos.c, r: u.pos.r }));
  if (attackCells.length) sceneManager.highlight(attackCells, 'attack');
}

// 信息卡（附计略剩余次数）。
function showSelectedUnitCard(unit) {
  hud.showUnit(unit, { usesLeft: (sid) => skillUsesLeft(unit, sid) });
}

function clearSelection() {
  selectedUnit = null;
  moveCells = [];
  attackCells = [];
  pendingMode = null;
  pendingSkillId = null;
  pendingSkillCells = null;
  skillHoverCell = null;
  pendingDuelUnit = null;
  if (sceneManager) sceneManager.clearHighlight();
  hud.hideUnit();
}

function resetInteraction() {
  clearSelection();
}

// 移动：controller.moveUnit 触发 'unit:moved'（fx.moveAlong 在 bus 处理）→ 到达后弹行动菜单。
async function doMove(unit, cell) {
  interactionLocked = true;
  sceneManager.clearHighlight();
  // moveUnit 会 emit 'unit:moved'，由 bus 处理器播放行走动画并 resolve。
  movementDone = null;
  const arrival = new Promise((res) => {
    movementDone = res;
  });
  try {
    controller.moveUnit(unit, cell);
  } catch (_) {
    interactionLocked = false;
    return;
  }
  await arrival; // 行走动画完成
  await openActionMenu(unit);
}

let movementDone = null; // 行走动画完成回调（doMove ↔ bus 'unit:moved'）

// 行动菜单：攻击 / 单挑 / 计略 / 待机。
async function openActionMenu(unit) {
  const targets = attackableEnemiesOf(unit);
  // 持有且仍有次数的计略（次数=0 不进子菜单）。
  const ownedSkills = (unit.skills || []).filter((sid) => SKILLS[sid] && skillUsesLeft(unit, sid) > 0);
  // 至少一个计略当前有合法施放目标（含 self 类如 guard 恒可）才启用「计略」。
  const anyCastable = ownedSkills.some((sid) => skillHasTarget(unit, sid));
  // 近战我方贴敌将（曼哈顿 1）即可发起单挑——含第一战「贴黄巾渠帅 yt_capt」的演示路径。
  const duelTargets = controller.canDuelTargets(unit);

  const actions = [
    { id: 'attack', label: '攻击', disabled: targets.length === 0 },
  ];
  if (duelTargets.length > 0) {
    actions.push({ id: 'duel', label: '单挑 ⚔' });
  }
  actions.push({ id: 'skill', label: '计略', disabled: !anyCastable });
  actions.push({ id: 'wait', label: '待机' });

  showSelectedUnitCard(unit);
  const choice = await hud.actionMenu(actions);

  if (choice === 'attack') {
    enterAttackMode(unit);
  } else if (choice === 'duel') {
    await beginDuelAction(unit, duelTargets);
  } else if (choice === 'skill') {
    await chooseSkill(unit, ownedSkills);
  } else {
    // 待机 / 取消：结束该单位行动。
    finishUnitAction(unit);
  }
}

// --- 攻击目标选择 -----------------------------------------------------------
function enterAttackMode(unit) {
  selectedUnit = unit;
  pendingMode = 'attack';
  const targets = attackableEnemiesOf(unit);
  attackCells = targets.map((u) => ({ c: u.pos.c, r: u.pos.r }));
  sceneManager.clearHighlight();
  sceneManager.highlight(attackCells, 'attack');
  interactionLocked = false;
  hud.turnBanner('选择攻击目标', 700);
}

function handleAttackPick(hitInfo) {
  let target = null;
  if (hitInfo.kind === 'unit') {
    target = controller.units.find((x) => x.id === hitInfo.id && x.alive);
  } else if (hitInfo.kind === 'tile') {
    target = controller.units.find(
      (x) => x.alive && x.pos.c === hitInfo.c && x.pos.r === hitInfo.r,
    );
  }
  const foeFaction = selectedUnit.faction === 'wei' ? 'foe' : 'wei';
  if (!target || target.faction !== foeFaction) return;
  const [mn, mx] = atkRangeOf(selectedUnit);
  const d = manhattan(selectedUnit.pos, target.pos);
  if (d < mn || d > mx) return;

  const attacker = selectedUnit;
  pendingMode = null;
  interactionLocked = true;
  sceneManager.clearHighlight();
  sfx.attack();
  // controller.attack 会 emit 'unit:attacked'/'unit:died'（bus 处理演出）。
  controller.attack(attacker, target);
  // 攻击为结束动作。
  finishUnitAction(attacker);
}

// --- 单挑（武将对决）-------------------------------------------------------
// 选「单挑」后：单目标→立即开打；多目标→进入点选敌将模式。
async function beginDuelAction(unit, duelTargets) {
  const targets = duelTargets && duelTargets.length ? duelTargets : controller.canDuelTargets(unit);
  if (!targets || targets.length === 0) {
    // 兜底（理论不会到这）：回行动菜单。
    await openActionMenu(unit);
    return;
  }
  if (targets.length === 1) {
    await startDuel(unit, targets[0]);
    return;
  }
  // 多个相邻敌将：点选目标。
  enterDuelMode(unit, targets);
}

function enterDuelMode(unit, targets) {
  selectedUnit = unit;
  pendingDuelUnit = unit;
  pendingMode = 'duel';
  attackCells = targets.map((u) => ({ c: u.pos.c, r: u.pos.r }));
  sceneManager.clearHighlight();
  sceneManager.highlight(attackCells, 'attack');
  interactionLocked = false;
  hud.turnBanner('选择单挑对手', 800);
}

function handleDuelPick(hitInfo) {
  const unit = pendingDuelUnit;
  if (!unit) return;
  let target = null;
  if (hitInfo.kind === 'unit') {
    target = controller.units.find((x) => x.id === hitInfo.id && x.alive);
  } else if (hitInfo.kind === 'tile') {
    target = controller.units.find(
      (x) => x.alive && x.pos.c === hitInfo.c && x.pos.r === hitInfo.r,
    );
  }
  // 仅接受合法（仍相邻可挑战的）敌将。
  const valid = controller.canDuelTargets(unit);
  if (!target || !valid.some((t) => t.id === target.id)) return;

  pendingMode = null;
  pendingDuelUnit = null;
  startDuel(unit, target);
}

// 发起一场单挑：电影化对决 → 回写战场 → 刷新场面 → 结束发起者行动。
async function startDuel(unit, target) {
  pendingMode = null;
  pendingDuelUnit = null;
  interactionLocked = true;
  sceneManager.clearHighlight();
  clearSelection();

  bus.emit('duel:start', { aId: unit.id, bId: target.id, forced: false });

  const duel = new Duel(unit, target, { rng: makeRng(`${BATTLE_SEED}:duel:${unit.id}:${target.id}:${controller.turn}`) });
  let outcome;
  try {
    outcome = await duelView.run(duel, duelViewCtx());
  } catch (err) {
    console.error('[main] duel view failed:', err);
    outcome = { winnerId: null, loserId: null, loserHpAfter: 0, fled: true, expGain: 0 };
  }

  // 回写主战场：败者掉血/阵亡/退走 + 胜者经验 + 发起者 hasActed + 'duel:end' + 胜负判定。
  // applyDuelOutcome 内部会 emit 'unit:died'（bus 移除 3D group）/ 'unit:moved'（退走）。
  controller.applyDuelOutcome(outcome);

  // 升级飘字（单挑胜方可能升级）。
  if (outcome && outcome.winnerId) {
    const w = controller.units.find((u) => u.id === outcome.winnerId);
    maybeShowLevelUp(w);
  }

  // 相机回等距沙盘（duelView 已 reset，这里再保险一次）。
  cameraRig && cameraRig.setIso();

  // 刷新 HUD：若发起者仍存活则展示其最新状态。
  if (unit.alive) hud.showUnit(unit);
  else hud.hideUnit();

  // 若单挑已分出整场胜负（applyDuelOutcome→_checkEnd 触发 battle:win/lose），onBattleEnd 已接管。
  // finishUnitAction 会读取 controller.phase；'resolved' 时不再恢复交互。
  finishUnitAction(unit.alive ? unit : null);
}

// --- 计略 -------------------------------------------------------------------
// 计略子菜单：列出持有计略（名 + 剩余次数 + 简述），无次数/无目标者置灰。
async function chooseSkill(unit, ownedSkills) {
  const items = hud.skillMenuItems(
    ownedSkills,
    (sid) => skillUsesLeft(unit, sid),
    (sid) => skillHasTarget(unit, sid),
  );
  const pick = await hud.actionMenu(items);
  if (pick === 'cancel') {
    // 取消计略 → 回行动菜单。
    await openActionMenu(unit);
    return;
  }
  const def = SKILLS[pick];
  if (!def) {
    finishUnitAction(unit);
    return;
  }

  // self 类（guard / ironwall 选自身）若仅自身一格，直接施放无需选格。
  const info = controller.skillTargetCells(unit, pick);
  const cells = (info && info.targets) || [];
  if (cells.length === 0) {
    // 理论上 chooseSkill 入口已过滤；兜底回菜单。
    await openActionMenu(unit);
    return;
  }
  if (def.target === 'self' || (cells.length === 1 && cells[0].c === unit.pos.c && cells[0].r === unit.pos.r && def.area === 0)) {
    castSkillAt(unit, pick, cells[0]);
    return;
  }

  // 进入施法目标选择模式：高亮合法施法格；hover/点击预览 AOE。
  enterSkillMode(unit, pick, info);
}

// 进入计略目标选择模式。
function enterSkillMode(unit, skillId, info) {
  selectedUnit = unit;
  pendingMode = 'skill';
  pendingSkillId = skillId;
  pendingSkillCells = info; // { targets, aoe, aoeOf }
  skillHoverCell = null;
  const def = SKILLS[skillId];
  sceneManager.clearHighlight();
  // 合法施法格：敌方计略用红，友方/增益用青。
  const baseColor = def.target === 'enemy' ? 'attack' : 'move';
  sceneManager.highlight(info.targets, baseColor);
  interactionLocked = false;
  const verb = def.target === 'enemy' ? '选择施法目标' : (def.target === 'self' ? '施放' : '选择友军');
  hud.turnBanner(`${def.name} · ${verb}`, 800);
}

// 在 skill 模式下重画高亮：合法施法格 + 当前 hover 格的 AOE（金色预览）。
function refreshSkillPreview() {
  if (pendingMode !== 'skill' || !pendingSkillCells) return;
  const def = SKILLS[pendingSkillId];
  sceneManager.clearHighlight();
  const baseColor = def && def.target === 'enemy' ? 'attack' : 'move';
  sceneManager.highlight(pendingSkillCells.targets, baseColor);
  if (skillHoverCell) {
    const aoe = pendingSkillCells.aoeOf(skillHoverCell);
    // AOE 预览用醒目金色（与施法格/移动/攻击色区分）。
    sceneManager.highlight(aoe, 0xffd24a);
  }
}

// 该格是否为合法施法格。
function isLegalSkillCell(cell) {
  if (!pendingSkillCells || !cell) return false;
  return pendingSkillCells.targets.some((t) => t.c === cell.c && t.r === cell.r);
}

// 处理 skill 模式点击：合法格则确认施放。
function handleSkillPick(hitInfo) {
  let cell = null;
  if (hitInfo.kind === 'tile') {
    cell = { c: hitInfo.c, r: hitInfo.r };
  } else if (hitInfo.kind === 'unit') {
    const u = controller.units.find((x) => x.id === hitInfo.id && x.alive);
    if (u) cell = { c: u.pos.c, r: u.pos.r };
  }
  if (!cell || !isLegalSkillCell(cell)) return;

  const caster = selectedUnit;
  const skillId = pendingSkillId;
  castSkillAt(caster, skillId, cell);
}

// skill 模式下 hover：更新 AOE 预览（仅当 hover 落在合法施法格上）。
function handleSkillHover(clientX, clientY) {
  if (pendingMode !== 'skill' || interactionLocked) return;
  const hitInfo = sceneManager.pick(clientX, clientY);
  let cell = null;
  if (hitInfo) {
    if (hitInfo.kind === 'tile') cell = { c: hitInfo.c, r: hitInfo.r };
    else if (hitInfo.kind === 'unit') {
      const u = controller.units.find((x) => x.id === hitInfo.id && x.alive);
      if (u) cell = { c: u.pos.c, r: u.pos.r };
    }
  }
  const next = cell && isLegalSkillCell(cell) ? cell : null;
  const changed = (next && (!skillHoverCell || next.c !== skillHoverCell.c || next.r !== skillHoverCell.r))
    || (!next && skillHoverCell);
  if (changed) {
    skillHoverCell = next;
    refreshSkillPreview();
  }
}

// 确认在 cell 施放计略：走 controller.useSkill（结算/扣次数/经验/胜负由控制器负责，
// 'unit:skill' 事件驱动特效与飘字）。
function castSkillAt(caster, skillId, cell) {
  pendingMode = null;
  pendingSkillId = null;
  pendingSkillCells = null;
  skillHoverCell = null;
  interactionLocked = true;
  sceneManager.clearHighlight();
  try {
    controller.useSkill(caster, skillId, cell);
  } catch (err) {
    console.error('[main] useSkill failed:', err);
  }
  // useSkill 已标记 caster.hasActed 并按需触发 battle:win/lose；这里收束该单位行动。
  finishUnitAction(controller.phase === 'resolved' ? null : caster);
}

// 结束某单位的行动：标记已行动，清交互；若我方全员行动完则提示可结束回合。
function finishUnitAction(unit) {
  if (unit) unit.hasActed = true;
  clearSelection();
  interactionLocked = controller.phase === 'resolved';
  if (controller.phase === 'resolved') return;

  // 我方是否全部行动？
  const weiActive = controller.units.filter((u) => u.alive && u.faction === 'wei');
  const allActed = weiActive.every((u) => u.hasActed);
  if (allActed) {
    endPlayerTurn();
  }
}

// ---------------------------------------------------------------------------
// 结束回合 / 敌方相位
// ---------------------------------------------------------------------------
function ensureEndTurnButton() {
  if (typeof document === 'undefined') return;
  let btn = document.getElementById('ccz-endturn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'ccz-endturn';
    btn.type = 'button';
    btn.textContent = '结束回合 ⏎';
    btn.style.cssText = [
      'position:absolute', 'right:16px', 'top:16px', 'z-index:6',
      'padding:10px 16px', 'border-radius:10px', 'cursor:pointer',
      'font:800 15px/1 inherit', 'color:#fff',
      'border:2px solid var(--gold,#d4af37)',
      'background:linear-gradient(180deg,var(--vermilion-soft,#a23030),var(--vermilion,#7a1f1f))',
      'box-shadow:0 4px 0 #4d1212',
    ].join(';');
    btn.addEventListener('click', () => {
      if (!interactionLocked && controller && controller.phase === 'player') endPlayerTurn();
    });
    document.body.appendChild(btn);
  }
  btn.style.display = 'block';
}

function hideEndTurnButton() {
  const btn = document.getElementById('ccz-endturn');
  if (btn) btn.style.display = 'none';
}

async function endPlayerTurn() {
  if (!controller || controller.phase !== 'player') return;
  interactionLocked = true;
  clearSelection();
  hideEndTurnButton();
  await hud.turnBanner('敌军回合', 1000);
  // 增减益/中毒等状态的衰减与结算由 controller 在回合开始 _tickAllStatuses 处理
  // （并 emit 'status:tick'，见 wireBus），UI 不再自行维护 guard 增益表。
  // controller.endPlayerTurn() → runEnemyTurn()：逐个敌人 move/attack 经 bus 演出。
  // 由于 runEnemyTurn 同步执行所有敌方动作，演出（行走/受击）异步播放，因此这里
  // 用 requestAnimationFrame 让出后再驱动，给三维一帧渲染窗口。
  await delay(120);
  controller.endPlayerTurn();
  // runEnemyTurn 内已 emit 'turn:changed' 回到 player；若未结束则恢复玩家相位。
  // 若本次切换触发了开场剧情（camera:cinematic / cinematicPending），解锁与进入玩家相位
  // 交给该剧情的 handler 在播完后统一处理，这里不抢先，避免竞态导致永久卡死。
  if (controller.phase === 'player' && !cinematicPending) {
    beginPlayerPhase();
  }
}

// ---------------------------------------------------------------------------
// 事件总线 → 演出绑定（渲染 / 音频 / UI / 剧情触发）
// ---------------------------------------------------------------------------
function wireBus() {
  // 移动：沿 path 行走 + 音效；到达后 resolve doMove 的等待。
  bus.on('unit:moved', ({ unit, path }) => {
    const group = sceneManager.unitGroup(unit.id);
    sfx.move();
    const worldPath = (path || []).map((p) => sceneManager.grid.tileWorld(p.c, p.r));
    // 终点保险（path 不含起点；若为空直接落位）。
    const finish = () => {
      // 仅当这是玩家发起的移动时才 resolve（敌方移动 movementDone 为 null）。
      if (movementDone) {
        const r = movementDone;
        movementDone = null;
        r();
      }
    };
    if (group && worldPath.length) {
      group.userData.moving = true;
      moveAlong(group, worldPath, () => {
        group.userData.moving = false;
        finish();
      });
    } else {
      finish();
    }
  });

  // 攻击：受击闪 + 伤害飘字 + 命中音（计略改走独立的 'unit:skill' 事件，这里跳过带 skill 标记的）。
  bus.on('unit:attacked', ({ attacker, defender, result }) => {
    if (!result || result.skill) return; // 计略演出由 'unit:skill' 自管
    if (!result.hit) {
      floatText(fxCtx(), unitWorldPos(defender), 'MISS', '#cdd5e6');
      return;
    }
    sfx.hit();
    hitFlash(sceneManager.unitGroup(defender.id));
    floatText(fxCtx(), unitWorldPos(defender), `${result.dmg}`, '#ff5b5b');
    // 反击演出。
    if (result.counter && result.counter.hit) {
      hitFlash(sceneManager.unitGroup(attacker.id));
      floatText(fxCtx(), unitWorldPos(attacker), `${result.counter.dmg}`, '#ffd95e');
    }
    // 升级飘字（命中后攻方可能升级）。
    maybeShowLevelUp(attacker);
  });

  // 阵亡：移除三维 group + 音效。
  bus.on('unit:died', ({ unit }) => {
    sceneManager.removeUnit(unit.id);
  });

  // 计略施放：按 element/kind 播三维特效 + 对每个命中目标飘伤害/治疗/状态 + 音效。
  bus.on('unit:skill', ({ casterId, skillId, targetCell, result }) => {
    const def = SKILLS[skillId];
    if (!def) return;
    const caster = controller.units.find((u) => u.id === casterId);

    // AOE 世界格（地面高度）用于 castFx 范围演出。
    const aoe = aoeCells(targetCell, def.area || 0, MAP);
    const aoeWorld = aoe.map((c) => cellWorldGround(c.c, c.r));
    const center = cellWorldGround(targetCell.c, targetCell.r);
    center.y += 0.4;

    // 特效音：伤害=出手+命中；治疗=heal；其余=select。
    if (def.kind === 'damage') { sfx.attack(); sfx.hit(); }
    else if (def.kind === 'heal') sfx.heal();
    else sfx.select();

    // 三维特效（按 kind/element 分派）。
    castFx(def.kind, def.element || null, center, aoeWorld);

    // 逐目标飘字 + 受击闪。
    for (const hit of (result && result.hits) || []) {
      const target = controller.units.find((u) => u.id === hit.unitId);
      if (!target) continue;
      const tpos = unitWorldPos(target);
      if (hit.missed) {
        floatText(fxCtx(), tpos, '闪避', '#cdd5e6');
        continue;
      }
      if (typeof hit.dmg === 'number' && hit.dmg > 0) {
        hitFlash(sceneManager.unitGroup(target.id), elementFlashColor(def.element));
        floatText(fxCtx(), tpos, `${hit.dmg}`, elementTextColor(def.element));
      }
      if (typeof hit.heal === 'number' && hit.heal > 0) {
        hitFlash(sceneManager.unitGroup(target.id), 0x4fd07a);
        floatText(fxCtx(), tpos, `+${hit.heal}`, '#7dffa0');
      }
      if (hit.status) {
        const good = /_up$/.test(hit.status.type);
        floatText(fxCtx(), { x: tpos.x, y: tpos.y + 0.5, z: tpos.z }, hud.statusLabel(hit.status.type), good ? '#bff0c8' : '#ffc7c7');
      }
    }

    // 命中后施法者可能升级；刷新选中信息卡（剩余次数已变）。
    if (caster) maybeShowLevelUp(caster);
    if (selectedUnit && selectedUnit.alive) showSelectedUnitCard(selectedUnit);
  });

  // 状态结算（回合开始）：poison 掉血飘字 + 状态消退提示。
  bus.on('status:tick', ({ unitId, dmg }) => {
    const unit = controller.units.find((u) => u.id === unitId);
    if (!unit) return;
    if (dmg > 0) {
      hitFlash(sceneManager.unitGroup(unit.id), 0x8fd14f);
      floatText(fxCtx(), unitWorldPos(unit), `-${dmg}`, '#b6e84f');
    }
    // 若信息卡正展示该单位，刷新其状态徽章。
    if (selectedUnit && selectedUnit.id === unitId) showSelectedUnitCard(selectedUnit);
  });

  // 回合切换横幅（runEnemyTurn 在新回合 emit）。
  bus.on('turn:changed', ({ turn }) => {
    // 触发器（如第 3 回合援军）由 runEnemyTurn 经 'camera:cinematic' 单独通知。
    void turn;
  });

  // 触发器 / 运镜：battleController._fireTurnStartTriggers emit 'camera:cinematic' {scenarioId}。
  bus.on('camera:cinematic', async (payload) => {
    if (payload && payload.scenarioId) {
      // 回合开始剧情触发：本剧情独占交互锁。播完后按"当前相位"进入玩家相位，
      // 不能恢复进入前捕获的旧锁值——那会与 endPlayerTurn 的解锁竞态、导致永久卡死。
      cinematicPending = true;
      interactionLocked = true;
      try {
        await runScenario(payload.scenarioId, scenarioCtx());
        cameraRig.setIso();
      } finally {
        cinematicPending = false;
        // 回到玩家相位（含解锁 / 横幅 / 结束回合按钮）；若已分胜负则不解锁。
        if (controller && controller.phase === 'player') beginPlayerPhase();
      }
    } else if (payload && payload.focus && cameraRig) {
      // 纯运镜请求（focus 为 {c,r} 或世界点）。
      const f = payload.focus;
      const focusVec = typeof f.c === 'number'
        ? (sceneManager.grid ? (() => { const w = sceneManager.grid.tileWorld(f.c, f.r); return new THREE.Vector3(w.x, w.y, w.z); })() : null)
        : new THREE.Vector3(f.x || 0, f.y || 0, f.z || 0);
      if (focusVec) cameraRig.cinematic({ focus: focusVec, zoom: payload.zoom || 1.6 });
    }
  });

  // 胜负。
  bus.on('battle:win', () => onBattleEnd(true));
  bus.on('battle:lose', () => onBattleEnd(false));
}

// 升级飘字（与上一帧的 level 比对：用 unit.__lastLevel 记忆）。
function maybeShowLevelUp(unit) {
  if (!unit) return;
  const prev = unit.__lastLevel == null ? unit.level : unit.__lastLevel;
  if (unit.level > prev) {
    floatText(fxCtx(), unitWorldPos(unit, 1.9), `Lv.${unit.level}!`, '#ffe27a');
  }
  unit.__lastLevel = unit.level;
}

// ---------------------------------------------------------------------------
// 战斗结束：剧情 → 结算 → 存档 → 返回
// ---------------------------------------------------------------------------
let battleEnded = false;

async function onBattleEnd(win) {
  if (battleEnded) return;
  battleEnded = true;
  interactionLocked = true;
  hideEndTurnButton();
  clearSelection();

  win ? sfx.win() : sfx.lose();
  await delay(600);

  if (win) {
    // 升级总结 + 把战场进度回写常驻 roster（持久化等级/经验/curHp；客将不回写）。
    const luLines = collectLevelUpSummary();
    persistRosterFromBattle();

    // 战后剧情（仅胜利播 outro）。
    await runScenario(STORY.outro, scenarioCtx());
    cameraRig.setIso();

    // 结算屏：点「继续」→ resolve 让章节循环推进（整军 / 下一战 / 章末）。
    menus.result({
      win: true,
      lines: luLines,
      onNext: () => {
        menus.close();
        resolveBattle(true);
      },
      onMenu: () => backToTitle(),
    });
    return;
  }

  // 战败：保留章节循环让出，由结算屏接管（重打本战 / 返回标题）。
  menus.result({
    win: false,
    lines: [],
    onRetry: () => {
      menus.close();
      restartBattle();
    },
    onMenu: () => backToTitle(),
  });
  // 通知 runBattle 让出（不再自动推进；后续由上面两个回调驱动）。
  resolveBattle(false);
}

// resolve 当前战的 Promise（仅一次）。
function resolveBattle(win) {
  const r = battleResolver;
  battleResolver = null;
  if (r) r(win);
}

// 把战场单位的等级/经验/当前血量回写到 roster。
function persistRosterFromBattle() {
  const byId = new Map();
  for (const e of game.state.roster || []) byId.set(e.generalId, e);
  for (const u of controller.units) {
    if (u.faction !== 'wei') continue;
    const e = byId.get(u.id);
    if (!e) continue;
    e.level = u.level;
    e.exp = u.exp;
    e.curHp = u.alive ? u.curHp : null; // 阵亡者下战满血复出（v1 宽松）
  }
}

// 升级总结行（对比 roster 旧等级与战后等级）。
function collectLevelUpSummary() {
  const oldLevels = new Map();
  for (const e of game.state.roster || []) oldLevels.set(e.generalId, e.level || 1);
  const lines = [];
  for (const u of controller.units) {
    if (u.faction !== 'wei') continue;
    const old = oldLevels.get(u.id) ?? 1;
    if (u.level > old) {
      lines.push(`${u.name} 升至 Lv.${u.level}`);
    }
  }
  if (lines.length === 0) lines.push('全军安然，经验已记入军册。');
  return lines;
}

function backToTitle() {
  battleEnded = false;
  battleResolver = null;
  controller = null;
  cameraRig && cameraRig.setIso();
  showTitle();
}

// 战败重打本战：保持 battleIndex 不变，重新 runChapter（会从当前 idx 重打）。
function restartBattle() {
  battleEnded = false;
  battleResolver = null;
  controller = null;
  // battleIndex 未推进（战败不存档），直接续跑章节循环即重入本战。
  runChapter();
}

// ---------------------------------------------------------------------------
// 章末结算字幕（末战告捷后）→ 返回标题/hub。
// ---------------------------------------------------------------------------
async function showChapterEnd() {
  interactionLocked = true;
  hideEndTurnButton();
  clearSelection();
  cameraRig && cameraRig.setIso();
  menus.result({
    win: true,
    lines: [
      `【${CHAPTER.name}】 圆满`,
      '讨董之盟将散，曹操东归，转图兖州——霸业自此启程。',
    ],
    onNext: () => {
      menus.close();
      backToTitle();
    },
    onMenu: () => backToTitle(),
  });
}

// ---------------------------------------------------------------------------
boot();
