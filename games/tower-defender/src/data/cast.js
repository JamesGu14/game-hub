// data/cast.js — 剧情演绎角色注册表(演绎 spec §3.3)。CAST[who] = { name, portrait, voice, side }。
// portrait: { gen: '<generalId>' } → 渲染层经 generalSprite(id, 3) 取三阶图逐级回退;
//           { img: '<assetKey>' }  → assets.images[key];null → 无立绘(色块名牌兜底)。
// voice: edge-tts 音色与调参(段1 惰性数据,段2 gen-voice.py/playVoice 直接消费)。
// side: 'shu'(对话框左侧) | 'enemy'(右侧)。
// 【命名规则】塔将沿用 GENERALS 既有缩写 id(liao/zhou/madai…历史命名不动);
//            非作战角色用全拼 id(liubei、zhongjiang,将来如有孙尚香 = sunshangxiang)。
// 铁律:render-free、纯数据、加载期无随机。
import { GENERALS } from './generals.js';
import { BOSSES, LIEUTENANTS } from './bosses.js';

// 我方年轻将共用云希,按人微调 rate/pitch 区分(spec §4);老将(huang/zhou/zhuge)云健苍劲,与敌将靠 pitch 区分。
const SHU_VOICE = {
  liao:     { name: 'zh-CN-YunxiNeural', rate: '+4%' },                 // 干练报信人
  guanping: { name: 'zh-CN-YunxiNeural', pitch: '+6%' },                // 少年清亮
  zhangbao: { name: 'zh-CN-YunxiNeural', rate: '+2%', pitch: '+2%' },   // 虎气
  madai:    { name: 'zh-CN-YunxiNeural', rate: '-2%' },                 // 沉稳
  zhao:     { name: 'zh-CN-YunxiNeural' },                              // 清朗(基准)
  ma:       { name: 'zh-CN-YunxiNeural', pitch: '-2%' },                // 剽悍
  guan:     { name: 'zh-CN-YunxiNeural', rate: '-6%', pitch: '-4%' },   // 威严
  zhang:    { name: 'zh-CN-YunxiNeural', rate: '+6%', pitch: '-6%' },   // 粗豪
  huang:    { name: 'zh-CN-YunjianNeural', rate: '-12%' },              // 老将苍劲
  zhou:     { name: 'zh-CN-YunjianNeural', rate: '-12%' },
  zhuge:    { name: 'zh-CN-YunjianNeural', rate: '-12%' },
  yueying:  { name: 'zh-CN-XiaoyiNeural' },                             // 清亮才女
};

const ENEMY_VOICE = { name: 'zh-CN-YunjianNeural', pitch: '-8%' };       // 敌将共用,低沉威压

export const CAST = {};

// 我方 12 塔将(立绘 = 三阶最威风,经 generalSprite 回退)
for (const id of Object.keys(GENERALS)) {
  CAST[id] = { name: GENERALS[id].name, portrait: { gen: id }, voice: SHU_VOICE[id], side: 'shu' };
}
// 敌将(主将 + 副将;44 张 boss 图全有,缺图渲染层色块名牌兜底)
for (const [id, b] of [...Object.entries(BOSSES), ...Object.entries(LIEUTENANTS)]) {
  CAST[id] = { name: b.name, portrait: { img: 'boss_' + id }, voice: ENEMY_VOICE, side: 'enemy' };
}
// 非作战角色(全拼 id)
CAST.liubei = { name: '刘备', portrait: { img: 'gen_liubei' }, voice: { name: 'zh-CN-YunyangNeural' }, side: 'shu' };
CAST.narrator = { name: '旁白', portrait: null, voice: { name: 'zh-CN-XiaoxiaoNeural', rate: '-8%' }, side: 'shu' };
CAST.zhongjiang = { name: '众将', portrait: null, voice: { name: 'zh-CN-YunxiNeural' }, side: 'shu' };   // 齐声句:云希单声+文字标(齐声)
