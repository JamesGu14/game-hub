// tests/battleController.test.mjs — Task B5 回合状态机（headless，无 Three.js / 无 DOM）
//
// 运行：node games/caocao-zhuan/tests/battleController.test.mjs
//
// 契约（plan §1.8 / 任务 B5）：
//   new BattleController(map, roster, { rng, bus })
//     .units                                       Unit[]（map.deploy + map.enemies 生成）
//     .turn   (从 1 开始) ；.phase ('player'|'enemy'|'event'|'resolved')
//     .selectableTiles(unit) -> Map<"c,r",cost>    （委托 pathfind.reachable，排除占用）
//     .moveUnit(unit, to)                          校验可达；置 hasMoved；emit 'unit:moved'
//     .attack(attacker, defender)                  调 combat + leveling；emit 'unit:attacked'/'unit:died'
//     .endPlayerTurn() / .runEnemyTurn()
//   _checkEnd 命中胜负时 emit 'battle:win'/'battle:lose' 并置 phase='resolved'。
//
// 本测试用真实第一章地图 + 全部曹魏武将名册；脚本化「逐个逼近并击杀全部敌人」，
// 断言最终 phase==='resolved' 且收到过 'battle:win'。

import assert from 'node:assert';
import { BattleController } from '../src/battle/battleController.js';
import { MAP } from '../src/data/chapters/ch01/b1_chenliu.map.js';
import { makeBus } from '../src/core/eventBus.js';
import { makeRng } from '../src/core/rng.js';

const WEI_ROSTER = ['caocao', 'xiahoudun', 'xiahouyuan', 'caoren', 'caohong'];
const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

// ---------------------------------------------------------------------------
// 1) 构造：units 正确生成，顶层有效属性齐全，初始 phase/turn 正确
// ---------------------------------------------------------------------------
{
  const bus = makeBus();
  const rng = makeRng('b5-construct');
  const bc = new BattleController(MAP, WEI_ROSTER, { rng, bus });

  assert.equal(bc.turn, 1, 'turn 从 1 开始');
  assert.equal(bc.phase, 'player', "初始 phase 为 'player'");

  // 5 wei (deploy) + 5 foe (enemies) = 10
  assert.equal(bc.units.length, 10, '共 10 个单位');
  const wei = bc.units.filter((u) => u.faction === 'wei');
  const foe = bc.units.filter((u) => u.faction === 'foe');
  assert.equal(wei.length, 5, '5 个曹魏单位');
  assert.equal(foe.length, 5, '5 个敌方单位');

  // 顶层有效属性（UNIT 契约）齐全
  const cc = bc.units.find((u) => u.id === 'caocao');
  assert.ok(cc, '曹操在场');
  for (const k of ['maxHp', 'curHp', 'atk', 'def', 'int', 'spd', 'mov']) {
    assert.equal(typeof cc[k], 'number', `顶层属性 ${k} 为数字`);
  }
  assert.equal(cc.curHp, cc.maxHp, '初始 curHp === maxHp');
  assert.equal(cc.faction, 'wei', '曹操是 wei');
  assert.equal(cc.ai, null, '玩家方 ai 为 null');
  assert.deepEqual(cc.pos, { c: 1, r: 6 }, '曹操按 deploy 落位');
  assert.equal(cc.hasMoved, false);
  assert.equal(cc.hasActed, false);
  assert.equal(cc.alive, true);

  // 敌方 ai 来自 enemies 表
  const spear = bc.units.find((u) => u.id === 'yt_spear');
  assert.equal(spear.faction, 'foe');
  assert.equal(spear.ai, 'reckless', '敌方 ai 取自 enemies 表项');

  console.log('  [construct] ok');
}

// ---------------------------------------------------------------------------
// 2) selectableTiles 委托 pathfind（排除占用、不含起点）
// ---------------------------------------------------------------------------
{
  const bc = new BattleController(MAP, WEI_ROSTER, { rng: makeRng(1), bus: makeBus() });
  const cc = bc.units.find((u) => u.id === 'caocao');
  const tiles = bc.selectableTiles(cc);
  assert.ok(tiles instanceof Map, 'selectableTiles 返回 Map');
  assert.ok(tiles.size > 0, '曹操有可移动格');
  assert.ok(!tiles.has('1,6'), '不含起点');
  // 不应包含被其它存活单位占据的格（夏侯惇在 2,6）
  assert.ok(!tiles.has('2,6'), '排除被占格');
  console.log('  [selectableTiles] ok');
}

// ---------------------------------------------------------------------------
// 3) moveUnit：合法移动更新 pos + hasMoved + emit 'unit:moved'；非法移动抛错
// ---------------------------------------------------------------------------
{
  const bus = makeBus();
  let movedPayload = null;
  bus.on('unit:moved', (p) => { movedPayload = p; });
  const bc = new BattleController(MAP, WEI_ROSTER, { rng: makeRng(2), bus });
  const cc = bc.units.find((u) => u.id === 'caocao');

  const tiles = bc.selectableTiles(cc);
  const someKey = [...tiles.keys()][0];
  const [tc, tr] = someKey.split(',').map(Number);

  bc.moveUnit(cc, { c: tc, r: tr });
  assert.deepEqual(cc.pos, { c: tc, r: tr }, 'pos 已更新');
  assert.equal(cc.hasMoved, true, 'hasMoved 置 true');
  assert.ok(movedPayload && movedPayload.unit === cc, "emit 'unit:moved' 携带 unit");
  assert.deepEqual(movedPayload.to, { c: tc, r: tr }, "emit 'unit:moved' 携带 to");

  // 非法移动（远处不可达格）应抛错
  assert.throws(() => bc.moveUnit(cc, { c: 9, r: 0 }), /reach|unreach|invalid|不可达/i,
    '非法移动抛错');
  console.log('  [moveUnit] ok');
}

// ---------------------------------------------------------------------------
// 4) attack：施加伤害、击杀置 alive=false + emit 'unit:died'、攻方得经验、hasActed
// ---------------------------------------------------------------------------
{
  const bus = makeBus();
  const events = [];
  bus.on('unit:attacked', (p) => events.push(['attacked', p]));
  bus.on('unit:died', (p) => events.push(['died', p]));
  const bc = new BattleController(MAP, WEI_ROSTER, { rng: makeRng('atk'), bus });

  // 人为拉一个强力 wei 与一个弱敌相邻，直接打
  const cc = bc.units.find((u) => u.id === 'xiahoudun'); // 高攻步兵
  const foe = bc.units.find((u) => u.id === 'yt_archer'); // 脆皮弓手
  cc.pos = { c: foe.pos.c, r: foe.pos.r - 1 }; // 相邻（曼哈顿 1）
  // 削弱目标至残血以保证一击击杀（不依赖 rng 抖动）
  foe.curHp = 1;
  const expBefore = cc.exp || 0;

  const res = bc.attack(cc, foe);
  assert.ok(res && typeof res.hit === 'boolean', 'attack 返回 combat result');
  assert.equal(cc.hasActed, true, '攻方 hasActed 置 true');
  assert.ok(events.some((e) => e[0] === 'attacked'), "emit 'unit:attacked'");

  if (res.killed) {
    assert.equal(foe.alive, false, '被击杀目标 alive=false');
    assert.equal(foe.curHp <= 0, true, '被击杀目标 curHp<=0');
    assert.ok(events.some((e) => e[0] === 'died' && e[1].unit === foe), "emit 'unit:died'");
    assert.ok((cc.exp || 0) !== expBefore || cc.level > 1, '攻方获得经验/升级');
  }
  console.log('  [attack] ok (killed=' + res.killed + ')');
}

// ---------------------------------------------------------------------------
// 5) 全流程：脚本化逼近并击杀所有敌人 → phase==='resolved' 且收到 'battle:win'
// ---------------------------------------------------------------------------
{
  const bus = makeBus();
  let won = false;
  let lost = false;
  bus.on('battle:win', () => { won = true; });
  bus.on('battle:lose', () => { lost = true; });

  const bc = new BattleController(MAP, WEI_ROSTER, { rng: makeRng('b5-win'), bus });

  // 选一个无敌打手（直接改属性，纯测试夹具——验证状态机闭环，而非平衡）
  const hero = bc.units.find((u) => u.id === 'xiahoudun');
  hero.atk = 999;
  hero.maxHp = 9999;
  hero.curHp = 9999;
  hero.def = 999;
  hero.spd = 999; // 必中
  hero.mov = 99;  // 任意距离可达（地图不大）

  // 直接「瞬移到敌人旁 + 攻击」循环，直到全部 foe 死亡或安全上限
  let guard = 0;
  while (!won && !lost && guard < 50) {
    guard++;
    const foes = bc.units.filter((u) => u.faction === 'foe' && u.alive);
    if (foes.length === 0) break;
    const target = foes[0];

    // 把英雄放到目标四邻的一个可站格（直接设 pos，绕过寻路；本测试只验证状态机）
    const spot = findAdjacentFreeTile(bc, target);
    assert.ok(spot, '目标周围有空格可站');
    hero.pos = spot;
    hero.hasMoved = false;
    hero.hasActed = false;

    bc.attack(hero, target);
    // 若胜负已决，attack 内部 _checkEnd 已处理
  }

  assert.equal(won, true, "最终 emit 'battle:win'");
  assert.equal(lost, false, '未误判失败');
  assert.equal(bc.phase, 'resolved', "phase 落到 'resolved'");
  assert.ok(
    bc.units.filter((u) => u.faction === 'foe').every((u) => !u.alive),
    '所有敌人阵亡',
  );
  console.log('  [full battle:win] ok (rounds=' + guard + ')');
}

// 在目标四邻找一个界内、非水、未被占据的空格
function findAdjacentFreeTile(bc, target) {
  const occ = new Set(
    bc.units.filter((u) => u.alive && u.id !== undefined).map((u) => `${u.pos.c},${u.pos.r}`),
  );
  const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dc, dr] of deltas) {
    const c = target.pos.c + dc;
    const r = target.pos.r + dr;
    if (c < 0 || r < 0 || c >= bc.map.cols || r >= bc.map.rows) continue;
    if (bc.map.tiles[r][c] === 'water') continue;
    if (occ.has(`${c},${r}`) && !(c === target.pos.c && r === target.pos.r)) {
      // 占据格但若恰是目标自身则不算（不会发生，因 target 在 target.pos）
      continue;
    }
    return { c, r };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 6) endPlayerTurn → runEnemyTurn：相位流转、回合 +1、重置 hasMoved/hasActed、emit 'turn:changed'
// ---------------------------------------------------------------------------
{
  const bus = makeBus();
  let turnChanged = null;
  bus.on('turn:changed', (p) => { turnChanged = p; });
  const bc = new BattleController(MAP, WEI_ROSTER, { rng: makeRng('enemy-turn'), bus });

  // 标记一个 wei 已行动，验证回合结束后被重置
  const cc = bc.units.find((u) => u.id === 'caocao');
  cc.hasMoved = true;
  cc.hasActed = true;

  bc.endPlayerTurn(); // 内部跑敌方回合并回到 player

  assert.equal(bc.turn, 2, '敌方回合结束后 turn=2');
  assert.equal(bc.phase, 'player', '回到玩家相位');
  assert.equal(cc.hasMoved, false, '新回合 hasMoved 重置');
  assert.equal(cc.hasActed, false, '新回合 hasActed 重置');
  assert.ok(turnChanged && turnChanged.turn === 2, "emit 'turn:changed' turn=2");
  console.log('  [enemy turn / turn:changed] ok');
}

console.log('battleController ok');
