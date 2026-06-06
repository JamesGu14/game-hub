#!/usr/bin/env bash
# [P2] 自含铁律守卫：本游戏 src/ tests/ 不得 import games/tower-defender 以外的路径。
# 触发条件：import 路径 3+ 层 ../（逃出本游戏目录）、含 games/、或含其它游戏名。
set -euo pipefail
cd "$(dirname "$0")/.."

bad=$(grep -rnE "from[[:space:]]*['\"]" src tests 2>/dev/null \
  | grep -E "from[[:space:]]*['\"]((\.\./){3,}|[^'\"]*games/|[^'\"]*(caocao-zhuan|turbo-drift|snake|breakout|pixel-quest|jungle-blitz|tactical-strike|boom-worms)/)" \
  || true)

if [ -n "$bad" ]; then
  echo "❌ 检测到跨游戏/逃逸 import（违反自含铁律）："
  echo "$bad"
  exit 1
fi
echo "✅ 自含 import 检查通过（无跨游戏引用）"
