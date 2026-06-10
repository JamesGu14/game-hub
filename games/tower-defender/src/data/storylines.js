// data/storylines.js — 44 生成关剧本模板(演绎 spec §3.2)+ 统一访问器 storyContentFor。
// storyContentFor(level, roster) → { narration, script }:纯函数、确定性(同关同 roster 同输出),
// 加载期/调用期零随机零 Date。样板关(story.script 手写)直通;生成关按章模板 + seed=level.id 轮替。
// 模板变量:{boss}=敌主将名 {lt}=首副将名 {city}=首营城名 {wan}=兵力万数(波数/难度派生)
//          {g1}{g2}{g3}=点将三人组(unlockedGenerals 阵容按优先序前三,剧情随解锁进度生长)。
// 主公:第1-4章=刘备;第5章=诸葛丞相(刘备卒于223年,史实向;夷陵期间诸葛亮留守成都调度,自洽)。
// 文案铁律:原创、一年级能懂、faction 中立(章 bossPool 吴魏混编,不点敌方势力名)、单句≤60字。
// 本模块只读 level 字段,绝不在 level/story 上写任何东西(LEVELS 单例防写穿)。
import { CAST } from './cast.js';

// 点将优先序(spec 原型两例反推:基础6将→廖化/张苞/关平;全解锁→赵云/张飞/关羽)
export const ROLLCALL_PRIORITY = ['zhao', 'zhang', 'guan', 'ma', 'huang', 'zhuge', 'liao', 'zhangbao', 'guanping', 'zhou', 'madai', 'yueying'];

// roster(Set<generalId>) → 点将三人组 id(优先序内取前三;BASE_ROSTER 恒 6 人,必有 3)
export function rollcall(roster) {
  return ROLLCALL_PRIORITY.filter((id) => roster.has(id)).slice(0, 3);
}

// 1..99 → 中文数字(兵力万数用)
const D = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function numToCn(n) {
  if (n <= 0) return D[0];                       // 兜底(wanOf 恒≥2,实际不触发)
  if (n >= 100) return '百';                     // 封顶(波数/难度调参击穿时文案仍可读:"百万大军")
  if (n < 10) return D[n];
  const t = Math.floor(n / 10), o = n % 10;
  return (t > 1 ? D[t] : '') + '十' + (o ? D[o] : '');
}

// 兵力万数:波数×(1+难度)/4,L2≈5万(呼应原型"五万大军")→ 终章≈26-30万,恒≥2
function wanOf(level) {
  return Math.max(2, Math.round(level.waveCount * (1 + level.difficulty) / 4));
}

// —— 旁白模板(每章 2 套)——
const NARR = {
  1: [
    '东汉末年，天下大乱，群雄四起。{boss}带着{wan}万大军，杀向{city}。蜀汉的将士们立下誓言：一定要守住家园！',
    '烽火连天的乱世里，百姓只盼着平安。可是{boss}的{wan}万兵马，已经兵临{city}城下。勇敢的将军们，拿起武器吧！',
  ],
  2: [
    '官渡之战，以弱胜强，天下震动。如今{boss}又率{wan}万大军卷土重来，{city}危在旦夕。这一次，还能以少胜多吗？',
    '河北兵强马壮，{boss}领着{wan}万人马直扑{city}。蜀汉将士虽然人少，却个个以一当十，毫不畏惧！',
  ],
  3: [
    '长江滚滚，战船如云。{boss}率{wan}万大军顺江而来，要一举拿下{city}。赤壁的火光还没熄灭，新的大战又开始了！',
    '江风阵阵，杀气腾腾。{boss}的{wan}万水陆大军已经围住{city}。将军们要在江边列阵，寸土不让！',
  ],
  4: [
    '蜀道难，难于上青天！可是{boss}的{wan}万大军，偏偏翻山越岭杀向{city}。高山挡不住敌人，就让将军们来挡！',
    '汉中是蜀地的大门，{city}是必经之路。{boss}率{wan}万兵马来势汹汹，一场山地大战一触即发！',
  ],
  5: [
    '关张二位将军的仇、夷陵的大火，蜀汉将士都记在心里。如今{boss}又率{wan}万大军杀向{city}，新的恶战就在眼前！',
    '蜀汉的旗帜依然高高飘扬。{boss}带着{wan}万人马直逼{city}，丞相摇着羽扇，早已成竹在胸。将士们，听令出战！',
  ],
};

// —— 对话模板(每章 3 套,seed=level.id 轮替;结构循 James 原型:报信→主公反应→敌将叫阵→点将→齐声→出征令)——
// 行格式 [who, text]:who 里 'g1'/'g2'/'g3'/'lt'/'boss' 是占位角色,展开时换成真实 cast id。
const SCRIPTS = {
  1: [
    [
      ['g1', '报——主公！{boss}率{wan}万大军，直奔{city}杀来啦！'],
      ['liubei', '什么？！{boss}来得好快！诸位莫慌，且随我守住城池！'],
      ['boss', '哈哈哈！小小{city}，弹指可破！识相的早早开城投降！'],
      ['liubei', '{g1}、{g2}、{g3}听令！'],
      ['zhongjiang', '（齐声）末将在！'],
      ['liubei', '务必守住{city}，生擒{boss}！'],
    ],
    [
      ['g1', '主公！探马来报，{boss}带着副将{lt}，领{wan}万兵马围住{city}了！'],
      ['boss', '{lt}听令，给我猛攻城门！今日不破{city}，誓不收兵！'],
      ['lt', '末将得令！弟兄们，跟我冲！'],
      ['liubei', '贼军势大，更要沉住气。{g1}、{g2}、{g3}，随我上城迎敌！'],
      ['zhongjiang', '（齐声）末将在！誓与{city}共存亡！'],
    ],
    [
      ['g1', '主公，{boss}的{wan}万大军已到{city}城外，旌旗遮天蔽日！'],
      ['liubei', '乱世之中，百姓最苦。这一仗，是为身后的百姓而战！'],
      ['boss', '城里的听着！我{boss}天下无敌，降者免死！'],
      ['g2', '主公放心！量他兵马再多，末将们也叫他有来无回！'],
      ['liubei', '好！{g1}、{g2}、{g3}，各守要道，让{boss}知道我们的厉害！'],
      ['zhongjiang', '（齐声）得令！'],
    ],
  ],
  2: [
    [
      ['g1', '报——主公！名将{boss}，率{wan}万精兵杀向{city}！'],
      ['liubei', '敌兵多将广，我们兵少，只能智取，不可硬拼！'],
      ['boss', '我军战无不胜！{city}小城，一鼓可下！'],
      ['liubei', '{g1}、{g2}、{g3}听令！深沟高垒，以弱胜强，就看今日！'],
      ['zhongjiang', '（齐声）末将在！'],
    ],
    [
      ['g1', '主公！{boss}与副将{lt}兵分两路，{wan}万人马直扑{city}而来！'],
      ['boss', '{lt}，你攻东门，我攻西门，看他首尾如何相顾！'],
      ['lt', '得令！主将放心，末将定第一个登上城头！'],
      ['liubei', '兵来将挡，水来土掩。{g1}、{g2}、{g3}，分头守住各路要道！'],
      ['zhongjiang', '（齐声）末将在！人在城在！'],
      ['liubei', '好！让来犯之敌见识见识，什么叫众志成城！'],
    ],
    [
      ['g1', '主公，{boss}的{wan}万大军在{city}外扎下连营，一眼望不到头！'],
      ['liubei', '当年官渡一战，两万人马胜了十万。兵不在多，在乎齐心！'],
      ['boss', '哼，凭你们这点人马也想守城？真是螳臂当车！'],
      ['g3', '主公，末将愿打头阵，挫挫他的锐气！'],
      ['liubei', '{g1}、{g2}、{g3}听令！守住{city}，叫他乘兴而来，败兴而归！'],
      ['zhongjiang', '（齐声）得令！'],
    ],
  ],
  3: [
    [
      ['g1', '报——主公！{boss}率{wan}万兵马，战船顺江而下，直逼{city}！'],
      ['liubei', '水路来敌，行军极快。众将随我即刻布防，不得迟疑！'],
      ['boss', '哈哈哈！我军船坚兵利，{city}转眼便是囊中之物！'],
      ['liubei', '{g1}、{g2}、{g3}听令！'],
      ['zhongjiang', '（齐声）末将在！'],
      ['liubei', '守住渡口要道，一只船也不许靠岸！'],
    ],
    [
      ['g1', '主公！{boss}与{lt}率{wan}万水陆大军，在{city}外安营扎寨了！'],
      ['boss', '{lt}，今夜趁着江雾，悄悄摸到城下，打他个措手不及！'],
      ['lt', '妙计！末将这就点齐兵马！'],
      ['liubei', '敌军惯用偷袭，须得日夜提防。{g1}、{g2}、{g3}，轮流值守，不可松懈！'],
      ['zhongjiang', '（齐声）末将在！'],
    ],
    [
      ['g1', '主公，{boss}带{wan}万大军杀向{city}，扬言三日破城！'],
      ['liubei', '三日？当年赤壁一把火，八十万大军灰飞烟灭。兵贵在精，不在多！'],
      ['boss', '城头的守军听着，我{boss}纵横江上，从无敌手！'],
      ['g2', '主公，江边浅滩水流缓慢，正好阻敌，末将有把握！'],
      ['liubei', '好！{g1}、{g2}、{g3}各就各位，叫他三日破城变成三日大败！'],
      ['zhongjiang', '（齐声）得令！'],
    ],
  ],
  4: [
    [
      ['g1', '报——主公！{boss}率{wan}万大军翻山越岭，杀向{city}！'],
      ['liubei', '蜀道艰险，敌军远来疲惫，这正是我们的机会！'],
      ['boss', '哼！山高路远算什么！拿下{city}，蜀中大门便开了！'],
      ['liubei', '{g1}、{g2}、{g3}听令！'],
      ['zhongjiang', '（齐声）末将在！'],
      ['liubei', '占住高处要道，以逸待劳，守住{city}！'],
    ],
    [
      ['g1', '主公！{boss}命副将{lt}为先锋，{wan}万人马已过山口，直逼{city}！'],
      ['lt', '主将有令，午时之前必须攻到城下！弟兄们，加快脚步！'],
      ['boss', '{lt}是员猛将，有他开路，{city}指日可下！'],
      ['liubei', '敌将骄横，必有破绽。{g1}、{g2}、{g3}，各守险要，挫其锐气！'],
      ['zhongjiang', '（齐声）末将在！'],
    ],
    [
      ['g1', '主公，{boss}的{wan}万大军在{city}外的山谷里扎营，连绵十里！'],
      ['liubei', '定军山一战，黄老将军以逸待劳，阵斩敌将。今日我们也用此计！'],
      ['boss', '传我将令：明日一早，全军攻城！我倒要看看谁敢挡路！'],
      ['g3', '主公，末将已探明地形，山道狭窄，正好设伏！'],
      ['liubei', '好！{g1}、{g2}、{g3}听令，守住{city}，再立新功！'],
      ['zhongjiang', '（齐声）得令！'],
    ],
  ],
  5: [
    [
      ['g1', '报——丞相！{boss}率{wan}万大军，杀向{city}！'],
      ['zhuge', '来得正好。亮已在此等候多时，岂容他猖狂！'],
      ['boss', '诸葛亮！今日我{boss}亲自领兵，定叫你有去无回！'],
      ['zhuge', '{g1}、{g2}、{g3}听令！'],
      ['zhongjiang', '（齐声）末将在！'],
      ['zhuge', '依计行事，守住{city}，挫败{boss}！'],
    ],
    [
      ['g1', '丞相！{boss}派副将{lt}打头阵，{wan}万兵马已到{city}城外！'],
      ['lt', '弟兄们，建功立业就在今日，随我攻城！'],
      ['boss', '{lt}虽勇，还需小心诸葛亮的计谋……传令各营，步步为营！'],
      ['zhuge', '敌将谨慎，我们便诱他深入。{g1}、{g2}、{g3}，按八阵图方位布防！'],
      ['zhongjiang', '（齐声）末将在！'],
    ],
    [
      ['g1', '丞相，{boss}率{wan}万大军直逼{city}，来势汹汹！'],
      ['zhuge', '兵者，诡道也。他要速战，我偏要他寸步难行。'],
      ['boss', '众将士听令！蜀军粮草不多，拖不起！给我全力攻城！'],
      ['g2', '丞相放心，末将们早已严阵以待！'],
      ['zhuge', '好！{g1}、{g2}、{g3}各守要冲，叫敌军知道，蜀中无懈可击！'],
      ['zhongjiang', '（齐声）得令！'],
    ],
  ],
};

// 变量替换:text 模板({boss}/{lt}/{city}/{wan}/{g1..g3})。vars 必须覆盖模板里全部占位符,
// 漏填 → 字面 "undefined" 注入,由 storylines.test 门禁(/undefined/)拦截。
function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
}

// 统一访问器:样板关(story.script 手写)直通;生成关按章模板展开。
// level = levels.js 展开后的关卡(含 boss.name/lieutenants/camps[0].cityName/waveCount/difficulty/story);
// roster = unlockedGenerals(save) 的 Set。
export function storyContentFor(level, roster) {
  const st = level.story || {};
  if (st.script && st.narration) return { narration: st.narration, script: st.script.map((l) => ({ ...l })) };   // 浅拷贝防消费方写穿 CAMPAIGN 单例

  const [g1, g2, g3] = rollcall(roster);
  const vars = {
    boss: level.boss.name,
    lt: level.lieutenants[0].name,
    city: level.camps[0].cityName,
    wan: numToCn(wanOf(level)),
    g1: CAST[g1].name, g2: CAST[g2].name, g3: CAST[g3].name,
  };
  const whoMap = { g1, g2, g3, lt: level.lieutenants[0].id, boss: level.boss.id };

  const narrTmpl = NARR[level.chapter][level.id % 2];
  const scriptTmpl = SCRIPTS[level.chapter][level.id % 3];
  return {
    narration: fill(narrTmpl, vars),
    script: scriptTmpl.map(([who, text]) => ({ who: whoMap[who] || who, text: fill(text, vars) })),
  };
}
