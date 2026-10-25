// The Kotlin Multiplatform port of Trackula. See docs/kotlin-port.md.
pluginManagement {
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
