import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS } from '../src/data/campaign.js';

// 需求②:骑兵进 ch3赤壁/ch4西川/ch5夷陵(进阶兵种章,L21+ 渐进解锁);ch1天下大乱/ch2官渡 保持极简不加(平衡)。
test('骑兵入 ch3/ch4/ch5 tiers,ch1/ch2 不含,tiers[0] 恒 footman', () => {
  const byId = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
  for (const id of [3, 4, 5]) {
    assert.ok(byId[id].tiers.includes('cavalry'), `ch${id} 应含 cavalry`);
  }
  for (const id of [1, 2]) {
    assert.ok(!byId[id].tiers.includes('cavalry'), `ch${id} 不应含 cavalry(早期保持极简)`);
  }
  for (const c of CHAPTERS) {
    assert.equal(c.tiers[0], 'footman', `ch${c.id} tiers[0] 须 footman`);
    assert.ok(['wei', 'wu'].includes(c.faction), `ch${c.id} faction 仅魏吴`);
  }
});
