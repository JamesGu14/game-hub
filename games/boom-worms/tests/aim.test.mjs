// Tests for the Aim charge model — focus on the ping-pong charge behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Aim } from '../src/aim.js';
import { AIM } from '../src/config.js';

test('startCharge resets power to min and sets direction upward', () => {
  Aim.power = 999;
  Aim._dir = -1;
  Aim.charging = false;
  Aim.startCharge();
  assert.equal(Aim.charging, true);
  assert.equal(Aim.power, AIM.minSpeed);
  assert.equal(Aim._dir, 1);
});

test('stepCharge ping-pongs: rises to max, falls back to min, then rises again', () => {
  Aim.startCharge();
  const dt = 1 / 60;
  let hitMax = false, fellBack = false, roseAgain = false;
  for (let i = 0; i < 500; i++) {
    Aim.stepCharge(dt);
    if (Aim.power >= AIM.maxSpeed - 1e-6) hitMax = true;
    if (hitMax && Aim.power <= AIM.minSpeed + 1e-6) fellBack = true;
    if (fellBack && Aim.power > AIM.minSpeed + 30) roseAgain = true;
  }
  assert.ok(hitMax, 'charge should reach maxSpeed');
  assert.ok(fellBack, 'charge should fall back to minSpeed');
  assert.ok(roseAgain, 'charge should rise again (loops)');
});

test('stepCharge never leaves the [minSpeed, maxSpeed] band', () => {
  Aim.startCharge();
  const dt = 1 / 60;
  for (let i = 0; i < 500; i++) {
    Aim.stepCharge(dt);
    assert.ok(Aim.power >= AIM.minSpeed - 1e-6, 'power >= minSpeed');
    assert.ok(Aim.power <= AIM.maxSpeed + 1e-6, 'power <= maxSpeed');
  }
});

test('stepCharge is a no-op when not charging', () => {
  Aim.reset(1);
  Aim.charging = false;
  Aim.power = AIM.minSpeed;
  Aim.stepCharge(1 / 60);
  assert.equal(Aim.power, AIM.minSpeed);
});

test('reset restores defaults (not charging, power=min, direction up)', () => {
  Aim.startCharge();
  Aim.stepCharge(0.5);
  Aim.reset(1);
  assert.equal(Aim.charging, false);
  assert.equal(Aim.power, AIM.minSpeed);
  assert.equal(Aim._dir, 1);
});
