// render3d/terrainFactory.js — 等距地形工厂（PoC 端口 + terrain.js 语义）
//
// 契约（plan §1.8）：
//   buildGrid(map) -> { group, tileMeshes }
//
// map（plan §1.6）：{ cols, rows, tiles }，tiles[r][c] = terrainId 字符串。
// terrainId 取自 data/terrain.js：
//   grass 草 / road 路 / forest 林(+树) / hill 丘(更高) /
//   mountain 山(最高) / water 水(更低 + emissive，不可通行外观) / gate 关门(堡块)
//
// tileMeshes[r][c] = { mesh, top, x, z }（top = 该格顶面世界 y）。
//
// 辅助：
//   tileWorld(c,r) -> { x, y, z }            // y = 顶面高度
//   highlightTiles(cells, color)             // 半透明覆盖面（cyan=移动 / red=攻击）
//   clearHighlights()
//
// 全部程序化（无外部贴图）。

import * as THREE from 'three';

const TS = 1.0; // tile 边长
const GAP = 0.06; // tile 间距

// 各地形：底色 / 高度 / 是否水面外观。
const TERRAIN_VIS = {
  grass: { color: 0x5f9b4a, h: 0.32, water: false },
  road: { color: 0xc6a368, h: 0.3, water: false },
  forest: { color: 0x4f8b3e, h: 0.34, water: false, tree: true },
  hill: { color: 0x6fa356, h: 0.62, water: false },
  mountain: { color: 0x7d7468, h: 0.9, water: false, peak: true },
  water: { color: 0x3f86c8, h: 0.2, water: true },
  gate: { color: 0x8a6a3a, h: 0.34, water: false, fort: true },
};

const HIGHLIGHT_COLORS = {
  move: 0x3ad0ff, // 青：可移动
  attack: 0xff5151, // 红：可攻击
};

function mat(color, { rough = 0.95, metal = 0, emissive = 0, emi = 0, flat = true } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    flatShading: flat,
    emissive,
    emissiveIntensity: emi,
  });
}

function boxMesh(w, h, d, color, opt = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opt));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * 构建等距地形。
 * @param {{cols:number,rows:number,tiles:string[][]}} map
 * @returns {{ group:THREE.Group, tileMeshes:Array<Array<{mesh:THREE.Mesh,top:number,x:number,z:number}>>,
 *            tileWorld:Function, highlightTiles:Function, clearHighlights:Function }}
 */
export function buildGrid(map) {
  const COLS = map.cols;
  const ROWS = map.rows;
  const group = new THREE.Group();
  const tileMeshes = [];
  const overlays = [];
  const overlayGroup = new THREE.Group();
  group.add(overlayGroup);

  // 居中铺排：(c,r) -> [x,z]
  function tileXZ(c, r) {
    return [
      c * (TS + GAP) - (COLS - 1) * (TS + GAP) / 2,
      r * (TS + GAP) - (ROWS - 1) * (TS + GAP) / 2,
    ];
  }

  for (let r = 0; r < ROWS; r++) {
    tileMeshes[r] = [];
    for (let c = 0; c < COLS; c++) {
      const id = (map.tiles[r] && map.tiles[r][c]) || 'grass';
      const vis = TERRAIN_VIS[id] || TERRAIN_VIS.grass;
      const h = vis.h;
      const [x, z] = tileXZ(c, r);

      const t = boxMesh(TS, h, TS, vis.color, {
        rough: vis.water ? 0.3 : 0.95,
        metal: vis.water ? 0.2 : 0,
        emissive: vis.water ? 0x163a5a : 0,
        emi: vis.water ? 0.5 : 0,
      });
      t.position.set(x, h / 2, z);
      t.userData = { kind: 'tile', c, r, terrainId: id };
      group.add(t);
      tileMeshes[r][c] = { mesh: t, top: h, x, z };

      // 森林：树干 + 树冠。
      if (vis.tree) {
        const trunk = boxMesh(0.12, 0.34, 0.12, 0x6b4a2a);
        trunk.position.set(x, h + 0.17, z);
        group.add(trunk);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 7), mat(0x357a35));
        cone.castShadow = true;
        cone.position.set(x, h + 0.6, z);
        group.add(cone);
      }

      // 山地：石锥峰。
      if (vis.peak) {
        const peak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.55, 6), mat(0x8c8276));
        peak.castShadow = true;
        peak.position.set(x, h + 0.27, z);
        group.add(peak);
      }

      // 关门：堡块 + 门洞色。
      if (vis.fort) {
        const wall = boxMesh(TS * 0.92, 0.6, 0.22, 0x6f5634, { rough: 0.9 });
        wall.position.set(x, h + 0.3, z - 0.34);
        group.add(wall);
        for (const dx of [-0.34, 0.34]) {
          const merlon = boxMesh(0.22, 0.78, 0.24, 0x5e4a2c, { rough: 0.9 });
          merlon.position.set(x + dx, h + 0.39, z - 0.34);
          group.add(merlon);
        }
        const door = boxMesh(0.3, 0.4, 0.06, 0x2a1d10, { rough: 1 });
        door.position.set(x, h + 0.2, z - 0.23);
        group.add(door);
      }
    }
  }

  function tileWorld(c, r) {
    const tm = tileMeshes[r] && tileMeshes[r][c];
    if (!tm) {
      const [x, z] = tileXZ(c, r);
      return { x, y: 0, z };
    }
    return { x: tm.x, y: tm.top, z: tm.z };
  }

  function clearHighlights() {
    for (const o of overlays) {
      overlayGroup.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
    overlays.length = 0;
  }

  // cells: [{c,r}...]；color: 'move'|'attack' 或具体 hex。
  function highlightTiles(cells, color = 'move') {
    const col = HIGHLIGHT_COLORS[color] != null ? HIGHLIGHT_COLORS[color] : color;
    for (const cell of cells || []) {
      const tm = tileMeshes[cell.r] && tileMeshes[cell.r][cell.c];
      if (!tm) continue;
      const ov = new THREE.Mesh(
        new THREE.PlaneGeometry(TS * 0.92, TS * 0.92),
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
        }),
      );
      ov.rotation.x = -Math.PI / 2;
      ov.position.set(tm.x, tm.top + 0.03, tm.z);
      ov.userData = { kind: 'highlight', c: cell.c, r: cell.r };
      overlayGroup.add(ov);
      overlays.push(ov);
    }
  }

  return { group, tileMeshes, tileWorld, highlightTiles, clearHighlights, _overlays: overlays };
}

export default { buildGrid };
