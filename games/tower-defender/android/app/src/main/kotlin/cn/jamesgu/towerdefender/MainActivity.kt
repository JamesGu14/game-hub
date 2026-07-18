package cn.jamesgu.towerdefender

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.RenderProcessGoneDetail
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

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    request.url.host != "appassets.androidplatform.net"   // 锁定内部域:外链/根路径导航一律吞掉

                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    recreate(); return true   // 渲染进程被系统杀(低内存):自愈重建而非崩溃
                }
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

    // 后台停渲染省电;页面收到 visibilitychange → 游戏自身重置累加器并存档(main.js persistResume / loop.onVisible)
    override fun onPause() { webView.onPause(); super.onPause() }
    override fun onResume() { super.onResume(); webView.onResume() }
    override fun onDestroy() { (webView.parent as? ViewGroup)?.removeView(webView); webView.destroy(); super.onDestroy() }
}
