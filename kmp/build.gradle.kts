plugins {
    // The check and build tasks of the root project.
    base
    // All convention plugins are in one JAR. The root project loads it, with the Kotlin Gradle plugin, one time for
    // all modules. Do not remove this line: if each module loads the Kotlin Gradle plugin, the build fails.
    id("trackula.ktlint")
}

// build-logic is a separate build. `check` and `ktlintFormat` also do its checks.
tasks.named("check") {
    dependsOn(gradle.includedBuild("build-logic").task(":check"))
}
tasks.named("ktlintFormat") {
    dependsOn(gradle.includedBuild("build-logic").task(":ktlintFormat"))
}
