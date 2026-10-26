// Each file src/main/kotlin/<id>.gradle.kts is a plugin with the ID <id>.
plugins {
    `kotlin-dsl`
    alias(libs.plugins.ktlint)
}

dependencies {
    // The plugins that the convention plugins apply.
    implementation(libs.kotlin.plugin)
    implementation(libs.ktlint.plugin)
}

ktlint {
    version = libs.versions.ktlint
}

// The Kotlin DSL accessors in the build folder are generated code.
tasks.withType<org.jlleitschuh.gradle.ktlint.tasks.BaseKtLintCheckTask>().configureEach {
    // A local value: the configuration cache cannot keep a reference to the script.
    val buildFolder = layout.buildDirectory
    exclude { it.file.startsWith(buildFolder.get().asFile) }
}
