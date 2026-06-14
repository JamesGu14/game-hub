// tests/attackAnim.test.mjs — 出手帧序列纯函数：数据驱动选帧 + 窗口内外回退 idle。
// 关羽 L5 打样：出手窗口内按进度 引刀(atk1)→劈出(atk2)→收势(idle)；其余将/级零影响。
// 运行：node games/tower-defender/tests/attackAnim.test.mjs
import assert from 'node:assert';
import { attackFrameId, hasAttackSequence, ATK_FRAME_DUR } from '../src/render/attackAnim.js';

const F = 1.0;  // lastFireAt 基准时刻

// —— 无攻击序列的将 → 始终 null（向后兼容：其余将渲染不受影响）——
{
  assert.equal(attackFrameId('zhao', 5, F, F + 0.1), null, '无序列将→null');
  assert.equal(attackFrameId('huang', 2, F, F + 0.1), null, '无序列将(huang L2)→null');
  assert.equal(hasAttackSequence('zhao', 5), false, 'zhao L5 无序列');
}

// —— 关羽仅 L5 有序列；L4 无（打样只接 L5）——
{
  assert.equal(hasAttackSequence('guan', 5), true, 'guan L5 有序列');
  assert.equal(hasAttackSequence('guan', 4), false, 'guan L4 无序列');
  assert.equal(attackFrameId('guan', 4, F, F + 0.1), null, 'guan L4→null(用 idle)');
}

// —— 未出手（lastFireAt 为 null）→ null（idle）——
{
  assert.equal(attackFrameId('guan', 5, null, 5.0), null, '未出手→idle');
}

// —— 出手窗口内按进度切帧：引刀 → 劈出 → 收势 ——
{
  const d = ATK_FRAME_DUR;
  assert.equal(attackFrameId('guan', 5, F, F + d * 0.0), 'gen_guan_5_atk1', 'k=0→引刀atk1');
  assert.equal(attackFrameId('guan', 5, F, F + d * 0.2), 'gen_guan_5_atk1', '前段→引刀atk1');
  assert.equal(attackFrameId('guan', 5, F, F + d * 0.55), 'gen_guan_5_atk2', '中段→劈出atk2');
  assert.equal(attackFrameId('guan', 5, F, F + d * 0.85), null, '后段→收势(idle)');
}

// —— 窗口外（出手前 / 已收势）→ null ——
{
  const d = ATK_FRAME_DUR;
  assert.equal(attackFrameId('guan', 5, F, F + d * 1.5), null, '窗口后→idle');
  assert.equal(attackFrameId('guan', 5, F, F - 0.1), null, '出手前(k<0)→idle');
  assert.equal(attackFrameId('guan', 5, F, F + d), null, 'k=1 右边界→idle(窗口右开)');
}

console.log('ok attackAnim');
