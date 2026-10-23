// The Kotlin Multiplatform port of Trackula. See docs/kotlin-port.md.
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

rootProject.name = "trackula"

include(":model", ":sheets", ":services")
