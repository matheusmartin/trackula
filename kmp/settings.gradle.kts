// The Kotlin Multiplatform port of Trackula. See docs/kotlin-port.md.
rootProject.name = "trackula"

pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}

include(":model")
