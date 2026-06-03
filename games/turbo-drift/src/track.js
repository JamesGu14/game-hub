// games/turbo-drift/src/track.js
import { RENDER } from './config.js';

// 用 cos 缓动把一段弯/坡平滑展开；返回 {curve,y,worldY}[]
export function buildSegments(parts) {
  const segs = [];
  for (const p of parts) {
    const n = p.n, curve = p.curve || 0, hill = p.hill || 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const ease = -Math.cos(t * Math.PI) / 2 + 0.5; // 0→1 平滑
      segs.push({ curve: curve * ease, y: hill * ease });
    }
  }
  let acc = 0;
  for (const s of segs) { acc += s.y; s.worldY = acc; }
  return segs;
}

function pickBoxes(segCount, count) {
  const boxes = [];
  for (let i = 1; i <= count; i++) boxes.push(Math.floor((segCount * i) / (count + 1)));
  return boxes;
}

const RAW = [
  {
    id: 'track1', name: '草原日间', theme: {
      sky: ['#5ec8ff', '#bfeaff'], grass: ['#4caf50', '#43a047'],
      road: ['#5a5a66', '#52525e'], rumble: ['#ff5555', '#ffffff'], deco: 'tree', night: false,
    },
    parts: [
      { n: 50, curve: 0, hill: 0 }, { n: 40, curve: 1.6 }, { n: 40, curve: 0, hill: 40 },
      { n: 40, curve: -1.6 }, { n: 40, curve: 0, hill: -40 }, { n: 50, curve: 1.2 }, { n: 40, curve: 0 },
    ],
  },
  {
    id: 'track2', name: '城市夜赛', theme: {
      sky: ['#0a0420', '#5e2a7e'], grass: ['#0d0a1f', '#120e28'],
      road: ['#23202e', '#1c1a26'], rumble: ['#00e5ff', '#ff2d95'], deco: 'neon', night: true,
    },
    parts: [
      { n: 44, curve: 0 }, { n: 40, curve: 2.2 }, { n: 36, curve: 0, hill: 50 },
      { n: 40, curve: -2.0 }, { n: 40, curve: 1.5, hill: -30 }, { n: 44, curve: -1.2 }, { n: 36, curve: 0 },
    ],
  },
  {
    id: 'track3', name: '沙漠黄昏', theme: {
      sky: ['#ff9a3c', '#ffd56b'], grass: ['#caa45a', '#b8924a'],
      road: ['#6b5a44', '#5e4e3a'], rumble: ['#ffffff', '#c0392b'], deco: 'cactus', night: false,
    },
    parts: [
      { n: 50, curve: 0, hill: 0 }, { n: 60, curve: 1.8, hill: 90 }, { n: 50, curve: -1.4, hill: -90 },
      { n: 40, curve: 2.4 }, { n: 50, curve: 0, hill: 60 }, { n: 40, curve: -2.0, hill: -60 }, { n: 40, curve: 0 },
    ],
  },
  {
    id: 'track4', name: '雪地夜境', theme: {
      sky: ['#0b1a3a', '#22406e'], grass: ['#dfe9f5', '#cdd9ea'],
      road: ['#3a4256', '#2f3648'], rumble: ['#9fd3ff', '#ffffff'], deco: 'pine', night: true, ice: true,
    },
    parts: [
      { n: 40, curve: 0 }, { n: 36, curve: 3.0 }, { n: 30, curve: -3.0 }, { n: 30, curve: 3.2, hill: 40 },
      { n: 30, curve: -2.6, hill: -40 }, { n: 40, curve: 2.0 }, { n: 30, curve: -3.0 }, { n: 30, curve: 0 },
    ],
  },
];

export const TRACKS = RAW.map(r => {
  const segs = buildSegments(r.parts);
  return {
    id: r.id, name: r.name, theme: r.theme, segs,
    length: segs.length * RENDER.segLen,
    itemBoxes: pickBoxes(segs.length, 4),
  };
});

export const trackById = id => TRACKS.find(t => t.id === id);
