// tests/storylines.test.mjs — 演绎门禁1(spec §8.1):全50关 build 不抛/确定性/who∈CAST/
// 变量零 undefined·零占位/单句≤60中文字符(text.length 含标点)/点将名单随 roster 变化
// 运行:node games/tower-defender/tests/storylines.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { CAST } from '../src/data/cast.js';
import { CAMPAIGN } from '../src/data/campaign.js';
import { storyContentFor, rollcall, ROLLCALL_PRIORITY, numToCn } from '../src/data/storylines.js';

const BASE = new Set(['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying']);
const FULL = new Set([...BASE, 'zhao', 'zhang', 'guan', 'ma', 'huang', 'zhuge']);
const SAMPLE_IDS = new Set([1, 11, 21, 31, 41, 50]);

// 1) 全 50 关 × 两种 roster:build 不抛 + 结构 + 内容门禁
for (const lv of LEVELS) {
  for (const roster of [BASE, FULL]) {
    const c = storyContentFor(lv, roster);
    assert.ok(typeof c.narration === 'string' && c.narration.length >= 20, `L${lv.id} narration`);
    assert.ok(Array.isArray(c.script) && c.script.length >= 4, `L${lv.id} script ≥4 句`);
    assert.ok(c.script.length <= 12, `L${lv.id} script ≤12 句`);
    if (!SAMPLE_IDS.has(lv.id)) assert.ok(c.script.length <= 6, `生成关 L${lv.id} 压 4-6 句`);
    for (const [i, line] of c.script.entries()) {
      assert.ok(CAST[line.who], `L${lv.id} 句${i} who='${line.who}' 在 CAST`);
      assert.ok(typeof line.text === 'string' && line.text.length > 0, `L${lv.id} 句${i} 有词`);
      assert.ok(line.text.length <= 60, `L${lv.id} 句${i} ≤60 字(实际 ${line.text.length})`);
      assert.ok(!/undefined|null|\{|\}|NaN/.test(line.text), `L${lv.id} 句${i} 无占位/未替换变量: ${line.text}`);
    }
    assert.ok(!/undefined|\{|\}|NaN/.test(c.narration), `L${lv.id} narration 无占位`);
    // 确定性:同关同 roster 双调用逐字相同
    assert.deepEqual(storyContentFor(lv, roster), c, `L${lv.id} 确定性`);
  }
}

// 2) 样板关直通:campaign 手写内容原样返回
const l1 = storyContentFor(LEVELS[0], BASE);
assert.equal(l1.narration, CAMPAIGN[0].story.narration, '样板关 narration 直通');
assert.deepEqual(l1.script, CAMPAIGN[0].story.script, '样板关 script 直通');

// 3) 点将名单随 roster(spec 原型两例)
assert.deepEqual(rollcall(BASE), ['liao', 'zhangbao', 'guanping'], '基础阵容 → 廖化/张苞/关平');
assert.deepEqual(rollcall(FULL), ['zhao', 'zhang', 'guan'], '全解锁 → 赵云/张飞/关羽');
assert.equal(ROLLCALL_PRIORITY.length, 12, '优先序覆盖 12 将');

// 4) 生成关剧本里点将三人组真实生效(取一个非样板关,如 L2)
const l2base = storyContentFor(LEVELS[1], BASE);
const l2full = storyContentFor(LEVELS[1], FULL);
const joined = (c) => c.script.map((s) => s.text).join('');
assert.ok(joined(l2base).includes('廖化') && joined(l2base).includes('关平'), 'L2 基础 roster 点将入词');
assert.ok(joined(l2full).includes('赵云') && joined(l2full).includes('关羽'), 'L2 全 roster 点将入词');
assert.notDeepEqual(l2base.script, l2full.script, '点将随 roster 变化');

// 5) 变量注入:敌主将名/首营城名出现在文案;第5章主公=诸葛亮(丞相),1-4章=刘备
assert.ok(joined(l2base).includes(LEVELS[1].boss.name), 'L2 敌主将名入词');
assert.ok((l2base.narration + joined(l2base)).includes(LEVELS[1].camps[0].cityName), 'L2 首营城名入词');
for (const lv of LEVELS) {
  if (SAMPLE_IDS.has(lv.id)) continue;
  const whos = new Set(storyContentFor(lv, FULL).script.map((s) => s.who));
  if (lv.chapter <= 4) assert.ok(whos.has('liubei') && !whos.has('zhuge'), `L${lv.id} 1-4章主公=刘备`);
  else assert.ok(whos.has('zhuge') && !whos.has('liubei'), `L${lv.id} 5章主公=诸葛丞相(刘备已故,史实向)`);
}

// 6) numToCn 抽查
assert.equal(numToCn(5), '五'); assert.equal(numToCn(10), '十');
assert.equal(numToCn(13), '十三'); assert.equal(numToCn(26), '二十六');

console.log('ok storylines(50关×2roster 门禁全过)');
