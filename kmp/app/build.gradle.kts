// The UI in Compose Multiplatform. The app runs in the browser as Wasm. The JVM target runs the UI tests on the
// desktop version of Compose.
import org.jetbrains.compose.ExperimentalComposeLibrary

plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.compose)
    alias(libs.plugins.compose.compiler)
}

kotlin {
    jvmToolchain(21)

    jvm()
    @OptIn(org.jetbrains.kotlin.gradle.ExperimentalWasmDsl::class)
    wasmJs {
        outputModuleName.set("trackula")
        browser {
            commonWebpackConfig {
                outputFileName = "trackula.js"
            }
            // The UI tests run on the JVM. A browser test needs Karma and Chrome.
            testTask { enabled = false }
        }
        binaries.executable()
    }

    compilerOptions {
        allWarningsAsErrors.set(true)
    }

    sourceSets {
        commonMain.dependencies {
            implementation(project(":sheets"))
            implementation(project(":services"))
            implementation(libs.compose.runtime)
            implementation(libs.compose.foundation)
            implementation(libs.compose.ui)
            implementation(libs.compose.material3)
            implementation(libs.compose.resources)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.coroutines.test)
            @OptIn(ExperimentalComposeLibrary::class)
            implementation(libs.compose.ui.test)
        }
        jvmTest.dependencies {
            implementation(compose.desktop.currentOs)
        }
        wasmJsMain.dependencies {
            implementation(libs.kotlinx.browser)
        }
    }
}

compose.resources {
    packageOfResClass = "trackula.app.resources"
    publicResClass = false
}
