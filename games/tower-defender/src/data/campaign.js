// data/campaign.js — 50 关编年战役谱（检查点A·§6）。
// 5 章 × 10 关。6 手写样板关（博望坡/长坂坡/赤壁/定军山/夷陵 各章首 + L50 上方谷·司马懿）有 rich story；
// 其余 44 关由确定性 builder 按章派生（template/faction/enemyTiers/boss + 轻量 story）。
// difficulty/waveCount 全部由 positionParams（章带）统一计算 → 全 50 关单调，样板只覆盖内容字段。
// 铁律：render-free、纯数据、加载期无 Math.random/Date（仅 index 数学）。
// 故事铁律：原创、史实向、一年级能懂、不抄受版权文本；成语取公共常识。
// 框架声明（统一话术）由 storyCard.js 固定渲染，避免误导孩子把"守成都"当史实。

export const CHAPTERS = [
  { id: 1, title: '天下大乱·诸侯并起', faction: 'wei', templates: ['twoCamp', 'threeCamp'], tiers: ['footman', 'wolf'], bossPool: ['huaxiong', 'lvbu', 'menghuo'], diffLo: 0.0, diffHi: 0.8 },
  { id: 2, title: '官渡之争·以弱胜强', faction: 'wei', templates: ['threeCamp', 'fourCamp'], tiers: ['footman', 'wolf', 'heavy'], bossPool: ['yanliang', 'wenchou', 'zhangliao'], diffLo: 0.8, diffHi: 1.6 },
  { id: 3, title: '火烧赤壁·三分天下', faction: 'wu', templates: ['fourCamp', 'fiveCamp'], tiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman'], bossPool: ['caocao', 'ganning', 'sunquan'], diffLo: 1.6, diffHi: 2.4 },
  { id: 4, title: '进取西川·汉中之战', faction: 'wei', templates: ['fiveCamp', 'sixCamp'], tiers: ['footman', 'wolf', 'heavy', 'tengjia'], bossPool: ['xiahouyuan', 'zhangren', 'caoren'], diffLo: 2.4, diffHi: 3.2 },
  { id: 5, title: '夷陵之火·六出祁山', faction: 'wu', templates: ['sixCamp', 'eightCamp'], tiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'tengjia'], bossPool: ['luxun', 'zhuran', 'zhanghe', 'xuchu'], diffLo: 3.2, diffHi: 4.0 },
];

const FACTION_CN = { nanman: '南蛮', wu: '东吴', wei: '曹魏' };

// 位置 → difficulty/waveCount（章带内线性、跨章接续 → 全 50 关单调，无锯齿）。k=0..9 章内位置。
function positionParams(ch, k) {
  const C = CHAPTERS[ch - 1];
  const p = k / 9;
  return {
    difficulty: +(C.diffLo + (C.diffHi - C.diffLo) * p).toFixed(2),
    waveCount: 20 + Math.round(p * (ch - 1)),   // 20→(20+章号-1)，后章更长，恒 ≥20
  };
}

// —— 6 手写样板关（键=id；只覆盖"内容"字段；difficulty/waveCount 由 positionParams 给 → 全局单调）——
// 落点：各章首关 1/11/21/31/41（章首=该章最易，适合开篇）+ L50 终局（司马懿，验主动技管线）。
const SAMPLES = {
  1: {
    name: '博望坡之战', faction: 'wei', templateId: 'threeCamp', pathSubset: ['a', 'b', 'c'], enemyTiers: ['footman', 'wolf'],
    boss: { id: 'xiahoudun', name: '夏侯惇', hpMult: 1.1 },
    story: { hook: '初出茅庐第一计，一把火烧退曹军！', year: '公元202年', place: '新野·博望坡', sides: '刘备军 vs 夏侯惇', result: '蜀军以火攻大胜', idiom: '初出茅庐', portrait: 'zhuge' },
  },
  11: {
    name: '长坂坡之战', faction: 'wei', templateId: 'fourCamp', pathSubset: ['a', 'b', 'c', 'd'], enemyTiers: ['footman', 'wolf', 'heavy'],
    boss: { id: 'zhangliao', name: '张辽', hpMult: 1.0 },
    story: { hook: '赵云七进七出，怀里护着小阿斗！', year: '公元208年', place: '当阳·长坂坡', sides: '刘备军 vs 曹操追兵', result: '赵云单骑救主', idiom: '单骑救主', portrait: 'zhao' },
  },
  21: {
    name: '赤壁之战', faction: 'wu', templateId: 'fiveCamp', pathSubset: ['a', 'b', 'c', 'd', 'e'], enemyTiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman'],
    boss: { id: 'caocao', name: '曹操', hpMult: 1.3 },
    story: { hook: '借东风一把火，烧退曹操八十万大军！', year: '公元208年', place: '长江·赤壁', sides: '孙刘联军 vs 曹操', result: '曹操大败，三分天下', idiom: '火烧赤壁', portrait: 'zhuge' },
  },
  31: {
    name: '定军山之战', faction: 'wei', templateId: 'sixCamp', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f'], enemyTiers: ['footman', 'wolf', 'heavy', 'tengjia'],
    boss: { id: 'xiahouyuan', name: '夏侯渊', hpMult: 1.1 },
    story: { hook: '老将黄忠一刀斩下夏侯渊！', year: '公元219年', place: '汉中·定军山', sides: '刘备军 vs 夏侯渊', result: '黄忠斩将夺山', idiom: '老当益壮', portrait: 'huang' },
  },
  41: {
    name: '夷陵之战', faction: 'wu', templateId: 'eightCamp', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], enemyTiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'tengjia'],
    boss: { id: 'luxun', name: '陆逊', hpMult: 1.2 },
    story: { hook: '陆逊火烧连营七百里！', year: '公元222年', place: '夷陵·猇亭', sides: '刘备军 vs 陆逊', result: '蜀军连营被焚', idiom: '火烧连营', portrait: null },
  },
  50: {
    name: '上方谷·五丈原', faction: 'wei', templateId: 'eightCamp', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], enemyTiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'tengjia'],
    boss: { id: 'simayi', name: '司马懿', hpMult: 1.6 },   // bossSkills 由 BOSSES.simayi 透传（summon+stunTower）
    story: { hook: '火烧上方谷，天降大雨救了司马懿！', year: '公元234年', place: '郿县·五丈原', sides: '诸葛亮 vs 司马懿', result: '诸葛亮病逝军中，北伐落幕', idiom: '死诸葛吓走活仲达', portrait: 'zhuge' },
  },
};

// —— 骨架 builder：第 ch 章第 k 关（k=0..9）→ 内容字段（difficulty/waveCount 不在此，由 positionParams 给）——
function buildSkeleton(ch, k) {
  const C = CHAPTERS[ch - 1];
  const p = k / 9;
  const templateId = C.templates[k < 5 ? 0 : 1];   // 章内前半 templates[0]、后半 templates[1]
  const tierN = Math.max(1, Math.min(C.tiers.length, 1 + Math.round(p * (C.tiers.length - 1))));
  const bossId = C.bossPool[k % C.bossPool.length];
  const facCn = FACTION_CN[C.faction];
  return {
    name: `${C.title.split('·')[0]}·第${k + 1}阵`,
    faction: C.faction, templateId, enemyTiers: C.tiers.slice(0, tierN),
    boss: { id: bossId },   // levels.js 展开时 { ...BOSSES[id], ...boss } 补 name/hpMult
    story: {
      hook: `${C.title.split('·')[1] || '守护成都'}，守住我们的家！`,
      year: '三国时期', place: C.title.split('·')[0],
      sides: `蜀汉六将 vs ${facCn}军`, result: '待你来改写', idiom: '众志成城', portrait: null,
    },
  };
}

// —— 合成 50 关：difficulty/waveCount 统一由 positionParams 给（单调）；内容来自 SAMPLES 或 buildSkeleton ——
export const CAMPAIGN = Array.from({ length: 50 }, (_, i) => {
  const id = i + 1;
  const ch = Math.floor(i / 10) + 1;
  const k = i % 10;
  const pos = positionParams(ch, k);
  const content = SAMPLES[id] || buildSkeleton(ch, k);
  return { id, chapter: ch, waveCount: pos.waveCount, difficulty: pos.difficulty, ...content };
});
