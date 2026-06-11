// tests/groundLayout.test.mjs — 布点:路径格展开/硬软禁区/全50关确定性+禁区不变量+数量区间
// 运行:node games/tower-defender/tests/groundLayout.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { pathCellSet, hardBanSet, softBanSet, computeGroundLayout } from '../src/render/ground.js';
import { CHAPTER_THEMES } from '../src/data/chapterThemes.js';

// 1) 路径格:L1 path a 首段 (1,1)→(5,1) 应展开为 5 格;角点只记一次
{
  const lv = LEVELS[0];
  const set = pathCellSet(lv);
  for (let x = 1; x <= 5; x++) assert.ok(set.has(x + ',1'), `L1 路径格 (${x},1)`);
  assert.ok(!set.has('0,0'), 'L1 (0,0) 非路径格');
}

// 2) 硬禁区:含 路径/将位/城堡+名牌行/敌营+名牌格/玩法地形
{
  const lv = LEVELS[0];
  const set = pathCellSet(lv);
  const hard = hardBanSet(lv, set);
  const s0 = lv.slots[0];
  assert.ok(hard.has(s0.x + ',' + s0.y), '将位在硬禁区');
  const { c, r, w, h } = lv.castle;
  assert.ok(hard.has(c + ',' + r), '城堡格');
  assert.ok(hard.has(c + ',' + (r + h)), '城名牌行');
  assert.ok(hard.has(lv.camps[0].c + ',' + (lv.camps[0].r + 1)), '敌营名牌格');
  // L1 是 ch1A,有 plateau (8,6,2,2):
  const pl = lv.terrain.find((z) => z.type === 'plateau');
  assert.ok(pl && hard.has(pl.cells[0].x + ',' + pl.cells[0].y), '玩法地形格');
}

// 3) 软禁区:路径格 8 邻、且不与路径格重合
{
  const lv = LEVELS[0];
  const set = pathCellSet(lv);
  const soft = softBanSet(lv, set);
  assert.ok(soft.size > 0, '软禁区非空');
  for (const k of soft) assert.ok(!set.has(k), '软禁区不含路径格');
  assert.ok(soft.has('1,0') || soft.has('0,1'), '(1,1) 路径格的邻格入软禁区');
}
// 4) 全 50 关:确定性 + 禁区不变量 + 数量区间 + 地标合法(spec §9)
{
  let hit = 0;   // 达到数量下限(拼块≥2/小景≥10/动效≥2/有地标)的关数
  for (const lv of LEVELS) {
    const a = computeGroundLayout(lv);
    const b = computeGroundLayout(lv);
    assert.deepStrictEqual(a, b, `L${lv.id} 确定性(同种子同布置)`);
    const pathSet = pathCellSet(lv);
    const hard = hardBanSet(lv, pathSet);
    for (const j of a.jitterCells) assert.ok(!hard.has(j.x + ',' + j.y), `L${lv.id} 抖动格出硬禁区`);
    for (const d of a.decors) assert.ok(!hard.has(d.x + ',' + d.y), `L${lv.id} 小景出硬禁区`);
    for (const p of a.patches) for (const lb of p.lobes) {
      for (let Y = Math.floor(p.cy + lb.dy - lb.ry); Y <= Math.ceil(p.cy + lb.dy + lb.ry) - 1; Y++)
        for (let X = Math.floor(p.cx + lb.dx - lb.rx); X <= Math.ceil(p.cx + lb.dx + lb.rx) - 1; X++)
          assert.ok(!hard.has(X + ',' + Y), `L${lv.id} 拼块瓣出硬禁区`);
    }
    if (a.landmark) {
      assert.ok(CHAPTER_THEMES[lv.chapter].landmarks.includes(a.landmark.kind), `L${lv.id} 地标在章池内`);
      for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++)
        assert.ok(!hard.has((a.landmark.x + dx) + ',' + (a.landmark.y + dy)), `L${lv.id} 地标2×2出硬禁区`);
    }
    assert.ok(a.patches.length <= 4, `L${lv.id} 拼块≤4`);
    assert.ok(a.decors.length <= 16, `L${lv.id} 小景≤16`);
    assert.ok(a.accents.length <= 3, `L${lv.id} 动效≤3`);
    for (const ac of a.accents) assert.ok(typeof ac.phase === 'number' && ac.kind, `L${lv.id} accent 形状`);
    if (a.patches.length >= 2 && a.decors.length >= 10 && a.accents.length >= 2 && a.landmark) hit++;
  }
  assert.ok(hit >= 45, `≥90% 关达到数量下限(实际 ${hit}/50)`);
}

// 5) 第2章亲水加权机制活着:全章10关里至少 1 个 沙洲/芦苇 拼块锚点 8 邻邻水
{
  const { terrainTypeAt } = await import('../src/systems/terrainSystem.js');
  let waterside = 0;
  for (const lv of LEVELS.filter((l) => l.chapter === 2)) {
    for (const p of computeGroundLayout(lv).patches) {
      if (p.kind !== 'sandbar' && p.kind !== 'reedCluster') continue;
      const ax = Math.round(p.cx - 1), ay = Math.round(p.cy - 1);   // 锚格 = 2×2 块左上
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const t = terrainTypeAt(lv, ax + dx, ay + dy);
        if (t === 'river' || t === 'shallow') waterside++;
      }
    }
  }
  assert.ok(waterside >= 1, `ch2 亲水加权生效(邻水命中 ${waterside})`);
}

console.log('ok groundLayout');
