import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeKonami, KONAMI } from '../src/input.js';

test('the full Konami sequence triggers exactly once', () => {
  let fired = 0;
  const k = makeKonami(() => { fired += 1; });
  let completing = false;
  for (const key of KONAMI) completing = k.push(key);
  assert.equal(fired, 1);
  assert.equal(completing, true, 'last key reports completion');
});

test('a wrong key resets progress', () => {
  let fired = 0;
  const k = makeKonami(() => { fired += 1; });
  k.push('ArrowUp'); k.push('ArrowUp'); k.push('x'); // break it
  for (const key of KONAMI) k.push(key);              // full run after the break
  assert.equal(fired, 1);
});

test('a correct prefix that diverges does not fire', () => {
  let fired = 0;
  const k = makeKonami(() => { fired += 1; });
  k.push('ArrowUp'); k.push('ArrowUp'); k.push('ArrowDown'); k.push('ArrowDown');
  k.push('ArrowLeft'); k.push('ArrowRight'); k.push('ArrowLeft'); k.push('ArrowRight');
  k.push('a'); // wrong (should be 'b')
  assert.equal(fired, 0);
});
