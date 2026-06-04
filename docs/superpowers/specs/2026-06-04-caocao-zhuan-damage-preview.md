# 《群雄逐鹿·孟德篇》战斗伤害预测 UI — 设计稿（待审）

> 攻击/计略前显示「预想伤害 + 命中 + 反击 + 击杀」预测面板（SRPG 关键手感）。
> 纯本作设计；伤害/命中沿用本作既定公式。状态：**待 James 审阅**。

## 1. 触发时机
- **普攻**：选中我方单位 → 进攻击模式 → **悬停/点选**一个射程内敌人 → 弹出预测面板（确认才真打）。
- **计略**：选技能 → 目标格悬停 → 对 AOE 覆盖的每个目标显示预测（伤害/治疗/状态/命中）。
- 敌方回合可选：悬停敌人攻击意图时也可显示（先做我方）。

## 2. 面板内容（双向预测）
```
┌─ 夏侯惇(我) → 黄巾枪兵(敌) ──────────┐
│ 命中 92%      预想伤害 28–34         │   ← 我方对敌（抖动区间）
│ ☠ 可击杀(敌 30/44→0)                 │   ← 击杀提示(高亮)
│ 修正: 兵种克制↑1.3 · 地形林 防+2 · 晴 │   ← 相克/地形/天气/状态标签
│ 连击 40% · 致命 15%                  │   ← 爆发/士气衍生几率
│ ── 反击 ──                          │
│ 敌反击 命中 70% 伤害 6–8 (不会被反杀) │   ← 敌→我（若在反击距离；否则"无反击")
└──────────────────────────────────┘
```
- 计略版：逐目标列「命中% · 伤害/治疗 · 施加状态(如中毒3回合) · 是否击杀」；buff/heal 不显示反击。
- 颜色编码：绿=有利/可击杀；红=会被反杀或己方危险；灰=miss 风险高。

## 3. 数据来源（需要「干跑」预测，不改状态）
新增**纯函数预测**（复用既有公式，不 mutate）：
```js
// battle/forecast.js
predictAttack(attacker, defender, map, weather)
//  -> { hitPct, dmgMin, dmgMax, willKill, counter:{hitPct,dmgMin,dmgMax,willKill}|null,
//       comboPct, critPct, mods:[{label, kind:'up'|'down'|'info'}] }
predictSkill(caster, skill, targetCell, units, map, weather)
//  -> { targets:[{unitId, hitPct, dmg|heal, status?, willKill}], mods:[...] }
```
- 伤害区间来自抖动系数 min/max（如 0.9~1.1）；命中、连击、致命按本作公式（命中看爆/士差，计略看精/士差；连击爆发差、致命士气差）。
- `combat.resolveAttack` 抽出**纯计算核**给 forecast 复用，保证「预测=实际」一致（同一公式，预测不掷随机只算区间与概率）。

## 4. UI / 交互
- `ui/forecast.js`：渲染浮层（跟随光标或固定 HUD 角）；进入攻击/计略目标模式时显示，移开/取消时隐藏。
- 键鼠：悬停预览、左键确认、右键/Esc 取消。手柄：方向键切目标、A 确认、B 取消。
- 与现有 `main.js` 攻击/计略目标选择流程对接（pendingMode='attack'|'skill' 时挂预测）。

## 5. 实现要点（并入实现 plan）
1. 重构 `combat.js`：拆出 `coreDamage()/coreHit()` 纯算（无随机）供 forecast + resolveAttack 共用。
2. 新建 `battle/forecast.js`（predictAttack/predictSkill）。
3. 新建 `ui/forecast.js`（浮层）；`main.js` 目标模式接入。
4. 接天气/地形/相克/状态修正标签（与天气系统、职业 footprint 联动）。
5. 单测：predictAttack 的命中%/伤害区间/willKill/反击预测与 resolveAttack 实跑结果自洽（同输入同公式）。

## 6. 范围
- 先做**普攻预测 + 计略预测（伤害/命中/击杀/反击/修正标签）**；连击/致命显示几率即可。敌方意图预览后置。
