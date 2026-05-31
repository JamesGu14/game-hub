import { FIELD } from './config.js';

// Each floor/platform: world-space rect. Gaps between floors are pits.
// boss ∈ {'gate','gunship','mech','twinCannon','core'}. pods.kind ∈ {weaponS,weaponM,weaponL,shield,heal}.
export const STAGES = [
  {
    id: 1,
    name: '丛林入口',
    palette: { sky: '#274b1a', far: '#1d3a14', mid: '#16300f', ground: '#3a5a22', accent: '#8bc34a' },
    worldWidth: 4600,
    groundY: 470,
    floors: [
      { x: 0, w: 1300, y: 470 },
      { x: 1480, w: 1500, y: 470 },
      { x: 3120, w: 1480, y: 470 },
    ],
    platforms: [
      { x: 700, y: 360, w: 160, h: 18, oneWay: true },
      { x: 2000, y: 360, w: 180, h: 18, oneWay: true },
      { x: 2600, y: 300, w: 160, h: 18, oneWay: true },
    ],
    hazards: [],
    decor: [{ type: 'tree', x: 300, y: 470 }, { type: 'tent', x: 2200, y: 470 }],
    spawns: [
      { x: 600, type: 'grunt' },
      { x: 1000, type: 'grunt' },
      { x: 1700, type: 'grunt' },
      { x: 2300, type: 'turret' },
      { x: 3000, type: 'grunt' },
      { x: 3400, type: 'jumper' },
    ],
    pods: [{ x: 900, y: 300, kind: 'weaponS' }, { x: 2700, y: 250, kind: 'heal' }],
    checkpoints: [1600, 3120],
    bossX: 4150,
    boss: 'gate',
  },
];

export const stageCount = () => STAGES.length;
export const getStage = (i) => STAGES[i];
