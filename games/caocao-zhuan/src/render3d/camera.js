// render3d/camera.js — 等距正交相机 + 关键运镜 tween（PoC 端口）
//
// 契约（plan §1.8）：
//   makeCamera(aspect) -> {
//     camera,                       // THREE.OrthographicCamera
//     setIso(),                     // 锁定等距视角
//     cinematic({focus:Vector3, zoom}),  // 运镜：聚焦某点并放大
//     reset(),                      // 回到等距默认
//     update(dt),                   // 每帧朝目标 lerp（位置/lookAt/zoom）
//     setAspect(aspect),            // resize 时更新投影
//   }
//
// 实现要点（来自 PoC）：相机在固定等距方位俯视，cinematic 把 target 改到
// 战场某处并提高 zoom；update 用指数 lerp 平滑过渡，产生缓动运镜。

import * as THREE from 'three';

// 等距默认机位（俯视斜角），与 PoC 一致。
const ISO_POS = new THREE.Vector3(10, 11, 10);
const ISO_LOOK = new THREE.Vector3(0, 0.5, 0);
const VIEW_SIZE = 6.2; // 正交半高（世界单位）
const LERP = 0.06; // 每帧趋近系数（PoC 同值，~60fps 平滑）

/**
 * @param {number} aspect  渲染目标宽高比 w/h
 */
export function makeCamera(aspect = 1) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.copy(ISO_POS);

  let viewSize = VIEW_SIZE;
  let curAspect = aspect || 1;

  // 当前 lookAt（独立 lerp，使转向平滑）。
  const lookCur = ISO_LOOK.clone();

  // 趋近目标。
  const target = {
    pos: ISO_POS.clone(),
    look: ISO_LOOK.clone(),
    zoom: 1,
  };

  function applyFrustum() {
    const a = curAspect || 1;
    camera.left = -viewSize * a;
    camera.right = viewSize * a;
    camera.top = viewSize;
    camera.bottom = -viewSize;
    camera.updateProjectionMatrix();
  }

  function setAspect(a) {
    curAspect = a || 1;
    applyFrustum();
  }

  function setTarget(pos, look, zoom) {
    target.pos.copy(pos);
    target.look.copy(look);
    target.zoom = zoom;
  }

  // 锁定等距（立即设目标；update 平滑趋近）。
  function setIso() {
    setTarget(ISO_POS, ISO_LOOK, 1);
  }

  // 复位 = 回等距。
  function reset() {
    setIso();
  }

  // 运镜：聚焦 focus（Vector3），放大到 zoom（默认 2.0）。
  function cinematic({ focus, zoom = 2.0 } = {}) {
    const f = focus || ISO_LOOK;
    // 机位从聚焦点上方/侧前方俯压，营造特写。
    const pos = new THREE.Vector3(f.x + 0.5, f.y + 2.6, f.z + 5.2);
    const look = new THREE.Vector3(f.x, Math.max(f.y, 1.0), f.z);
    setTarget(pos, look, zoom);
  }

  // 每帧趋近（dt 可缩放趋近速度；缺省按 PoC 固定步长）。
  function update(dt) {
    // 帧率无关：dt(秒) 越大趋近越快，dt 缺省时退化为 PoC 的 0.06。
    const k = dt != null ? 1 - Math.pow(1 - LERP, Math.max(0, dt) * 60) : LERP;
    camera.position.lerp(target.pos, k);
    lookCur.lerp(target.look, k);
    camera.lookAt(lookCur);
    camera.zoom += (target.zoom - camera.zoom) * k;
    camera.updateProjectionMatrix();
  }

  // 初始化投影 + 朝向。
  applyFrustum();
  camera.lookAt(lookCur);

  return {
    camera,
    setIso,
    cinematic,
    reset,
    update,
    setAspect,
    get viewSize() {
      return viewSize;
    },
    set viewSize(v) {
      viewSize = v;
      applyFrustum();
    },
  };
}

export default { makeCamera };
