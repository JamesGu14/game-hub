// battle/skillEngine.js — 计略结算（纯逻辑，禁止 import three / 触碰 DOM）
//
// 契约（plan §1.3，冻结）：
//   skillTargets(caster, skill, map, units)  -> 合法「施法目标格」集合 [{c,r}, ...]
//       按 skill.target（enemy/ally/self/tile）与 skill.range=[min,max]（曼哈顿）过滤；
//       enemy/ally 还要求该格上有符合阵营的存活单位。self/tile 不要求格上有单位。
//   aoeCells(targetCell, area, map)          -> AOE 覆盖格 [{c,r}, ...]
//       以 targetCell 为心、曼哈顿半径 area 内的全部在界格（area=0 -> 仅目标格本身）。
//   resolveSkill(caster, skill, targetCell, units, map, rng)
//       -> { hits:[{unitId, dmg?, heal?, status?, missed?}], log:[], element }
//       AOE 内逐个「符合 target 阵营」的存活单位结算；不直接 mutate（返回 effects，
//       由 controller 应用）。命中：'always' 必中；'intDiff' = clamp(85+int 差, 30, 100)。
//
// 数值（原创，非任何商业表）：
//   伤害 dmg = max(1, round(power × (1 + caster.int/INT_SCALE) × elementMul × jitter − defEff))
//       defEff   = (target.def × statMods(target).def + 地形 defBonus) × DEF_SCALE + target.int×INT_DEF
//       jitter   = JITTER_LO + rng()×JITTER_SPAN
//       elementMul：地形相性（火克林、水克火/在水域增伤 等），缺省 1
//   治疗 heal = max(1, round(power × (1 + caster.int/INT_SCALE) × jitter))（不被 def 抵）
//   buff/debuff/control（power 通常 0）：命中后产出 status（由 controller applyStatus）。
//
// rng 调用顺序（确定性）：对每个目标，先 hit 判定（intDiff 时），命中后再取 jitter。
//   —— 与 combat.js 同序，便于回放/单测。
//
// 纯度：仅 import data/skills、data/terrain、battle/statuses（均不触碰 DOM/three）。

import { TERRAIN } from '../data/terrain.js';
import { statMods } from './statuses.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

// 数值常数（原创取值）。
const INT_SCALE = 40;     // 施法者 int 对威力的放缩：power × (1 + int/40)
const DEF_SCALE = 0.6;    // 目标 def 对计略伤害的抗性折扣（计略比物理更难被纯 def 挡）
const INT_DEF = 0.5;      // 目标 int 额外抵计略（谋抗谋）
const JITTER_LO = 0.9;    // 抖动下限
const JITTER_SPAN = 0.2;  // 抖动幅度 -> [0.9, 1.1)
const HIT_LO = 30;        // intDiff 命中下限
const HIT_HI = 100;       // intDiff 命中上限

// 元素 × 地形相性乘子（原创）。缺省 1。
//   fire   在林/丘易燃 → 增伤；
//   water  在水域顺势 → 增伤；
//   thunder/dark/null → 不吃地形（恒 1，靠基数与命中）。
const ELEMENT_TERRAIN = {
  fire: { forest: 1.4, hill: 1.2 },
  water: { water: 1.4 },
};

// 读取某格地形定义（tiles[r][c] = terrainId），找不到回退 grass。
function terrainAt(map, pos) {
  const id = map && map.tiles && map.tiles[pos.r] ? map.tiles[pos.r][pos.c] : undefined;
  return TERRAIN[id] || TERRAIN.grass;
}

function inBounds(map, c, r) {
  if (!map) return false;
  const cols = map.cols != null ? map.cols : (map.tiles && map.tiles[0] ? map.tiles[0].length : 0);
  const rows = map.rows != null ? map.rows : (map.tiles ? map.tiles.length : 0);
  return c >= 0 && r >= 0 && c < cols && r < rows;
}

// 单位是否存活（无 alive 字段时按 curHp>0 兜底）。
function isAlive(u) {
  if (!u) return false;
  if (typeof u.alive === 'boolean') return u.alive;
  return typeof u.curHp === 'number' ? u.curHp > 0 : true;
}

// 目标阵营过滤：相对施法者，按 skill.target 判断「这个单位是否合法目标」。
//   enemy -> 不同 faction；ally -> 同 faction；self -> 同一单位；tile -> 任意单位。
function matchesTargetSide(caster, skill, unit) {
  if (!unit) return false;
  switch (skill.target) {
    case 'enemy':
      return unit.faction !== caster.faction;
    case 'ally':
      return unit.faction === caster.faction;
    case 'self':
      return unit === caster || (unit.id != null && unit.id === caster.id);
    case 'tile':
    default:
      return true;
  }
}

// 取某格上的存活单位（首个）；无则 null。
function unitAt(units, cell) {
  for (const u of units) {
    if (u && u.pos && u.pos.c === cell.c && u.pos.r === cell.r && isAlive(u)) return u;
  }
  return null;
}

/**
 * 合法「施法目标格」集合（供 UI 高亮 / AI 选格）。
 *   - self：仅施法者当前格（若 range 含 0）。
 *   - enemy/ally：施法距离 ∈ [min,max] 且该格站着符合阵营的存活单位的格。
 *   - tile：施法距离内的全部在界、可落点格（不要求有单位）。
 * 距离按曼哈顿，从 caster.pos 起算。不 mutate。
 * @returns {{c:number,r:number}[]}
 */
export function skillTargets(caster, skill, map, units = []) {
  if (!caster || !caster.pos || !skill) return [];
  const [min, max] = skill.range || [0, 0];
  const out = [];

  if (skill.target === 'self') {
    if (min <= 0) out.push({ c: caster.pos.c, r: caster.pos.r });
    return out;
  }

  // 遍历射程内的在界格。
  for (let dr = -max; dr <= max; dr++) {
    for (let dc = -max; dc <= max; dc++) {
      const dist = Math.abs(dc) + Math.abs(dr);
      if (dist < min || dist > max) continue;
      const c = caster.pos.c + dc;
      const r = caster.pos.r + dr;
      if (!inBounds(map, c, r)) continue;
      const cell = { c, r };

      if (skill.target === 'tile') {
        out.push(cell);
        continue;
      }
      // enemy / ally：该格须站着符合阵营的存活单位。
      const u = unitAt(units, cell);
      if (u && matchesTargetSide(caster, skill, u)) out.push(cell);
    }
  }
  return out;
}

/**
 * AOE 覆盖格：以 targetCell 为心、曼哈顿半径 area 内的全部在界格。
 *   area=0 -> 仅目标格本身。
 * @returns {{c:number,r:number}[]}
 */
export function aoeCells(targetCell, area, map) {
  if (!targetCell) return [];
  const a = Math.max(0, area | 0);
  const out = [];
  for (let dr = -a; dr <= a; dr++) {
    for (let dc = -a; dc <= a; dc++) {
      if (Math.abs(dc) + Math.abs(dr) > a) continue;
      const c = targetCell.c + dc;
      const r = targetCell.r + dr;
      if (inBounds(map, c, r)) out.push({ c, r });
    }
  }
  return out;
}

// 施法者威力放缩（int 越高威力越大）。
function powerScale(caster) {
  const intv = caster && typeof caster.int === 'number' ? caster.int : 0;
  return 1 + intv / INT_SCALE;
}

// 元素 × 目标所在地形 的相性乘子。
function elementMul(element, map, cell) {
  if (!element) return 1;
  const table = ELEMENT_TERRAIN[element];
  if (!table) return 1;
  const terr = terrainAt(map, cell);
  return table[terr.id] || 1;
}

// intDiff 命中率：clamp(85 + caster.int - target.int, 30, 100)。
function hitChance(caster, target) {
  const ci = caster && typeof caster.int === 'number' ? caster.int : 0;
  const ti = target && typeof target.int === 'number' ? target.int : 0;
  return clamp(85 + (ci - ti), HIT_LO, HIT_HI);
}

/**
 * 结算一次计略（AOE 内逐目标）。不 mutate 入参；返回 effects 由 controller 应用。
 *   hits[i] 形如：
 *     伤害命中  { unitId, dmg, status? }
 *     伤害未命中 { unitId, missed:true }
 *     治疗      { unitId, heal }
 *     增减益/控场 { unitId, status }（未命中 -> { unitId, missed:true }）
 * @param {object} caster - Unit（读 int/faction/pos）
 * @param {object} skill  - SkillDef（见 data/skills.js）
 * @param {{c,r}} targetCell - 落点格（AOE 心）
 * @param {object[]} units - 全体单位（读 pos/faction/def/int/curHp/alive/id）
 * @param {object} map    - { cols, rows, tiles }
 * @param {() => number} rng - 注入的 [0,1) 随机源（确定性）
 * @returns {{ hits:object[], log:string[], element:(string|null) }}
 */
export function resolveSkill(caster, skill, targetCell, units = [], map, rng = Math.random) {
  const log = [];
  const result = { hits: [], log, element: skill ? skill.element || null : null };
  if (!caster || !skill || !targetCell) return result;

  const cells = aoeCells(targetCell, skill.area || 0, map);
  const cellKey = new Set(cells.map((c) => `${c.c},${c.r}`));
  const scale = powerScale(caster);
  const casterName = caster.name || caster.classId || '施法者';

  // 收集 AOE 内符合阵营的存活目标（去重，按 units 顺序保持确定性）。
  const targets = [];
  for (const u of units) {
    if (!u || !u.pos) continue;
    if (!isAlive(u)) continue;
    if (!cellKey.has(`${u.pos.c},${u.pos.r}`)) continue;
    if (!matchesTargetSide(caster, skill, u)) continue;
    targets.push(u);
  }

  for (const target of targets) {
    const tName = target.name || target.classId || '目标';

    // 命中判定（intDiff 时先掷骰；always 必中）。
    let hit = true;
    if (skill.hit === 'intDiff') {
      const chance = hitChance(caster, target);
      const roll = rng() * 100;
      hit = roll < chance;
    }
    if (!hit) {
      result.hits.push({ unitId: target.id, missed: true });
      log.push(`${casterName} 的「${skill.name || skill.id}」被 ${tName} 闪避`);
      continue;
    }

    if (skill.kind === 'damage') {
      const jitter = JITTER_LO + rng() * JITTER_SPAN;
      const mods = statMods(target);
      const defTerr = terrainAt(map, target.pos);
      const defEff =
        (target.def || 0) * mods.def * DEF_SCALE +
        (defTerr.defBonus || 0) +
        (target.int || 0) * INT_DEF;
      const elMul = elementMul(skill.element, map, target.pos);
      const raw = (skill.power || 0) * scale * elMul * jitter - defEff;
      const dmg = Math.max(1, Math.round(raw));
      const hitEntry = { unitId: target.id, dmg };
      if (skill.status) hitEntry.status = { ...skill.status };
      result.hits.push(hitEntry);
      log.push(
        `${casterName} 的「${skill.name || skill.id}」命中 ${tName} 造成 ${dmg}` +
        `${elMul !== 1 ? `（${skill.element}×${elMul}）` : ''}` +
        `${skill.status ? `，附加「${skill.status.type}」` : ''}`
      );
    } else if (skill.kind === 'heal') {
      const jitter = JITTER_LO + rng() * JITTER_SPAN;
      const heal = Math.max(1, Math.round((skill.power || 0) * scale * jitter));
      result.hits.push({ unitId: target.id, heal });
      log.push(`${casterName} 的「${skill.name || skill.id}」为 ${tName} 回复 ${heal} 生命`);
    } else {
      // buff / debuff / control：命中后施加状态（power 通常 0）。
      const entry = { unitId: target.id };
      if (skill.status) entry.status = { ...skill.status };
      result.hits.push(entry);
      log.push(
        `${casterName} 的「${skill.name || skill.id}」对 ${tName} 施加` +
        `「${skill.status ? skill.status.type : '效果'}」`
      );
    }
  }

  return result;
}

export default { skillTargets, aoeCells, resolveSkill };
