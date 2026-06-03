// 第五战 · 荥阳追击（章末转折）  (Task B5 — original story script)
// 全原创中文对白，取材公有领域三国史/演义之骨：董卓焚洛阳、挟天子西迁长安，
//   关东诸侯各保实力、按兵酸枣；唯曹操力主西追，孤军至荥阳汴水，遭徐荣设伏大败，
//   赖部曲死战、典韦护主，方得脱身。outro 奠定其孤独而坚毅的枭雄基调，并引出第二章。
//   绝不抄录任何现代译本或商业游戏脚本/文案；著名独白以全新笔法另写，不照原句。
//
// step 类型（见 b1 范式 / scenarioRunner）：
//   { type:'narrate', text }                          旁白
//   { type:'say', who:<generalId>, text }             立绘对白（who ∈ GENERALS）
//   { type:'choice', prompt, options:[{text,setFlag}] } 分支
//   { type:'camera', preset|focus|zoom }              运镜
//   { type:'setFlag', flag:{...} }                    置旗
//   { type:'duel', a, b, forced }                     单挑（本战未用）
// who 必须为 data/generals.js 中的 canonical generalId。

export const STORY = {
  // ── 战前：洛阳焚天，诸侯观望，孤军西追 ──────────────────────────
  intro: {
    id: 'ch01_b5_intro',
    steps: [
      { type: 'camera', preset: 'cinematic' },
      { type: 'narrate', text: '初平元年春。董卓闻关东兵起，竟纵火焚洛阳，驱百万生民西迁长安。两百年帝都，一夕成焦土。' },
      { type: 'narrate', text: '火光映红半边天。酸枣大营里，十余路诸侯日日置酒高会，却无一人敢西向追贼。' },
      { type: 'say', who: 'caocao', text: '诸公举义兵以诛暴乱，今大众已合，何疑而不进？董卓焚宫室、劫天子，正是天亡之时——一战可定，奈何坐失！' },
      { type: 'narrate', text: '满座默然。有人低头饮酒，有人顾左右而言他。终究，无人应他这一声。' },
      { type: 'say', who: 'caocao', text: '……也罢。诸君既各有所惜，曹操便独往。哪怕只有我曹氏这数千部曲，也要叫董卓知道：这天下，还有人敢追。' },
      { type: 'camera', focus: { c: 3, r: 7 }, zoom: 1.1 },
      { type: 'say', who: 'xiahoudun', text: '兄长往哪里去，元让的刀就跟到哪里！这群只会喝酒的诸侯，让他们瞧瞧什么叫义师！' },
      { type: 'say', who: 'dianwei', text: '主公放心。典韦这双铁戟在前,任他西凉铁骑,也近不得主公半步。' },
      { type: 'say', who: 'caoren', text: '只是……兄长，孤军深入,粮道又长，西边地形我军不熟。子孝以为，当慎之又慎。' },
      { type: 'say', who: 'caocao', text: '我知此行凶险。可若人人都等一个万全,这逆贼便永无人讨。传令——衔枚疾进，直取成皋,追上董卓后军！' },
      { type: 'narrate', text: '于是曹操引军西出，过荥阳，抵汴水。两岸林木深密，丘陵起伏，焦道蜿蜒入谷——静得没有一丝鸟声。' },
      {
        type: 'choice',
        prompt: '汴水之畔，谷口幽深。前路凶吉未卜，孟德当如何进兵？',
        options: [
          { text: '全军压上，趁势追击', setFlag: { ch01_b5_started: true, pressPursuit: true } },
          { text: '稳住阵脚，缓缓而进', setFlag: { ch01_b5_started: true, cautiousAdvance: true } }
        ]
      },
      { type: 'camera', preset: 'iso' }
    ]
  },

  // ── 战后：虽败犹荣，枭雄独行，第二章引子 ────────────────────────
  outro: {
    id: 'ch01_b5_outro',
    steps: [
      { type: 'camera', preset: 'cinematic' },
      { type: 'narrate', text: '残兵且战且退，终是杀出谷口。点检之下，西来数千部曲，十去其六。汴水之上，浮尸蔽流。' },
      { type: 'say', who: 'caocao', text: '是我太急了。一念追贼，几乎把这些托命于我的儿郎，尽数葬送在这荥阳谷中。' },
      { type: 'say', who: 'xiahoudun', text: '兄长不必自责。诸侯按兵不动，独你一人敢追——便是败了，这一败，也比他们满营的酒气干净。' },
      { type: 'say', who: 'dianwei', text: '主公还在，曹家的旗就还在。死的弟兄，是为追贼而死，不是白死。' },
      { type: 'narrate', text: '曹操默立汴水之畔，望着西天那一片未熄的火光，久久不语。' },
      { type: 'say', who: 'caocao', text: '我曾以为，举一面义旗，天下豪杰自会景从。今日方知——这世道，没有谁会替你把刀举到底。' },
      { type: 'say', who: 'caocao', text: '路要自己走，贼要自己讨，连这条命，也得自己替自己担着。从今往后，我曹孟德宁可错负了这满座观望的诸侯，也绝不教这逆贼再焚一座城、再劫一回驾。' },
      { type: 'say', who: 'caoren', text: '兄长……往后，我们怎么办？' },
      { type: 'say', who: 'caocao', text: '回酸枣，但不久留。诸侯之盟，散在旦夕之间。乱世将至——与其求人,不如自强。我要去募一支只听我号令的兵，立一处真正属于自己的根基。' },
      { type: 'setFlag', flag: { ch01_b5_cleared: true, ch01_cleared: true, heroResolveAwakened: true } },
      { type: 'narrate', text: '荥阳一败，曹操声名反盛于诸侯——天下皆知，独此人敢以孤军追董。讨董之盟，不久果如其言而散。' },
      { type: 'narrate', text: '【第一章·起兵讨董 终】曹操东归，转图兖州。一个枭雄真正的霸业，自这场虽败犹荣的孤军之战，悄然启程。' },
      { type: 'camera', preset: 'iso' }
    ]
  },

  // ── 战场触发器 ────────────────────────────────────────────────
  //   回合 2：埋伏触发——徐荣伏兵尽出 + 董卓西遁过场；
  //   回合 4：悲壮护主——曹操中箭遇险，部曲死战、典韦断后。
  triggers: [
    { on: 'turnStart', turn: 2, scenarioId: 'ch01_b5_ambush' },
    { on: 'turnStart', turn: 4, scenarioId: 'ch01_b5_rescue' }
  ],

  // 触发器对应的临场演出（scenarioRunner 按 scenarioId 播放）
  scenarios: {
    // 埋伏触发：金鼓骤起，两翼林丘伏兵尽出；远景带过董卓西遁。
    ch01_b5_ambush: {
      id: 'ch01_b5_ambush',
      steps: [
        { type: 'camera', focus: { c: 4, r: 1 }, zoom: 1.2 },
        { type: 'narrate', text: '一声梆子响，谷中骤然金鼓大作。两岸林莽、丘陵之上，旌旗齐举——伏兵，竟早已候在这里！' },
        { type: 'say', who: 'xurong', text: '关东诸将，皆鼠辈耳。徐某在此恭候多时，倒真有一个送上门来的。曹孟德，这荥阳谷，便是你扬名……也是你葬身之地！' },
        { type: 'say', who: 'caocao', text: '中伏了。徐荣……董卓帐下，竟还藏着这般善战之将。元让、典韦，结阵！不可乱，乱则尽没！' },
        { type: 'camera', focus: { c: 3, r: 0 }, zoom: 1.0 },
        { type: 'narrate', text: '远处西天，烟尘滚滚——那是董卓的后军正护着天子车驾，从容西去，连头也不曾回。' },
        { type: 'narrate', text: '一道肥硕的身影立于车前，遥望着谷中混战，发出一声轻蔑的冷笑，旋即没入烟尘。' },
        { type: 'say', who: 'dongzhuo', text: '哼。关东群儿，也配追孤？让这姓曹的，把命留在荥阳吧。' },
        { type: 'say', who: 'xiahouyuan', text: '贼子居高临下，箭如雨发！兄长当心头顶——妙才掩护，全军向东南隘口收拢！' },
        { type: 'setFlag', flag: { ch01_b5_ambushSprung: true } },
        { type: 'camera', preset: 'iso' }
      ]
    },

    // 悲壮护主：曹操中流矢、坐骑被创，部曲死战夺路，典韦断后。
    ch01_b5_rescue: {
      id: 'ch01_b5_rescue',
      steps: [
        { type: 'camera', focus: { c: 3, r: 5 }, zoom: 1.25 },
        { type: 'narrate', text: '乱军之中，一支冷箭破空而至，正中曹操臂膀；坐骑亦被流矢所伤，长嘶人立，几将他掀落马下。' },
        { type: 'say', who: 'caocao', text: '无妨……区区一箭，伤不了曹孟德。儿郎们,莫管我，向东南——杀出去！' },
        { type: 'say', who: 'dianwei', text: '主公中箭了!都让开——典韦在此,谁也别想再近主公一步!' },
        { type: 'narrate', text: '典韦弃了战马,挺双铁戟立于焦道当中，硬生生用血肉之躯，截住了追杀而来的西凉铁骑。' },
        { type: 'say', who: 'caohong', text: '兄长快上我的马！子廉这条命不值什么——天下可以没有曹洪，不能没有兄长你啊！' },
        { type: 'say', who: 'caocao', text: '子廉……罢了，我记下了。元让护我两翼，典韦断后——能多带回一个弟兄，便是一个。撤！' },
        { type: 'narrate', text: '部曲们以身为墙，前仆后继，硬是在伏兵的合围里，替曹操凿开了一条通向东南隘口的血路。' },
        { type: 'setFlag', flag: { ch01_b5_caocaoWounded: true, ch01_b5_lastStand: true } },
        { type: 'camera', preset: 'iso' }
      ]
    }
  }
};

export default STORY;
