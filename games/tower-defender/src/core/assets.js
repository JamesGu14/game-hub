// core/assets.js — 资源索引 + 并行预加载（Phase 6）。
// manifest: id → 路径（相对 index.html）。preload() 并行加载 Image，缺图不阻塞（onerror 也 resolve）。
// 渲染层经 assets.images[id] 取图；缺则回退色块（见 render/entityRenderer.js）。
// 自含铁律：只触 Image（core 资源层允许）；不碰 gameState / DOM 布局。

export const assets = { ready: false, images: {} };

// id 命名：gen_<generalId> / enemy_<enemyType> / boss_<bossId>。
// v1 仅南蛮核心集（蜀汉六将 + 南蛮三兵 + 木鹿/兀突骨）；东吴/曹魏缺图 → 渲染回退色块。
export const MANIFEST = {
  // —— 蜀汉六将（战场塔 + UI 立绘共用）——
  gen_huang: 'assets/sprites/generals/huang.png',
  gen_zhang: 'assets/sprites/generals/zhang.png',
  gen_guan: 'assets/sprites/generals/guan.png',
  gen_zhao: 'assets/sprites/generals/zhao.png',
  gen_ma: 'assets/sprites/generals/ma.png',
  gen_zhuge: 'assets/sprites/generals/zhuge.png',
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
