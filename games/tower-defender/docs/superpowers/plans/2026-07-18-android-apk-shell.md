# 成都保卫战 Android WebView 壳 APK — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用裸 Kotlin WebView 壳把 tower-defender 打成完全离线 APK,经 USB 装到小米平板 7 Pro,游戏更新后一条命令重打重装且不丢存档。

**Architecture:** `games/tower-defender/android/` 独立 Gradle 工程,单 Activity + WebViewAssetLoader(带 MIME 硬化)加载打进 APK 的游戏静态文件;构建期 Sync 任务从游戏根同步资源(单一真源);游戏运行时代码仅加 `shellEnv.js` 一个纯函数并在 `main.js` 两处消费。

**Tech Stack:** Kotlin 2.1.20 / AGP 8.11.1 / Gradle wrapper 8.14 / compileSdk=targetSdk 36, minSdk 26 / androidx webkit·activity·core / macOS sips(图标)/ keytool(签名)。

**Spec:** `games/tower-defender/docs/superpowers/specs/2026-07-18-android-apk-shell-design.md`(已 grill 复审)。

## Global Constraints

- 所有路径基于 repo 根 `/Users/james/Projects/game-hub`;游戏根 = `games/tower-defender`。
- `applicationId = cn.jamesgu.towerdefender`;入口 URL `https://appassets.androidplatform.net/assets/game/index.html`;UA 追加 token `" TDShell/1"`。
- **不声明 INTERNET 权限**;媒体播放策略保持 WebView 默认(首次手势)。
- 签名:`~/keystores/gamehub.jks` + `android/keystore.properties`(**绝不入 git**)。
- 游戏运行时代码只允许动 `src/core/shellEnv.js`(新增)与 `src/main.js`(两处);浏览器内行为必须不变。
- 测试门禁:`bash scripts/test.sh`(在游戏根执行;逐个 node 跑 `tests/*.test.mjs`,任一红 exit 1)。
- 环境(已核实):JDK 17 + JAVA_HOME 已设;`ANDROID_HOME=/opt/homebrew/share/android-commandlinetools` 含 platforms android-35/36、build-tools 34-36;brew gradle 可生成 wrapper;adb 已识别授权设备 `6b09dfc0`(小米平板 7 Pro,Android 16)。
- **首次 `./gradlew` 需联网**下载 Gradle 8.14 distribution 与 AGP 依赖;agent 执行时 Bash 沙箱若拦网络,用 `dangerouslyDisableSandbox: true` 重试该命令。
- 提交:直接提交 develop(仓库惯例),中文 conventional 风格,消息尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;**不 push**。

---

### Task 1: 游戏侧壳环境检测 shellEnv(TDD)

**Files:**
- Create: `games/tower-defender/tests/shellEnv.test.mjs`
- Create: `games/tower-defender/src/core/shellEnv.js`
- Modify: `games/tower-defender/src/main.js`(import 区、204 行、562 行附近)

**Interfaces:**
- Consumes: 无(首任务)。
- Produces: `isShellEnv(ua) => boolean`(`src/core/shellEnv.js` 具名导出;参数为 UA 字符串,非字符串一律 false)。`main.js` 内模块级常量 `IS_SHELL`。壳(Task 2)靠 UA 含 `TDShell` 触发此逻辑。

- [ ] **Step 1: 写失败测试**(仿 `tests/achievements.test.mjs` 的 node:assert 平铺风格)

```js
// tests/shellEnv.test.mjs — 壳 UA 标记检测:命中 / 不误判 / 非字符串安全
import assert from 'node:assert';
import { isShellEnv } from '../src/core/shellEnv.js';

// 壳 UA(Android WebView 追加 " TDShell/1")→ true
assert.equal(isShellEnv('Mozilla/5.0 (Linux; Android 16; 24091RPADC) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 TDShell/1'), true);

// 浏览器 UA(iPad Safari / Mac Chrome)→ false
assert.equal(isShellEnv('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'), false);
assert.equal(isShellEnv('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0'), false);

// 非字符串 / 空 → false 不炸
assert.equal(isShellEnv(undefined), false);
assert.equal(isShellEnv(''), false);
assert.equal(isShellEnv(null), false);

console.log('shellEnv.test.mjs OK');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/james/Projects/game-hub/games/tower-defender && node tests/shellEnv.test.mjs`
Expected: FAIL,`Cannot find module '../src/core/shellEnv.js'`。

- [ ] **Step 3: 最小实现**

```js
// core/shellEnv.js — 壳环境检测(Android WebView 壳 UA 带 " TDShell/1" 标记,见 android/ 工程)。
export function isShellEnv(ua) {
  return typeof ua === 'string' && ua.includes('TDShell');
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/shellEnv.test.mjs`
Expected: `shellEnv.test.mjs OK`。

- [ ] **Step 5: 接线 main.js(两处消费)**

① import 区(文件头部与其他 `./core/` import 并列)加:

```js
import { isShellEnv } from './core/shellEnv.js';
```

② 204 行处,原:

```js
const fsSupported = () => !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
```

改为(壳内恒全屏,4 个调用点全收敛于此闸门,静音按钮补位布局 223 行自动跟上):

```js
const IS_SHELL = isShellEnv(typeof navigator !== 'undefined' ? navigator.userAgent : '');
const fsSupported = () => !IS_SHELL && !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
```

③ 562 行 boot 流程 `resize();` 之后加(壳内隐藏返回 HUB 链接):

```js
  if (IS_SHELL) { const hub = document.getElementById('back-to-hub'); if (hub) hub.style.display = 'none'; }
```

- [ ] **Step 6: 全量门禁**

Run: `bash scripts/test.sh`
Expected: exit 0(81 个 .test.mjs 全过,含自含 import 守卫)。

- [ ] **Step 7: Commit**

```bash
git add tests/shellEnv.test.mjs src/core/shellEnv.js src/main.js
git commit -m "feat(tower-defender): 壳环境检测shellEnv——壳内隐藏全屏按钮与HUB链接(TDD,浏览器行为不变)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Android 壳工程(assembleDebug 绿)

**Files:**(全部 Create,基目录 `games/tower-defender/android/`)
- `.gitignore`、`settings.gradle.kts`、`build.gradle.kts`、`gradle.properties`、`local.properties`(gitignored)
- `app/build.gradle.kts`
- `app/src/main/AndroidManifest.xml`
- `app/src/main/kotlin/cn/jamesgu/towerdefender/MainActivity.kt`
- `app/src/main/kotlin/cn/jamesgu/towerdefender/MimeFixPathHandler.kt`
- `app/src/main/res/values/themes.xml`、`app/src/main/res/values-v31/themes.xml`
- wrapper:`gradle/wrapper/*` + `gradlew`(由 brew gradle 生成)

**Interfaces:**
- Consumes: 游戏根静态文件(`index.html`/`style.css`/`src/`/`assets/`);Task 1 的 UA 约定 `" TDShell/1"`。
- Produces: 可构建工程;`MimeFixPathHandler(inner: WebViewAssetLoader.PathHandler)`;调试产物 `app/build/outputs/apk/debug/app-debug.apk`;Task 4 在 `app/build.gradle.kts` 已留好的 keystore.properties 读取逻辑;Task 6(条件)接线点 = MainActivity 的 `shouldInterceptRequest`。

- [ ] **Step 1: 写 `.gitignore`**

```gitignore
.gradle/
build/
local.properties
keystore.properties
```

- [ ] **Step 2: 写 `settings.gradle.kts`**

```kotlin
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "tower-defender-shell"
include(":app")
```

- [ ] **Step 3: 写根 `build.gradle.kts`**

```kotlin
plugins {
    id("com.android.application") version "8.11.1" apply false
    id("org.jetbrains.kotlin.android") version "2.1.20" apply false
}
```

- [ ] **Step 4: 写 `gradle.properties` 与 `local.properties`**

`gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx2g
android.useAndroidX=true
```

`local.properties`(gitignored,机器绑定):

```properties
sdk.dir=/opt/homebrew/share/android-commandlinetools
```

- [ ] **Step 5: 写 `app/build.gradle.kts`**(含资源同步单一真源 + 签名读取)

```kotlin
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// 签名四元组:android/keystore.properties(gitignored,Task 4 生成);缺失时 release 回退 debug 签名保证可构建。
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "cn.jamesgu.towerdefender"
    compileSdk = 36

    defaultConfig {
        applicationId = "cn.jamesgu.towerdefender"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        create("release") {
            if (keystoreProps.isNotEmpty()) {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false   // 纯 assets 壳,无可缩代码
            signingConfig = if (keystoreProps.isNotEmpty()) signingConfigs.getByName("release")
                            else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    lint { checkReleaseBuilds = false }   // 侧载自用,不让 lintVital 阻塞 release
}

// —— 单一真源:构建期把游戏静态文件同步进 APK assets(game/ 前缀),不打包 docs/tests/tools/scripts ——
val gameRoot = rootProject.projectDir.parentFile   // = games/tower-defender
val syncGameAssets = tasks.register<Sync>("syncGameAssets") {
    into(layout.buildDirectory.dir("gameAssets/game"))
    from(gameRoot) { include("index.html", "style.css") }
    from(File(gameRoot, "src")) { into("src") }
    from(File(gameRoot, "assets")) { into("assets") }
}
android.sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("gameAssets"))
tasks.named("preBuild") { dependsOn(syncGameAssets) }

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.core:core-ktx:1.16.0")
}
```

- [ ] **Step 6: 写 `AndroidManifest.xml`**(无 INTERNET 权限;本任务先不设 icon,Task 3 补)

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:label="成都保卫战"
        android:allowBackup="true"
        android:theme="@style/Theme.TowerDefender">
        <!-- configChanges 必须含 orientation:sensorLandscape 两个横向间翻转若触发重建,WebView 会整页重载丢局中状态 -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:screenOrientation="sensorLandscape"
            android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboard|keyboardHidden|density">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

- [ ] **Step 7: 写主题资源**(版本门控属性全放 v31 overlay,基主题干净避 lint)

`res/values/themes.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.TowerDefender" parent="android:Theme.Material.Light.NoTitleBar.Fullscreen">
        <item name="android:windowBackground">@android:color/black</item>
    </style>
</resources>
```

`res/values-v31/themes.xml`(splash 底色 = 游戏 theme-color;刘海区铺满):

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.TowerDefender" parent="android:Theme.Material.Light.NoTitleBar.Fullscreen">
        <item name="android:windowBackground">@android:color/black</item>
        <item name="android:windowSplashScreenBackground">#2B1D12</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    </style>
</resources>
```

- [ ] **Step 8: 写 `MimeFixPathHandler.kt`**(spec §5.1 MIME 硬化)

```kotlin
package cn.jamesgu.towerdefender

import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader

// module script 对 MIME 是硬要求:平台 MIME 表在部分 WebView 版本对 .js 猜成 text/plain → 拒载白屏。
// 包一层 AssetsPathHandler,对关键扩展名显式定 MIME,不赌平台表。
class MimeFixPathHandler(private val inner: WebViewAssetLoader.PathHandler) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse? {
        val resp = inner.handle(path) ?: return null
        val mime = when (path.substringAfterLast('.', "").lowercase()) {
            "js", "mjs" -> "text/javascript"
            "json" -> "application/json"
            "css" -> "text/css"
            "html" -> "text/html"
            else -> null
        }
        if (mime != null) resp.mimeType = mime
        return resp
    }
}
```

- [ ] **Step 9: 写 `MainActivity.kt`**

```kotlin
package cn.jamesgu.towerdefender

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader

private const val TAG = "TDWeb"   // 冒烟门禁与排障通道:页面 console → logcat
private const val START_URL = "https://appassets.androidplatform.net/assets/game/index.html"

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var lastBackMs = 0L   // 双击退出窗口

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", MimeFixPathHandler(WebViewAssetLoader.AssetsPathHandler(this)))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true                                  // localStorage 存档
            settings.textZoom = 100                                            // 不随系统字号缩放 DOM
            settings.userAgentString = settings.userAgentString + " TDShell/1" // 游戏侧 isShellEnv 识别
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)
            }
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                    val line = "[${msg.messageLevel()}] ${msg.sourceId()}:${msg.lineNumber()} ${msg.message()}"
                    if (msg.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.e(TAG, line) else Log.i(TAG, line)
                    return true
                }
            }
        }
        setContentView(webView)
        hideSystemBars()
        webView.loadUrl(START_URL)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val now = System.currentTimeMillis()
                if (now - lastBackMs < 2000) finish()
                else { lastBackMs = now; Toast.makeText(this@MainActivity, "再按一次退出", Toast.LENGTH_SHORT).show() }
            }
        })
    }

    private fun hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, webView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()   // 从通知栏/后台回来重新沉浸
    }

    // 后台停渲染省电;页面收到 visibilitychange → 游戏自身重置累加器并存档(main.js:629,637)
    override fun onPause() { webView.onPause(); super.onPause() }
    override fun onResume() { super.onResume(); webView.onResume() }
    override fun onDestroy() { webView.destroy(); super.onDestroy() }
}
```

- [ ] **Step 10: 生成 wrapper 并构建**

```bash
cd /Users/james/Projects/game-hub/games/tower-defender/android
gradle wrapper --gradle-version 8.14
./gradlew --version          # Expected: Gradle 8.14 / JVM 17
./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`;`ls -lh app/build/outputs/apk/debug/app-debug.apk` 约 66MB。首次执行需联网下载,沙箱拦截则加 `dangerouslyDisableSandbox: true` 重试。

- [ ] **Step 11: 验证 APK 内 assets 结构**

```bash
unzip -l app/build/outputs/apk/debug/app-debug.apk | grep -E "assets/game/(index.html|src/main.js|assets/voice/registry.json)"
```

Expected: 三条路径都在(证明 syncGameAssets 布局正确,fetch/module/配音路径闭环)。

- [ ] **Step 12: Commit**

```bash
cd /Users/james/Projects/game-hub
git add games/tower-defender/android
git commit -m "feat(tower-defender/android): 裸Kotlin WebView壳工程——AssetLoader+MIME硬化+沉浸横屏+双击退出+console转logcat,assembleDebug绿

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(确认 `git status` 不含 local.properties/build 产物——.gitignore 生效。)

---

### Task 3: 国画 adaptive 图标

**Files:**
- Create: `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- Create: `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_fg.png`(432×432,sips 生成)
- Create: `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`(192×192 legacy 兜底)
- Create: `android/app/src/main/res/values/colors.xml`
- Modify: `android/app/src/main/AndroidManifest.xml`(application 加 `android:icon`)

**Interfaces:**
- Consumes: `games/tower-defender/assets/bg/select-bg.jpg`(国画选关背景)。
- Produces: `@mipmap/ic_launcher`(Task 4 装机后桌面可见)。

- [ ] **Step 1: sips 中心方形裁切 + 出图**

```bash
cd /Users/james/Projects/game-hub/games/tower-defender
SRC=assets/bg/select-bg.jpg
RES=android/app/src/main/res
TMP=$(mktemp -d)
W=$(sips -g pixelWidth  "$SRC" | awk '/pixelWidth/{print $2}')
H=$(sips -g pixelHeight "$SRC" | awk '/pixelHeight/{print $2}')
S=$(( W<H ? W : H ))
mkdir -p "$RES/mipmap-anydpi-v26" "$RES/mipmap-xxxhdpi"
sips -c "$S" "$S" "$SRC" --out "$TMP/sq.jpg" >/dev/null                       # 中心方裁
sips -s format png --resampleHeightWidth 432 432 "$TMP/sq.jpg" --out "$RES/mipmap-xxxhdpi/ic_launcher_fg.png" >/dev/null
sips -s format png --resampleHeightWidth 192 192 "$TMP/sq.jpg" --out "$RES/mipmap-xxxhdpi/ic_launcher.png" >/dev/null
```

Expected: 两个 png 生成;用 Read 工具打开 `ic_launcher_fg.png` 人工核验(非黑非糊;满幅国画,adaptive 遮罩裁边可接受,不满意换裁切位或改用武将头像素材——spec §9 预案)。

- [ ] **Step 2: 写 adaptive xml 与底色**

`mipmap-anydpi-v26/ic_launcher.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_bg" />
    <foreground android:drawable="@mipmap/ic_launcher_fg" />
</adaptive-icon>
```

`values/colors.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_bg">#2B1D12</color>
</resources>
```

- [ ] **Step 3: Manifest application 标签加图标属性**

`android:label="成都保卫战"` 行后加:

```xml
        android:icon="@mipmap/ic_launcher"
```

- [ ] **Step 4: 重新构建验证**

Run: `cd android && ./gradlew assembleDebug`
Expected: `BUILD SUCCESSFUL`。

- [ ] **Step 5: Commit**

```bash
cd /Users/james/Projects/game-hub
git add games/tower-defender/android
git commit -m "feat(tower-defender/android): 国画adaptive图标(select-bg中心裁切+#2B1D12底)+应用名成都保卫战

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 专用签名 + 一键构建装机脚本 + 首次装机

**Files:**
- Create: `~/keystores/gamehub.jks`(repo 外,一次性)
- Create: `games/tower-defender/android/keystore.properties`(gitignored)
- Create: `games/tower-defender/scripts/build-apk.sh`

**Interfaces:**
- Consumes: Task 2 的 keystore.properties 读取逻辑(`app/build.gradle.kts`)与 applicationId。
- Produces: 签名 release APK(`android/app/build/outputs/apk/release/app-release.apk`);一键脚本 `scripts/build-apk.sh`(James 日后更新游戏后唯一入口)。

- [ ] **Step 1: 生成专用 keystore(幂等:已存在则跳过)+ 写 keystore.properties**

```bash
mkdir -p ~/keystores
if [ ! -f ~/keystores/gamehub.jks ]; then
  PASS=$(openssl rand -hex 16)
  keytool -genkeypair -v -keystore ~/keystores/gamehub.jks -alias gamehub \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" \
    -dname "CN=James Gu, OU=game-hub, O=jamesgu.cn, C=CN"
  cat > /Users/james/Projects/game-hub/games/tower-defender/android/keystore.properties <<EOF
storeFile=$HOME/keystores/gamehub.jks
storePassword=$PASS
keyAlias=gamehub
keyPassword=$PASS
EOF
fi
```

Expected: jks 与 properties 生成;`git status` 确认 keystore.properties **未被追踪**(James 护栏:密钥不入 git)。

- [ ] **Step 2: release 构建**

Run: `cd /Users/james/Projects/game-hub/games/tower-defender/android && ./gradlew assembleRelease`
Expected: `BUILD SUCCESSFUL`;`app/build/outputs/apk/release/app-release.apk` ≤ 80MB(spec 门禁 2)。

- [ ] **Step 3: 写一键脚本 `scripts/build-apk.sh`**

```bash
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
```

`chmod +x scripts/build-apk.sh`。

- [ ] **Step 4: 跑脚本首次装机**

Run: `bash scripts/build-apk.sh`
Expected: `Success` + `✅ 已安装并拉起`;平板亮起游戏。若 `adb install` 报 `INSTALL_FAILED_USER_RESTRICTED`:HyperOS 需在平板【开发者选项 → USB 安装】开启(可能要登录小米账号),提示 James 操作后重跑(spec §9 风险 2)。

- [ ] **Step 5: Commit**

```bash
cd /Users/james/Projects/game-hub
git add games/tower-defender/scripts/build-apk.sh
git commit -m "feat(tower-defender): 专用签名+一键构建装机脚本build-apk.sh,release已装上小米平板

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 真机冒烟门禁(spec §8 验收 3-7)

**Files:** 无新文件(产出 = 门禁记录,汇报给 James)。

**Interfaces:**
- Consumes: 已装机的 release 包;TAG `TDWeb` 的 logcat 通道。
- Produces: 验收结论;若 BGM/配音异常 → 触发 Task 6。

- [ ] **Step 1: logcat 清零并冷启动**

```bash
adb logcat -c
adb shell am force-stop cn.jamesgu.towerdefender
adb shell am start -n cn.jamesgu.towerdefender/.MainActivity
sleep 15
```

- [ ] **Step 2: 控制台零 error 门禁**

```bash
LOG=$(mktemp -t td-smoke)
adb logcat -d -s TDWeb | tee "$LOG" | grep -c "\[ERROR\]" || true
```

Expected: `0`。非零则逐条读 `$LOG`(mktemp 已打印路径)定位(MIME/路径/权限类问题回 Task 2 修,修复后重跑本任务)。

- [ ] **Step 3: 截图核验首屏**

```bash
SHOT=$(mktemp -t td-screen).png
adb exec-out screencap -p > "$SHOT"; echo "$SHOT"
```

用 Read 工具看图:标题/选关界面正常渲染、无白屏黑屏、横屏、无系统栏。

- [ ] **Step 4: 自动触键进一步冒烟(可选,点一下屏幕中心触发首手势)**

```bash
adb shell input tap 1200 700
sleep 5
adb logcat -d -s TDWeb | grep -c "\[ERROR\]" || true
```

Expected: 仍为 `0`(首手势后音频初始化不报错)。

- [ ] **Step 5: 人工验收清单交 James(spec §8.6)**

请 James 实机确认:触控建塔/BGM+配音出声/**BGM 循环播过结尾不断**/**切后台回前台对局与 BGM 恢复**/双击返回退出/杀进程重进存档在/横屏锁定。BGM 或配音异常 → 执行 Task 6;全过 → 汇报验收通过。

- [ ] **Step 6: 浏览器回归**

Run: `cd /Users/james/Projects/game-hub/games/tower-defender && bash scripts/test.sh`
Expected: exit 0。另在 Mac Chrome 打开游戏确认:全屏按钮与"← HUB"链接**仍显示**(非壳环境不受影响,spec §8.7)。

---

### Task 6(条件:仅当 Task 5 发现 BGM/配音 seek·循环异常): 媒体 Range 预案

**Files:**
- Create: `android/app/src/main/kotlin/cn/jamesgu/towerdefender/MediaRangeServer.kt`
- Modify: `MainActivity.kt` 的 `shouldInterceptRequest`

**Interfaces:**
- Consumes: Task 2 的拦截点;mp3 在 APK 内未压缩存储(AGP 默认 noCompress 含 mp3,`assets.openFd` 因此可用)。
- Produces: 对 `.mp3` 的 HTTP 206 Range 响应。

- [ ] **Step 1: 写 `MediaRangeServer.kt`**

```kotlin
package cn.jamesgu.towerdefender

import android.content.res.AssetManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.InputStream

// [spec §9 预案] WebViewAssetLoader 无 Range 支持;媒体栈需要 seek 时对 mp3 走此:206 + Content-Range。
object MediaRangeServer {
    fun serve(assets: AssetManager, request: WebResourceRequest): WebResourceResponse? {
        val path = request.url.path ?: return null
        if (!path.startsWith("/assets/") || !path.endsWith(".mp3")) return null
        val assetPath = path.removePrefix("/assets/")
        val total = try { assets.openFd(assetPath).use { it.length } } catch (e: Exception) { return null }
        val headers = mutableMapOf("Accept-Ranges" to "bytes")
        val range = request.requestHeaders.entries.firstOrNull { it.key.equals("Range", true) }?.value
        val m = range?.let { Regex("bytes=(\\d+)-(\\d*)").find(it) }
        val stream = assets.open(assetPath)
        if (m == null) {
            headers["Content-Length"] = total.toString()
            return WebResourceResponse("audio/mpeg", null, 200, "OK", headers, stream)
        }
        val start = m.groupValues[1].toLong()
        val end = m.groupValues[2].toLongOrNull() ?: (total - 1)
        var toSkip = start
        while (toSkip > 0) { val s = stream.skip(toSkip); if (s <= 0) break; toSkip -= s }
        headers["Content-Range"] = "bytes $start-$end/$total"
        headers["Content-Length"] = (end - start + 1).toString()
        return WebResourceResponse("audio/mpeg", null, 206, "Partial Content", headers, BoundedInputStream(stream, end - start + 1))
    }
}

// 精确截断响应体,避免媒体栈读到超出 Range 的字节。
private class BoundedInputStream(private val inner: InputStream, private var remaining: Long) : InputStream() {
    override fun read(): Int = if (remaining <= 0) -1 else inner.read().also { if (it >= 0) remaining-- }
    override fun read(b: ByteArray, off: Int, len: Int): Int {
        if (remaining <= 0) return -1
        val n = inner.read(b, off, minOf(len.toLong(), remaining).toInt())
        if (n > 0) remaining -= n
        return n
    }
    override fun close() { inner.close() }
}
```

- [ ] **Step 2: MainActivity 接线**(`shouldInterceptRequest` 内,assetLoader 之前)

```kotlin
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    MediaRangeServer.serve(assets, request) ?: assetLoader.shouldInterceptRequest(request.url)
```

- [ ] **Step 3: 重装重冒烟**

Run: `bash scripts/build-apk.sh`,重跑 Task 5 Step 1-5(重点:BGM 循环与配音)。
Expected: 异常消失。

- [ ] **Step 4: Commit**

```bash
cd /Users/james/Projects/game-hub
git add games/tower-defender/android/app/src/main/kotlin/cn/jamesgu/towerdefender
git commit -m "fix(tower-defender/android): mp3媒体Range预案——206+Content-Range+限长流,修BGM循环/seek

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
