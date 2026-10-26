// Browser code: Google sign-in, the Google Picker, browser storage and input. The input logic and the configuration
// are common code with tests. The code that calls browser APIs is only in wasmJsMain.
plugins {
    id("trackula.kotlin-multiplatform")
}

/**
 * Writes BuildConfig.kt with the Google OAuth client ID and the Picker API key. They are build values, not values in
 * the code. Each value comes from the environment variable with the same name, else from config.env in the
 * repository root. A missing value is empty: then the app shows a message and does not start the sign-in.
 */
val generateConfig = tasks.register("generateConfig") {
    group = "build"
    description = "Writes BuildConfig.kt with the Google OAuth client ID and the Picker API key."
    val configFile = layout.settingsDirectory.file("../config.env")
    // The task reads the environment variables when it runs. A changed value runs the task again, and the
    // configuration cache stays valid.
    val values = listOf("GOOGLE_CLIENT_ID", "GOOGLE_API_KEY").associateWith {
        providers.environmentVariable(it).orElse("")
    }
    values.forEach { (name, value) -> inputs.property(name, value) }
    inputs.files(configFile).optional().withPathSensitivity(PathSensitivity.NONE).withPropertyName("configFile")
    val folder = layout.buildDirectory.dir("generated/config")
    outputs.dir(folder).withPropertyName("folder")
    doLast {
        val file = configFile.asFile
        val fromFile = if (file.exists()) {
            file.readLines()
                .map { it.trim() }
                .filter { it.isNotEmpty() && !it.startsWith("#") && "=" in it }
                .associate { line ->
                    val value = line.substringAfter("=").trim().removeSurrounding("\"").removeSurrounding("'")
                    line.substringBefore("=").trim() to value
                }
        } else {
            emptyMap()
        }
        fun value(name: String): String {
            // An empty environment variable counts as not set.
            val text = values.getValue(name).get().ifEmpty { fromFile[name].orEmpty() }
            val valid = text.all { it.isLetterOrDigit() || it in "-_.:" }
            require(valid) { "$name has characters that are not valid. Use only letters, digits and - _ . :" }
            return text
        }
        val outputFile = folder.get().file("trackula/services/BuildConfig.kt").asFile
        outputFile.parentFile.mkdirs()
        outputFile.writeText(
            """
            |// Made by the generateConfig task of services/build.gradle.kts. Do not edit.
            |package trackula.services
            |
            |internal object BuildConfig {
            |    const val GOOGLE_CLIENT_ID = "${value("GOOGLE_CLIENT_ID")}"
            |    const val GOOGLE_API_KEY = "${value("GOOGLE_API_KEY")}"
            |}
            |
            """.trimMargin(),
        )
    }
}

kotlin {
    // The app uses the Wasm target.
    @OptIn(org.jetbrains.kotlin.gradle.ExperimentalWasmDsl::class)
    wasmJs {
        nodejs()
    }

    sourceSets {
        commonMain {
            // The folder of generateConfig: each task that reads the sources runs generateConfig first.
            kotlin.srcDir(generateConfig)
            dependencies {
                api(project(":sheets"))
            }
        }
        commonTest.dependencies {
            implementation(libs.kotlinx.coroutines.test)
        }
        wasmJsMain.dependencies {
            implementation(libs.ktor.client.js)
            implementation(libs.kotlinx.browser)
        }
    }
}
