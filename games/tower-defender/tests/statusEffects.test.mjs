// tests/statusEffects.test.mjs — 状态机（§17.3：减速取最强不叠加 · 定身=0 · 灼烧叠3）
// 运行：node games/tower-defender/tests/statusEffects.test.mjs
import assert from 'node:assert';
import { applySlow, applyStun, applyBurn, effectiveSpeed } from '../src/systems/combat/statusEffects.js';

// 减速取最强不叠加 + 到期恢复
{
  const e = { speed: 1, statuses: {} };
  applySlow(e, 0.4, 2, 0);
  applySlow(e, 0.2, 2, 0);                 // 较弱不覆盖
  assert.equal(e.statuses.slow.pct, 0.4, '取最强 0.4');
  assert.ok(Math.abs(effectiveSpeed(e, 0) - 0.6) < 1e-9, 'effSpeed 1×0.6');
  assert.equal(effectiveSpeed(e, 5), 1, '到期恢复满速');
}

// 定身=0；定身过后减速仍计时
{
  const e = { speed: 2, statuses: {} };
  applySlow(e, 0.5, 3, 0);
  applyStun(e, 1, 0);
  assert.equal(effectiveSpeed(e, 0), 0, '定身时速度 0');
  assert.equal(effectiveSpeed(e, 1.5), 1, '定身过(>1s)后减速仍在：2×0.5');
}

// 灼烧最多叠 3 层
{
  const e = { statuses: {} };
  for (let i = 0; i < 4; i++) applyBurn(e, 5, 3, 0);
  assert.equal(e.statuses.burn.length, 3, '最多 3 层（满层刷最早）');
}

console.log('ok statusEffects');
