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
