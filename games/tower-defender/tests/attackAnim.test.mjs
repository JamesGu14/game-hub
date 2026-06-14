// tests/attackAnim.test.mjs — 出手帧序列纯函数：数据驱动选帧 + 窗口内外回退 idle。
// 关羽 L5：曹操传式两态——出手窗口整段显示「刀向下」劈砍帧(atk2)，停留 0.4~0.5s，窗口外回 idle；其余将/级零影响。
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

// —— 出手窗口内整段显示「刀向下」劈砍帧(曹操传式两态:持刀↔刀向下,停留 0.4~0.5s) ——
{
  const d = ATK_FRAME_DUR;
  assert.ok(d >= 0.4 && d <= 0.5, '劈砍停留时长在 0.4~0.5s');
  assert.equal(attackFrameId('guan', 5, F, F + d * 0.0), 'gen_guan_5_atk2', 'k=0→刀向下atk2');
  assert.equal(attackFrameId('guan', 5, F, F + d * 0.3), 'gen_guan_5_atk2', '前段→刀向下');
  assert.equal(attackFrameId('guan', 5, F, F + d * 0.9), 'gen_guan_5_atk2', '整窗口停留→刀向下');
}

// —— 窗口外（出手前 / 已收势）→ null ——
{
  const d = ATK_FRAME_DUR;
  assert.equal(attackFrameId('guan', 5, F, F + d * 1.5), null, '窗口后→idle');
  assert.equal(attackFrameId('guan', 5, F, F - 0.1), null, '出手前(k<0)→idle');
  assert.equal(attackFrameId('guan', 5, F, F + d + 0.01), null, '超过停留时长(窗口外)→idle');
}

console.log('ok attackAnim');
