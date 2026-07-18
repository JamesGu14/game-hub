#!/usr/bin/env bash
# 一键:构建 release APK → 覆盖安装到 USB 平板(同签名保存档)→ 拉起游戏。
# 用法:bash scripts/build-apk.sh(游戏根或任意处执行皆可)
set -euo pipefail
cd "$(dirname "$0")/.."
adb get-state >/dev/null 2>&1 || { echo "❌ 未检测到 adb 设备(检查 USB 连接/平板授权)"; exit 1; }
( cd android && ./gradlew --quiet assembleRelease )
APK=android/app/build/outputs/apk/release/app-release.apk
adb install -r "$APK"
adb shell am start -n cn.jamesgu.towerdefender/.MainActivity
echo "✅ 已安装并拉起(APK $(du -h "$APK" | cut -f1))"
