import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config';

describe('config', () => {
  it('has positive tick rate', () => {
    expect(CONFIG.TICK_HZ).toBeGreaterThan(0);
  });

  it('has frame catchup cap of at least 1', () => {
    expect(CONFIG.MAX_FRAME_CATCHUP).toBeGreaterThanOrEqual(1);
  });
});
