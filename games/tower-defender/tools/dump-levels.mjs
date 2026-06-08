// tools/dump-levels.mjs — 展开后 LEVELS → JSON（审波次/diff/定位 flaky）。
// 用法：node tools/dump-levels.mjs           # 全量摘要（每关一行）
//       node tools/dump-levels.mjs 21        # 单关完整 JSON
//       node tools/dump-levels.mjs --full     # 全量完整 JSON
import { LEVELS } from '../src/data/levels.js';

const arg = process.argv[2];

if (arg === '--full') {
  console.log(JSON.stringify(LEVELS, null, 2));
} else if (arg && /^\d+$/.test(arg)) {
  const lv = LEVELS.find((l) => l.id === +arg);
  if (!lv) { console.error(`无 L${arg}`); process.exit(1); }
  console.log(JSON.stringify(lv, null, 2));
} else {
  for (const lv of LEVELS) {
    const enemies = {};
    let bossName = '';
    for (const w of lv.waves) for (const s of w.spawns) {
      if (s.enemyType === 'boss') bossName = s.name || '?';
      else enemies[s.enemyType] = (enemies[s.enemyType] || 0) + s.count;
    }
    const types = Object.entries(enemies).map(([t, n]) => `${t}×${n}`).join(' ');
    console.log(`L${lv.id} [ch${lv.chapter} ${lv.faction}] ${lv.name} | ${lv.waves.length}波 scale=${lv.scale} 金=${lv.startGold} slots=${lv.slots.length} | boss=${bossName} | ${types}`);
  }
}
