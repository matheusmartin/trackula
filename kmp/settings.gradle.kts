// The Kotlin Multiplatform port of Trackula. See docs/kotlin-port.md.
pluginManagement {
    // The convention plugins of the modules.
    includeBuild("build-logic")
    repositories {
        gradlePluginPortal()
        mavenCentral()
        google()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
        google()
    }
}

rootProject.name = "trackula"

include(":model", ":sheets", ":services", ":app")
