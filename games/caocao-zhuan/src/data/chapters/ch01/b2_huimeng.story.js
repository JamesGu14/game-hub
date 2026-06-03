// 第二战 · 会盟酸枣  (Task B2 — original story script)
// 全原创中文对白，取材公有领域三国史/演义之骨：关东诸侯会盟酸枣讨董、推袁绍为盟主、
// 联军貌合神离日置酒高会而不进兵、曹操独倡进取、谋士荀彧/戏志才来投、先锋遭遇董卓军。
// 绝不抄录任何现代译本或商业游戏脚本/文案。
//
// step 类型（同 b1_chenliu.story.js / scenarioRunner）：
//   { type:'narrate', text }                            旁白
//   { type:'say', who:<generalId>, text }               立绘对白（who 取 appearance 生成立绘）
//   { type:'choice', prompt, options:[{text,setFlag}] }  分支（写 game.state.storyFlags）
//   { type:'camera', preset|focus|zoom }                运镜
//   { type:'setFlag', flag:{...} }                      直接置旗
// who 必须为 data/generals.js 中的 canonical generalId。

export const STORY = {
  // ── 战前：酸枣会盟、诸侯推诿、曹操献策、谋士来投 ─────────────────
  intro: {
    id: 'ch01_b2_intro',
    steps: [
      { type: 'camera', preset: 'cinematic' },
      { type: 'narrate', text: '初平元年春，关东州郡共举义旗，十余路诸侯屯兵酸枣，推渤海袁绍为盟主，歃血而盟，誓诛董卓。' },
      { type: 'narrate', text: '旌旗连营三十里，金鼓震野。曹操引陈留之众至此会盟，本以为天下忠义聚于一处，自此可长驱洛阳。' },
      { type: 'say', who: 'caocao', text: '诸侯云集，兵甲十万。董卓虽暴，岂能当此堂堂之阵？' },
      { type: 'narrate', text: '然连日所见，却是大营之中日日置酒高会，各路兵马按辔不前，互相观望，无一人肯先渡汴水半步。' },
      { type: 'camera', focus: { c: 4, r: 8 }, zoom: 1.1 },
      { type: 'say', who: 'xiahoudun', text: '兄长！这帮诸侯，盟誓时一个比一个慷慨，临阵却一个比一个惜命。说是讨董，倒像是来赴宴的。' },
      { type: 'say', who: 'caoren', text: '酒过三巡，话尽是论功劳、争位次。问及进兵之期，便都推说粮草未齐、地利未明。' },
      { type: 'say', who: 'caocao', text: '董卓焚烧宫室、迁都长安在即，正是天亡之时。我等举大众而疑，失其势矣。' },
      // ── 谋士登场：荀彧、戏志才来投，献进取之策 ──
      { type: 'narrate', text: '正忧愤间，帐外通报：颍川荀彧、戏志才二士闻孟德首倡大义，弃绍来投。' },
      { type: 'camera', focus: { c: 4, r: 8 }, zoom: 1.2 },
      { type: 'say', who: 'xunyu', text: '彧观袁本初外宽内忌、好谋无决，终不能成大事。能拨乱定危者，唯将军耳，故来相投。' },
      // 荀彧献策台词
      { type: 'say', who: 'xunyu', text: '诸侯逗留观望，正堕董卓之计。为今之计，宜遣一军先据汴水浅滩，扼其要津、试其虚实——锋芒一现，怯者自不敢南顾，勇者方肯继进。' },
      { type: 'say', who: 'xizhicai', text: '志才以为然。彼董卓恃强，必遣先锋来探。将军若能挫其前锋于水上，则联军之气可振，进退之机在我矣。' },
      { type: 'say', who: 'caocao', text: '二位之言，正合我意！与其在营中坐看人争座次，不如以一战定军心。' },
      { type: 'narrate', text: '斥候飞报：董卓军先锋已渡汴水北岸列阵，西凉步骑倚林据滩，正窥联军虚实。' },
      { type: 'say', who: 'dz_van', text: '哼，关东鼠辈，会盟数十日不敢越雷池一步。相国早料定尔等是群乌合——某今日便来会会，谁是真要送死的！' },
      {
        type: 'choice',
        prompt: '汴水之南，诸侯按兵不动。曹孟德，是与众观望，还是独引一军先发？',
        options: [
          { text: '独引先锋，挫其锐气！', setFlag: { ch01_b2_started: true, leadVanguard: true } },
          { text: '据滩列阵，以战振军心', setFlag: { ch01_b2_started: true, holdFord: true } }
        ]
      },
      { type: 'camera', preset: 'iso' }
    ]
  },

  // ── 战后：先锋告捷、联军依旧迁延、转入下一战引子 ────────────────
  outro: {
    id: 'ch01_b2_outro',
    steps: [
      { type: 'camera', preset: 'cinematic' },
      { type: 'narrate', text: '汴水浅滩血染半流。董卓军先锋大溃北遁，弃旗鼓辎重于水上，曹军先锋一战立威于诸侯之前。' },
      { type: 'say', who: 'xiahoudun', text: '痛快！西凉兵也不过如此。兄长这一仗打出去，看谁还敢说咱们陈留之众是来凑数的！' },
      { type: 'say', who: 'xizhicai', text: '前锋既破，正可乘胜西进。然恐诸侯仍狃于安逸，不肯随行——将军之锐，怕又要为人作嫁了。' },
      { type: 'say', who: 'caocao', text: '果如志才所料。捷报传回大营，诸侯交口称善，却仍是宴饮如故，竟无一人请缨。' },
      { type: 'say', who: 'xunyu', text: '将军不必怒。义之所在，不计众寡。彼等可待，董卓不可待——汜水关已在前，破关西向，洛阳可望。' },
      { type: 'say', who: 'caocao', text: '说得好。旁人观望，我自向前。传令前锋，整备粮械，兵指汜水关！' },
      // 典韦本战后投奔（剧情加入，由集成流程读取后 push 进 roster）
      { type: 'narrate', text: '是役之后，陈留人典韦提双戟来投。其人壮猛绝伦，一人可当数十，曹操大喜，留为帐前护卫。' },
      { type: 'say', who: 'dianwei', text: '某典韦，平生只服肯向前的人。将军既敢独战西凉，这双戟，从今日起便替将军挡在阵前！' },
      { type: 'setFlag', flag: { ch01_b2_cleared: true, joinXunyu: true, joinXizhicai: true, joinDianwei: true } },
      { type: 'narrate', text: '联军屯酸枣终日逗留，卒无西进；唯曹操一军，整旅孤行，向汜水关而去。' },
      { type: 'camera', preset: 'iso' }
    ]
  },

  // ── 战场触发器：第 3 回合「诸侯按兵不动」的讽刺事件 ────────────────
  triggers: [
    { on: 'turnStart', turn: 3, scenarioId: 'ch01_b2_standoff' }
  ],

  // 触发器对应的临场小演出（由 scenarioRunner 按 scenarioId 播放）
  scenarios: {
    ch01_b2_standoff: {
      id: 'ch01_b2_standoff',
      steps: [
        { type: 'camera', focus: { c: 4, r: 8 }, zoom: 1.15 },
        { type: 'narrate', text: '战正酣处，南望联军大营——旌旗连云，却阒然不动。营中隐隐传来丝竹欢呼之声，竟是诸侯仍在置酒赏功，无一兵一卒渡水来援。' },
        { type: 'say', who: 'caoren', text: '兄长！咱们在前头浴血，他们在后头喝酒。这十八路诸侯，竟连一支接应都不肯派！' },
        { type: 'say', who: 'caocao', text: '（按剑冷笑）所谓会盟者，原是各为其私。罢了——既无人肯助，便看我曹氏儿郎，独取此功！' },
        { type: 'say', who: 'xunyu', text: '将军息怒。彼坐观成败，正可成将军独擅之名。今日血战，他日皆为将军立威之资——只管向前。' },
        { type: 'setFlag', flag: { ch01_b2_standoff_seen: true } },
        { type: 'camera', preset: 'iso' }
      ]
    }
  }
};

export default STORY;
