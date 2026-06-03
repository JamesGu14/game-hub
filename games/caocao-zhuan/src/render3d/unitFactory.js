// render3d/unitFactory.js — 程序化低多边形武将工厂（PoC 端口）
//
// 契约（plan §1.8）：
//   makeGeneral(appearance, faction) -> THREE.Group
//
// 全部美术皆程序化生成（无外部模型/贴图）。从 data/generals.js 的 appearance 读取：
//   { armor, accent, skin, helmet:'crest'|'plume'|'cap',
//     weapon:'sword'|'spear'|'bow'|'halberd', mount:bool, scale,
//     banner:{ char, color }, horse? }
// faction 决定脚下底环颜色：'wei' = 蓝环；其余（'foe'/'ally'/'npc'）= 红环。
//
// group.userData.isUnit = true（供 raycast 命中上溯）。
// group.userData.bannerFlag 保留旗面 Mesh 引用，供 sceneManager 帧循环做 idle 飘扬。

import * as THREE from 'three';

const RING_WEI = 0x3a78ff; // 我方蓝环
const RING_FOE = 0xe24b4b; // 敌方红环

// 标准材质（低多边形：默认 flatShading）。
function mat(color, { rough = 0.85, metal = 0.1, flat = true, emissive = 0, emi = 0 } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    flatShading: flat,
    emissive,
    emissiveIntensity: emi,
  });
}

// 盒体（带阴影与可选定位）。
function box(w, h, d, color, opt = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opt));
  m.castShadow = true;
  m.receiveShadow = true;
  if (opt.x !== undefined) m.position.set(opt.x, opt.y || 0, opt.z || 0);
  return m;
}

// 旗：木杆 + CanvasTexture 旗面（写姓氏字）。返回 group，userData.flag = 旗面 Mesh。
function makeBanner(color, char) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 1.15, 6),
    mat(0x6b4a2a),
  );
  pole.castShadow = true;
  pole.position.y = 0.57;
  g.add(pole);

  const cv = document.createElement('canvas');
  cv.width = 96;
  cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#' + (color >>> 0).toString(16).padStart(6, '0').slice(-6);
  x.fillRect(0, 0, 96, 128);
  x.strokeStyle = 'rgba(0,0,0,.35)';
  x.lineWidth = 6;
  x.strokeRect(3, 3, 90, 122);
  x.fillStyle = '#fff6e0';
  x.font = 'bold 78px "Songti SC","STSong",serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(char || '兵', 48, 68);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.6),
    new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }),
  );
  flag.position.set(0.27, 0.82, 0);
  g.add(flag);
  g.userData.flag = flag;
  return g;
}

// 低多边形坐骑。
function makeHorse(color) {
  const g = new THREE.Group();
  g.add(box(0.78, 0.34, 0.3, color, { x: 0, y: 0.5, z: 0 })); // 躯干
  g.add(box(0.2, 0.42, 0.22, color, { x: 0.42, y: 0.62, z: 0 })); // 颈
  g.add(box(0.3, 0.18, 0.18, color, { x: 0.56, y: 0.78, z: 0 })); // 头
  for (const dx of [-0.3, 0.3]) {
    for (const dz of [-0.11, 0.11]) {
      g.add(box(0.1, 0.5, 0.1, 0x2c2c33, { x: dx, y: 0.25, z: dz })); // 腿
    }
  }
  return g;
}

/**
 * 生成一个程序化武将 group。
 * @param {object} appearance data/generals.js 的 appearance 对象
 * @param {string} faction    'wei' | 'foe' | 'ally' | 'npc'
 * @returns {THREE.Group}
 */
export function makeGeneral(appearance = {}, faction = 'wei') {
  const cfg = {
    armor: 0x2a3550,
    accent: 0xb8902c,
    skin: 0xe7b98a,
    helmet: 'crest',
    weapon: 'sword',
    mount: false,
    scale: 1,
    banner: { char: '兵', color: 0x333333 },
    ...appearance,
  };

  const g = new THREE.Group();
  g.userData.isUnit = true;
  g.userData.faction = faction;

  // 坐骑抬高人物。
  const baseY = cfg.mount ? 0.95 : 0;
  const rig = new THREE.Group();
  rig.position.y = baseY;
  g.add(rig);

  // 脚下阵营底环（蓝=wei / 红=其余）。
  const ringCol = faction === 'wei' ? RING_WEI : RING_FOE;
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, 0.05, 20),
    mat(ringCol, { emissive: ringCol, emi: 0.55, rough: 0.5 }),
  );
  ring.position.y = 0.03;
  ring.receiveShadow = true;
  g.add(ring);
  g.userData.baseRing = ring;

  // 长袍（accent 色）。
  const robe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.34, 0.46, 8),
    mat(cfg.accent),
  );
  robe.castShadow = true;
  robe.position.y = 0.3;
  rig.add(robe);

  // 躯干甲 + 护肩条。
  rig.add(box(0.42, 0.4, 0.26, cfg.armor, { x: 0, y: 0.66, z: 0, metal: 0.3, rough: 0.55 }));
  rig.add(box(0.5, 0.12, 0.32, cfg.accent, { x: 0, y: 0.84, z: 0, metal: 0.3 }));

  // 头（柔和着色）。
  rig.add(box(0.2, 0.2, 0.2, cfg.skin, { x: 0, y: 1.0, z: 0, rough: 0.9, metal: 0, flat: false }));

  // 头盔变体：cap 平顶盔 / crest 锥盔+脊 / plume 锥盔+翎。
  if (cfg.helmet === 'cap') {
    rig.add(box(0.24, 0.12, 0.24, cfg.armor, { x: 0, y: 1.13, z: 0, metal: 0.4 }));
  } else {
    const helm = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 0.26, 8),
      mat(cfg.armor, { metal: 0.5, rough: 0.4 }),
    );
    helm.castShadow = true;
    helm.position.y = 1.2;
    rig.add(helm);
    if (cfg.helmet === 'plume') {
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 6), mat(cfg.accent));
      p.position.set(0, 1.42, -0.02);
      rig.add(p);
    } else {
      // crest：盔脊
      rig.add(box(0.06, 0.2, 0.26, cfg.accent, { x: 0, y: 1.36, z: 0 }));
    }
  }

  // 双肩（手臂近似）。
  rig.add(box(0.1, 0.36, 0.12, cfg.armor, { x: -0.28, y: 0.66, z: 0, metal: 0.3 }));
  rig.add(box(0.1, 0.36, 0.12, cfg.armor, { x: 0.28, y: 0.66, z: 0, metal: 0.3 }));

  // 武器（右手）。
  const wp = new THREE.Group();
  wp.position.set(0.34, 0.66, 0.04);
  rig.add(wp);
  if (cfg.weapon === 'sword') {
    wp.add(box(0.05, 0.5, 0.1, 0xdfe6ef, { metal: 0.85, rough: 0.25, y: 0.18 }));
    wp.add(box(0.18, 0.05, 0.05, 0xb8902c, { y: -0.02, metal: 0.6 }));
  } else if (cfg.weapon === 'spear') {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.3, 6), mat(0x7a5a30));
    p.position.y = 0.25;
    wp.add(p);
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.2, 6),
      mat(0xe6edf5, { metal: 0.85, rough: 0.2 }),
    );
    tip.position.y = 0.95;
    wp.add(tip);
  } else if (cfg.weapon === 'bow') {
    const bow = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.025, 6, 14, Math.PI * 1.25),
      mat(0x8a5a2a),
    );
    bow.rotation.z = Math.PI * 0.62;
    bow.position.y = 0.2;
    wp.add(bow);
  } else if (cfg.weapon === 'halberd') {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.45, 6), mat(0x5a3f22));
    p.position.y = 0.3;
    wp.add(p);
    wp.add(box(0.04, 0.3, 0.18, 0xe6edf5, { x: 0.1, y: 0.95, metal: 0.85, rough: 0.2 }));
    const cr = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.022, 6, 10, Math.PI),
      mat(0xe6edf5, { metal: 0.8, rough: 0.25 }),
    );
    cr.position.set(0.02, 0.86, 0);
    cr.rotation.z = -0.4;
    wp.add(cr);
  }

  // 背旗（CanvasTexture 姓氏）。
  const banner = cfg.banner || { char: '兵', color: 0x333333 };
  const bn = makeBanner(banner.color, banner.char);
  bn.position.set(-0.32, 0, -0.12);
  rig.add(bn);
  g.userData.bannerFlag = bn.userData.flag;

  // 坐骑。
  if (cfg.mount) {
    g.add(makeHorse(cfg.horse || 0x7a5230));
  }

  rig.scale.setScalar(cfg.scale || 1);
  return g;
}

export default { makeGeneral };
