// tools/verify-levels.mjs — [P3] 关卡无漏怪 + 完整性校验器（§17.4）。
// 无漏怪硬约束:每条蜀道每段都落在某将位「最小射程」(2.5格)内 → 无天然漏怪、3★ 理论可达。
// 用法:`node tools/verify-levels.mjs`(CLI,有问题 exit 1);单测 import { verifyLevel }。
import { LEVELS } from '../src/data/levels.js';
import { ENEMIES } from '../src/data/enemies.js';

export const MIN_RANGE = 2.5;       // 将塔最小射程(格);§17.4
const SAMPLE_STEP = 0.25;           // 沿段采样步长(格)
const SPAWN_GRACE = 1.0;            // 出生口前 1 格豁免(敌刚出营、尚在营门,非真漏怪;杀伤走廊仍严格)
const MIN_PATH_LEN = 14;            // 每条蜀道最短总长(格);防"短路速通"且与主路差距不致过大

// 点到所有将位的最近距离(格)。
function nearestSlotDist(px, py, slots) {
  let best = Infinity;
  for (const s of slots) {
    const dx = (s.x + 0.5) - px, dy = (s.y + 0.5) - py;   // slot 中心
    const d = Math.hypot(dx, dy);
    if (d < best) best = d;
  }
  return best;
}

// 校验单关。返回 { ok, leaks:[], errors:[] }。
export function verifyLevel(level) {
  const leaks = [], errors = [];
  const id = level.id ?? '?';

  // —— 完整性 ——
  if (!level.faction) errors.push(`L${id}: 缺 faction`);
  if (!Array.isArray(level.camps) || !level.camps.length) errors.push(`L${id}: camps 空`);
  if (!level.paths || !Object.keys(level.paths).length) errors.push(`L${id}: paths 空`);
  if (!Array.isArray(level.slots) || !level.slots.length) errors.push(`L${id}: slots 空`);
  if (!Array.isArray(level.waves) || !level.waves.length) errors.push(`L${id}: waves 空`);

  const campIds = new Set((level.camps || []).map((c) => c.id));
  const pathIds = new Set(Object.keys(level.paths || {}));

  // castle 在界内
  const cs = level.castle;
  if (!cs || cs.c < 0 || cs.r < 0 || cs.c + cs.w > level.cols || cs.r + cs.h > level.rows) {
    errors.push(`L${id}: castle 越界 ${JSON.stringify(cs)}`);
  }

  // 成都占据的格 / 蜀道占据的格(用于:末点须连成都、将位不得在路或城上)
  const castleCells = new Set();
  if (cs) for (let c = cs.c; c < cs.c + cs.w; c++) for (let r = cs.r; r < cs.r + cs.h; r++) castleCells.add(`${c},${r}`);
  const pathCells = new Set();
  for (const pid of pathIds) {
    const wp = level.paths[pid]; if (!Array.isArray(wp)) continue;
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i], b = wp[i + 1];
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
      const steps = Math.max(1, Math.ceil(L / 0.25));
      for (let k = 0; k <= steps; k++) { const tt = k / steps; pathCells.add(`${Math.round(a.x + (b.x - a.x) * tt)},${Math.round(a.y + (b.y - a.y) * tt)}`); }
    }
  }

  // 每条 path:末点须是成都格(视觉连通)+ 总长 ≥ MIN_PATH_LEN(防短路速通)
  for (const pid of pathIds) {
    const wp = level.paths[pid];
    if (!Array.isArray(wp) || wp.length < 2) { errors.push(`L${id} path ${pid}: 点数 <2`); continue; }
    const end = wp[wp.length - 1];
    if (!castleCells.has(`${end.x},${end.y}`)) errors.push(`L${id} path ${pid}: 末点 ${JSON.stringify(end)} 非成都格(未连成都)`);
    let plen = 0; for (let i = 0; i < wp.length - 1; i++) plen += Math.hypot(wp[i + 1].x - wp[i].x, wp[i + 1].y - wp[i].y);
    if (plen < MIN_PATH_LEN) errors.push(`L${id} path ${pid}: 路径过短 ${plen.toFixed(1)}格 (<${MIN_PATH_LEN})`);
  }

  // 将位不得落在蜀道或成都上
  for (const s of level.slots || []) {
    if (pathCells.has(`${s.x},${s.y}`)) errors.push(`L${id}: 将位 (${s.x},${s.y}) 落在蜀道上`);
    if (castleCells.has(`${s.x},${s.y}`)) errors.push(`L${id}: 将位 (${s.x},${s.y}) 落在成都上`);
  }

  // wave 引用合法
  for (const w of level.waves || []) {
    for (const sp of w.spawns || []) {
      if (!campIds.has(sp.campId)) errors.push(`L${id} wave ${w.waveId}: campId '${sp.campId}' 不存在`);
      if (!pathIds.has(sp.pathId)) errors.push(`L${id} wave ${w.waveId}: pathId '${sp.pathId}' 不存在`);
      if (!ENEMIES[sp.enemyType]) errors.push(`L${id} wave ${w.waveId}: enemyType '${sp.enemyType}' 未定义`);
    }
  }

  // —— [板型+地形] terrain 规则(level.terrain 存在才生效;老关无地形自动跳过)——
  if (Array.isArray(level.terrain) && level.terrain.length) {
    const cellKey = (c) => `${c.x},${c.y}`;
    const blocked = new Set();   // river ∪ mountain = 禁建 + 敌不走
    for (const z of level.terrain) {
      if (z.type === 'river' || z.type === 'mountain') for (const c of z.cells) blocked.add(cellKey(c));
    }
    // ① 将位不落水/山
    for (const s of level.slots || []) {
      if (blocked.has(`${s.x},${s.y}`)) errors.push(`L${id}: 将位 (${s.x},${s.y}) 落在 river/mountain 上`);
    }
    // ② 路径采样格 / camps / castle 不与水/山相交(渡口=路径格,设计期已从 river 区抠除)
    for (const k of pathCells) if (blocked.has(k)) errors.push(`L${id}: 蜀道格 (${k}) 穿 river/mountain`);
    for (const cp of level.camps || []) if (blocked.has(`${cp.c},${cp.r}`)) errors.push(`L${id}: 敌营 ${cp.id} 落在 river/mountain 上`);
    for (const k of castleCells) if (blocked.has(k)) errors.push(`L${id}: 成都格 (${k}) 被 river/mountain 覆盖`);
    // ③ 动态地形(shallow/rockfall/firegully)每区至少盖 1 个路径格(防"装饰区"失效)
    for (const z of level.terrain) {
      if (!['shallow', 'rockfall', 'firegully'].includes(z.type)) continue;
      if (!z.cells.some((c) => pathCells.has(cellKey(c)))) errors.push(`L${id}: ${z.type} 区未覆盖任何路径格`);
    }
    // ④ plateau:不含路径格(高台上不走兵) + 每区至少含 1 个将位格(否则机制无感)
    const slotSet = new Set((level.slots || []).map((s) => `${s.x},${s.y}`));
    for (const z of level.terrain) {
      if (z.type !== 'plateau') continue;
      if (z.cells.some((c) => pathCells.has(cellKey(c)))) errors.push(`L${id}: plateau 区压住路径格`);
      if (!z.cells.some((c) => slotSet.has(cellKey(c)))) errors.push(`L${id}: plateau 区不含任何将位格(机制无感)`);
    }
  }

  // —— 无漏怪:每段路采样点须在某将位 2.5 格内 ——
  for (const pid of pathIds) {
    const wp = level.paths[pid];
    if (!Array.isArray(wp) || wp.length < 2) continue;
    let distFromStart = 0;
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i], b = wp[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
      const steps = Math.max(1, Math.ceil(segLen / SAMPLE_STEP));
      for (let k = 0; k <= steps; k++) {
        const tt = k / steps;
        if (distFromStart + segLen * tt < SPAWN_GRACE) continue;   // 出生豁免
        const px = a.x + (b.x - a.x) * tt + 0.5;   // 段上点(格中心)
        const py = a.y + (b.y - a.y) * tt + 0.5;
        const d = nearestSlotDist(px, py, level.slots || []);
        if (d > MIN_RANGE + 1e-9) {
          leaks.push({ path: pid, seg: i, at: { x: +px.toFixed(2), y: +py.toFixed(2) }, nearest: +d.toFixed(2) });
          break;   // 每段报一次即可
        }
      }
      distFromStart += segLen;
    }
  }

  return { ok: leaks.length === 0 && errors.length === 0, leaks, errors };
}

// —— CLI ——
function main() {
  let bad = 0;
  for (const lv of LEVELS) {
    const r = verifyLevel(lv);
    if (r.ok) {
      console.log(`✅ L${lv.id} ${lv.name} [${lv.faction}] camps=${lv.camps.length} slots=${lv.slots.length} waves=${lv.waves.length}`);
    } else {
      bad++;
      console.log(`❌ L${lv.id} ${lv.name}: ${r.errors.length} errors, ${r.leaks.length} leaks`);
      for (const e of r.errors) console.log(`   ⛔ ${e}`);
      for (const lk of r.leaks) console.log(`   🕳 path ${lk.path} 段${lk.seg} @${JSON.stringify(lk.at)} 最近将位 ${lk.nearest}格 (>${MIN_RANGE})`);
    }
  }
  console.log(bad ? `\n${bad}/${LEVELS.length} 关有问题` : `\n✅ 全部 ${LEVELS.length} 关通过(无漏怪+完整)`);
  process.exit(bad ? 1 : 0);
}

// 仅作为脚本直跑时执行 main(被 import 时不跑)。
if (import.meta.url === `file://${process.argv[1]}`) main();
