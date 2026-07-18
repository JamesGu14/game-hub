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
