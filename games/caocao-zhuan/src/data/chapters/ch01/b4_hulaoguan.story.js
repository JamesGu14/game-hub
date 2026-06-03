// 第四战 · 虎牢关（三英战吕布）  (Task B4 — original story script)
// 全原创中文对白，取材公有领域三国史/演义之骨：诸侯进逼虎牢，吕布跃马当关、连挫数将，
// 张飞挺矛先斗、关羽舞刀夹攻、刘备拍马助阵，三英合战飞将，吕布力竭败走入关；
// 曹军趁势从侧翼破关。绝不抄录任何商业游戏脚本/文案。
//
// step 类型（见 b1_chenliu.story.js / scenarioRunner）：
//   { type:'narrate', text }                            旁白
//   { type:'say', who:<generalId>, text }               立绘对白
//   { type:'choice', prompt, options:[{text,setFlag}] } 分支
//   { type:'camera', preset|focus|zoom }                运镜
//   { type:'setFlag', flag:{...} }                      置旗
//   { type:'duel', a:<id>, b:<id>, forced:true }        强制单挑（三英战吕布即用此）
// who / duel.a / duel.b 必须为 data/generals.js 中的 canonical generalId。

export const STORY = {
  // ── 战前：虎牢关下，吕布当关 ──────────────────────────────
  intro: {
    id: 'ch01_b4_intro',
    steps: [
      { type: 'camera', preset: 'cinematic' },
      { type: 'narrate', text: '汜水关既破，联军长驱直抵虎牢。雄关锁路，箭楼森然，关下尘土未落，已是数面诸侯旌旗折损于此。' },
      { type: 'narrate', text: '关前校场，一骑赤兔如火，掠出阵来。马上之人顶束发金冠、披紫金连环铠，手中方天画戟寒光逼人——温侯吕布奉先。' },
      { type: 'say', who: 'lubu', text: '关东群鼠，也敢窥我虎牢？某在此立马半日，未见一个像样的对手。来——谁来送死，报上名来！' },
      { type: 'camera', focus: { c: 6, r: 1 }, zoom: 1.2 },
      { type: 'say', who: 'caocao', text: '此人便是吕布。三姓家奴，却有万夫不当之勇——联军连折数将，皆败于他戟下。' },
      { type: 'say', who: 'xiahoudun', text: '兄长，让元让去会他！我这条命早交了出来，便拿来填这道关也值。' },
      { type: 'say', who: 'caocao', text: '不可逞匹夫之勇。元让，你随我引主力取关墙侧翼——正面这飞将，自有人替我们挡住。' },
      { type: 'camera', focus: { c: 6, r: 8 }, zoom: 1.1 },
      { type: 'narrate', text: '联军阵后，三骑并出。当头者两耳垂肩、面如冠玉，乃平原刘备刘玄德;左右二将，一持青龙偃月，一挺丈八蛇矛，正是关羽、张飞。' },
      { type: 'say', who: 'zhangfei', text: '哥哥稍待！这等狂徒，何须哥哥动手——看俺老张先去捅他个透心凉！' },
      { type: 'say', who: 'guanyu', text: '三弟稍安。此人非寻常之辈，戟法刁钻，你切莫贪攻。我在侧策应，你我兄弟换着拖住他。' },
      { type: 'say', who: 'liubei', text: '虎牢之险，全系于此一人。我三人合力,挫其锐气;曹公侧翼破关,此战可成。二弟三弟——随我上!' },
      {
        type: 'choice',
        prompt: '关下尘土飞扬，吕布横戟相待。当如何破此雄关？',
        options: [
          { text: '三英缠住吕布，主力直取关门', setFlag: { ch01_b4_started: true, threeHeroesPlan: true } },
          { text: '弓弩齐压关墙，逼吕布退入关内', setFlag: { ch01_b4_started: true, suppressPlan: true } }
        ]
      },
      { type: 'camera', preset: 'iso' }
    ]
  },

  // ── 战后：吕布败走，虎牢门开 ──────────────────────────────
  outro: {
    id: 'ch01_b4_outro',
    steps: [
      { type: 'camera', preset: 'cinematic' },
      { type: 'narrate', text: '飞将力竭，赤兔回旋,吕布一声长啸,拨马退入关去。曹军趁其阵脚一乱，自侧翼涌上关墙，虎牢门轰然洞开。' },
      { type: 'say', who: 'zhangfei', text: '哪里走！这厮跑得比兔子还快——可惜让他溜了，没能割下他那颗狗头！' },
      { type: 'say', who: 'guanyu', text: '三弟休躁。今日三人方逼退他一人，已足见此獠之勇。来日方长，总有再会之时。' },
      { type: 'say', who: 'liubei', text: '胜负在势，不在一时之气。吕布虽退，虎牢已破，洛阳门户洞开——这便够了。' },
      { type: 'camera', focus: { c: 6, r: 0 }, zoom: 1.1 },
      { type: 'say', who: 'caocao', text: '三位壮士今日之勇，曹某亲眼所见，铭于五内。他日疆场，但愿是并肩,而非相向。' },
      { type: 'say', who: 'guanyu', text: '曹公言重。各为其主，今日同讨国贼，便是同道。' },
      { type: 'say', who: 'caocao', text: '关已破,洛阳在望。只是……董卓既知虎牢不守，只怕已生焚都西遁之念。诸君,莫教这老贼从容脱身。' },
      { type: 'setFlag', flag: { ch01_b4_cleared: true, ch01_b4_lubu_routed: true, guestsLeaving: true } },
      { type: 'narrate', text: '是夜，虎牢关头联军旗号猎猎。刘关张三英之名，自此战传遍诸侯;而曹操望向洛阳方向的眼神，却已无半分喜色。' },
      { type: 'camera', preset: 'iso' }
    ]
  },

  // ── 战场触发器：第 3 回合「三英战吕布」单挑序列启动 ──────────────
  // 与 map.triggers 同步；引擎按 on:'turnStart' & turn 派发 scenarioId。
  triggers: [
    { on: 'turnStart', turn: 3, scenarioId: 'ch01_b4_three_heroes' }
  ],

  // 触发器对应的临场演出：张飞 → 关羽 → 刘备 依次单挑吕布（车轮战）。
  // 吕布 curHp 跨三场持续累减（单挑结算 applyDuelOutcome 回写战场 HP）；
  // 三场后若吕布未被击毙，narrate 其力竭败走 + setFlag(ch01_b4_lubu_routed)，
  // 由集成层据此撤走/退场吕布；若中途被斩，victory.defeatLeader(lubu) 直接达成。
  scenarios: {
    ch01_b4_three_heroes: {
      id: 'ch01_b4_three_heroes',
      steps: [
        { type: 'camera', focus: { c: 6, r: 1 }, zoom: 1.25 },
        { type: 'narrate', text: '三通鼓罢，吕布横戟立马于校场之中。联军阵中,一员黑面虬髯的猛将再也按捺不住，挺矛拍马,直冲温侯而去。' },

        // —— 第一斗：张飞挺矛先战 ——
        { type: 'say', who: 'zhangfei', text: '三姓家奴！燕人张翼德在此，看矛！' },
        { type: 'say', who: 'lubu', text: '又是个不知死活的。也好——便拿你这条莽汉的血，给某的画戟开个荤！' },
        { type: 'duel', a: 'zhangfei', b: 'lubu', forced: true },
        { type: 'narrate', text: '两条枪戟搅作一团，连斗五十余合，势不相让。张飞越战越勇，吕布的戟势却已不复先前那般刁钻。' },

        // —— 第二斗：关羽舞刀夹攻 ——
        { type: 'say', who: 'guanyu', text: '三弟力乏，待为兄助你一臂！吕布,接关某一刀！' },
        { type: 'say', who: 'lubu', text: '哼，一个不够,又添一个?来得好——某倒要看看，你这把大刀有几分斤两!' },
        { type: 'duel', a: 'guanyu', b: 'lubu', forced: true },
        { type: 'narrate', text: '青龙偃月上下翻飞，与丈八蛇矛左右夹击。吕布以一敌二，戟走偏锋,渐渐只有招架之功,赤兔马也急得团团打转。' },

        // —— 第三斗：刘备拍马助阵，三英合围 ——
        { type: 'say', who: 'liubei', text: '二弟三弟稍退半步——我来!三人合力，今日便挫尽这飞将的威风!' },
        { type: 'say', who: 'lubu', text: '好,好!三个打一个,也算你们关东诸侯拿得出的本事!某……某今日记下了!' },
        { type: 'duel', a: 'liubei', b: 'lubu', forced: true },

        // —— 三斗之后：吕布力竭败走（若未被击毙）——
        { type: 'narrate', text: '三英环转,刀矛剑影裹住一人一骑。吕布虚晃一戟,荡开三般兵器,圈定赤兔,望关上飞驰而去——任凭三人在后呼喝,不敢再回身缠斗。' },
        { type: 'say', who: 'zhangfei', text: '呔!哪里逃!哥哥,二哥,追啊!' },
        { type: 'say', who: 'liubei', text: '穷寇莫追。他既退,关门便守不住了——传讯曹公，可从侧翼登关!' },
        { type: 'setFlag', flag: { ch01_b4_threeHeroesDone: true, ch01_b4_lubu_routed: true } },
        { type: 'camera', preset: 'iso' }
      ]
    }
  }
};

export default STORY;
