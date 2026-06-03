// data/chapters/ch01/index.js — 第一章「起兵讨董」章节清单（Task F）
//
// 契约（plan §4）：
//   export const CH01 = {
//     id, name,
//     battles: [ { map, story, joinsAfter? } × 5 ]   // 按序：b1…b5
//   }
//
// 每个 battle 把对应的 *.map.js 与 *.story.js 模块对象配成一对，按战序排列。
// joinsAfter：该战「胜利 + outro」之后加入玩家常驻 roster 的武将 id 列表
//   （剧情登场加入；客将不在此列）。集成层（main.js）在战后据此 game.addToRoster(...)。
//   §1：荀彧 / 戏志才 / 典韦 在第 2 战「会盟酸枣」后加入。
//
// 注意：
//   · b1–b3 的回合触发器（turnStart 小演出）声明在各自 *.story.js 的 STORY.triggers 上，
//     而引擎（battleController._fireTurnStartTriggers）读取的是 map.triggers。
//     集成层在装配战斗时把 story.triggers 合并进 map.triggers（见 main.js buildBattleMap），
//     故此处无需改动内容文件即可让全部 turnStart 触发器统一生效。
//   · 客将（刘备/关羽/张飞）直接列在 b4 map.deploy 内（faction 'wei' 仅本战），
//     战后不进常驻 roster（main.js 在持久化时只回写非客将）。

import b1Map from './b1_chenliu.map.js';
import b1Story from './b1_chenliu.story.js';
import b2Map from './b2_huimeng.map.js';
import b2Story from './b2_huimeng.story.js';
import b3Map from './b3_sishuiguan.map.js';
import b3Story from './b3_sishuiguan.story.js';
import b4Map from './b4_hulaoguan.map.js';
import b4Story from './b4_hulaoguan.story.js';
import b5Map from './b5_xingyang.map.js';
import b5Story from './b5_xingyang.story.js';

export const CH01 = {
  id: 'ch01',
  name: '第一章 · 起兵讨董',
  battles: [
    { map: b1Map, story: b1Story },
    // 第 2 战会盟酸枣后：荀彧、戏志才、典韦 来投，加入常驻 roster。
    { map: b2Map, story: b2Story, joinsAfter: ['xunyu', 'xizhicai', 'dianwei'] },
    { map: b3Map, story: b3Story },
    // 第 4 战虎牢关：客将刘关张在 map.deploy 内（仅本战），战后离队（不在 joinsAfter）。
    { map: b4Map, story: b4Story },
    { map: b5Map, story: b5Story },
  ],
};

export default CH01;
