// Level data for 像素冒险 PIXEL QUEST.
// Rows are TOP-DOWN strings using the TILES legend (config.js) plus entity markers:
//   '@' player start, 'c' checkpoint, 'g' goomba, 'k' koopa, 'o' floating coin.
// Tile legend chars: # ground, X block, B brick, b brickCoin, ? qcoin, M qpower,
//   * qstar, [ ] pipe halves, = platform, F flag, A castle.
// Gaps (missing ground columns) are pits. All gaps are <= 3 tiles and crossable
// WITHOUT the run key. parseLevel() turns a level into a grid + entity lists.

import { TILE, TILES } from './config.js';

const ENTITY_CHARS = new Set(['@', 'c', 'g', 'k', 'o']);

// ---------------------------------------------------------------------------
// 1-1 草地 (overworld) — gentle tutorial: run/jump, stomp, ?-blocks, a pipe,
// small pits (<=3 tiles), a midpoint checkpoint, finishing at the flag.
const lvl1 = {
  id: '1-1', name: '草地', theme: 'overworld', time: 300,
  rows: [
    '                                                                                                                            ',
    '                                                                                                                            ',
    '                                                                                                                            ',
    '                                                                                                                            ',
    '                                                                                                                            ',
    '            ?                  o o o                                                        ?M?                             ',
    '                                                                                                                            ',
    '                      o o               ?M?                   o o o                                 o o                     ',
    '                                                       []                                                     F             ',
    '    @     g                       g                    []     g       c             k             g                         ',
    '#################  ##########################   ##############################   ###########################################',
    '#################  ##########################   ##############################   ###########################################',
    '#################  ##########################   ##############################   ###########################################',
    '#################  ##########################   ##############################   ###########################################',
  ],
};

// ---------------------------------------------------------------------------
// 1-2 地下 (underground) — more platforms, coin strings, koopas, modest pits.
const lvl2 = {
  id: '1-2', name: '地下洞窟', theme: 'underground', time: 320,
  rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X                                                                                                                            X',
    'X                                                                                                                            X',
    'X                                                                                                                            X',
    'X                                                                                                                            X',
    'X         o o o       BbB                     o o o              ?  ?  ?                            o o o                    X',
    'X      ====                          ====                  ====                       ====                  ====            X',
    'X   ?              M                                                             ?                                          X',
    'X                                                                                                                  F         X',
    'X    @         k              g           k           g          c       k            g            k                        X',
    'X###########   #############   #############   #############   ############   #############   #############   ############XX',
    'X###########   #############   #############   #############   ############   #############   #############   ############XX',
    'X###########   #############   #############   #############   ############   #############   #############   ############XX',
    'X###########   #############   #############   #############   ############   #############   #############   ############XX',
  ],
};

// ---------------------------------------------------------------------------
// 1-3 空中 (sky) — moving platforms over bigger (still crossable) gaps, a star.
// Solid floating tile clusters guarantee a walkable path; movers add flavour.
const lvl3 = {
  id: '1-3', name: '云端天空', theme: 'sky', time: 340,
  rows: [
    '                                                                                                                            ',
    '                                                                                                                            ',
    '                                                                                                                            ',
    '                                                                                                                            ',
    '                                                                                                                            ',
    '                                       *                                                                                    ',
    '                                                                                                                            ',
    '                   o o o             o o o             o o o             o o o             o o o                            ',
    '    @     g                 k                 g         c       g                 k                 g               F       ',
    '         ======   ======   ======   ======   ======   ======   ======   ======   ======   ======   ======   ======          ',
    '#########                                                                                                        ###########',
    '#########                                                                                                        ###########',
    '#########                                                                                                        ###########',
    '#########                                                                                                        ###########',
  ],
  platforms: [
    { x: 40, y: 8, axis: 'v', range: 1.5, speed: 45 },
    { x: 90, y: 8, axis: 'h', range: 2, speed: 50 },
  ],
};

// ---------------------------------------------------------------------------
// 1-4 城堡 (castle) — narrow walkways, jump traps, enemy combos; ends at the
// castle where the princess waits. Reaching the castle wins the game.
const lvl4 = {
  id: '2-5', name: '魔王城堡', theme: 'castle', time: 360,
  rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X                                                                                                                      X',
    'X                                                                                                                      X',
    'X                                                                                                                      X',
    'X                                                                                                                      X',
    'X          ?     ?                     BBB                        ?   ?                                                X',
    'X                                                                                                                      X',
    'X                      o o                                  o o                          o o                          X',
    'X                  ===                       ===   c                        ===                     ==                 X',
    'X    @   g                  k          g                  g       k          g           k          g          F       X',
    'X############   ###############   ############   ###########   ###########   ############   ############   ###########XX',
    'X############   ###############   ############   ###########   ###########   ############   ############   ###########XX',
    'X############   ###############   ############   ###########   ###########   ############   ############   ###########XX',
    'X############   ###############   ############   ###########   ###########   ############   ############   ###########XX',
  ],
};

// ---------------------------------------------------------------------------
// 1-4 熔岩要塞 (lava) — boss 前的爬坡关:岩浆坑更密、敌人组合更多,中段有一处
// 熔岩沟用平台垫子跳跃通过。所有坑 <=3 格,走路(不按跑步键)即可通关。以旗子
// 结尾,过关进入最终的魔王城堡 (1-5)。
const lvlLava = {
  id: '1-4', name: '熔岩要塞', theme: 'lava', time: 350,
  rows: [
    '                                                                                                                        ',
    '                                                                                                                        ',
    '                                                                                                                        ',
    '                                                                                                                        ',
    '                                                                                                                        ',
    '        M             ? ?                                 *                           ? ?                               ',
    '                                                                                                                        ',
    '         o           o o                     oo    oo    o o                         o o           o o                  ',
    '                                            ====  ====                                                          F       ',
    '   @  g              g                g                 k   c         g             k            g  k                   ',
    '################   #########   #############          ##########   ###########   ###########   #########   #############',
    '################   #########   #############          ##########   ###########   ###########   #########   #############',
    '################   #########   #############          ##########   ###########   ###########   #########   #############',
    '################   #########   #############          ##########   ###########   ###########   #########   #############',
  ],
};

// ---------------------------------------------------------------------------
// World 1 finale + World 2 (1-5 雪原 … 2-4 暗夜要塞). Each ends at a flag; only the
// final 魔王城堡 (2-5) holds the castle (= win the game). Authored + verifier-checked.
const lvlSnow = {
  id: '1-5', name: '雪原', theme: 'snow', time: 340,
  rows: [
    "                                                                                                                    ",
    "                                                                                                                    ",
    "                                                                                                                    ",
    "                                                                                                                    ",
    "                                                                                                                    ",
    "              M                               ? ?                                 ?                                 ",
    "             o o                         o o                                 o o             o o                    ",
    "                             o o                 o o          X             =====                                   ",
    "                          XX            =====               X X X                           =====           F       ",
    "    @       g           X XX Xg           k     g       c X X X X X g         k     g             g                 ",
    "##################   #############   ###############   ###############   #############   ###########   #############",
    "##################   #############   ###############   ###############   #############   ###########   #############",
    "##################   #############   ###############   ###############   #############   ###########   #############",
    "##################   #############   ###############   ###############   #############   ###########   #############",
  ],
};

const lvlDesert = {
  id: '2-1', name: '黄沙关', theme: 'desert', time: 340,
  rows: [
    "                                                                                                                    ",
    "                                                                                                                    ",
    "                                                                                                                    ",
    "                                                                                                                    ",
    "                                                                                                              XX    ",
    "                                                                                                              XX    ",
    "                                        M     ooo                                     ooo                   XXXX    ",
    "          ooo []                            []              []ooo                         []                XXXX    ",
    "        []    []            []              []              []              []            []              XXXXXX    ",
    "    @   []  g []          k []  g           []  g       c   []  g       k   []  g         []  g           XXXXXX F  ",
    "########[]####[]####   #####[]####   #######[]####   #######[]####   #######[]####   #####[]######   ###############",
    "########[]####[]####   #####[]####   #######[]####   #######[]####   #######[]####   #####[]######   ###############",
    "########[]####[]####   #####[]####   #######[]####   #######[]####   #######[]####   #####[]######   ###############",
    "########[]####[]####   #####[]####   #######[]####   #######[]####   #######[]####   #####[]######   ###############",
  ],
};

const lvlForest = {
  id: '2-2', name: '丛林秘境', theme: 'forest', time: 350,
  rows: [
    "                                                                                                                      ",
    "                                                                                                                      ",
    "                                                                                                                      ",
    "                                                                                                                      ",
    "                                                                                                                      ",
    "            *                                                                                                         ",
    "        oooo                      oo                          o    o    o   o                               oooo      ",
    "        ====                 oo   === oo             ====          ===      ===                   o   o     ====      ",
    "                             ===      ===  ====               ===       ===      ====             === ===         F   ",
    "    @    g           k                       g       cg                           k          g              k   g     ",
    "################   #######               ########   ########                   #######   #######         #############",
    "################   #######               ########   ########                   #######   #######         #############",
    "################   #######               ########   ########                   #######   #######         #############",
    "################   #######               ########   ########                   #######   #######         #############",
  ],
};

const lvlBeach = {
  id: '2-3', name: '碧海沙滩', theme: 'beach', time: 350,
  rows: [
    "                                                                                                                    ",
    "                                                                                                                    ",
    "                                                                                                                    ",
    "                                                                                                                    ",
    "                                                                                                                    ",
    "                                                                                                                    ",
    "       M         ?             o   o           ?                                                    ooo             ",
    "             oo      oo                                                oo        oo        oo                       ",
    "                          ==  ==  ==                                                                        F       ",
    "    @   g         g                   k      gc         g           k       g                   k                   ",
    "############   #####   ###            ##   #######   #####   #      ##   #######   ##   ##   #######################",
    "############   #####   ###            ##   #######   #####   # []   ##   #######   ##[] ##   #######################",
    "############   #####   ###            ##   #######   #####   # []   ##   #######   ##[] ##   #######################",
    "############   #####   ###            ##   #######   #####   # []   ##   #######   ##[] ##   #######################",
  ],
};

const lvlNight = {
  id: '2-4', name: '暗夜要塞', theme: 'night', time: 360,
  rows: [
    "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "X                                                                                                                    X",
    "X                                                                                                                    X",
    "X                                                                                                                    X",
    "X                                                                                                                    X",
    "X       M                        ? B                      ? ?                                                        X",
    "X                                            o  o                                   ===                              X",
    "X          o o          o         o o                                 =o=            o           o o                 X",
    "X                                           === ==                                                                   X",
    "X   @     g g          k g        g k                    c  g k                                 g             F      X",
    "################   ########   ########   ###      ##   ########   ##########   ###########   ########   ##############",
    "################   ########   ########   ###      ##   ########   ##########   ###########   ########   ##############",
    "################   ########   ########   ###      ##   ########   ##########   ###########   ########   ##############",
    "################   ########   ########   ###      ##   ########   ##########   ###########   ########   ##############",
  ],
};

// ---------------------------------------------------------------------------
// World 3 (3-1 毒沼泽 … 3-5 终焉魔城) — the endgame world. 3-1..3-4 end at a flag;
// the grand finale 3-5 is castle-only (no flag), so reaching the castle fires the
// victory cutscene + win. Authored by parallel agents, all verifier-checked.
const lvlSwamp = {
  id: '3-1', name: '毒沼泽', theme: 'swamp', time: 360,
  rows: [
    '                                                                                                                    ',
    '                                                                                                                    ',
    '                                                                                                                    ',
    '                                                                                                                    ',
    '                                                                                                                    ',
    '        ?               b ?             M                      ooo                       ooo                        ',
    '             o     o           o             o     o            o                         o        o                ',
    '                                                                                                                    ',
    '                  ===                             ===          ===                       ===                  F     ',
    '    @   g               g g         k                   c               k g                             g   k       ',
    '############   ###   #########   ###########   ###   #######         #########   #####         ###   ###############',
    '############   ###   #########   ###########   ###   #######         #########   #####         ###   ###############',
    '############   ###   #########   ###########   ###   #######         #########   #####         ###   ###############',
    '############   ###   #########   ###########   ###   #######         #########   #####         ###   ###############',
  ],
};

const lvlCrystal = {
  id: '3-2', name: '水晶矿洞', theme: 'crystal', time: 360,
  rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X           X               X                     X                   X                   X                 X      X',
    'X           X               X                     X                   X                   X                 X      X',
    'X                                                                                                                  X',
    'X                                                                 *                                                X',
    'X        M              ?                            ?                                        ?                    X',
    'X       o o                                                      ooo                                               X',
    'X                      ooo                          ooo         =====                        ooo                   X',
    'X                     =====            XX          =====                                    =====        ooo  F    X',
    'X   @  g     k                     g XX    k       c     g             g        XXX k            g                 X',
    'X###############   ###########   ############   ###########   ###########   ##########   ##########   #############X',
    'X###############   ###########   ############   ###########   ###########   ##########   ##########   #############X',
    'X###############   ###########   ############   ###########   ###########   ##########   ##########   #############X',
    'X###############   ###########   ############   ###########   ###########   ##########   ##########   #############X',
  ],
};

const lvlStorm = {
  id: '3-3', name: '雷暴天际', theme: 'storm', time: 360,
  rows: [
    '                                                                                                                      ',
    '                                                                                                                      ',
    '                                                                                                                      ',
    '                                                                                                                      ',
    '                                                                                                                      ',
    '         ?                        *                                                      ??                           ',
    '                ooo    ooo  ooo           ooo   ooo  ooo             ooo   ooo  ooo                 ooo    ooo        ',
    '                       ===  ===                 ===  ===                   ===  === ===             ===    ===        ',
    '                       ===  ===                 ===  ===                   ===  === ===                          F    ',
    '    @   gg                         kg                        cgk                          g       k     g             ',
    '############   ######           ######   #####             ######   #####              ######   ######################',
    '############   ######           ######   #####             ######   #####              ######   ######################',
    '############   ######           ######   #####             ######   #####              ######   ######################',
    '############   ######           ######   #####             ######   #####              ######   ######################',
  ],
};

const lvlSteel = {
  id: '3-4', name: '钢铁要塞', theme: 'steel', time: 370,
  rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X                                                                                                                      X',
    'X                                                                                                                      X',
    'X                                                                                                                      X',
    'X                                                                                                                      X',
    'X    M                  *          ??                                    BB                        ?                   X',
    'X   ooo     o     o           oooo          o       o   o            oooo      o               o         oooo          X',
    'X                      XX     ====[]            X                    ====         XX []                                X',
    'X       []            XXXX        []           XX  === ===               []       XX []              []  ====    F     X',
    'X  @   g[]g           XkgX        []gk         Xg         kg    c        []k g    Xgk[]           gk []                X',
    'X#######[]#   ###   #######   ####[]##  ###   #####       ##   ###   ####[]###   ####[]##  ###   ####[]################X',
    'X#######[]#   ###   #######   ####[]##  ###   #####       ##   ###   ####[]###   ####[]##  ###   ####[]################X',
    'X#######[]#   ###   #######   ####[]##  ###   #####       ##   ###   ####[]###   ####[]##  ###   ####[]################X',
    'X#######[]#   ###   #######   ####[]##  ###   #####       ##   ###   ####[]###   ####[]##  ###   ####[]################X',
  ],
};

// 3-5 终焉魔城 — GRAND FINALE. Castle-only (the agent's flag 'F' was swapped to the
// castle 'A' so reaching it triggers _winGame → the kneel/crown/confetti cutscene).
const lvlAbyss = {
  id: '3-5', name: '终焉魔城', theme: 'abyss', time: 400,
  rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X                                                                                                                      X',
    'X                                                                                                                      X',
    'X                                                                                                                      X',
    'X                                                                                                                      X',
    'X                                 ?     ?                                   *                                          X',
    'X     M                            o  o  o                                            ??             oooo              X',
    'X       oooo                          XXXX          o    o  o            ooooo                o  o                     X',
    'X                                  XX XXXX XX                                                                 XX       X',
    'X   @    gg       k        gk    X XX XXXX XX  g   ===  === ==  kc  gg     k       gk     k  === ==   gg     XXX A  g  X',
    'X############   ######   #########################             #######   #####   ###########        #####   ###########X',
    'X############   ######   #########################             #######   #####   ###########        #####   ###########X',
    'X############   ######   #########################             #######   #####   ###########        #####   ###########X',
    'X############   ######   #########################             #######   #####   ###########        #####   ###########X',
  ],
};

export const LEVELS = [
  lvl1, lvl2, lvl3, lvlLava, lvlSnow, lvlDesert, lvlForest, lvlBeach, lvlNight, lvl4,
  lvlSwamp, lvlCrystal, lvlStorm, lvlSteel, lvlAbyss,
];

// ---------------------------------------------------------------------------
// Parse a level definition into a usable world description.
export function parseLevel(lvl) {
  const rows = lvl.rows;
  const numRows = rows.length;
  let cols = 0;
  for (const row of rows) cols = Math.max(cols, row.length);

  const grid = [];
  const enemies = [];
  const coins = [];
  let spawn = { x: 2 * TILE, y: 2 * TILE };
  let checkpoint = null;
  let flagX = null;
  let castleX = null;
  let castleY = null;

  for (let rIdx = 0; rIdx < numRows; rIdx++) {
    const row = rows[rIdx];
    const gridRow = new Array(cols).fill(null);
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const ch = row[cIdx] || ' ';
      if (ch === ' ') continue;

      if (ENTITY_CHARS.has(ch)) {
        const px = cIdx * TILE;
        const py = rIdx * TILE;
        if (ch === '@') {
          spawn = { x: px, y: py };
        } else if (ch === 'g') {
          enemies.push({ type: 'goomba', x: px, y: py });
        } else if (ch === 'k') {
          enemies.push({ type: 'koopa', x: px, y: py });
        } else if (ch === 'o') {
          coins.push({ x: px + TILE / 2, y: py + TILE / 2 });
        } else if (ch === 'c') {
          checkpoint = { x: px, y: py };
        }
        continue;
      }

      const type = TILES[ch];
      if (!type) continue;
      gridRow[cIdx] = type;
      if (type === 'flag' && flagX == null) flagX = cIdx * TILE;
      if (type === 'castle') { castleX = cIdx * TILE; castleY = rIdx * TILE; }
    }
    grid.push(gridRow);
  }

  // Optional checkpoint authored by a column index near a ground row.
  if (!checkpoint && lvl.checkpointCol != null) {
    // place the checkpoint flag at the first solid surface in that column
    const col = lvl.checkpointCol;
    let surfRow = numRows - 1;
    for (let rIdx = 0; rIdx < numRows; rIdx++) {
      if (grid[rIdx] && grid[rIdx][col]) { surfRow = rIdx; break; }
    }
    checkpoint = { x: col * TILE, y: (surfRow - 2) * TILE };
  }

  // Build moving platforms (positions are in tile units in the level def).
  const movers = (lvl.platforms || []).map((p) => ({
    x: p.x * TILE,
    y: p.y * TILE,
    axis: p.axis,
    range: p.range * TILE,
    speed: p.speed,
  }));

  return {
    grid,
    cols,
    rows: numRows,
    theme: lvl.theme,
    spawn,
    checkpoint,
    flagX,
    castleX,
    castleY,
    enemies,
    coins,
    movers,
    width: cols * TILE,
    height: numRows * TILE,
    time: lvl.time,
    name: lvl.name,
    id: lvl.id,
  };
}
