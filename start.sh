#!/usr/bin/env bash
# 一键启动 game-hub 本地服务器。
# 用法:
#   ./start.sh            # 默认端口 8000
#   ./start.sh 8123       # 指定端口
#
# game-hub 使用 ES modules，必须通过 http(s) 访问（不能用 file:// 双击打开）。
# 打砖块 / FPS 是纯静态游戏，无需编译；贪吃蛇需先 npm run build（见下方提示）。

set -euo pipefail

# 切到脚本所在目录（即项目根目录），保证相对路径正确。
cd "$(dirname "$0")"

PORT="${1:-8000}"
URL="http://localhost:${PORT}/"

echo "🎮 game-hub 启动中..."
echo "   目录: $(pwd)"
echo "   地址: ${URL}"
echo "   停止: 按 Ctrl + C"
echo

# 贪吃蛇需要构建产物，未构建时友好提示（不阻塞启动）。
if [ ! -f "games/snake/dist/index.html" ]; then
  echo "ℹ️  提示: 贪吃蛇尚未构建，点它会打不开。如需游玩请先运行:"
  echo "      (cd games/snake && npm install && npm run build)"
  echo "   打砖块和 FPS 无需构建，可直接游玩。"
  echo
fi

# 尝试自动在默认浏览器打开（失败也不影响服务器）。
open_browser() {
  sleep 1
  if command -v open >/dev/null 2>&1; then open "${URL}"        # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "${URL}"  # Linux
  fi
}
open_browser &

# 选一个可用的静态服务器：优先 python3，其次 python，最后 npx serve。
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "${PORT}"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "${PORT}"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -l "${PORT}" .
else
  echo "❌ 未找到 python3 / python / npx，请先安装其中之一。" >&2
  exit 1
fi
