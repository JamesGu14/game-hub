import { describe, it, expect } from 'vitest';
import { angleDiff, clamp, lerp, dist, TAU } from '../src/util/math';

describe('angleDiff', () => {
  it('returns 0 for equal angles', () => {
    expect(angleDiff(1, 1)).toBe(0);
  });
  it('returns positive for counter-clockwise target', () => {
    expect(angleDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });
  it('chooses the short way across the wrap boundary', () => {
    // current near +π, target near -π → small positive diff
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2, 5);
  });
  it('handles full rotations', () => {
    expect(angleDiff(0, TAU)).toBeCloseTo(0);
  });
});

describe('clamp', () => {
  it('clamps below', () => { expect(clamp(-5, 0, 10)).toBe(0); });
  it('clamps above', () => { expect(clamp(15, 0, 10)).toBe(10); });
  it('passes through inside range', () => { expect(clamp(5, 0, 10)).toBe(5); });
});

describe('lerp', () => {
  it('returns a at t=0', () => { expect(lerp(2, 8, 0)).toBe(2); });
  it('returns b at t=1', () => { expect(lerp(2, 8, 1)).toBe(8); });
  it('returns midpoint at t=0.5', () => { expect(lerp(2, 8, 0.5)).toBe(5); });
});

describe('dist', () => {
  it('computes Euclidean distance', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
