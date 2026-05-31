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
    pods: [{ x: 900, y: 430, kind: 'weaponS' }, { x: 2700, y: 410, kind: 'heal' }],
    checkpoints: [1600, 3120],
    bossX: 4150,
    boss: 'gate',
  },

  // ── Stage 2 ─────────────────────────────────────────────────────────────────
  // 「河流大桥」 River Bridge — blue-green river tones
  // Layout: three bridge segments with two river-water gaps; oneWay platforms
  // hover over the water for routing. Gunship boss at far end.
  {
    id: 2,
    name: '河流大桥',
    palette: { sky: '#0d3b4f', far: '#0a4a5e', mid: '#083d4e', ground: '#1a5f4a', accent: '#4dd0e1' },
    worldWidth: 5200,
    groundY: 470,
    floors: [
      // Segment 1: start to first river gap
      { x: 0,    w: 1200, y: 470 },
      // Segment 2: between the two river gaps
      { x: 1500, w: 1100, y: 470 },
      // Segment 3: second river gap to boss room end
      { x: 2900, w: 2300, y: 470 },
    ],
    platforms: [
      // OneWay platforms spanning/flanking the gaps — reachable from ground (jump peak ~131px)
      { x: 1220, y: 370, w: 180, h: 18, oneWay: true },
      { x: 2620, y: 370, w: 180, h: 18, oneWay: true },
      // Mid-bridge elevated platform for a drone intercept route
      { x: 1900, y: 340, w: 160, h: 18, oneWay: true },
    ],
    hazards: [
      // Water fills the two bridge gaps
      { type: 'water', x: 1200, w: 300, y: 470 },
      { type: 'water', x: 2600, w: 300, y: 470 },
    ],
    decor: [
      { type: 'tree', x: 200,  y: 470 },
      { type: 'tree', x: 800,  y: 470 },
      { type: 'tent', x: 3200, y: 470 },
      { type: 'tree', x: 4400, y: 470 },
    ],
    spawns: [
      { x: 500,  type: 'grunt' },
      { x: 1000, type: 'grunt' },
      { x: 1700, type: 'drone' },
      { x: 2100, type: 'drone' },
      { x: 2400, type: 'drone' },
      { x: 3000, type: 'turret' },
      { x: 3600, type: 'grunt' },
      { x: 4200, type: 'grunt' },
    ],
    // weaponM on the running path (y≈430); heal on segment 3 before boss
    pods: [
      { x: 1100, y: 430, kind: 'weaponM' },
      { x: 4000, y: 430, kind: 'heal' },
    ],
    // Both checkpoints on solid bridge segments
    checkpoints: [1500, 2900],
    bossX: 4700,
    boss: 'gunship',
  },

  // ── Stage 3 ─────────────────────────────────────────────────────────────────
  // 「敌军基地」 Enemy Base — steel/dark base tones
  // Layout: indoor-style multi-level layout; dense turrets, jumpers, one nest.
  // Multiple oneWay platforms form a climbable interior. Mech boss.
  {
    id: 3,
    name: '敌军基地',
    palette: { sky: '#1a1a2e', far: '#16213e', mid: '#0f3460', ground: '#4a4a5a', accent: '#e94560' },
    worldWidth: 5600,
    groundY: 470,
    floors: [
      // Main ground runs almost the whole stage; one pit around mid-point
      { x: 0,    w: 1800, y: 470 },
      { x: 2100, w: 3500, y: 470 },
    ],
    platforms: [
      // Low tier (~350) — reachable from ground
      { x: 600,  y: 350, w: 180, h: 18, oneWay: true },
      { x: 1200, y: 350, w: 160, h: 18, oneWay: true },
      // Mid tier (~260) — reachable from low tier (gap ~90px ✓)
      { x: 700,  y: 260, w: 160, h: 18, oneWay: true },
      { x: 1300, y: 260, w: 180, h: 18, oneWay: true },
      // Over the pit
      { x: 1850, y: 360, w: 200, h: 18, oneWay: true },
      // Interior platforms
      { x: 2500, y: 350, w: 160, h: 18, oneWay: true },
      { x: 3200, y: 300, w: 160, h: 18, oneWay: true },
      { x: 4000, y: 350, w: 180, h: 18, oneWay: true },
    ],
    hazards: [],
    decor: [
      { type: 'tent', x: 400,  y: 470 },
      { type: 'tent', x: 1500, y: 470 },
      { type: 'tent', x: 3000, y: 470 },
      { type: 'tent', x: 4600, y: 470 },
    ],
    spawns: [
      { x: 400,  type: 'grunt' },
      { x: 900,  type: 'turret' },
      { x: 1400, type: 'jumper' },
      { x: 2200, type: 'turret' },
      { x: 2700, type: 'jumper' },
      { x: 3100, type: 'turret' },
      { x: 3500, type: 'nest' },
      { x: 4000, type: 'jumper' },
      { x: 4500, type: 'turret' },
    ],
    // weaponL on a platform-reachable y; heal on ground path before boss
    pods: [
      { x: 1250, y: 230, kind: 'weaponL' },   // ~30px above the 260-tier platform top
      { x: 4600, y: 430, kind: 'heal' },
      { x: 4800, y: 430, kind: 'shield' },     // shield before the mech boss
    ],
    checkpoints: [2100, 4000],
    bossX: 5100,
    boss: 'mech',
  },

  // ── Stage 4 ─────────────────────────────────────────────────────────────────
  // 「瀑布悬崖」 Waterfall Cliff — teal/rock tones
  // Layout: vertical-ish climb; stacked oneWay platforms with manageable gaps.
  // Pits punish careless play. Grenadiers on ledges, drones patrol. TwinCannon boss.
  {
    id: 4,
    name: '瀑布悬崖',
    palette: { sky: '#0d3347', far: '#0a4a52', mid: '#0c3d4a', ground: '#2d7a6a', accent: '#80cbc4' },
    worldWidth: 5800,
    groundY: 470,
    floors: [
      // Ground segments with gaps (pits)
      { x: 0,    w: 900,  y: 470 },
      { x: 1100, w: 900,  y: 470 },
      { x: 2200, w: 900,  y: 470 },
      // Solid boss room floor (bossX≈5300; spans from 5180 to world end)
      { x: 3300, w: 2500, y: 470 },
    ],
    platforms: [
      // Vertical staircase to climb cliffs — each step ≤120px above the one below
      // Starting ramp from floor 1
      { x: 820,  y: 380, w: 160, h: 18, oneWay: true },
      // Mid-air steps over first pit
      { x: 980,  y: 380, w: 160, h: 18, oneWay: true },
      // Climb tiers on segment 2
      { x: 1300, y: 300, w: 160, h: 18, oneWay: true },
      { x: 1600, y: 220, w: 160, h: 18, oneWay: true },
      { x: 1900, y: 300, w: 160, h: 18, oneWay: true },
      // Over second pit / approach to segment 3
      { x: 2070, y: 380, w: 160, h: 18, oneWay: true },
      // Cliff ascent on segment 3
      { x: 2400, y: 350, w: 160, h: 18, oneWay: true },
      { x: 2700, y: 270, w: 160, h: 18, oneWay: true },
      { x: 3000, y: 350, w: 180, h: 18, oneWay: true },
      // Low stepping stone over the third gap (3100-3300) so the cross is gentle
      { x: 3140, y: 420, w: 160, h: 18, oneWay: true },
    ],
    hazards: [
      // Pits between ground segments
      { type: 'water', x: 900,  w: 200, y: 470 },
      { type: 'water', x: 2000, w: 200, y: 470 },
      { type: 'water', x: 3100, w: 200, y: 470 },
    ],
    decor: [
      { type: 'tree', x: 300,  y: 470 },
      { type: 'tree', x: 1200, y: 470 },
      { type: 'tree', x: 2400, y: 470 },
      { type: 'tree', x: 4000, y: 470 },
      { type: 'tent', x: 5000, y: 470 },
    ],
    spawns: [
      { x: 500,  type: 'grunt' },
      { x: 1200, type: 'grenadier' },
      { x: 1700, type: 'drone' },
      { x: 2300, type: 'grenadier' },
      { x: 2600, type: 'drone' },
      { x: 3000, type: 'grenadier' },
      { x: 3500, type: 'turret' },
      { x: 4200, type: 'grunt' },
      { x: 4800, type: 'grenadier' },
    ],
    // shield before the hard grenadier stretch; heal on ground before boss room
    pods: [
      { x: 820, y: 430, kind: 'shield' },   // on floor [0-900], before the first water gap
      { x: 4600, y: 430, kind: 'heal' },
    ],
    checkpoints: [1100, 3300],
    bossX: 5300,
    boss: 'twinCannon',
  },

  // ── Stage 5 ─────────────────────────────────────────────────────────────────
  // 「核心基地」 Core Facility — red-alert/dark tones
  // Final gauntlet: all enemy types, spaced for fairness; heal+shield before boss.
  // Core boss (3-phase) at the end. Solid floor spans entire boss room.
  {
    id: 5,
    name: '核心基地',
    palette: { sky: '#1a0000', far: '#2d0a0a', mid: '#1f0505', ground: '#5a1a1a', accent: '#ff5252' },
    worldWidth: 6400,
    groundY: 470,
    floors: [
      // Ground segments — one pit early, one mid, then solid run to boss room
      { x: 0,    w: 1200, y: 470 },
      { x: 1400, w: 1200, y: 470 },
      { x: 2800, w: 1000, y: 470 },
      // Solid boss room floor: starts at 4000, runs to world end (covers bossX=5900)
      { x: 4000, w: 2400, y: 470 },
    ],
    platforms: [
      // Over first pit
      { x: 1220, y: 370, w: 200, h: 18, oneWay: true },
      // Over second pit (2600-2800)
      { x: 2600, y: 370, w: 220, h: 18, oneWay: true },
      // Interior elevated routes
      { x: 1800, y: 340, w: 160, h: 18, oneWay: true },
      { x: 2200, y: 270, w: 160, h: 18, oneWay: true },
      { x: 3200, y: 340, w: 160, h: 18, oneWay: true },
      { x: 3700, y: 280, w: 160, h: 18, oneWay: true },
    ],
    hazards: [
      { type: 'water', x: 1200, w: 200, y: 470 },
      { type: 'water', x: 2600, w: 200, y: 470 },
      { type: 'water', x: 3800, w: 200, y: 470 },
    ],
    decor: [
      { type: 'tent', x: 300,  y: 470 },
      { type: 'tent', x: 1600, y: 470 },
      { type: 'tent', x: 3000, y: 470 },
      { type: 'tent', x: 4500, y: 470 },
      { type: 'tent', x: 5500, y: 470 },
    ],
    spawns: [
      // Spread out — breathing room between each encounter
      { x: 400,  type: 'grunt' },
      { x: 800,  type: 'turret' },
      { x: 1500, type: 'jumper' },
      { x: 1900, type: 'drone' },
      { x: 2300, type: 'grenadier' },
      { x: 3000, type: 'nest' },
      { x: 3500, type: 'turret' },
      { x: 3900, type: 'jumper' },
      // Boss room approach — final defenders, well-spaced
      { x: 4300, type: 'grenadier' },
      { x: 4800, type: 'drone' },
      { x: 5200, type: 'grunt' },
      { x: 5600, type: 'turret' },
    ],
    // weaponS early; heal AND shield just before boss room so the kid enters equipped
    pods: [
      { x: 700,  y: 430, kind: 'weaponS' },
      { x: 2900, y: 430, kind: 'heal' },
      { x: 5500, y: 430, kind: 'shield' },
      { x: 5700, y: 430, kind: 'heal' },
    ],
    checkpoints: [1400, 2800, 4000],
    bossX: 5900,
    boss: 'core',
  },
];

export const stageCount = () => STAGES.length;
export const getStage = (i) => STAGES[i];
