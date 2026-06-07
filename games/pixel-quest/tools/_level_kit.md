# Level Authoring Kit — 像素冒险 PIXEL QUEST

You are authoring ONE new level for a tile-based platformer. Your only deliverable
is a single validated JavaScript level object. Work from the project root
`/Users/james/Projects/game-hub/games/pixel-quest`.

## Deliverable format
A JS object literal exactly like this (id/name/theme/time given in your assignment):
```js
{
  id: '2-1', name: '黄沙关', theme: 'desert', time: 340,
  rows: [ /* 14 strings, ALL THE SAME LENGTH (use ~110–120 chars) */ ],
}
```
Return ONLY this object (plus the validator's final `PASS` output as proof). Do NOT
edit `src/config.js` or `src/levels.js` — integration is done by the orchestrator.
The theme color set is added by the orchestrator; you only use the theme key name.

## Tile legend (characters inside the row strings)
- `#` ground, `X` block (solid; also used as side walls / ceiling)
- `B` brick, `b` brickCoin (coin brick), `?` qcoin, `M` qpower (mushroom/flower), `*` qstar
- `[` `]` pipe left/right halves (a pipe is `[]` side by side, can be 1+ tiles tall)
- `=` platform, `F` flag (level goal), `A` castle (DO NOT USE — finale only)
- Entity markers (become objects, not tiles): `@` player spawn, `c` checkpoint,
  `g` goomba, `k` koopa, `o` floating coin
- New monster markers (阶段 B): `v` 飞翼怪(空中,须摆在地面/平台上方,掉翅膀后能落地),
  `z` 冲刺兽(地面,前方留一段平直地),`p` 食人花(管口,踩不死;本段必须配火花道具 `M` +
  留"等它缩回再跳过"的躲避路径),`a` 甲壳兽(踩反伤,小写 `a`≠大写 `A` 城堡;必须与 `k` 同摆,
  供踢壳消灭),`m` 炎魔(定时喷火球,须给玩家躲火球的横向空间)。
- 注意:verifier 对新怪透明,不校验"摆位合理性"(飞翼下方有地/食人花配 M/甲壳配 k),阶段 C 须人工+真机验收。

## Layout conventions (14 rows tall)
- Rows 10–13 = the main floor (`#`). Carve pits by leaving spaces.
- Row 9 = where entities sit: `@`, `g`, `k`, `c` (they rest on the floor below).
- Rows 5–8 = floating coins `o`, platforms `=`, and bumpable blocks `? M * B b`.
- Rows 0–4 = sky (usually empty). Open levels have no ceiling; "fortress" levels MAY
  use a full row-0 `X` ceiling + `X` side walls (the verifier handles ceilings).
- Put `@` near the left (e.g. col 3–5) on solid floor. Put `F` near the right
  (e.g. ~8 cols before the end) with solid floor beneath it.

## HARD RULES (the validator enforces all of these — you MUST get `PASS`)
Physics: jump apex ≈ 4.3 tiles, walk reach ≈ 3.8 tiles. So:
1. **Pits ≤ 3 tiles wide.** A column with no floor AND no platform above is "deadly";
   no more than 3 deadly columns in a row between spawn and goal.
   - To make a WIDER lava/water channel, bridge it with `=` platforms (rows 7–8) so
     no run of bare columns exceeds 3. Platform vs floor height diff must be ≤ 3.
2. **Steps ≤ 3 tiles.** Adjacent walkable surfaces can rise at most 3 tiles.
   Pyramids/stairs must step up ≤3 at a time.
3. **Bumpable blocks (`? M * B b`)**: must sit in rows 4–9 (not higher than row 4),
   and NOT within 1 column of any pit edge (keep them ≥2 cols from pits) — otherwise
   they "block a jump over a pit".
4. **Goal**: include exactly one `F` (flag). NEVER place `A` (castle).
5. **Checkpoint `c`**: place one, mid-level, on a column that has solid floor below it.
6. **Spawn `@`**: must be over solid floor.
7. All 14 rows must be the SAME length.

## How to validate (iterate until PASS)
1. Write your level object to a temp file as a default export, e.g.:
   `/tmp/level-<yourtheme>.mjs` containing: `export default { id:'...', ... };`
2. Run: `node tools/_validate_one.mjs /tmp/level-<yourtheme>.mjs`
3. Read the issues, fix your rows, repeat until it prints `PASS`.

## STRONGLY RECOMMENDED: generate rows with a script (don't hand-count spaces)
Hand-typing 120-char rows with exact pit widths is error-prone. Instead write a small
Node script that places tiles at computed columns, guaranteeing widths, then prints the
rows. Example pattern (adapt freely):
```js
// /tmp/gen-<theme>.mjs  ->  run: node /tmp/gen-<theme>.mjs
const COLS=116, ROWS=14;
const g=Array.from({length:ROWS},()=>Array(COLS).fill(' '));
const span=(r,c0,c1,ch)=>{for(let c=c0;c<=c1;c++)g[r][c]=ch;};
const set=(r,c,ch)=>{g[r][c]=ch;};
// floor rows 10-13, then carve 3-wide pits:
const pits=[[14,16],[26,28],[40,42],[58,60],[72,74],[88,90],[102,104]];
for(let r=10;r<=13;r++){ span(r,0,COLS-1,'#'); for(const[a,b]of pits) span(r,a,b,' '); }
// a platform-bridged wider channel example (floor gap 46-55, two pads to hop):
// span(10,46,55,' ');...; span(8,46,49,'='); span(8,52,55,'=');
set(9,3,'@');
for(const c of [8,22,48,70,96]) set(9,c,'g');
for(const c of [34,80]) set(9,c,'k');
set(9,52,'c');                 // checkpoint (ensure floor below this col!)
set(5,10,'M'); set(5,33,'?'); set(5,35,'?'); set(5,66,'*'); // blocks (>=2 from pits)
for(const c of [9,21,23,67,69,95,97]) set(7,c,'o'); // coins
set(8,108,'F');                // flag near the end
const rows=g.map(r=>r.join(''));
console.log('export default '+JSON.stringify({id:'X',name:'Y',theme:'Z',time:340,rows})+';');
```
Then pipe/save its output to your `/tmp/level-*.mjs` and validate.

## Content / feel guidance
- Make it fun and FAIR: walk-only crossable (no run key needed), readable layouts.
- Include: 6–10 enemies (mix `g`/`k`), 1 power-up (`M` or `*`), a few coin clusters,
  1 checkpoint, and a satisfying rhythm of pits + platforms.
- Match the difficulty band in your assignment. Variety between sections is good.
- Your assignment specifies a gimmick/identity — lean into it with layout (e.g. pipes
  for desert, lots of platforms for jungle, wide bridged channels for water, dense
  pits + tight platforms for the dark fortress).
