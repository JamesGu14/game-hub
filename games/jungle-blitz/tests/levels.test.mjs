import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/levels.js';
import { FIELD } from '../src/config.js';

const BOSSES = new Set(['gate', 'gunship', 'mech', 'twinCannon', 'core']);
const POD_KINDS = new Set(['weaponS', 'weaponM', 'weaponL', 'shield', 'heal']);

for (const s of STAGES) {
  test(`stage ${s.id} (${s.name}) is internally valid`, () => {
    assert.ok(s.worldWidth > FIELD.W, 'world wider than viewport');
    assert.ok(s.bossX > 0 && s.bossX < s.worldWidth, 'bossX inside world');
    assert.ok(BOSSES.has(s.boss), 'known boss');
    assert.ok(s.floors.length >= 1, 'has ground');
    for (const c of s.checkpoints) assert.ok(c > 0 && c < s.worldWidth, 'checkpoint inside world');
    const sorted = [...s.checkpoints].sort((a, b) => a - b);
    assert.deepEqual(s.checkpoints, sorted, 'checkpoints ascending');
    for (const sp of s.spawns) assert.ok(sp.x > 0 && sp.x < s.worldWidth, 'spawn inside world');
    for (const p of s.pods) assert.ok(POD_KINDS.has(p.kind), 'known pod kind');
  });
}

test('stage 5 (final) uses the core boss', () => {
  const last = STAGES[STAGES.length - 1];
  if (last.id === 5) assert.equal(last.boss, 'core');
});
