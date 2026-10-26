// ktlint checks the format and the style of all Kotlin code. `check` runs it. `./gradlew ktlintFormat` corrects most
// problems. The rules are in .editorconfig.
plugins {
    id("org.jlleitschuh.gradle.ktlint")
}

ktlint {
    version = the<VersionCatalogsExtension>().named("libs").findVersion("ktlint").get().requiredVersion
}

// Generated code, for example the Compose resource accessors, has its own format.
tasks.withType<org.jlleitschuh.gradle.ktlint.tasks.BaseKtLintCheckTask>().configureEach {
    // A local value: the configuration cache cannot keep a reference to the script.
    val buildFolder = layout.buildDirectory
    exclude { it.file.startsWith(buildFolder.get().asFile) }
}
