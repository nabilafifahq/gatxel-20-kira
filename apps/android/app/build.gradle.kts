import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
}

// Alamat server Kira yang ditanam ke APK: -PkiraUrl=https://kira-server.nama-tailnet.ts.net
// Boleh kosong; aplikasi lalu meminta alamat saat pertama dibuka.
val kiraUrl: String = providers.gradleProperty("kiraUrl").orNull.orEmpty().trim().removeSuffix("/").lowercase()
if (kiraUrl.isNotEmpty() && !Regex("^https://[a-z0-9-]+(\\.[a-z0-9-]+)+(:[0-9]{1,5})?$").matches(kiraUrl)) {
    throw GradleException(
        "kiraUrl harus berbentuk https://nama-host.domain tanpa path, misalnya https://kira-server.nama-tailnet.ts.net",
    )
}

// versionCode dari nomor run GitHub Actions, 1 untuk build lokal.
val kiraVersionCode: Int = providers.environmentVariable("GITHUB_RUN_NUMBER").orNull?.let { raw ->
    raw.toIntOrNull()?.takeIf { it in 1..2_100_000_000 }
        ?: throw GradleException("GITHUB_RUN_NUMBER harus angka 1 sampai 2100000000, diterima: $raw")
} ?: 1

// Kunci rilis dari Gradle property atau variabel lingkungan. Keempatnya diisi atau tidak sama sekali.
fun signingValue(name: String): String? =
    (providers.gradleProperty(name).orNull ?: providers.environmentVariable(name).orNull)?.takeIf { it.isNotBlank() }

val releaseStoreFile = signingValue("KIRA_KEYSTORE_FILE")
val releaseStorePassword = signingValue("KIRA_KEYSTORE_PASSWORD")
val releaseKeyAlias = signingValue("KIRA_KEY_ALIAS")
val releaseKeyPassword = signingValue("KIRA_KEY_PASSWORD")
val signingValues = listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword)
val hasReleaseKey = signingValues.all { it != null }
if (!hasReleaseKey && signingValues.any { it != null }) {
    throw GradleException(
        "Kunci rilis butuh keempat nilai: KIRA_KEYSTORE_FILE, KIRA_KEYSTORE_PASSWORD, KIRA_KEY_ALIAS, KIRA_KEY_PASSWORD.",
    )
}

android {
    namespace = "com.gatxel.kira"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.gatxel.kira"
        minSdk = 26
        targetSdk = 36
        versionCode = kiraVersionCode
        versionName = "1.0.$kiraVersionCode"
        buildConfigField("String", "KIRA_URL", "\"$kiraUrl\"")
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            if (hasReleaseKey) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // Blok info dependensi di APK hanya dibaca Google Play. APK ini dipasang langsung.
    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
}
