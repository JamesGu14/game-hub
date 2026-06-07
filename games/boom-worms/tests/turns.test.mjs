import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextActive, aliveTeams, checkOutcome } from '../src/turns.js';

const mk = (alive) => alive.map((a, i) => ({ id: i, alive: a }));
const teams = (t0, t1) => [{ id: 0, worms: mk(t0) }, { id: 1, worms: mk(t1) }];

test('nextActive alternates team and advances within team', () => {
  const t = teams([true, true], [true, true]);
  let n = nextActive(t, { team: 0, wormIdx: 0 });
  assert.equal(n.team, 1);
  n = nextActive(t, { team: 1, wormIdx: 0 });
  assert.equal(n.team, 0);
});

test('nextActive skips dead worms', () => {
  const t = teams([true, false, true], [false, true]);
  const n = nextActive(t, { team: 1, wormIdx: 1 });
  assert.equal(n.team, 0);
  assert.ok(t[0].worms[n.wormIdx].alive);
});

test('checkOutcome: winner team id when one side wiped, else null, -1 draw', () => {
  assert.equal(checkOutcome(teams([false, false], [true])), 1);
  assert.equal(checkOutcome(teams([true], [false])), 0);
  assert.equal(checkOutcome(teams([true], [true])), null);
  assert.equal(checkOutcome(teams([false], [false])), -1);
});

test('checkOutcome stays backward-compatible with the single-arg call', () => {
  // 现有调用点（game.js _updateResolve）只传 teams；默认参数必须保持旧行为。
  assert.equal(checkOutcome(teams([false, false], [true])), 1);
  assert.equal(checkOutcome(teams([true], [false])), 0);
  assert.equal(checkOutcome(teams([true], [true])), null);
  assert.equal(checkOutcome(teams([false], [false])), -1);
});

test('checkOutcome accepts the explicit eliminate objective + state (3-arg, §11.7)', () => {
  const obj = { type: 'eliminate' };
  assert.equal(checkOutcome(teams([true], [false]), obj, { turnCount: 3 }), 0);
  assert.equal(checkOutcome(teams([false], [false]), obj, {}), -1);
  assert.equal(checkOutcome(teams([true], [true]), obj), null);
});
