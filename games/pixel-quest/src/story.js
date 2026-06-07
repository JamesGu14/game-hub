// 剧情数据 + 世界推导。零生字、短句(每句 ≤38 字)。speaker=中文名,portrait=英文 key。
// 世界 5-10 故意留空(阶段 B-D 再填):空脚本 → introFor/outroFor 返回 [],运行器立即 onDone,不卡死。

export const OPENING = [
  { speaker: '国王', portrait: 'king',   text: '不好啦!桃花公主被酷霸王抓走了!' },
  { speaker: '国王', portrait: 'king',   text: '谁能把公主救回来,我就把他招为驸马!' },
  { speaker: '侍从', portrait: 'herald', text: '可是……能去的勇士,都被酷霸王打败了。' },
  { speaker: '侍从', portrait: 'herald', text: '现在没人敢去啦,呜呜。' },
  { speaker: '马里奥', portrait: 'mario', text: '别怕!交给我!' },
  { speaker: '马里奥', portrait: 'mario', text: '我去把公主救回来!出发啦!' },
];

export const WORLD_INTRO = {
  1: [
    { speaker: '侍从', portrait: 'herald', text: '勇士,先穿过这片蘑菇平原吧!' },
    { speaker: '马里奥', portrait: 'mario', text: '草地、山洞、天空,还有热熔岩和冷雪地。' },
    { speaker: '马里奥', portrait: 'mario', text: '我顺着酷霸王的脚印,一路追上去!' },
  ],
  2: [
    { speaker: '侍从', portrait: 'herald', text: '这里是失落边境:沙漠、森林、海边,还有黑夜。' },
    { speaker: '侍从', portrait: 'herald', text: '那座城堡是坏蛋的小基地。' },
    { speaker: '马里奥', portrait: 'mario', text: '我把它攻下来,找到公主的下落!' },
  ],
  3: [
    { speaker: '侍从', portrait: 'herald', text: '哇……这里是魔界裂隙,好可怕。' },
    { speaker: '马里奥', portrait: 'mario', text: '毒沼、水晶矿、打雷的山。' },
    { speaker: '马里奥', portrait: 'mario', text: '越走越吓人,但我不怕!继续往里冲!' },
  ],
  4: [
    { speaker: '侍从', portrait: 'herald', text: '这里是天空回廊,飘在云上面。' },
    { speaker: '马里奥', portrait: 'mario', text: '樱花、神殿、大蘑菇,还有星空。' },
    { speaker: '马里奥', portrait: 'mario', text: '闯过这些考验,就能得到新的本领!我试一试!' },
  ],
};

export const WORLD_OUTRO = {
  1: [
    { speaker: '马里奥', portrait: 'mario', text: '耶!平原闯过来啦!' },
    { speaker: '马里奥', portrait: 'mario', text: '前面是陌生的边境……公主,我来了!' },
  ],
  2: [
    { speaker: '马里奥', portrait: 'mario', text: '前哨,攻破!' },
    { speaker: '侍从', portrait: 'herald', text: '马里奥!公主被带去更深的地方了,小心呀!' },
    { speaker: '马里奥', portrait: 'mario', text: '知道啦!我继续追!' },
  ],
  3: [
    { speaker: '马里奥', portrait: 'mario', text: '呼……魔界裂隙,走完啦!' },
    { speaker: '马里奥', portrait: 'mario', text: '我好像越来越有劲了!继续前进!' },
  ],
  4: [
    { speaker: '马里奥', portrait: 'mario', text: '考验通过!我浑身都是劲儿!' },
    { speaker: '马里奥', portrait: 'mario', text: '有了新本领,坏蛋们等着吧!' },
  ],
};

// 阶段 A 占位结局(救出 + 婚礼,不含 Boss 战台词);阶段 D 用 spec §五 完整版替换。
export const ENDING = [
  { speaker: '桃花公主', portrait: 'princess', text: '马里奥!你真的来救我了!' },
  { speaker: '马里奥', portrait: 'mario', text: '我说过的,再难也挡不住我!' },
  { speaker: '桃花公主', portrait: 'princess', text: '我们回家吧,回到我们的王国!' },
  { speaker: '国王', portrait: 'king', text: '勇士啊!你救回了我的女儿,了不起!' },
  { speaker: '国王', portrait: 'king', text: '我说话算话——封你为驸马!全国一起庆祝!' },
  { speaker: '侍从', portrait: 'herald', text: '大家快来呀,王国要办大喜事啦!' },
  { speaker: '马里奥', portrait: 'mario', text: '公主,我答应过一定带你回家!' },
];

// ---- 世界推导(每 5 关一个世界;levelIndex 0-based)----
export function worldOf(i) { return Math.floor(i / 5) + 1; }
export function isWorldFirstLevel(i) { return i % 5 === 0; }
export function isWorldLastLevel(i) { return i % 5 === 4; }
export function introFor(i) { return WORLD_INTRO[worldOf(i)] || []; }
export function outroFor(i) { return WORLD_OUTRO[worldOf(i)] || []; }

// 开发期自检:节点结构 + 句长(不抛错,只告警,避免影响线上)
(() => {
  const all = [OPENING, ENDING, ...Object.values(WORLD_INTRO), ...Object.values(WORLD_OUTRO)].flat();
  for (const b of all) {
    if (!b || !b.speaker || !b.portrait || typeof b.text !== 'string') { console.warn('story: 坏节点', b); continue; }
    if (b.text.length > 38) console.warn('story: 文案过长(>38)', b.text);
  }
})();
