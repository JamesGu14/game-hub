// tests/attacks.test.mjs — 五种攻击行为（溅射/减速/冲锋/灼烧/连射 + 防空过滤）
// 运行：node games/tower-defender/tests/attacks.test.mjs
import assert from 'node:assert';
import { GENERALS } from '../src/data/generals.js';
import { createTower } from '../src/entities/tower.js';
import { createEnemy } from '../src/entities/enemy.js';
import { runAttack } from '../src/systems/combat/attacks.js';

const path = [{ x: 0, y: 0 }, { x: 12, y: 0 }];
function enemy(type, px, py, opts = {}) { const e = createEnemy(type, 'a', path, 1); e.px = px; e.py = py; Object.assign(e, opts); return e; }
function newTower(id, px, py) { const t = createTower(id, { x: 0, y: 0 }); t.px = px; t.py = py; return t; }
const rng = () => 0.99;   // 不暴击

// 张飞溅射：地面多体中，飞兵不中
{
  const t = newTower('zhang', 100, 100);
  const primary = enemy('footman', 100, 100);
  const near = enemy('footman', 100, 120);    // 20px < 36（溅射半径1格）
  const fly = enemy('flyer', 100, 110);
  const state = { enemies: [primary, near, fly], projectiles: [], fx: [], gold: 0 };
  runAttack(state, t, GENERALS.zhang, primary, 0, rng);
  assert.ok(primary.hp < 60 && near.hp < 60, '溅射命中地面多体');
  assert.equal(fly.hp, 70, '溅射不碰飞兵');
}

// 关羽：命中扣血 + 上 40% 减速
{
  const t = newTower('guan', 100, 100);
  const e = enemy('footman', 100, 100);
  const state = { enemies: [e], projectiles: [], fx: [], gold: 0 };
  runAttack(state, t, GENERALS.guan, e, 0, rng);
  assert.ok(e.hp < 60, '关羽命中扣血');
  assert.ok(e.statuses.slow && Math.abs(e.statuses.slow.pct - 0.4) < 1e-9, '上 40% 减速');
}

// 马超：以最前为锋尖，穿透身后 ≤3；第4个（最后排）不中
{
  const t = newTower('ma', 18, 100);          // range 3格=108px
  const e0 = enemy('footman', 40, 100, { progress: 1 });   // 最后排
  const e1 = enemy('footman', 60, 100, { progress: 2 });
  const e2 = enemy('footman', 80, 100, { progress: 3 });
  const primary = enemy('footman', 100, 100, { progress: 4 }); // 锋尖（最前）
  const state = { enemies: [e0, e1, e2, primary], projectiles: [], fx: [], gold: 0 };
  runAttack(state, t, GENERALS.ma, primary, 0, rng);
  const hit = [e0, e1, e2, primary].filter((e) => e.hp < 60).length;
  assert.equal(hit, 3, '马超最多命中 3（锋尖+身后2）');
  assert.equal(e0.hp, 60, '最后排不中');
}

// 诸葛：上灼烧（DoT，非直伤）；L3 火烧藤甲 dps×2
{
  const t = newTower('zhuge', 100, 100);
  const e = enemy('footman', 100, 100);
  const state = { enemies: [e], projectiles: [], fx: [], gold: 0 };
  runAttack(state, t, GENERALS.zhuge, e, 0, rng);
  assert.equal(e.hp, 60, '灼烧不走直伤（hp 不立即掉）');
  assert.equal(e.statuses.burn.length, 1, '上 1 层灼烧');
  assert.equal(e.statuses.burn[0].dps, 8, 'L1 dps=8');

  const t3 = newTower('zhuge', 100, 100); t3.level = 3;
  const teng = enemy('tengjia', 100, 100);
  const s2 = { enemies: [teng], projectiles: [], fx: [], gold: 0 };
  runAttack(s2, t3, GENERALS.zhuge, teng, 0, rng);
  // L3 dps = towerStats(zhuge,3).dmg(8×1.6²=20.48) ×2(火烧藤甲)
  assert.ok(Math.abs(teng.statuses.burn[0].dps - 20.48 * 2) < 1e-9, '火烧藤甲 dps×2');
}

// 赵云 L3 七进七出：击杀后连射，最多连 2
{
  const t = newTower('zhao', 100, 100); t.level = 3; t.targets = 'ground';
  const g = GENERALS.zhao;                    // dmg48 L3=48×1.6²=122.88，秒杀步卒
  const a = enemy('footman', 100, 100, { progress: 3 });   // primary
  const b = enemy('footman', 110, 100, { progress: 2 });   // 连射目标
  const c = enemy('footman', 120, 100, { progress: 1 });   // 超出连 2 不再射
  const state = { enemies: [a, b, c], projectiles: [], fx: [], gold: 0 };
  runAttack(state, t, g, a, 0, rng);
  assert.equal(a.alive, false, '锋首被秒');
  assert.equal(b.alive, false, '连射秒第二个');
  assert.equal(c.alive, true, '连射封顶 2，第三个不中');
  assert.equal(state.gold, a.gold + b.gold, '两杀两份掉金');
}

console.log('ok attacks');
