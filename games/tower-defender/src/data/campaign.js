// data/campaign.js — 50 关编年战役谱（检查点A·§6）。
// 5 章 × 10 关。6 手写样板关（博望坡/长坂坡/赤壁/定军山/夷陵 各章首 + L50 上方谷·司马懿）有 rich story；
// 其余 44 关由确定性 builder 按章派生（template/faction/enemyTiers/boss + 轻量 story）。
// difficulty/waveCount 全部由 positionParams（章带）统一计算 → 全 50 关单调，样板只覆盖内容字段。
// 铁律：render-free、纯数据、加载期无 Math.random/Date（仅 index 数学）。
// 故事铁律：原创、史实向、一年级能懂、不抄受版权文本；成语取公共常识。
// 框架声明（统一话术）由 storyScene.js 固定渲染，避免误导孩子把"守成都"当史实。
import { BASE_BOARDS } from './baseBoards.js';
import { pathSubsetFor } from './boardVariants.js';

export const CHAPTERS = [
  { id: 1, title: '天下大乱·诸侯并起', faction: 'wei', templates: ['ch1A', 'ch1B'], tiers: ['footman', 'wolf'], bossPool: ['huaxiong', 'lvbu', 'menghuo'], lieutenantPool: ['lidian', 'yujin', 'yuejin', 'caohong'], diffLo: 0.0, diffHi: 0.8 },
  // [2026-06-13 平衡] ch2 去 heavy:重甲克制(诸葛/关羽)L21 才解锁,L18-20 重甲=无解题(实测墙);
  // 官渡主题=兵海以弱胜强,难度靠 diffK 数量曲线给。heavy 首秀顺延至 ch3 骨架带(L25,克制已到手)。
  { id: 2, title: '官渡之争·以弱胜强', faction: 'wei', templates: ['ch2A', 'ch2B'], tiers: ['footman', 'wolf'], bossPool: ['yanliang', 'wenchou', 'zhangliao'], lieutenantPool: ['yuejin', 'caohong', 'caoxiu', 'niujin'], diffLo: 0.8, diffHi: 1.6 },
  { id: 3, title: '火烧赤壁·三分天下', faction: 'wu', templates: ['ch3A', 'ch3B'], tiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'cavalry'], bossPool: ['caocao', 'ganning', 'sunquan'], lieutenantPool: ['zhoutai', 'jiangqin', 'dingfeng', 'xusheng'], diffLo: 1.6, diffHi: 2.4 },
  { id: 4, title: '进取西川·汉中之战', faction: 'wei', templates: ['ch4A', 'ch4B'], tiers: ['footman', 'wolf', 'heavy', 'tengjia', 'cavalry'], bossPool: ['xiahouyuan', 'zhangren', 'caoren'], lieutenantPool: ['lidian', 'yujin', 'caoxiu', 'niujin'], diffLo: 2.4, diffHi: 3.2 },
  { id: 5, title: '夷陵之火·六出祁山', faction: 'wu', templates: ['ch5A', 'ch5B'], tiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'tengjia', 'cavalry'], bossPool: ['luxun', 'zhuran', 'zhanghe', 'xuchu'], lieutenantPool: ['dingfeng', 'xusheng', 'panzhang', 'handang'], diffLo: 3.2, diffHi: 4.0 },
];

const FACTION_CN = { nanman: '南蛮', wu: '东吴', wei: '曹魏' };

// 位置 → difficulty/waveCount（章带内线性、跨章接续 → 全 50 关单调，无锯齿）。k=0..9 章内位置。
function positionParams(ch, k) {
  const C = CHAPTERS[ch - 1];
  const p = k / 9;
  return {
    difficulty: +(C.diffLo + (C.diffHi - C.diffLo) * p).toFixed(2),
    waveCount: 30 + Math.round(p * (ch - 1)),   // [改进③] 30→(30+章号-1)，每关+10波(满级可达),恒 ≥30
  };
}

// —— 6 手写样板关（键=id；只覆盖"内容"字段；difficulty/waveCount 由 positionParams 给 → 全局单调）——
// 落点：各章首关 1/11/21/31/41（章首=该章最易，适合开篇）+ L50 终局（司马懿，验主动技管线）。
const SAMPLES = {
  1: {
    name: '博望坡之战', faction: 'wei', templateId: 'ch1A', pathSubset: ['a', 'b', 'c'], enemyTiers: ['footman', 'wolf'],
    boss: { id: 'xiahoudun', name: '夏侯惇', hpMult: 1.1 },
    lieutenants: ['lidian', 'yujin'],   // 李典、于禁（史载随夏侯惇战博望坡）
    story: { hook: '初出茅庐第一计，一把火烧退曹军！', year: '公元202年', place: '新野·博望坡', sides: '刘备军 vs 夏侯惇', result: '蜀军以火攻大胜', idiom: '初出茅庐', portrait: 'zhuge',
    narration: '东汉末年，天下大乱。曹操派大将夏侯惇，带着十万大军杀向新野。刘备请来了聪明的军师诸葛亮，第一仗就在博望坡打响！',
    script: [
      { who: 'liao', text: '报——！主公，不好啦！夏侯惇率十万大军，直奔我们杀来啦！' },
      { who: 'liubei', text: '莫慌。军师诸葛先生足智多谋，且听他怎么说。' },
      { who: 'xiahoudun', text: '哈哈哈！刘备兵不过三千，竟敢挡我？看我一举踏平博望坡！' },
      { who: 'zhang', text: '哼！那诸葛亮年纪轻轻，一介书生，真有本事退敌吗？' },
      { who: 'guan', text: '三弟莫急，且看军师如何调兵遣将。' },
      { who: 'zhuge', text: '博望坡道路狭窄，两旁都是芦苇。待曹军进入，一把火便叫他有来无回！' },
      { who: 'liubei', text: '好计！众将听令，全凭军师调遣，不得有误！' },
      { who: 'xiahoudun', text: '传我将令：全军加速，直取新野！谁敢挡路，杀无赦！' },
      { who: 'zhang', text: '俺张飞倒要看看，这把火烧不烧得起来！' },
      { who: 'zhuge', text: '关将军、张将军埋伏两侧，见火起便杀出。请主公安心守城！' },
      { who: 'zhongjiang', text: '（齐声）得令！' },
      { who: 'liubei', text: '诸位将军，守住博望坡，让曹军有来无回！' },
    ],
    },
  },
  11: {
    name: '长坂坡之战', faction: 'wei', templateId: 'ch2A', pathSubset: ['a', 'b', 'c', 'd'], enemyTiers: ['footman', 'wolf'],   // [平衡] 章首=该章最易:tiers 对齐位置带(heavy 章内 L18 登场;旧挂全章池致第15波重甲墙)
    boss: { id: 'zhangliao', name: '张辽', hpMult: 1.0 },
    lieutenants: ['yuejin', 'caohong'],   // 乐进、曹洪
    story: { hook: '赵云七进七出，怀里护着小阿斗！', year: '公元208年', place: '当阳·长坂坡', sides: '刘备军 vs 曹操追兵', result: '赵云单骑救主', idiom: '单骑救主', portrait: 'zhao',
    narration: '曹操亲率大军南下，刘备带着百姓撤退，走到当阳长坂坡被追上了。乱军之中，刘备的小儿子阿斗不见了！大将赵云单枪匹马，杀回曹军阵中寻找。',
    script: [
      { who: 'guanping', text: '主公！曹军追上来了！先锋张辽来势凶猛，眼看就要冲散百姓啦！' },
      { who: 'liubei', text: '百姓不能丢！众将护住百姓，且战且退！' },
      { who: 'zhangliao', text: '刘备！丞相有令，今日定要将你拿下！你还往哪里逃！' },
      { who: 'zhao', text: '主公放心！小主人阿斗丢在乱军里了，赵云这就杀回去，定把他平安带回来！' },
      { who: 'liubei', text: '子龙！千军万马，你一人一骑，千万小心！' },
      { who: 'zhao', text: '看我七进七出，杀他个通透！' },
      { who: 'zhang', text: '子龙去吧！俺老张守住当阳桥，量他百万曹军，也休想过去半步！' },
      { who: 'zhangliao', text: '不好，是张飞！此人有万夫不当之勇，将士们小心！' },
      { who: 'zhang', text: '燕人张飞在此！谁敢与我决一死战！' },
      { who: 'liubei', text: '好！子龙救阿斗，翼德断后，众将护百姓，守住长坂坡！' },
    ],
    },
  },
  21: {
    name: '赤壁之战', faction: 'wu', templateId: 'ch3A', pathSubset: ['a', 'b', 'c', 'd', 'e'], enemyTiers: ['footman', 'wolf'],   // [平衡] 同 L11:heavy/flyer/shaman 由章内骨架渐进引入(L26/L27/L29)
    boss: { id: 'caocao', name: '曹操', hpMult: 1.3 },
    lieutenants: ['caohong', 'caoxiu'],   // 曹洪、曹休
    story: { hook: '借东风一把火，烧退曹操八十万大军！', year: '公元208年', place: '长江·赤壁', sides: '孙刘联军 vs 曹操', result: '曹操大败，三分天下', idiom: '火烧赤壁', portrait: 'zhuge',
    narration: '曹操统一北方后，带着号称八十万的大军杀到长江边，要一口气吞掉江南。刘备和东吴的孙权联起手来，在赤壁迎战。一场冬天里的大火，即将改变天下！',
    script: [
      { who: 'guan', text: '军师，曹操八十万大军在江北扎下水寨，战船密密麻麻，如何破他？' },
      { who: 'zhuge', text: '曹军都是北方人，不习水战，战船全用铁链锁在一起——这正是破敌的妙处！' },
      { who: 'caocao', text: '哈哈哈！战船连锁，如履平地。待我练好水军，便踏平江东，再无敌手！' },
      { who: 'zhang', text: '军师，船锁在一起又怎样？难道还能一把火全烧了不成？' },
      { who: 'zhuge', text: '翼德说得对，就是一把火！黄盖老将军已假意投降曹操，船里装的全是干柴火油！' },
      { who: 'liubei', text: '只是冬天刮西北风，火借风势，岂不烧到我们自己？' },
      { who: 'zhuge', text: '主公放心，亮夜观天象，三日之内，必有东南大风！' },
      { who: 'caocao', text: '报——黄盖来降了？哈哈，连东吴老将都来投我，天下唾手可得！' },
      { who: 'zhuge', text: '东风起了！传令下去，火船出发，今夜火烧赤壁！' },
      { who: 'zhongjiang', text: '（齐声）得令！火烧曹营，杀——！' },
      { who: 'liubei', text: '众将听令，守住江口，莫放曹军逃回北岸！' },
    ],
    },
  },
  31: {
    name: '定军山之战', faction: 'wei', templateId: 'ch4A', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f'], enemyTiers: ['footman', 'wolf'],   // [平衡] 同 L11:heavy/tengjia 由章内骨架渐进引入
    boss: { id: 'xiahouyuan', name: '夏侯渊', hpMult: 1.1 },
    lieutenants: ['yujin', 'niujin'],   // 于禁、牛金
    story: { hook: '老将黄忠一刀斩下夏侯渊！', year: '公元219年', place: '汉中·定军山', sides: '刘备军 vs 夏侯渊', result: '黄忠斩将夺山', idiom: '老当益壮', portrait: 'huang',
    narration: '刘备进军汉中，曹操的大将夏侯渊在定军山扎下大营，挡住了去路。老将黄忠虽然年过七十，却主动请战，要去会一会这位曹军名将！',
    script: [
      { who: 'madai', text: '禀主公！夏侯渊在定军山扎营，居高临下，我军几次进攻都没拿下来。' },
      { who: 'huang', text: '主公！老臣黄忠愿往！定斩夏侯渊，夺下定军山！' },
      { who: 'liubei', text: '汉升老将军年过七旬，此战凶险，还需从长计议啊。' },
      { who: 'huang', text: '主公莫看我年迈！我开得硬弓，骑得烈马，斩将夺旗，何须年轻人！' },
      { who: 'xiahouyuan', text: '黄忠老儿也敢来犯？我夏侯渊镇守汉中多年，岂怕你这白发老翁！' },
      { who: 'liubei', text: '好！法正先生随军参谋，定下以逸待劳之计——敌军骄躁时，便是出击之机！' },
      { who: 'huang', text: '末将明白！先按兵不动，养精蓄锐，等夏侯渊松懈疲惫，一鼓作气冲下山去！' },
      { who: 'xiahouyuan', text: '这老儿怎么还不来攻？将士们都给我盯紧了……哼，谅他也不敢！' },
      { who: 'huang', text: '时机到了！看老夫宝刀，斩将立功，就在今日！' },
      { who: 'liubei', text: '老将军威武！众将听令，随黄老将军夺取定军山！' },
      { who: 'zhongjiang', text: '（齐声）末将在！愿随老将军出战！' },
    ],
    },
  },
  41: {
    name: '夷陵之战', faction: 'wu', templateId: 'ch5A', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], enemyTiers: ['footman', 'wolf'],   // [平衡] 同 L11:进阶兵种由章内骨架渐进引入(L50 终关全量)
    boss: { id: 'luxun', name: '陆逊', hpMult: 1.2 },
    lieutenants: ['handang', 'xusheng'],   // 韩当、徐盛（夷陵吴将）
    story: { hook: '陆逊火烧连营七百里！', year: '公元222年', place: '夷陵·猇亭', sides: '刘备军 vs 陆逊', result: '蜀军连营被焚', idiom: '火烧连营', portrait: null,
    narration: '关羽、张飞先后遇害，刘备悲愤交加，亲率大军讨伐东吴，一路连下数城。东吴派出年轻的都督陆逊迎战。蜀军在山林里连着扎下七百里营寨，危险正悄悄逼近……',
    script: [
      { who: 'liao', text: '报——陛下！东吴拜陆逊为大都督，统领五万兵马，在猇亭一带挡住了我军！' },
      { who: 'liubei', text: '陆逊？一个白面书生！朕为二弟三弟报仇，岂会怕他！' },
      { who: 'luxun', text: '蜀军远来，锐气正盛，不可硬拼。传令各营，坚守不出，等他们松懈！' },
      { who: 'zhangbao', text: '陛下！吴军龟缩不出，天气又热，将士们都到林子里扎营乘凉去了。' },
      { who: 'luxun', text: '七百里连营，全在山林之中——天助我也！传令：每人带一把火，今夜火烧连营！' },
      { who: 'liao', text: '不好啦！吴军四面放火，营寨全烧起来了！陛下快走！' },
      { who: 'liubei', text: '悔不听丞相之言！众将何在，护朕突围！' },
      { who: 'zhangbao', text: '末将在！陛下莫慌，张苞拼死也要护陛下杀出去！' },
      { who: 'zhao', text: '陛下！赵云接应来了！子龙在此，吴军休得猖狂！' },
      { who: 'luxun', text: '穷寇莫追，蜀军还有后手，传令收兵。这一仗，东吴胜了！' },
      { who: 'liubei', text: '众将听令，结阵断后，守住退路，保大军平安撤回！' },
    ],
    },
  },
  50: {
    name: '上方谷·五丈原', faction: 'wei', templateId: 'ch5B', pathSubset: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], enemyTiers: ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'tengjia'],
    boss: { id: 'simayi', name: '司马懿', hpMult: 1.6 },   // bossSkills 由 BOSSES.simayi 透传（summon+stunTower）
    rampMax: 1.0,   // 司马懿终关豁免 HP ramp：震慑停火+召唤本就全战役最紧（满防仅余 3-5 HP），叠 1.5 必崩，单独保出厂难度
    disableTerrain: ['firegully'],   // [地形] 终关天命大雨：火谷失效（呼应火烧上方谷；雨丝渲染见 board.drawWeather）
    lieutenants: ['caoxiu', 'niujin'],   // 曹休、牛金
    story: { hook: '火烧上方谷，天降大雨救了司马懿！', year: '公元234年', place: '郿县·五丈原', sides: '诸葛亮 vs 司马懿', result: '大雨浇灭谷中烈火，诸葛亮病逝军中，北伐落幕', idiom: '死诸葛吓走活仲达', portrait: 'zhuge',
    narration: '诸葛亮六出祁山，北伐曹魏，对手是老谋深算的司马懿。诸葛亮设下妙计，把司马懿大军引进了葫芦形的上方谷，谷口一封，烈火熊熊烧起！眼看大功告成，天空却突然乌云密布……',
    script: [
      { who: 'madai', text: '丞相！司马懿父子果然中计，追着我军进上方谷了！' },
      { who: 'zhuge', text: '好！马岱听令：等魏军全部入谷，立刻堵住谷口，点燃干柴！' },
      { who: 'madai', text: '末将得令！这一回，定叫司马懿插翅难飞！' },
      { who: 'simayi', text: '慢着……谷中怎么堆着这么多干柴？不好！中计了！快撤——！' },
      { who: 'zhuge', text: '火起了！司马懿啊司马懿，你纵有千般算计，今日也难逃此谷！' },
      { who: 'simayi', text: '火势封路，四面都是烈焰！我父子三人，今日难道命丧于此？！' },
      { who: 'yueying', text: '夫君快看天上！乌云滚滚，只怕……只怕要下大雨了！' },
      { who: 'zhuge', text: '什么？！' },
      { who: 'simayi', text: '哈哈哈！大雨！天不亡我司马懿！将士们，趁雨突围，杀出去！' },
      { who: 'zhuge', text: '唉……谋事在人，成事在天，不可强求啊。' },
      { who: 'yueying', text: '夫君莫灰心！魏军虽然逃出谷去，还要来攻五丈原，这一仗还没完呢！' },
      { who: 'zhuge', text: '传令众将：摆开阵势，守住五丈原，与司马懿决一死战！' },
    ],
    },
  },
};

// —— 骨架 builder：第 ch 章第 k 关（k=0..9）→ 内容字段（difficulty/waveCount 不在此，由 positionParams 给）——
function buildSkeleton(ch, k) {
  const C = CHAPTERS[ch - 1];
  const p = k / 9;
  const templateId = C.templates[k < 5 ? 0 : 1];   // 章内前半 templates[0]、后半 templates[1]
  const pathSubset = pathSubsetFor(ch, k, Object.keys(BASE_BOARDS[templateId].paths));   // 前半=子集,后半/样板=null
  const tierN = Math.max(1, Math.min(C.tiers.length, 1 + Math.round(p * (C.tiers.length - 1))));
  const bossId = C.bossPool[k % C.bossPool.length];
  const lt = C.lieutenantPool;
  const facCn = FACTION_CN[C.faction];
  return {
    name: `${C.title.split('·')[0]}·第${k + 1}阵`,
    faction: C.faction, templateId, enemyTiers: C.tiers.slice(0, tierN),
    ...(pathSubset ? { pathSubset } : {}),
    boss: { id: bossId },   // levels.js 展开时 { ...BOSSES[id], ...boss } 补 name/hpMult
    lieutenants: [lt[k % lt.length], lt[(k + 1) % lt.length]],   // 2 冷门副将（随末波出场）
    story: {
      hook: `${C.title.split('·')[1] || '守护成都'}，守住我们的家！`,
      year: '三国时期', place: C.title.split('·')[0],
      sides: `蜀汉众将 vs ${facCn}军`, result: '待你来改写', idiom: '众志成城', portrait: null,
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
