// 第三战 · 汜水关  (Task B3 — original story script)
// 全原创中文对白,取材公有领域三国史/演义之骨:联军进逼汜水关,华雄出关耀武、连挫
// 联军大将;一员不知名的下级将校(关羽)请缨,温酒未冷而斩华雄于关下——此节以「友军侧
// 战报/远景过场」带过,曹军主视角不直演其细节,只闻马蹄、鼓噪与捷报。曹军则趁势自侧翼
// 强攻关门破之。绝不抄录任何商业游戏脚本/文案,对白与叙述全部重写。
//
// step 类型（见 b1 范式 / scenarioRunner）：
//   { type:'narrate', text }                            旁白
//   { type:'say', who:<generalId>, text }               立绘对白（who 取 appearance 生成立绘）
//   { type:'choice', prompt, options:[{text,setFlag}] }  分支（写 game.state.storyFlags）
//   { type:'camera', preset|focus|zoom }                运镜
//   { type:'setFlag', flag:{...} }                      直接置旗
// who 必须为 data/generals.js 中的 canonical generalId（友军斩华雄者为下级校尉,不出立绘,以旁白带过）。

export const STORY = {
  // ── 战前:联军进逼汜水关,华雄出关挑衅 ──────────────────────────
  intro: {
    id: 'ch01_b3_intro',
    steps: [
      { type: 'camera', preset: 'cinematic' },
      { type: 'narrate', text: '十八路诸侯西进,前锋直抵汜水关下。此关倚山扼水,一夫当道,实为入洛阳之锁钥。' },
      { type: 'narrate', text: '董卓遣骁将华雄领西凉精兵据守。华雄者,身长九尺,猿臂善射,西凉军中号为「虎将」。' },
      { type: 'camera', focus: { c: 4, r: 1 }, zoom: 1.2 },
      { type: 'say', who: 'huaxiong', text: '关上的诸侯听着——华某在此!尔等乌合之众,也敢窥探我西凉天险?' },
      { type: 'say', who: 'huaxiong', text: '昨日已斩尔联军两员上将,首级正悬于关楼。今日谁再来送死,华某的刀,正好饮血!' },
      { type: 'narrate', text: '关楼之上,果悬联军大将首级两颗,血犹未干。盟军营中,一时人人变色,竟无人敢应。' },
      { type: 'camera', focus: { c: 4, r: 6 }, zoom: 1.1 },
      { type: 'say', who: 'caocao', text: '诸侯惧其凶名,皆按兵不前。可叹会盟数十万众,竟被一关一将,扼住了咽喉。' },
      { type: 'say', who: 'xiahoudun', text: '兄长,正面硬撼那华雄,纵胜也是惨胜。莫如让正面诸侯去缠住他——' },
      { type: 'say', who: 'caocao', text: '——而我曹军,自侧翼桥道分两路,直取关门!华雄一人,守不住两面。' },
      { type: 'say', who: 'caoren', text: '子孝愿领一军走西桥。只是那壕沟两道窄桥,西凉枪手扼口,怕要恶战。' },
      { type: 'say', who: 'xiahouyuan', text: '东南土丘已被妙才占下。桥上但有西凉兵冒头,先吃我一轮箭再说。' },
      {
        type: 'choice',
        prompt: '汜水关下,鼓声未歇。曹孟德,这一战如何破关?',
        options: [
          { text: '分进两桥,抢登关门夺关', setFlag: { ch01_b3_started: true, flankGate: true } },
          { text: '先以弓弩压制,缓步推进', setFlag: { ch01_b3_started: true, suppressFirst: true } }
        ]
      },
      { type: 'camera', preset: 'iso' }
    ]
  },

  // ── 战后:侧翼破关,关楼易帜;友军斩华雄之捷报随风传来 ──────────────
  outro: {
    id: 'ch01_b3_outro',
    steps: [
      { type: 'camera', preset: 'cinematic' },
      { type: 'narrate', text: '曹军两路同登关门,西凉守卒夹击不支,溃退入关。汜水关侧翼,自此洞开。' },
      { type: 'say', who: 'caoren', text: '关门已破!子孝这一路虽折了些弟兄,到底把这天险踏在脚下了。' },
      { type: 'narrate', text: '正清点间,关前正面忽起一阵山呼海啸般的喝彩——盟军大营那头,锣鼓喧天。' },
      { type: 'narrate', text: '斥候飞马来报:盟军帐中,一员名不见经传的下级校尉请缨出战,众诸侯多有轻之者。' },
      { type: 'narrate', text: '那校尉只道「酒且斟下,某去便回」。马蹄声起,鼓声未及三通——他已提华雄首级掷于帐中,杯中之酒,尚温!' },
      { type: 'say', who: 'caocao', text: '温酒未冷,而斩骁将于万军之前……天下竟有如此人物?其名为何?' },
      { type: 'say', who: 'xiahoudun', text: '说是某路诸侯帐下一个马弓手,姓关,名羽。这般好身手,埋没在马弓手里,可惜了。' },
      { type: 'say', who: 'caocao', text: '记下这个名字。乱世之中,英雄不问出身——他日若得此等人为我所用,何愁大事不成。' },
      { type: 'setFlag', flag: { ch01_b3_cleared: true, sawGuanyuFeat: true } },
      { type: 'narrate', text: '汜水关既破,联军大举西进。然真正的拦路虎,正勒马于下一座雄关之上——其名,虎牢。' },
      { type: 'camera', preset: 'iso' }
    ]
  },

  // ── 战场触发器 ──────────────────────────────────────────────
  //   第 2 回合:华雄出关挑衅,西凉骑兵压上(战中挑衅事件)
  //   第 4 回合:友军侧正面受挫的战报(联军大将折损,曹军独力支撑)
  triggers: [
    { on: 'turnStart', turn: 2, scenarioId: 'ch01_b3_huaxiong_taunt' },
    { on: 'turnStart', turn: 4, scenarioId: 'ch01_b3_ally_setback' }
  ],

  // 触发器对应的临场小演出（由 scenarioRunner 按 scenarioId 播放）
  scenarios: {
    // 华雄挑衅
    ch01_b3_huaxiong_taunt: {
      id: 'ch01_b3_huaxiong_taunt',
      steps: [
        { type: 'camera', focus: { c: 4, r: 1 }, zoom: 1.25 },
        { type: 'say', who: 'huaxiong', text: '哼,几个想抄我后路的偏师?也敢登我汜水关!' },
        { type: 'say', who: 'huaxiong', text: '西凉的儿郎们——压上去!教这群曹家兵,死在这壕沟桥头!' },
        { type: 'say', who: 'caocao', text: '困不住正面,便来吓我侧翼?华雄,你越是张狂,越是说明这关,你守不住了。' },
        { type: 'setFlag', flag: { ch01_b3_taunted: true } },
        { type: 'camera', preset: 'iso' }
      ]
    },

    // 联军大将受挫的战报事件（友军侧远景过场,曹军视角只闻战报）
    ch01_b3_ally_setback: {
      id: 'ch01_b3_ally_setback',
      steps: [
        { type: 'camera', preset: 'cinematic' },
        { type: 'narrate', text: '关前正面方向,忽闻败鼓声乱。一骑浴血奔回,滚鞍下马:盟军又一员大将,被华雄阵斩于关下!' },
        { type: 'say', who: 'caoren', text: '又折了一员!那华雄竟如此了得……正面诸侯怕是再不敢轻易叩关了。' },
        { type: 'say', who: 'caocao', text: '正面越是顿挫,我侧翼越要急进。诸君,趁华雄分身乏术——抢登关门,就在此时!' },
        { type: 'say', who: 'xiahouyuan', text: '妙才的箭壶还满着。前头但凡挡路的,一个都过不去。' },
        { type: 'setFlag', flag: { ch01_b3_allySetback: true } },
        { type: 'camera', preset: 'iso' }
      ]
    },

    // 破关台词（站上关门夺关时的曹军演出;由流程在 capture 达成时按需播放）
    ch01_b3_gate_break: {
      id: 'ch01_b3_gate_break',
      steps: [
        { type: 'camera', focus: { c: 4, r: 0 }, zoom: 1.2 },
        { type: 'say', who: 'caoren', text: '登上去了!关门是我们的了——把曹军的旗,插上汜水关楼!' },
        { type: 'say', who: 'caocao', text: '好!天险天险,守在死人手里便不是险。传令各路:破关之功,曹军先得一份!' },
        { type: 'setFlag', flag: { ch01_b3_gateBroken: true } },
        { type: 'camera', preset: 'iso' }
      ]
    }
  }
};

export default STORY;
