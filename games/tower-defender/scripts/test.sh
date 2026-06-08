#!/usr/bin/env bash
# [检查点A·§9.3] 串跑全部单测 + node --check + verify-levels + check-imports。
# 用法：bash scripts/test.sh。任一红即 exit 1。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== node --check src/**, tools/** =="
find src tools -name '*.mjs' -o -name '*.js' | while read -r f; do node --check "$f"; done
echo "✅ syntax ok"

echo "== 单测 tests/*.test.mjs =="
fail=0
for t in tests/*.test.mjs; do
  if node "$t"; then :; else echo "❌ FAIL: $t"; fail=1; fi
done
[ "$fail" = 0 ] || { echo "❌ 有单测失败"; exit 1; }

echo "== verify-levels（50 关 0 漏怪）=="
node tools/verify-levels.mjs

echo "== check-imports（自含铁律）=="
bash scripts/check-imports.sh

echo ""
echo "✅✅ 全部门禁通过"
