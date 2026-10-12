// Aplikasi Android Kira: cangkang WebView Kotlin untuk tablet. Panduan: docs/android.md.
// Tanpa Gradle wrapper di git. Versi Gradle yang dipakai ada di .github/workflows/android-apk.yml
// (GRADLE_VERSION) dan docs/android.md.

pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "kira-android"
include(":app")
