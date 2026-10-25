plugins {
    alias(libs.plugins.kotlin.multiplatform) apply false
    alias(libs.plugins.compose) apply false
    alias(libs.plugins.compose.compiler) apply false
    alias(libs.plugins.ktlint) apply false
}

// ktlint checks the format and the style of all Kotlin code. `check` runs it. `./gradlew ktlintFormat` corrects most
// problems. The rules are in .editorconfig.
allprojects {
    apply(plugin = rootProject.libs.plugins.ktlint.get().pluginId)
    configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
        version.set(rootProject.libs.versions.ktlint.get())
    }
    // Generated code, for example the Compose resource accessors, has its own format.
    tasks.withType<org.jlleitschuh.gradle.ktlint.tasks.BaseKtLintCheckTask>().configureEach {
        val buildFolder = layout.buildDirectory.get().asFile
        exclude { it.file.startsWith(buildFolder) }
    }
}
