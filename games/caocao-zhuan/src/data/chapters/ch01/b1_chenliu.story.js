// 第一战 · 陈留起兵  (Task A4 — original story script)
// 全原创中文对白，取材公有领域三国史/演义之骨：曹操逃出洛阳、散家财、矫诏举义、
// 于陈留首倡讨董，初阵迎击黄巾残党。绝不抄录任何商业游戏脚本/文案。
//
// step 类型（见计划 §1.7）：
//   { type:'narrate', text }                         旁白
//   { type:'say', who:<generalId>, text }            立绘对白（who 取 appearance 生成立绘）
//   { type:'choice', prompt, options:[{text,setFlag}] } 分支（写 game.state.storyFlags）
//   { type:'camera', preset|focus|zoom }             运镜
//   { type:'setFlag', flag:{...} }                   直接置旗
// who 必须为 data/generals.js 中的 canonical generalId。

export const STORY = {
  // ── 战前：陈留散财、矫诏举义 ──────────────────────────────
  intro: {
    id: 'ch01_b1_intro',
    steps: [
      { type: 'camera', preset: 'cinematic' },
      { type: 'narrate', text: '中平末年，董卓挟天子以令天下，焚宫室、暴公卿，洛阳城内血未及干。' },
      { type: 'narrate', text: '一骑自西关连夜遁出，星驰至陈留——此人姓曹名操，字孟德。' },
      { type: 'say', who: 'caocao', text: '逆贼窃国，海内汹汹。我虽一介奔亡之身，岂能坐视社稷倾覆？' },
      { type: 'say', who: 'caocao', text: '陈留有孝廉之财，曹氏有忠义之众。散尽家赀，募天下豪杰——共讨此贼！' },
      { type: 'camera', focus: { c: 1, r: 6 }, zoom: 1.1 },
      { type: 'say', who: 'xiahoudun', text: '兄长一声号令，元让这条命便交与你。砍下董卓首级之前，我夏侯惇绝不回头！' },
      { type: 'say', who: 'caoren', text: '子孝已点齐宗族部曲，长枪三百、弓弩五十，只等孟德兄发兵。' },
      { type: 'say', who: 'caohong', text: '马也喂饱了，刀也磨亮了——子廉的快马，第一个杀进贼阵！' },
      { type: 'say', who: 'xiahouyuan', text: '妙才已据南面土丘。但凡贼子露头，我这一箭，定叫他过不了河。' },
      { type: 'narrate', text: '正商议间，斥候飞报：城东北有黄巾残党盘踞,劫掠乡里、断我粮道，倚关门林莽立寨。' },
      { type: 'say', who: 'yt_capt', text: '哈哈！什么讨董义师,不过是几个想搏个功名的狂徒。儿郎们，把这股送上门的肥肉吃了！' },
      { type: 'say', who: 'caocao', text: '黄巾未平，国难方殷。诸君，便以此寨为我义旗第一血——传令，进兵！' },
      {
        type: 'choice',
        prompt: '陈留城下，三军待发。曹孟德，可愿首倡大义？',
        options: [
          { text: '起兵！讨贼以正天下', setFlag: { ch01_b1_started: true, raisedBanner: true } },
          { text: '先扫黄巾，再图董卓', setFlag: { ch01_b1_started: true, clearYellowFirst: true } }
        ]
      },
      { type: 'camera', preset: 'iso' }
    ]
  },

  // ── 战后:首阵告捷、义旗初张 ──────────────────────────────
  outro: {
    id: 'ch01_b1_outro',
    steps: [
      { type: 'camera', preset: 'cinematic' },
      { type: 'narrate', text: '残阳如血。黄巾贼众溃散于林泽之间，关门易帜,陈留之围已解。' },
      { type: 'say', who: 'xiahoudun', text: '痛快!兄长你看,这帮乌合之众,经不起咱们曹家儿郎一冲。' },
      { type: 'say', who: 'caoren', text: '清点了:贼寨存粮可充军用，乡民亦多有来投。首战不亏。' },
      { type: 'say', who: 'caocao', text: '黄巾不过疥癣，董卓方是腹心之患。此一胜，是叫天下人看见——讨贼,有人敢先举旗。' },
      { type: 'say', who: 'xiahouyuan', text: '听说各路诸侯已在酸枣会盟，独缺一面响亮的旗号。' },
      { type: 'say', who: 'caocao', text: '那便去会一会这些英雄。曹孟德的旗，今日起,插向洛阳。' },
      { type: 'setFlag', flag: { ch01_b1_cleared: true } },
      { type: 'narrate', text: '是夜，曹操传檄诸郡,陈大义于天下。十八路诸侯之名，自此渐起。' },
      { type: 'camera', preset: 'iso' }
    ]
  },

  // ── 战场触发器:第 3 回合黄巾援军自关门杀出 ──────────────────
  triggers: [
    { on: 'turnStart', turn: 3, scenarioId: 'ch01_b1_reinforce' }
  ],

  // 触发器对应的临场小演出(由 scenarioRunner 按 scenarioId 播放)
  scenarios: {
    ch01_b1_reinforce: {
      id: 'ch01_b1_reinforce',
      steps: [
        { type: 'camera', focus: { c: 7, r: 0 }, zoom: 1.2 },
        { type: 'say', who: 'yt_capt', text: '想破我关寨?没那么容易!关后的弟兄,随我压上——踏平这群乳臭未干的!' },
        { type: 'say', who: 'caocao', text: '困兽犹斗。元让、子廉,稳住阵脚,莫教他冲乱了渡口！' },
        { type: 'say', who: 'xiahouyuan', text: '正合我意。贼帅既出关门，便在我箭程之内了。' },
        { type: 'setFlag', flag: { ch01_b1_reinforced: true } },
        { type: 'camera', preset: 'iso' }
      ]
    }
  }
};

export default STORY;
