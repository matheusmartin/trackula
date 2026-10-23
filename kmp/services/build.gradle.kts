// Browser code: Google sign-in, the Google Picker, browser storage and input. The input logic and the configuration
// are common code with tests. The code that calls browser APIs is only in wasmJsMain.
plugins {
    alias(libs.plugins.kotlin.multiplatform)
}

kotlin {
    jvmToolchain(21)

    // The JVM target runs the tests of the common code fast. The app uses the Wasm target.
    jvm()
    @OptIn(org.jetbrains.kotlin.gradle.ExperimentalWasmDsl::class)
    wasmJs {
        nodejs()
    }

    compilerOptions {
        allWarningsAsErrors.set(true)
    }

    sourceSets {
        commonMain {
            kotlin.srcDir(layout.buildDirectory.dir("generated/config"))
            dependencies {
                api(project(":sheets"))
            }
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.coroutines.test)
        }
        wasmJsMain.dependencies {
            implementation(libs.ktor.client.js)
            implementation(libs.kotlinx.browser)
        }
    }
}

/**
 * Writes BuildConfig.kt with the Google OAuth client ID and the Picker API key. They are build values, as the Dart
 * defines were. Each value comes from the environment variable with the same name, else from config.env in the
 * repository root. A missing value is empty: then the app shows a message and does not start the sign-in.
 */
val generateConfig by tasks.registering {
    val configFile = rootProject.layout.projectDirectory.file("../config.env")
    val names = listOf("GOOGLE_CLIENT_ID", "GOOGLE_API_KEY")
    val values = names.associateWith { providers.environmentVariable(it).orNull }
    inputs.property("values", values.mapValues { it.value.orEmpty() })
    inputs.files(configFile).optional()
    val output = layout.buildDirectory.file("generated/config/trackula/services/BuildConfig.kt")
    outputs.file(output)
    doLast {
        val file = configFile.asFile
        val fromFile = if (file.exists()) {
            file.readLines()
                .map { it.trim() }
                .filter { it.isNotEmpty() && !it.startsWith("#") && "=" in it }
                .associate { it.substringBefore("=").trim() to it.substringAfter("=").trim().removeSurrounding("\"") }
        } else {
            emptyMap()
        }
        fun value(name: String): String {
            val text = values[name] ?: fromFile[name].orEmpty()
            require(text.all { it.isLetterOrDigit() || it in "-_.:" }) { "$name has characters that are not valid." }
            return text
        }
        output.get().asFile.writeText(
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

tasks.matching { it.name.startsWith("compileKotlin") || it.name.startsWith("runKtlint") }.configureEach {
    dependsOn(generateConfig)
}
