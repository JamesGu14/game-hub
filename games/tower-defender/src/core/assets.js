// core/assets.js — 资源索引 + 并行预加载（Phase 6）。
// manifest: id → 路径（相对 index.html）。preload() 并行加载 Image，缺图不阻塞（onerror 也 resolve）。
// 渲染层经 assets.images[id] 取图；缺则回退色块（见 render/entityRenderer.js）。
// 自含铁律：只触 Image（core 资源层允许）；不碰 gameState / DOM 布局。

export const assets = { ready: false, images: {} };

// id 命名：gen_<generalId> / enemy_<enemyType> / boss_<bossId>。
// v1 仅南蛮核心集（蜀汉十二将 + 南蛮三兵 + 木鹿/兀突骨）；东吴/曹魏缺图 → 渲染回退色块。
export const MANIFEST = {
  // —— 蜀汉十二将（战场塔 + UI 立绘共用）——
  gen_huang: 'assets/sprites/generals/huang.png',
  gen_zhang: 'assets/sprites/generals/zhang.png',
  gen_guan: 'assets/sprites/generals/guan.png',
  gen_zhao: 'assets/sprites/generals/zhao.png',
  gen_ma: 'assets/sprites/generals/ma.png',
  gen_zhuge: 'assets/sprites/generals/zhuge.png',
  // —— [形象演进 spec §6] 12 将 × 3 阶(L1寒微/L2精进/L3神兵;取图经 generalSprite 逐级回退)——
  gen_huang_1: 'assets/sprites/generals/huang_1.png', gen_huang_2: 'assets/sprites/generals/huang_2.png', gen_huang_3: 'assets/sprites/generals/huang_3.png',
  gen_zhang_1: 'assets/sprites/generals/zhang_1.png', gen_zhang_2: 'assets/sprites/generals/zhang_2.png', gen_zhang_3: 'assets/sprites/generals/zhang_3.png',
  gen_guan_1: 'assets/sprites/generals/guan_1.png', gen_guan_2: 'assets/sprites/generals/guan_2.png', gen_guan_3: 'assets/sprites/generals/guan_3.png',
  gen_zhao_1: 'assets/sprites/generals/zhao_1.png', gen_zhao_2: 'assets/sprites/generals/zhao_2.png', gen_zhao_3: 'assets/sprites/generals/zhao_3.png',
  gen_ma_1: 'assets/sprites/generals/ma_1.png', gen_ma_2: 'assets/sprites/generals/ma_2.png', gen_ma_3: 'assets/sprites/generals/ma_3.png',
  gen_zhuge_1: 'assets/sprites/generals/zhuge_1.png', gen_zhuge_2: 'assets/sprites/generals/zhuge_2.png', gen_zhuge_3: 'assets/sprites/generals/zhuge_3.png',
  gen_liao_1: 'assets/sprites/generals/liao_1.png', gen_liao_2: 'assets/sprites/generals/liao_2.png', gen_liao_3: 'assets/sprites/generals/liao_3.png',
  gen_zhou_1: 'assets/sprites/generals/zhou_1.png', gen_zhou_2: 'assets/sprites/generals/zhou_2.png', gen_zhou_3: 'assets/sprites/generals/zhou_3.png',
  gen_madai_1: 'assets/sprites/generals/madai_1.png', gen_madai_2: 'assets/sprites/generals/madai_2.png', gen_madai_3: 'assets/sprites/generals/madai_3.png',
  gen_guanping_1: 'assets/sprites/generals/guanping_1.png', gen_guanping_2: 'assets/sprites/generals/guanping_2.png', gen_guanping_3: 'assets/sprites/generals/guanping_3.png',
  gen_zhangbao_1: 'assets/sprites/generals/zhangbao_1.png', gen_zhangbao_2: 'assets/sprites/generals/zhangbao_2.png', gen_zhangbao_3: 'assets/sprites/generals/zhangbao_3.png',
  gen_yueying_1: 'assets/sprites/generals/yueying_1.png', gen_yueying_2: 'assets/sprites/generals/yueying_2.png', gen_yueying_3: 'assets/sprites/generals/yueying_3.png',
  // —— [演绎段1] 剧情角色(非塔将):刘备(幕2 对话立绘;缺图 → storyScene 色块名牌兜底)——
  gen_liubei: 'assets/sprites/generals/liubei.png',
  // —— 南蛮敌兵（footman 用南蛮基底图）——
  enemy_footman: 'assets/sprites/enemies/nanman_footman.png',
  enemy_tengjia: 'assets/sprites/enemies/tengjia.png',
  enemy_wolf: 'assets/sprites/enemies/wolf.png',
  enemy_heavy: 'assets/sprites/enemies/heavy.png',     // [检查点A v2] 重甲（跨势力共用）
  enemy_flyer: 'assets/sprites/enemies/flyer.png',     // [检查点A v2] 飞兵·战鹰
  enemy_shaman: 'assets/sprites/enemies/shaman.png',   // [检查点A v2] 方士/术士
  // —— 南蛮名将 BOSS ——
  boss_mulu: 'assets/sprites/bosses/mulu.png',
  boss_wutugu: 'assets/sprites/bosses/wutugu.png',
  // —— [检查点A v2] 6 样板战主将（博望坡/长坂坡/赤壁/定军山/夷陵/上方谷）——
  boss_xiahoudun: 'assets/sprites/bosses/xiahoudun.png',
  boss_zhangliao: 'assets/sprites/bosses/zhangliao.png',
  boss_caocao: 'assets/sprites/bosses/caocao.png',
  boss_xiahouyuan: 'assets/sprites/bosses/xiahouyuan.png',
  boss_luxun: 'assets/sprites/bosses/luxun.png',
  boss_simayi: 'assets/sprites/bosses/simayi.png',
  // —— [检查点A v2 第二批] 12 生成关主将 ——
  boss_huaxiong: 'assets/sprites/bosses/huaxiong.png',
  boss_lvbu: 'assets/sprites/bosses/lvbu.png',
  boss_menghuo: 'assets/sprites/bosses/menghuo.png',
  boss_yanliang: 'assets/sprites/bosses/yanliang.png',
  boss_wenchou: 'assets/sprites/bosses/wenchou.png',
  boss_sunquan: 'assets/sprites/bosses/sunquan.png',
  boss_ganning: 'assets/sprites/bosses/ganning.png',
  boss_zhangren: 'assets/sprites/bosses/zhangren.png',
  boss_caoren: 'assets/sprites/bosses/caoren.png',
  boss_zhanghe: 'assets/sprites/bosses/zhanghe.png',
  boss_xuchu: 'assets/sprites/bosses/xuchu.png',
  boss_zhuran: 'assets/sprites/bosses/zhuran.png',
  // —— [检查点A v2 第二批] 12 副将 ——
  boss_lidian: 'assets/sprites/bosses/lidian.png',
  boss_yuejin: 'assets/sprites/bosses/yuejin.png',
  boss_yujin: 'assets/sprites/bosses/yujin.png',
  boss_caohong: 'assets/sprites/bosses/caohong.png',
  boss_caoxiu: 'assets/sprites/bosses/caoxiu.png',
  boss_niujin: 'assets/sprites/bosses/niujin.png',
  boss_zhoutai: 'assets/sprites/bosses/zhoutai.png',
  boss_jiangqin: 'assets/sprites/bosses/jiangqin.png',
  boss_dingfeng: 'assets/sprites/bosses/dingfeng.png',
  boss_xusheng: 'assets/sprites/bosses/xusheng.png',
  boss_panzhang: 'assets/sprites/bosses/panzhang.png',
  boss_handang: 'assets/sprites/bosses/handang.png',
  // —— [城堡美化] 建筑：势力敌营 + 成都（蛮款待南蛮关卡：补图 + 此处加一行即生效）——
  building_wei: 'assets/sprites/buildings/wei.png',
  building_wu: 'assets/sprites/buildings/wu.png',
  building_chengdu: 'assets/sprites/buildings/chengdu.png',
};

// 默认浏览器加载器：返回 Promise<Image|null>；onload→图、onerror→null（缺图不 throw、不阻塞）。
function defaultLoadImage(src) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.decoding = 'async';
      img.src = src;
    } catch {
      resolve(null);   // 无 Image 构造器（非浏览器）→ 静默缺图
    }
  });
}

// 并行预加载。loadImage / manifest 可注入（单测 mock）。装配前 await（main boot）。
// 任一图失败仅该 id 缺席（assets.images 无此键），整体仍 ready=true。
export async function preload(loadImage = defaultLoadImage, manifest = MANIFEST) {
  assets.images = {};                 // 幂等：重复 preload 覆盖（生产仅调一次）
  const entries = Object.entries(manifest);
  const results = await Promise.allSettled(entries.map(([, src]) => loadImage(src)));
  results.forEach((r, i) => {
    const id = entries[i][0];
    const img = r.status === 'fulfilled' ? r.value : null;
    if (img) assets.images[id] = img;   // 仅成功者入库；缺图 → undefined（渲染回退）
  });
  assets.ready = true;
  return assets;
}

// [形象演进 spec §6.1] 按等级取将立绘:gen_<id>_<stage> 逐级回退 → 旧图 gen_<id> → null(调用方画色块/首字)。
export function generalSprite(id, level = 1) {
  for (let s = Math.min(level, 3); s >= 1; s--) {
    const img = assets.images['gen_' + id + '_' + s];
    if (img) return img;
  }
  return assets.images['gen_' + id] || null;
}
