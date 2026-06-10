// tools/gen-sprites.mjs — [P6] 战场 sprite 生成器（OpenRouter / google/gemini-2.5-flash-image · Nano Banana）。
// 自含铁律：key 经 env 传，绝不落盘。以黄忠为风格锚 → 参考图链式生成保整套画风一致。
// 用法：OPENROUTER_API_KEY=sk-or-... node tools/gen-sprites.mjs            # 全套
//      OPENROUTER_API_KEY=sk-or-... node tools/gen-sprites.mjs zhang guan  # 仅指定 id（用已存黄忠当锚）
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) { console.error('✗ 需要 env OPENROUTER_API_KEY'); process.exit(1); }

const OUT = path.resolve('assets/sprites');
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash-image';

const STYLE = '近正俯视 3/4 视角的半写实卡通塔防游戏单位立绘，厚描边，暖色调，类似《王国保卫战 Kingdom Rush》的精细卡通游戏美术。正方形构图，全身站姿，角色居中，脚底位于画面底部中线，纯透明背景，无地面、无阴影、无文字、无边框。';
const STYLE_BUILDING = '近正俯视 3/4 视角的半写实卡通塔防游戏建筑立绘，厚描边，暖色调，类似《王国保卫战 Kingdom Rush》的精细卡通游戏美术。正方形构图，建筑单体居中，底边贴画面底部中线，纯透明背景，无地面、无阴影、无任何文字，旗帜一律纯色无字。';
const styleOf = (u) => (u.cat === 'buildings' ? STYLE_BUILDING : STYLE);

// v1 南蛮核心集：6 将（蜀汉，玩家方）+ 3 兵 + 2 BOSS（南蛮，敌方）。锚 = huang。
const UNITS = [
  { cat: 'generals', id: 'huang', anchor: true, desc: '三国蜀汉五虎上将·黄忠：年迈老将，花白长须，金色鳞甲，手持长弓，威风凛凛。' },
  { cat: 'generals', id: 'zhang', desc: '三国蜀汉五虎上将·张飞：豹头环眼，虬髯如戟，黝黑魁梧，身披黑甲，怒目圆睁。【武器必须准确】手持「丈八蛇矛」——一杆极长的长枪/长矛，矛尖是青亮的蛇形波浪曲刃（蜿蜒弯曲如蛇身/火焰状），绝不是直枪尖。' },
  { cat: 'generals', id: 'guan', desc: '三国蜀汉五虎上将·关羽：面如重枣的红脸，长髯及胸，丹凤眼卧蚕眉，绿色战袍配金甲，威严。【武器必须准确】手持「青龙偃月刀」——一柄长柄大刀（关刀/偃月刀，polearm glaive）：长木柄顶端装一片宽大的弯月形大刀刃，刀背带青龙纹、柄端有红缨；绝不是普通单手刀或剑。' },
  { cat: 'generals', id: 'zhao', desc: '三国蜀汉五虎上将·赵云：年轻俊朗，白袍银甲，手持银枪，英姿飒爽。' },
  { cat: 'generals', id: 'ma', desc: '三国蜀汉五虎上将·马超：西凉锦马超，兽面狮盔，银甲白袍，手持长枪，英武剽悍。' },
  { cat: 'generals', id: 'zhuge', desc: '三国蜀汉军师·诸葛亮：儒雅智者，长须，身穿八卦纹道袍，无甲。【形象必须准确·羽扇纶巾，两样缺一不可】头戴「纶巾」（青色丝帛软头巾/绑带式头巾，不是硬官帽）；【关键·不可空手】一只手必须明显握着一把展开的白色羽毛扇（羽扇/鹅毛扇），羽扇要清晰可见地拿在手中。' },
  { cat: 'enemies', id: 'nanman_footman', desc: '南蛮步兵（敌军小兵）：赤膊配兽皮，持木盾与短矛，凶悍粗野。' },
  { cat: 'enemies', id: 'wolf', desc: '南蛮狼骑（敌军）：骑乘巨狼的轻装蛮族骑兵，持短矛，野性。' },
  { cat: 'enemies', id: 'tengjia', desc: '南蛮藤甲兵（敌军）：身披藤条编织的厚重藤甲，持藤盾，刀枪难入的重步兵。' },
  { cat: 'bosses', id: 'mulu', desc: '南蛮王·木鹿大王（BOSS）：驱役猛兽的南蛮祭司大王，华丽羽饰与兽骨装束，威严神秘，体型高大。' },
  { cat: 'bosses', id: 'wutugu', desc: '南蛮王·兀突骨（BOSS）：身高丈二的魁梧藤甲巨汉，凶猛粗野，体型壮硕。' },
  // —— 检查点A v2：6 样板战主将 + 3 敌兵（曹魏/东吴敌方；锚=huang 保画风一致）——
  { cat: 'bosses', id: 'xiahoudun', desc: '三国曹魏名将·夏侯惇（敌方武将BOSS）：独眼猛将，一只眼戴黑色眼罩，络腮短须，玄黑铁甲配暗红战袍，手持长枪，威猛凶悍，体型高大。' },
  { cat: 'bosses', id: 'zhangliao', desc: '三国曹魏名将·张辽（敌方武将BOSS）：威风凛凛的沙场宿将，银亮铠甲配深蓝战袍，手持长戟，目光锐利、气度沉稳，体型高大。' },
  { cat: 'bosses', id: 'caocao', desc: '三国曹魏之主·曹操（敌方主帅BOSS）：枭雄霸气，头戴王者金边冠冕，玄红龙纹华丽战袍配金甲，手按腰间宝剑，威严睥睨、气场强大，体型高大。' },
  { cat: 'bosses', id: 'xiahouyuan', desc: '三国曹魏名将·夏侯渊（敌方武将BOSS）：神行疾射的猛将，土黄轻甲劲装，背负强弓、手持长枪，矫健剽悍，体型高大。' },
  { cat: 'bosses', id: 'luxun', desc: '三国东吴儒将·陆逊（敌方都督BOSS）：年轻俊秀的书生大都督，束发戴冠，青绿文士袍配轻甲，手持宝剑，儒雅中带锐气，身后隐有淡淡火光。' },
  { cat: 'bosses', id: 'simayi', desc: '三国曹魏军师·司马懿（敌方终极BOSS）：深沉老谋的权臣军师，玄黑深紫长袍配暗金纹饰，头戴文士冠，手持羽扇，阴鸷睿智、气场威严压迫，体型高大。' },
  { cat: 'enemies', id: 'heavy', desc: '三国重装甲士（敌军重步兵）：身披厚重铁甲铁盔的魁梧重步兵，持大盾与长柄重兵器，坚不可摧、移动缓慢，体型壮硕。' },
  { cat: 'enemies', id: 'flyer', desc: '三国军用斥候战鹰（敌军飞行单位）：一只展翅翱翔的威猛战鹰/猎隼，利爪锐目，双翼张开作盘旋俯冲姿态（空中斥候）。' },
  { cat: 'enemies', id: 'shaman', desc: '三国随军术士方士（敌军辅助）：身披道袍头戴道冠的随军术士，手持桃木法杖与符箓作施法疗伤姿态，周身淡淡灵气光晕。' },
  // —— 检查点A v2 第二批：12 生成关主将 ——
  { cat: 'bosses', id: 'huaxiong', desc: '三国猛将·华雄（敌方武将BOSS）：董卓麾下骁将，魁梧凶悍，深色重甲配赤红战袍，手持阔背大刀，气势汹汹，体型高大。' },
  { cat: 'bosses', id: 'lvbu', desc: '三国第一猛将·吕布（敌方强力BOSS）：英武绝伦的飞将，头戴束发金冠插雉鸡翎，华丽兽面金甲，手持「方天画戟」（长柄、戟头带左右双月牙利刃），威风凛凛，体型高大。' },
  { cat: 'bosses', id: 'menghuo', desc: '南蛮王·孟获（敌方武将BOSS）：南蛮首领，赤膊披兽皮金饰，头戴羽冠兽骨饰，手持阔身蛮刀，粗犷威猛，体型壮硕。' },
  { cat: 'bosses', id: 'yanliang', desc: '三国名将·颜良（敌方武将BOSS）：袁绍麾下河北名将，魁梧勇猛，银亮重甲配墨绿战袍，手持长柄大刀，威风凛凛，体型高大。' },
  { cat: 'bosses', id: 'wenchou', desc: '三国名将·文丑（敌方武将BOSS）：袁绍麾下河北猛将，孔武有力，玄铁铠甲配深紫战袍，手持长枪，悍勇粗豪，体型高大。' },
  { cat: 'bosses', id: 'sunquan', desc: '三国东吴之主·孙权（敌方主帅BOSS）：碧眼紫髯的少年君主，头戴王冠，青碧华丽王袍配金纹轻甲，手按腰间宝剑，英气勃发、气场威严，体型高大。' },
  { cat: 'bosses', id: 'ganning', desc: '三国东吴猛将·甘宁（敌方武将BOSS）：锦帆游侠出身的悍将，腰悬铜铃，青碧轻甲配锦袍羽饰，手持环首长刀，剽悍豪迈，体型高大。' },
  { cat: 'bosses', id: 'zhangren', desc: '三国益州名将·张任（敌方武将BOSS）：忠勇善射的蜀地将领，土黄皮甲配深褐战袍，背负强弓、手持长枪，沉稳刚毅，体型高大。' },
  { cat: 'bosses', id: 'caoren', desc: '三国曹魏名将·曹仁（敌方武将BOSS）：稳如磐石的曹氏宗族大将，厚重玄黑铁甲配暗红战袍，手持长枪、负大盾，沉稳坚毅，体型壮硕高大。' },
  { cat: 'bosses', id: 'zhanghe', desc: '三国曹魏名将·张郃（敌方武将BOSS）：用兵巧变的沙场宿将，银白精甲配深蓝战袍，手持长枪，老练锐利，体型高大。' },
  { cat: 'bosses', id: 'xuchu', desc: '三国曹魏猛将·许褚（敌方武将BOSS）：人称「虎痴」的魁梧力士，赤膊束兽皮甲，肌肉虬结，手持阔身大刀，凶猛粗豪，体型极壮硕高大。' },
  { cat: 'bosses', id: 'zhuran', desc: '三国东吴名将·朱然（敌方武将BOSS）：夷陵之战的东吴大将，青碧铠甲配锦袍，手持长刀，沉着干练，体型高大。' },
  // —— 检查点A v2 第二批：12 副将（冷门名将，体型中等，hpMult 较低）——
  { cat: 'bosses', id: 'lidian', desc: '三国曹魏将领·李典（敌方副将）：儒雅持重的青年将领，玄色轻甲配蓝灰战袍，手持长枪，沉稳干练，中等体型。' },
  { cat: 'bosses', id: 'yuejin', desc: '三国曹魏将领·乐进（敌方副将）：身材精悍的先登猛将，玄红轻甲，手持短戟与单刀，迅捷凶悍，中等体型。' },
  { cat: 'bosses', id: 'yujin', desc: '三国曹魏将领·于禁（敌方副将）：治军严整的老成将领，玄黑铠甲配深灰战袍，手持长枪，肃穆刚直，中等体型。' },
  { cat: 'bosses', id: 'caohong', desc: '三国曹魏将领·曹洪（敌方副将）：曹氏宗族悍将，玄铁甲配暗红战袍，手持环首大刀，粗豪勇猛，中等偏壮体型。' },
  { cat: 'bosses', id: 'caoxiu', desc: '三国曹魏将领·曹休（敌方副将）：曹氏宗族青年骁将，玄红轻甲，手持长枪，英武干练，中等体型。' },
  { cat: 'bosses', id: 'niujin', desc: '三国曹魏将领·牛金（敌方副将）：悍勇敢战的偏将，土褐皮甲配玄色战袍，手持长矛，粗犷剽悍，中等体型。' },
  { cat: 'bosses', id: 'zhoutai', desc: '三国东吴将领·周泰（敌方副将）：身上多处战伤疤痕的忠勇虎将，青碧轻甲半敞露出伤疤，手持环刀，悍不畏死，中等偏壮体型。' },
  { cat: 'bosses', id: 'jiangqin', desc: '三国东吴将领·蒋钦（敌方副将）：江东水军将领，青蓝轻甲配锦带，手持长刀，干练豪爽，中等体型。' },
  { cat: 'bosses', id: 'dingfeng', desc: '三国东吴将领·丁奉（敌方副将）：勇猛善战的老将，青碧皮甲配深蓝战袍，手持短兵刀盾，剽悍坚毅，中等体型。' },
  { cat: 'bosses', id: 'xusheng', desc: '三国东吴将领·徐盛（敌方副将）：智勇兼备的江东将领，青绿轻甲，手持长枪，沉着锐利，中等体型。' },
  { cat: 'bosses', id: 'panzhang', desc: '三国东吴将领·潘璋（敌方副将）：性烈骁勇的吴将，墨绿轻甲配锦袍，手持长刀，粗豪悍勇，中等体型。' },
  { cat: 'bosses', id: 'handang', desc: '三国东吴老将·韩当（敌方副将）：历经三世的江东宿将，花白须发，青碧铠甲配锦袍，手持长弓与佩刀，老练沉稳，中等体型。' },
  // —— [城堡美化] 建筑：势力敌营城堡 + 成都（蛮款待南蛮关卡时再生成，见 spec §3/§8）——
  { cat: 'buildings', id: 'wei', desc: '三国曹魏军镇城堡（敌方据点）：玄黑砖石城墙与垛口，铆钉加固的厚重铁门，城墙上一座双层中式歇山顶城楼，深色瓦顶配暗红色檐线点缀，墙头两座燃着火光的烽火盆，一面深蓝色纯色燕尾战旗（旗面无任何文字图案）。气质森严压迫。' },
  { cat: 'buildings', id: 'wu', desc: '三国东吴水寨城堡（敌方据点）：建在水边木桩平台上的水寨城堡，底部可见波纹水面与木桩基座，木石混合城墙，江南风格翘檐青瓦双层城楼，城门两侧挂一对红灯笼，背景露出一截战船桅杆与布帆，一面青绿色纯色战旗（旗面无任何文字图案）。气质灵秀水乡。' },
  { cat: 'buildings', id: 'chengdu', desc: '三国蜀汉都城成都的雄伟城楼（玩家大本营）：金红配色的三层中式楼阁城楼，朱红色城门与立柱，金黄色瓦顶层层飞檐，浅色石砌城墙，多面赤红色纯色汉式旌旗（旗面无任何文字图案），比普通军镇城堡更高大宏伟。气质巍峨温暖、值得守护的家园。' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gen(unit, refDataUrl) {
  const text = styleOf(unit) + (unit.cat === 'buildings' ? ' 建筑：' : ' 单位：') + unit.desc
    + (refDataUrl ? ' 【重要】严格参考所给图片的画风、笔触、配色、描边粗细与光照，保持整套素材风格高度统一。' : '');
  const content = [{ type: 'text', text }];
  if (refDataUrl) content.push({ type: 'image_url', image_url: { url: refDataUrl } });

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, modalities: ['image', 'text'], messages: [{ role: 'user', content }] }),
  });
  const j = await res.json();
  if (j.error) throw new Error('API ' + JSON.stringify(j.error).slice(0, 200));
  const msg = j.choices && j.choices[0] && j.choices[0].message;
  let url = msg && msg.images && msg.images[0] && (msg.images[0].image_url?.url || msg.images[0].url);
  if (!url) { const m = JSON.stringify(j).match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/); if (m) url = m[0]; }
  if (!url) throw new Error('no image: ' + JSON.stringify(j).slice(0, 200));
  const buf = Buffer.from(url.split(',')[1], 'base64');
  const dir = path.join(OUT, unit.cat); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, unit.id + '.png'); fs.writeFileSync(file, buf);
  return { file, bytes: buf.length };
}

function dataUrlOf(file) {
  return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
}

const only = process.argv.slice(2);
const list = only.length ? UNITS.filter((u) => only.includes(u.id)) : UNITS;

let anchorUrl = null;
const anchorFile = path.join(OUT, 'generals', 'huang.png');
if (only.length && fs.existsSync(anchorFile)) anchorUrl = dataUrlOf(anchorFile);   // 复用已存黄忠当锚

const results = [];
for (const unit of list) {
  try {
    const useRef = unit.anchor ? null : anchorUrl;   // 锚自身不带参考
    const r = await gen(unit, useRef);
    if (unit.anchor) anchorUrl = dataUrlOf(r.file);   // 黄忠出炉 → 设为后续锚
    console.log(`✓ ${unit.cat}/${unit.id}.png  (${(r.bytes / 1024).toFixed(0)} KB)`);
    results.push(unit.id);
    await sleep(1500);
  } catch (e) {
    console.log(`✗ ${unit.cat}/${unit.id}  — ${e.message}`);
  }
}
console.log(`\n完成 ${results.length}/${list.length}：${results.join(', ')}`);
