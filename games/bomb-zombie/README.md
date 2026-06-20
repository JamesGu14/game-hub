# 向僵尸开炮 BOMB ZOMBIE

竖屏阵地防守 + roguelite 升级构筑。底部炮台守城墙，僵尸潮从上方推进，自动射击割草，
击杀升级三选一滚雪球，叠满进化卡质变，主动技能择时翻盘。第 1 章「城郊废土」10 关（含尸潮之王 Boss）。

## 玩法
- 全自动锁定最近僵尸开火；玩家管升级三选一 + 择时放技能（1=核弹 2=冰冻）。
- 城墙血条归零 = 失守；刷完全部波次且清场 = 守城成功。

## 开发
- 纯逻辑单测：`node --test tests/*.test.mjs`
- 平衡模拟器：`node tools/sim-run.mjs`（验第 1 章可通关）
- 冒烟：`tests/smoke-ch1.mjs`（host-side puppeteer-core）

阶段 1 = 核心战斗。阶段 2 = 英雄/装备/养成闭环。阶段 3 = 扩章节 + 打磨。见 `docs/superpowers/specs/2026-06-20-bomb-zombie-design.md`。
