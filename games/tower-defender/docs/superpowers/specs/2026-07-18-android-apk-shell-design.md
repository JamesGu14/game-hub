# 成都保卫战 Android WebView 壳 APK — 设计

- 日期:2026-07-18
- 状态:已与 James 逐节确认(打包范围 / 方案选型 / 整体设计三次拍板)
- 目标设备:小米平板 7 Pro(24091RPADC "muyu",Android 16 / SDK 36,已 USB 连接并授权 adb)

## 1. 背景与目标

游戏是纯静态前端(index.html + style.css + ES module src + 64MB assets),无后端、无数据库,唯一 fetch 是本地 `assets/voice/registry.json`,存档全在 localStorage。目标:用**裸 Kotlin WebView 壳**把 tower-defender 单游戏打成完全离线的 APK,经 USB `adb install` 装到平板,游戏更新后一条命令重打重装且**不丢存档**。

**非目标**:game-hub 整包版(以后复用壳即可)、iOS 壳、存档导出/云同步、应用商店上架(仅侧载)。

## 2. 已验证事实

| 项 | 结论 |
|---|---|
| 游戏联网面 | 仅相对路径 fetch 配音清单(`voiceRegistry.js:12`),失败静默降级;全项目无外链/CDN |
| 模块加载 | `<script type="module">` → 必须 http(s) 提供,file:// 不可用 |
| 主循环 | 固定步长 + 累加器封顶(`gameLoop.js:42-47`),144Hz 屏无加速问题 |
| 渲染 | Canvas 2D,DPR 封顶 2(`main.js:252`),背景离屏烘焙;画布 `innerWidth/innerHeight` 自适应 |
| 音频 | SFX = AudioContext(首次手势解锁,幂等);BGM/配音 = HTMLAudio(`audio.js:139,224`) |
| 全屏按钮 | canvas 内绘制,走标准 Fullscreen API(`main.js:204-215`) |
| HUB 链接 | DOM 元素 `#back-to-hub`(index.html:12) |
| src 依赖闭包 | 无对 tests/tools/scripts 的 import → 打包 `index.html + style.css + src/ + assets/` 即完整 |
| Mac 环境 | JDK 17(brew openjdk)、Gradle、`ANDROID_HOME=/opt/homebrew/share/android-commandlinetools` 含 platform-tools + platforms android-35/36 + build-tools 34-36 + sdkmanager → **零环境安装** |
| 设备 | `adb devices` 已识别且已授权(state=device) |

## 3. 关键决策(已拍板)

1. **打包范围 = 只打 tower-defender**(APK 约 66MB);壳内隐藏"← HUB"链接。
2. **方案 = 裸 Kotlin WebView 工程**(否决 Capacitor:npm 依赖链+重工程;否决 TWA:需 https 托管,与离线目标相悖)。
3. **签名 = 专用 keystore**(repo 外 `~/keystores/gamehub.jks`),非 debug 签名——保证换机/重装系统后同签名覆盖安装,存档不丢。
4. **媒体策略 = WebView 默认"首次手势后播放"**,与已验证的 iPad Safari 行为一致,游戏现有解锁逻辑原样工作。
5. **返回键 = 双击退出**(2 秒窗口 + toast"再按一次退出"),防孩子误触。
6. **不声明 INTERNET 权限**——资源全部由拦截器提供,彻底离线且隐私干净;若真机冒烟发现 WebView 异常再加回(见风险)。

## 4. 工程结构

```
games/tower-defender/android/          # 独立 Gradle 工程
├── .gitignore                         # .gradle/ build/ keystore.properties local.properties
├── settings.gradle.kts
├── build.gradle.kts
├── gradle/wrapper/ + gradlew          # wrapper 锁版本,不依赖 brew gradle
├── keystore.properties                # 签名四元组(gitignore,模板见 §7)
└── app/
    ├── build.gradle.kts               # 含 syncGameAssets 任务 + 签名配置
    └── src/main/
        ├── AndroidManifest.xml
        ├── kotlin/cn/jamesgu/towerdefender/MainActivity.kt   # 唯一源码,~100 行
        └── res/                       # adaptive icon + 主题(splash 底色 #2b1d12)
```

- `applicationId = cn.jamesgu.towerdefender`;minSdk 26,compileSdk/targetSdk 36。
- Gradle wrapper 8.14 + AGP ≥8.10(支持 compileSdk 36)+ Kotlin 2.x;实施时以 `sdkmanager` 实际可用版本锁定精确值。
- 依赖仅三个 androidx:`webkit`(WebViewAssetLoader)、`activity-ktx`(OnBackPressedCallback)、`core-ktx`(WindowInsetsControllerCompat)。
- **syncGameAssets**(Gradle `Sync` 任务,`preBuild` 依赖它):把游戏根的 `index.html`、`style.css`、`src/`、`assets/` 同步到 `build/gameAssets/game/`,该目录经 `sourceSets` 注册为 assets 源。**游戏源零复制留存、单一真源**,每次构建自动携带最新游戏代码;不打包 docs/tests/tools/scripts/package.json。

## 5. 壳规格(MainActivity 行为)

1. `WebViewAssetLoader` + `AssetsPathHandler("/assets/")`,加载 `https://appassets.androidplatform.net/assets/game/index.html`;`shouldInterceptRequest` 同时覆盖页面 fetch(配音清单)与媒体请求。**MIME 硬化(grill 复审新增)**:用 ~10 行自定义 PathHandler 包一层 AssetsPathHandler,对 `.js/.mjs/.json` 显式返回 JavaScript/JSON MIME——module script 对 MIME 是硬要求,平台猜测在部分 WebView 版本返回 `text/plain` 会直接拒载白屏,不赌冒烟。已核实 `audio.js:129` 的 `new URL('../../assets/bgm/…', import.meta.url)` 在该域下解析为同域绝对路径,同一 handler 覆盖。
2. WebSettings:`javaScriptEnabled = true`、`domStorageEnabled = true`(localStorage 存档),其余保持默认(含媒体手势策略)。
3. UA 追加 `" TDShell/1"`(空格分隔 token),供游戏侧识别壳环境。
4. 全屏沉浸:edge-to-edge + `WindowInsetsControllerCompat` 隐藏系统栏(BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE)+ 主题 `layoutInDisplayCutoutMode=shortEdges`。
5. Manifest `screenOrientation="sensorLandscape"`(横屏双向);`FLAG_KEEP_SCREEN_ON` 防对局中息屏。
6. 返回:`OnBackPressedCallback` 双击退出(2s 窗口,toast 提示)。
7. `WebChromeClient.onConsoleMessage` → logcat(tag `TDWeb`,含级别/来源行号)——冒烟门禁与日后排障的通道。
8. 生命周期:`onPause/onResume` 调 `webView.onPause()/onResume()`(后台停渲染省电;游戏自身有 visibility 重置逻辑 `gameLoop.js:64`)。

## 6. 游戏运行时代码改动(仅此两处,TDD)

新增 `src/core/shellEnv.js`:纯函数 `isShellEnv(ua)`(检测 `TDShell` token),先写 2 个单测(命中/不命中)再实现。`main.js` 两处消费:

1. `fsSupported()` 增加 `!isShellEnv(navigator.userAgent)` ——壳内不绘制全屏按钮(壳恒全屏,且 WebView 内该 API 点击无效);
2. boot 时若壳环境 → `#back-to-hub` 置 `display:none`。

浏览器内行为零变化;现有 62+ 测试不受影响,验收含全量回归。

## 7. 构建 / 签名 / 安装 / 更新

- **keystore(一次性)**:`keytool -genkeypair` 生成 `~/keystores/gamehub.jks`(alias `gamehub`,RSA 2048,validity 10000 天);`android/keystore.properties`(gitignored)存 `storeFile/storePassword/keyAlias/keyPassword`,release signingConfig 从中读取。密码不进 git(James 护栏:密钥不明文落盘 repo)。
- **release 构建**:`isMinifyEnabled = false`(无可缩代码),默认 zipalign/签名由 AGP 完成。注:**首次构建需联网**下载 Gradle distribution 与 AGP 依赖(Mac 端一次性;之后可离线构建)。
- **`scripts/build-apk.sh`(一键)**:校验 adb 设备在线 → `android/gradlew -p android assembleRelease` → `adb install -r app-release.apk` → `adb shell am start -n cn.jamesgu.towerdefender/.MainActivity`。游戏日后更新,重跑即完成"构建+覆盖安装+拉起",同签名覆盖安装存档保留。
- **图标/应用名**:应用名「成都保卫战」;用 `assets/bg/select-bg.jpg`(国画选关背景)裁切生成 adaptive icon 前景,底色 `#2b1d12`(现 theme-color),macOS 自带 `sips` 生成各密度,零新依赖;splash 用 Android 12+ 默认(图标 + 同底色)。

## 8. 验收标准(客观门禁)

1. 游戏侧 `vitest` 全绿(现有全量 + shellEnv 新测)。
2. `./gradlew assembleRelease` 绿;APK ≤ 80MB。
3. `adb install -r` 成功,`am start` 拉起。
4. 冒烟期间 logcat `TDWeb` 过滤 **0 个 error 级**(如出现无害告警,white-list 并注明理由)。
5. `adb exec-out screencap` 截图核验:首屏/选关正常渲染(人工看图)。
6. 实机人工验收(James/孩子):触控建塔、BGM+配音出声、**BGM 循环播过一遍结尾不断**(`el.loop=true` + `currentTime=0` 依赖可 seek,audio.js:140,157)、**切后台回前台对局与 BGM 恢复**(persistResume 已在 hidden 时存档,main.js:637)、双击返回退出、杀进程重进存档在、横屏锁定生效。
7. 浏览器回归:Chrome 里游戏行为不变(全屏按钮与 HUB 链接照常显示)。

## 9. 风险与预案

| 风险 | 影响 | 预案 |
|---|---|---|
| WebViewAssetLoader 不支持 HTTP Range,HTMLAudio(BGM/配音 mp3)循环或 seek 异常 | 中(本方案最大技术风险) | 真机冒烟第一时间验证;异常则加 ~40 行 Range-aware 自定义 PathHandler |
| HyperOS 侧载需开发者选项「USB 安装」开关(可能要求登录小米账号) | 安装被拒 | 提示 James 在平板上开启后重试 |
| 不声明 INTERNET 权限的边缘异常 | 低 | 冒烟异常则加回该权限(资源加载本身不需要) |
| 图标自动裁切效果不佳 | 低 | 人工看一眼,不满意换裁切区域或改用武将头像素材 |

## 10. 后续可选(非本期)

- hub 整包版:复制 `android/` 目录,改 syncGameAssets 源与 applicationId 即可。
- 存档导出/导入(换设备迁移)。
- 若日后上架商店:改 AAB + 正式图标合规审查。
