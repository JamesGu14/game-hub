// 纯逻辑断言:story.js 的推导函数 + 数据完整性。Run: node tools/_story_test.mjs
import {
  OPENING, ENDING, WORLD_INTRO, WORLD_OUTRO,
  worldOf, isWorldFirstLevel, isWorldLastLevel, introFor, outroFor,
} from '../src/story.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log('FAIL: ' + msg); fails++; } };

// worldOf: 每 5 关一个世界,1-based
ok(worldOf(0) === 1, 'worldOf(0)=1');
ok(worldOf(4) === 1, 'worldOf(4)=1');
ok(worldOf(5) === 2, 'worldOf(5)=2');
ok(worldOf(19) === 4, 'worldOf(19)=4');
ok(worldOf(45) === 10, 'worldOf(45)=10');

// 世界边界
ok(isWorldFirstLevel(0) === true && isWorldFirstLevel(5) === true, 'first-of-world');
ok(isWorldFirstLevel(4) === false, 'mid not first');
ok(isWorldLastLevel(4) === true && isWorldLastLevel(9) === true, 'last-of-world');
ok(isWorldLastLevel(3) === false, 'mid not last');

// 世界 1-9 有 intro/outro(阶段A 填 1-4,阶段C 填 5-9);世界 10 空脚本安全降级为 []
ok(Array.isArray(introFor(0)) && introFor(0).length > 0, 'world1 intro filled');
ok(introFor(15).length > 0, 'world4 intro filled (idx15)');
ok(introFor(20).length > 0, 'world5 intro filled (idx20)');
ok(introFor(40).length > 0, 'world9 intro filled (idx40)');
ok(introFor(45).length === 0, 'world10 intro empty -> [] (idx45)');
ok(outroFor(0).length > 0, 'world1 outro filled');
ok(outroFor(20).length > 0, 'world5 outro filled (idx20)');
ok(outroFor(45).length === 0, 'world10 outro empty -> [] (idx45)');

// 数据完整性 + 长度约束(零生字短句)
const PORTRAITS = new Set(['king', 'mario', 'princess', 'bowser', 'herald']);
const all = [OPENING, ENDING, ...Object.values(WORLD_INTRO), ...Object.values(WORLD_OUTRO)].flat();
ok(all.length > 0, 'has beats');
for (const b of all) {
  ok(b && typeof b.speaker === 'string' && b.speaker.length > 0, 'beat has speaker: ' + JSON.stringify(b));
  ok(b && PORTRAITS.has(b.portrait), 'beat portrait valid: ' + JSON.stringify(b));
  ok(b && typeof b.text === 'string' && b.text.length > 0 && b.text.length <= 38, 'beat text 1..38: ' + JSON.stringify(b));
}

if (fails) { console.log(`\n${fails} FAIL`); process.exit(1); }
console.log('story.js: ALL PASS (' + all.length + ' beats)');
