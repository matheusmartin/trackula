// The Kotlin Multiplatform port of Trackula. See docs/kotlin-port.md.
pluginManagement {
    // The convention plugins of the modules.
    includeBuild("build-logic")
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

plugins {
    // Gradle downloads the JDK of jvmToolchain if the computer does not have it. The version is here, not in
    // gradle/libs.versions.toml: Gradle cannot read the version catalog in this block.
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

// Declare repositories only here. The build cannot use RepositoriesMode.FAIL_ON_PROJECT_REPOS: the Kotlin Gradle
// plugin adds the download repositories of Node.js and Binaryen to the projects.
dependencyResolutionManagement {
    repositories {
        // Compose Multiplatform uses some AndroidX libraries. They come only from Google, and Google gives only them.
        exclusiveContent {
            forRepository {
                google()
            }
            filter {
                includeGroupAndSubgroups("androidx")
            }
        }
        mavenCentral()
    }
}

rootProject.name = "trackula"

include(":model", ":sheets", ":services", ":app")
