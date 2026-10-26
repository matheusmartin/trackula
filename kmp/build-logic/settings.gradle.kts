// The convention plugins of Trackula: the build settings that more than one module uses. The main build includes this
// build in its pluginManagement block. See settings.gradle.kts of the main build.
dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
    // The same versions as the main build.
    versionCatalogs {
        create("libs") {
            from(files("../gradle/libs.versions.toml"))
        }
    }
}

rootProject.name = "build-logic"
