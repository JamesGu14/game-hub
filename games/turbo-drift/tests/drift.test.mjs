import { test } from 'node:test';
import assert from 'node:assert/strict';
import { driftStep, chargeToTier } from '../src/player.js';
import { DRIFT, NITRO } from '../src/config.js';

test('chargeToTier maps charge to 0..3 by thresholds', () => {
  assert.equal(chargeToTier(0), 0);
  assert.equal(chargeToTier(DRIFT.tierThresholds[0] + 0.01), 1);
  assert.equal(chargeToTier(DRIFT.tierThresholds[1] + 0.01), 2);
  assert.equal(chargeToTier(DRIFT.tierThresholds[2] + 0.01), 3);
});

test('holding drift with steer accumulates charge', () => {
  let d = { charge: 0, active: false };
  for (let i = 0; i < 60; i++) d = driftStep(d, { drifting: true, steer: 1 }, 1 / 60).state;
  assert.ok(d.active, 'is drifting');
  assert.ok(d.charge > DRIFT.chargeRate * 0.9, '~1s of charge');
});

test('drift needs steering input to engage', () => {
  const r = driftStep({ charge: 0, active: false }, { drifting: true, steer: 0 }, 1 / 60);
  assert.equal(r.state.active, false, 'no steer → no drift');
  assert.equal(r.state.charge, 0);
});

test('releasing drift returns a nitro burst sized by tier, then resets', () => {
  let d = { charge: 0, active: false };
  for (let i = 0; i < 90; i++) d = driftStep(d, { drifting: true, steer: -1 }, 1 / 60).state; // ~1.5s → tier 2
  const rel = driftStep(d, { drifting: false, steer: 0 }, 1 / 60);
  assert.ok(rel.released, 'released payload present');
  assert.equal(rel.released.tier, 2);
  assert.equal(rel.released.nitroDur, NITRO.durationByTier[2]);
  assert.equal(rel.state.charge, 0, 'charge reset');
  assert.equal(rel.state.active, false);
});

test('releasing with too-little charge gives tier 0 (no nitro)', () => {
  let d = { charge: 0, active: false };
  d = driftStep(d, { drifting: true, steer: 1 }, 1 / 60).state; // ~1 frame
  const rel = driftStep(d, { drifting: false, steer: 0 }, 1 / 60);
  assert.equal(rel.released.tier, 0);
  assert.equal(rel.released.nitroDur, 0);
});
