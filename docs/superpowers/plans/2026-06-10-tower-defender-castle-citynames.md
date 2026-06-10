# Tower Defender 城堡美化 + 真实城池命名 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把成都与敌营从占位色块升级为势力定制城堡贴图 + 每营一座真实三国城池名牌（章内唯一、知名度递进）。

**Architecture:** 新数据层 `cities.js`（5 章知名度升序城名池，236 名）→ `levels.js` 展开时按章内累计切片注入 `camp.cityName` → `board.js` 渲染建筑 billboard 贴图 + canvas 名牌 + 成都受损烟雾；美术走现有 Nano Banana 管线（`gen-sprites.mjs`）生成 3 张建筑 PNG，缺图回退现色块。

**Tech Stack:** 原生 ES Module + Canvas 2D；测试 = `node:assert` 自断言脚本（`node tests/<f>.test.mjs`，无框架）；sprite 生成 = OpenRouter / gemini-2.5-flash-image。

**Spec:** `docs/superpowers/specs/2026-06-10-tower-defender-castle-citynames-design.md`（决策依据，实现冲突时以 spec 为准）

**工作目录：所有命令默认在 `games/tower-defender/` 下执行。**

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/data/cities.js` | 新建 | 5 章城名池（纯数据，render-free、无随机） |
| `tests/cities.test.mjs` | 新建 | 池长度=推导需求 / 章内唯一 / 2-4 汉字 |
| `src/data/levels.js` | 修改 | `CITY_AT` 切片起点表 + expand 注入 `camp.cityName`（新对象防模板污染） |
| `tests/cityAssign.test.mjs` | 新建 | 每营有名 / 章内唯一 / 恰好用完整池 / 贴题岛 / 模板无污染 |
| `src/render/plate.js` | 新建 | `plateRect()` 名牌几何纯函数（无 ctx/DOM） |
| `tests/plate.test.mjs` | 新建 | 名牌几何（宽度递增/居中/缩放） |
| `src/render/entityRenderer.js` | 修改 | `aspect()` 加 export（board.js 复用，DRY） |
| `src/render/board.js` | 修改 | 建筑贴图渲染 + 名牌 + 成都烟雾；fallback 保留 |
| `tools/gen-sprites.mjs` | 修改 | `STYLE_BUILDING` + `styleOf()` + 3 个 buildings 条目 |
| `src/core/assets.js` | 修改 | MANIFEST + 3 个 building id（assets.test.mjs 是泛型循环，无需改测试） |

---

### Task 1: cities.js 城名池数据

**Files:**
- Create: `src/data/cities.js`
- Test: `tests/cities.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
// tests/cities.test.mjs — 城名池：池长度=由 CAMPAIGN×TEMPLATES 推导的需求、章内唯一、2-4 汉字
// 运行：node games/tower-defender/tests/cities.test.mjs
import assert from 'node:assert';
import { CITY_POOLS } from '../src/data/cities.js';
import { CAMPAIGN } from '../src/data/campaign.js';
import { TEMPLATES } from '../src/data/boardTemplates.js';

// 推导各章 camp 总需求（样板关按 pathSubset，生成关按模板全路）
const need = {};
for (const c of CAMPAIGN) {
  const tmpl = TEMPLATES[c.templateId];
  const n = (c.pathSubset && c.pathSubset.length) || Object.keys(tmpl.paths).length;
  need[c.chapter] = (need[c.chapter] || 0) + n;
}

for (const ch of [1, 2, 3, 4, 5]) {
  const pool = CITY_POOLS[ch];
  assert.ok(Array.isArray(pool), `章${ch} 池存在`);
  assert.equal(pool.length, need[ch], `章${ch} 池长 ${pool && pool.length} 应= ${need[ch]}`);
  assert.equal(new Set(pool).size, pool.length, `章${ch} 城名章内唯一`);
  for (const name of pool) assert.ok(/^[一-鿿]{2,4}$/.test(name), `城名「${name}」应为 2-4 个汉字`);
}
console.log('ok cities');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/cities.test.mjs`
Expected: FAIL —— `Cannot find module .../src/data/cities.js`

- [ ] **Step 3: 新建 cities.js（完整数据，逐关切片注释便于 James 审名单）**

```js
// data/cities.js — 5 章敌方城池名池（城堡美化 spec §5）。
// 规则：每章数组长度精确 = 该章 camp 总需求（26/36/46/56/72）；知名度升序为骨架，
// 样板关切片区间放贴题城名（"主题岛"例外）；章内唯一，跨章可复用（如长安）。
// 铁律：render-free、纯数据、无随机。名单史实向（汉末县/城/关隘/渡口）。
export const CITY_POOLS = {
  // —— 第1章 天下大乱·讨董中原（26 = L1×3 + L2-5×2 + L6-10×3）——
  1: [
    '宛城', '叶县', '堵阳',                // L1 博望坡（贴题岛：夏侯惇出兵方向）
    '缑氏', '偃师',                        // L2
    '梁县', '阳人',                        // L3（阳人之战：孙坚破华雄）
    '鄢陵', '长社',                        // L4
    '阳翟', '轘辕关',                      // L5
    '广成关', '伊阙关', '小平津',          // L6（洛阳八关）
    '孟津', '成皋', '荥阳',                // L7
    '中牟', '酸枣', '封丘',                // L8（捉放曹/联军会盟）
    '陈留', '濮阳', '汜水关',              // L9
    '虎牢关', '长安', '洛阳',              // L10（三英战吕布→帝都压轴）
  ],
  // —— 第2章 官渡之争·河北（36 = L11×4 + L12-15×3 + L16-20×4）——
  2: [
    '编县', '麦城', '当阳', '襄阳',        // L11 长坂坡（贴题岛：曹军追击线）
    '阴安', '繁阳', '内黄',                // L12
    '馆陶', '斥丘', '武安',                // L13
    '涉县', '朝歌', '汲县',                // L14
    '获嘉', '修武', '怀县',                // L15
    '轵县', '温县', '河阳', '燕县',        // L16
    '东阿', '鄄城', '平原', '清河',        // L17（刘备曾领平原）
    '巨鹿', '广宗', '邯郸', '仓亭',        // L18（仓亭之战）
    '易京', '南皮', '黎阳', '延津',        // L19（文丑殒命）
    '白马', '乌巢', '邺城', '官渡',        // L20（斩颜良/火烧乌巢→官渡压轴）
  ],
  // —— 第3章 火烧赤壁·荆襄江东（46 = L21×5 + L22-25×4 + L26-30×5）——
  3: [
    '乌林', '巴丘', '陆口', '夏口', '江陵',     // L21 赤壁（贴题岛：曹军水陆营）
    '下隽', '州陵', '沙羡', '邾县',             // L22
    '蕲春', '寻阳', '历阳', '阜陵',             // L23
    '居巢', '罗县', '益阳', '临湘',             // L24
    '汉寿', '孱陵', '春谷', '虎林',             // L25
    '芜湖', '牛渚', '石城', '丹徒', '曲阿',     // L26
    '吴县', '山阴', '南昌', '鄱阳', '庐陵',     // L27
    '海昏', '武陵', '零陵', '桂阳', '长沙',     // L28（荆南四郡）
    '江夏', '华容', '皖城', '濡须', '京口',     // L29（华容道）
    '秣陵', '武昌', '柴桑', '合肥', '建业',     // L30（逍遥津/吴都压轴）
  ],
  // —— 第4章 进取西川·汉中（56 = L31×6 + L32-35×5 + L36-40×6）——
  4: [
    '褒中', '沔阳', '城固', '天荡山', '南郑', '阳平关',   // L31 定军山（贴题岛：夏侯渊汉中据点）
    '符节', '牛鞞', '资中', '僰道', '朱提',               // L32
    '江原', '临邛', '郫县', '新都', '广都',               // L33
    '武阳', '德阳', '什邡', '江阳', '垫江',               // L34
    '朐忍', '汉昌', '安汉', '充国', '涪陵',               // L35
    '鱼复', '房陵', '上庸', '西城', '锡县', '赤坂',       // L36
    '黄金', '兴势', '武兴', '黄沙', '汉城', '乐城',       // L37（汉中防线诸戍）
    '马鸣阁', '关城', '沮县', '河池', '下辨', '故道',     // L38
    '散关', '宕渠', '阆中', '江州', '梓潼', '涪城',       // L39（张飞破张郃/阆中）
    '雒城', '绵竹', '白帝城', '白水关', '葭萌关', '剑阁', // L40（庞统/张飞战马超/剑门压轴）
  ],
  // —— 第5章 夷陵之火·六出祁山（72 = L41×8 + L42-45×6 + L46-49×8 + L50×8）——
  5: [
    '巫县', '秭归', '夷道', '佷山', '信陵', '西陵', '猇亭', '夷陵',   // L41 夷陵（贴题岛：吴军沿江据点）
    '枝江', '乐乡', '公安', '略阳', '平襄', '绵诸',                    // L42
    '清水', '障县', '兰干', '成纪', '显亲', '陇县',                    // L43
    '汧县', '雍县', '美阳', '杜阳', '槐里', '榆中',                    // L44
    '金城', '枹罕', '临洮', '狄道', '襄武', '首阳',                    // L45
    '中陶', '落门', '段谷', '沓中', '洮阳', '河关', '武街', '阴密',    // L46（姜维线地名）
    '泥阳', '漆县', '栒邑', '云阳', '郁夷', '虢县', '渝麋', '斜谷关',  // L47
    '箕谷', '赤崖', '列柳城', '阳溪', '卤城', '木门', '西县', '冀县',  // L48（张郃殒命木门）
    '望垣', '建威', '天水', '南安', '安定', '武都', '阴平', '祁山',    // L49（一伐三郡响应/六出祁山）
    '临渭', '郿县', '武功', '五丈原', '陈仓', '街亭', '上邽', '长安',  // L50 上方谷（贴题岛：北伐名城压轴）
  ],
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/cities.test.mjs`
Expected: `ok cities`（长度断言会自动核对 26/36/46/56/72，数错即红）

- [ ] **Step 5: Commit**

```bash
git add src/data/cities.js tests/cities.test.mjs
git commit -m "feat(tower-defender): cities.js 5章城名池(236名,知名度升序+样板贴题岛)+单测"
```

---

### Task 2: levels.js 注入 camp.cityName

**Files:**
- Modify: `src/data/levels.js`（import 区 + expand 内 camps 一行）
- Test: `tests/cityAssign.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
// tests/cityAssign.test.mjs — 城名注入：每营有名/关内唯一/章内唯一且恰好用完整池/贴题岛/模板无污染
// 运行：node games/tower-defender/tests/cityAssign.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { CITY_POOLS } from '../src/data/cities.js';
import { TEMPLATES } from '../src/data/boardTemplates.js';

// 1) 每关每营都有 cityName 且关内唯一
for (const lv of LEVELS) {
  for (const cp of lv.camps) assert.ok(typeof cp.cityName === 'string' && cp.cityName.length >= 2, `L${lv.id} camp ${cp.id} 有城名`);
  const names = lv.camps.map((c) => c.cityName);
  assert.equal(new Set(names).size, names.length, `L${lv.id} 关内城名唯一`);
}
// 2) 章内唯一 + 恰好用完整池（不多不少、确定性的强断言）
for (const ch of [1, 2, 3, 4, 5]) {
  const names = LEVELS.filter((l) => l.chapter === ch).flatMap((l) => l.camps.map((c) => c.cityName));
  assert.equal(new Set(names).size, names.length, `章${ch} 章内城名唯一`);
  assert.deepEqual([...names].sort(), [...CITY_POOLS[ch]].sort(), `章${ch} 恰好用完整池`);
}
// 3) 样板关贴题岛抽查（L1 首营序、L50 末营=长安）
assert.deepEqual(LEVELS[0].camps.map((c) => c.cityName), ['宛城', '叶县', '堵阳'], 'L1 贴题岛');
const L50 = LEVELS[49];
assert.equal(L50.camps[L50.camps.length - 1].cityName, '长安', 'L50 末营=长安');
// 4) TEMPLATES 单例不被污染（注入必须建新对象）
for (const t of Object.values(TEMPLATES)) for (const cp of t.camps) assert.equal(cp.cityName, undefined, '模板 camps 无 cityName 污染');
console.log('ok cityAssign');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/cityAssign.test.mjs`
Expected: FAIL —— `L1 camp a 有城名`（cityName undefined）

- [ ] **Step 3: 改 levels.js**

import 区（`import { BOSSES, ... }` 之后）加：

```js
import { CITY_POOLS } from './cities.js';

// 城名切片起点：章内累计 camp 数（spec §5.2）。确定性，加载期无随机。
const CITY_AT = (() => {
  const next = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, at = {};
  for (const c of CAMPAIGN) {
    const tmpl = TEMPLATES[c.templateId];
    const n = (c.pathSubset && c.pathSubset.length) || Object.keys(tmpl.paths).length;
    at[c.id] = next[c.chapter];
    next[c.chapter] += n;
  }
  return at;
})();
```

expand() 内，将这一行：

```js
  const camps = tmpl.camps.filter((cp) => subset.includes(cp.id));
```

替换为（新对象注入，防 TEMPLATES 单例污染）：

```js
  const cityNames = CITY_POOLS[c.chapter].slice(CITY_AT[c.id], CITY_AT[c.id] + subset.length);
  const camps = tmpl.camps.filter((cp) => subset.includes(cp.id)).map((cp, i) => ({ ...cp, cityName: cityNames[i] }));
```

- [ ] **Step 4: 跑新测试 + 全量回归**

Run: `node tests/cityAssign.test.mjs`
Expected: `ok cityAssign`

Run: `for f in tests/*.test.mjs; do node "$f" || break; done`
Expected: 每个文件打印 `ok ...`，无 break（存量 42 + 新 2 全绿）

Run: `node tools/verify-levels.mjs`
Expected: exit 0（camps 加字段不影响几何校验）

- [ ] **Step 5: Commit**

```bash
git add src/data/levels.js tests/cityAssign.test.mjs
git commit -m "feat(tower-defender): levels展开按章内切片注入camp.cityName(章内唯一/贴题岛/防模板污染)"
```

---

### Task 3: plate.js 名牌几何纯函数

**Files:**
- Create: `src/render/plate.js`
- Test: `tests/plate.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
// tests/plate.test.mjs — 名牌几何：宽度随字数递增、水平居中、scale 放大
// 运行：node games/tower-defender/tests/plate.test.mjs
import assert from 'node:assert';
import { plateRect } from '../src/render/plate.js';

const C = 36;
const r2 = plateRect('街亭', 100, 200, C);
const r3 = plateRect('五丈原', 100, 200, C);
const r4 = plateRect('葭萌关城', 100, 200, C);
assert.ok(r2.w < r3.w && r3.w < r4.w, '宽度随字数递增');
for (const r of [r2, r3, r4]) {
  assert.ok(Math.abs((r.x + r.w / 2) - 100) < 0.51, '水平居中于 cx');
  assert.equal(r.y, 200, '牌顶贴 footY');
  assert.ok(r.h > 0 && r.fontPx > 0, '高度/字号为正');
  assert.equal(r.textX, 100, '文字 x=cx');
  assert.ok(r.textY > r.y && r.textY < r.y + r.h, '文字 y 在牌内');
}
const big = plateRect('成都', 100, 200, C, 1.3);
assert.ok(big.fontPx > r2.fontPx && big.w > r2.w, 'scale=1.3 整体放大');
console.log('ok plate');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/plate.test.mjs`
Expected: FAIL —— `Cannot find module .../src/render/plate.js`

- [ ] **Step 3: 实现 plate.js**

```js
// render/plate.js — 城名牌几何（纯函数，无 ctx/DOM，供 board.js 绘制与单测）。
// 返回 { x, y, w, h, fontPx, textX, textY }：牌顶贴 footY、水平居中于 cx。
export function plateRect(text, cx, footY, C, scale = 1) {
  const fontPx = Math.round(C * 0.3 * scale);
  const padX = Math.round(C * 0.12 * scale), padY = Math.round(C * 0.07 * scale);
  const w = text.length * fontPx + padX * 2;
  const h = fontPx + padY * 2;
  return { x: cx - w / 2, y: footY, w, h, fontPx, textX: cx, textY: footY + h / 2 };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/plate.test.mjs`
Expected: `ok plate`

- [ ] **Step 5: Commit**

```bash
git add src/render/plate.js tests/plate.test.mjs
git commit -m "feat(tower-defender): plateRect城名牌几何纯函数+单测"
```

---

### Task 4: board.js 建筑贴图 + 名牌 + 成都烟雾

**Files:**
- Modify: `src/render/entityRenderer.js`（仅 1 行：`function aspect(` → `export function aspect(`）
- Modify: `src/render/board.js`（敌营/成都两段重写 + 3 个新 helper）

- [ ] **Step 1: entityRenderer.js 导出 aspect**

将 `function aspect(img) {` 改为 `export function aspect(img) {`（其余不动，DRY 供 board.js 复用）。

- [ ] **Step 2: 重写 board.js 的敌营/成都段**

文件头 import 区改为：

```js
import { BAL } from '../data/balance.js';
import { tintOf } from '../data/factions.js';
import { assets } from '../core/assets.js';
import { aspect } from './entityRenderer.js';
import { plateRect } from './plate.js';
```

文件末尾（drawBoard 之外）加 3 个 helper：

```js
// 建筑 billboard：底边锚 footY、高 hCells 格、按图片纵横比定宽 + 椭圆投影（同 entityRenderer 约定）
function drawBuilding(ctx, img, cx, footY, hCells) {
  const h = C * hCells, w = h / aspect(img);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(cx, footY, w * 0.36, w * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(img, cx - w / 2, footY - h, w, h);
}

// 城名牌：敌营=深底白字；gold=true 成都金红款（spec §6 配色）
function drawPlate(ctx, text, cx, footY, gold = false) {
  const r = plateRect(text, cx, footY, C, gold ? 1.3 : 1);
  ctx.fillStyle = gold ? 'rgba(94,18,22,.85)' : 'rgba(20,16,24,.78)';
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 4); ctx.fill();
  ctx.strokeStyle = gold ? '#e8c06a' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = gold ? '#ffe9b0' : '#f5edd8';
  ctx.font = `bold ${r.fontPx}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, r.textX, r.textY);
}

// 成都受损烟雾（spec §4）：HP<50% 灰烟 2 缕、HP<25% 橙红 3 缕；脉动用 state.time（gameLoop 累计秒）
function drawCastleSmoke(ctx, state, cx, topY) {
  const ratio = state.castleHp / state.castleMaxHp;
  if (!(ratio < 0.5)) return;
  const t = state.time || 0, fire = ratio < 0.25, n = fire ? 3 : 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ph = t * 0.9 + i * 2.1;
    const sway = Math.sin(ph) * C * 0.18;
    const a = 0.25 + 0.15 * Math.sin(ph * 1.7);
    ctx.strokeStyle = fire ? `rgba(224,122,42,${a.toFixed(3)})` : `rgba(90,90,100,${a.toFixed(3)})`;
    ctx.lineWidth = C * (0.16 - i * 0.03);
    const bx = cx + (i - 1) * C * 0.35;
    ctx.beginPath();
    ctx.moveTo(bx, topY);
    ctx.bezierCurveTo(bx + sway, topY - C * 0.5, bx - sway, topY - C * 0.9, bx + sway * 1.4, topY - C * 1.3);
    ctx.stroke();
  }
}
```

drawBoard 内，将「敌营（深色块 + 旗）」整段替换为：

```js
  // 敌营：势力城堡贴图（building_wei/wu/...；缺图回退色块+旗）+ 城名牌
  const campImg = assets.images['building_' + state.level.faction];
  for (const cp of camps) {
    const ccx = cp.c * C + C / 2, footY = cp.r * C + C - 1;
    if (campImg) {
      drawBuilding(ctx, campImg, ccx, footY, 1.6);
    } else {
      ctx.fillStyle = '#4a3550'; ctx.fillRect(cp.c * C + 3, cp.r * C + 3, C - 6, C - 6);
      ctx.fillStyle = '#b3243a'; ctx.fillRect(cp.c * C + C / 2 - 1, cp.r * C + 4, 8, 5);
    }
    if (cp.cityName) drawPlate(ctx, cp.cityName, ccx, footY + 1);
  }
```

「成都 2×2」整段替换为：

```js
  // 成都：蜀汉大城楼贴图（缺图回退色块）+ 金红名牌 + 受损烟雾
  const castleImg = assets.images.building_chengdu;
  const kcx = (castle.c + castle.w / 2) * C, kFootY = (castle.r + castle.h) * C - 2;
  if (castleImg) {
    drawBuilding(ctx, castleImg, kcx, kFootY, 2.7);
  } else {
    ctx.fillStyle = '#9aa0a8';
    ctx.fillRect(castle.c * C + 2, castle.r * C + 2, castle.w * C - 4, castle.h * C - 4);
    ctx.strokeStyle = '#5f6268'; ctx.lineWidth = 2;
    ctx.strokeRect(castle.c * C + 2, castle.r * C + 2, castle.w * C - 4, castle.h * C - 4);
  }
  drawPlate(ctx, '成都', kcx, kFootY + 1, true);
  drawCastleSmoke(ctx, state, kcx, castleImg ? kFootY - C * 2.7 : castle.r * C + 4);
```

注意：回退分支不再 fillText「成都」（金红名牌已盖全场景，避免双字）；原 `fillStyle:'#5f6268'` 误用 fill 画边，此处顺改为 `strokeStyle`（原代码 bug：fillStyle 设了但调 strokeRect）。顶行敌营（r=0）贴图上沿越出板顶 ~0.6 格——与现有 row 0 塔位 billboard 行为一致（既有先例），木框托盘有 7px 余量，可接受。

- [ ] **Step 3: 全量回归 + 自含校验**

Run: `for f in tests/*.test.mjs; do node "$f" || break; done`
Expected: 全部 `ok ...`（render 层无单测，回归保证 data/core 无破坏）

Run: `bash scripts/check-imports.sh`
Expected: exit 0（board.js 新增 import 均在本游戏内）

- [ ] **Step 4: Commit**

```bash
git add src/render/board.js src/render/entityRenderer.js
git commit -m "feat(tower-defender): board敌营/成都改建筑billboard贴图+城名牌+成都受损烟雾(缺图回退色块)"
```

---

### Task 5: gen-sprites 建筑条目 + MANIFEST 注册

**Files:**
- Modify: `tools/gen-sprites.mjs`（STYLE_BUILDING + styleOf + 3 条目）
- Modify: `src/core/assets.js`（MANIFEST + 3 行）

- [ ] **Step 1: gen-sprites.mjs 加建筑风格与条目**

`const STYLE = ...` 之后加：

```js
const STYLE_BUILDING = '近正俯视 3/4 视角的半写实卡通塔防游戏建筑立绘，厚描边，暖色调，类似《王国保卫战 Kingdom Rush》的精细卡通游戏美术。正方形构图，建筑单体居中，底边贴画面底部中线，纯透明背景，无地面、无阴影、无任何文字，旗帜一律纯色无字。';
const styleOf = (u) => (u.cat === 'buildings' ? STYLE_BUILDING : STYLE);
```

`gen()` 内第一行 `const text = STYLE + ' 单位：' + unit.desc` 改为：

```js
  const text = styleOf(unit) + (unit.cat === 'buildings' ? ' 建筑：' : ' 单位：') + unit.desc
```

UNITS 数组末尾加（蛮款按 spec §8 本期不生成）：

```js
  // —— [城堡美化] 建筑：势力敌营城堡 + 成都（蛮款待南蛮关卡时再生成，见 spec §3/§8）——
  { cat: 'buildings', id: 'wei', desc: '三国曹魏军镇城堡（敌方据点）：玄黑砖石城墙与垛口，铆钉加固的厚重铁门，城墙上一座双层中式歇山顶城楼，深色瓦顶配暗红色檐线点缀，墙头两座燃着火光的烽火盆，一面深蓝色纯色燕尾战旗（旗面无任何文字图案）。气质森严压迫。' },
  { cat: 'buildings', id: 'wu', desc: '三国东吴水寨城堡（敌方据点）：建在水边木桩平台上的水寨城堡，底部可见波纹水面与木桩基座，木石混合城墙，江南风格翘檐青瓦双层城楼，城门两侧挂一对红灯笼，背景露出一截战船桅杆与布帆，一面青绿色纯色战旗（旗面无任何文字图案）。气质灵秀水乡。' },
  { cat: 'buildings', id: 'chengdu', desc: '三国蜀汉都城成都的雄伟城楼（玩家大本营）：金红配色的三层中式楼阁城楼，朱红色城门与立柱，金黄色瓦顶层层飞檐，浅色石砌城墙，多面赤红色纯色汉式旌旗（旗面无任何文字图案），比普通军镇城堡更高大宏伟。气质巍峨温暖、值得守护的家园。' },
```

- [ ] **Step 2: assets.js MANIFEST 注册**

MANIFEST 对象末尾加：

```js
  // —— [城堡美化] 建筑：势力敌营 + 成都（蛮款待南蛮关卡：补图 + 此处加一行即生效）——
  building_wei: 'assets/sprites/buildings/wei.png',
  building_wu: 'assets/sprites/buildings/wu.png',
  building_chengdu: 'assets/sprites/buildings/chengdu.png',
```

`tests/assets.test.mjs` 对 MANIFEST 做泛型循环断言，**无需修改**。

- [ ] **Step 3: 回归**

Run: `for f in tests/*.test.mjs; do node "$f" || break; done`
Expected: 全部 `ok ...`（assets 测试自动覆盖新 id）

- [ ] **Step 4: Commit（代码先行，图片在 Step 5 人工审后单独提交）**

```bash
git add tools/gen-sprites.mjs src/core/assets.js
git commit -m "feat(tower-defender): gen-sprites建筑风格常量+魏/吴/成都条目, MANIFEST注册building_*"
```

- [ ] **Step 5: 生成图片（人工环节·需 James 提供 key）**

```bash
OPENROUTER_API_KEY=sk-or-... node tools/gen-sprites.mjs wei wu chengdu
```

Expected: `✓ buildings/wei.png ✓ buildings/wu.png ✓ buildings/chengdu.png`（复用已存黄忠锚保画风）。
人工审图：直接 `open assets/sprites/buildings/*.png` 对照 spec §3 元素清单；不合格的单独重跑该 id。

- [ ] **Step 6: 图片入库提交**

```bash
git add assets/sprites/buildings/
git commit -m "assets(tower-defender): 魏玄黑石城/吴青瓦水城/成都蜀汉城楼 3张建筑sprite(Nano Banana,黄忠锚)"
```

---

### Task 6: 全门禁 + 冒烟 + 验收

**Files:** 无新文件（验证任务）

- [ ] **Step 1: 全量门禁**

```bash
for f in tests/*.test.mjs; do node "$f" || break; done   # 期望 45 个 ok（42 存量 + cities/cityAssign/plate）
node tools/verify-levels.mjs                              # 期望 exit 0
bash scripts/check-imports.sh                             # 期望 exit 0
```

- [ ] **Step 2: 浏览器冒烟（启动无崩 + 截图）**

```bash
cd /Users/james/Projects/game-hub/games/tower-defender && python3 -m http.server 8080
```

另开终端跑（依赖 host 侧 puppeteer-core + 系统 Chrome，与 boom-worms 冒烟同模式；若未装：`npm i -g puppeteer-core`）：

```bash
node --input-type=module -e "
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:8080/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1500));
await p.screenshot({ path: '/tmp/td-castles-smoke.png' });
console.log(errs.length ? 'PAGEERROR:\n' + errs.join('\n') : 'ok smoke, screenshot /tmp/td-castles-smoke.png');
await b.close();
"
```

Expected: `ok smoke`，无 PAGEERROR。截图人工看一眼选关页正常。

- [ ] **Step 3: James 人工验收清单（spec §9）**

- L1（魏）：3 座玄黑石城 + 宛城/叶县/堵阳名牌；
- L21（吴）：5 座青瓦水城 + 乌林/巴丘/陆口/夏口/江陵名牌；
- 任一关：成都蜀汉大城楼 + 金红「成都」牌；故意漏怪掉血至 <10/20 出灰烟、<5/20 转橙红火苗；
- 第 5 章逐关扫一眼：城名无重复、越往后越知名（L50 末营长安）。

- [ ] **Step 4: 验收通过后归档**

按仓库惯例把本计划与 spec 标记完成（commit message 注明检查点），更新游戏 memory 状态。

---

## Self-Review 记录（写完计划后自查）

- **Spec 覆盖**：§3 美术（Task 5）、§4 渲染+烟（Task 4）、§5 城名池+切片+贴题岛（Task 1/2）、§6 名牌（Task 3/4）、§7 测试门禁（各 Task Step + Task 6）、§8 范围外（蛮款不生成 ✓ 玩法/story 未触碰 ✓）、§9 验收（Task 6 Step 3）——无缺口。
- **占位符扫描**：全部步骤含完整代码/命令/期望输出；城名 236 个全量在 Task 1（James 审名单即审该文件）。
- **类型一致性**：`camp.cityName`（Task 2 注入 ↔ Task 4 读取）、`plateRect` 返回字段（Task 3 定义 ↔ Task 4 使用）、`building_wei/wu/chengdu`（Task 5 MANIFEST ↔ Task 4 取图）、`aspect` export（Task 4 两文件）一致。
- **史实校正**：spec §5.3 示例中的「渭南」按汉末口径改为「临渭」（spec 标注名单实现期定稿，属预期内编辑）。
