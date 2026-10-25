// The UI in Compose Multiplatform. The app runs in the browser as Wasm. The JVM target runs the UI tests on the
// desktop version of Compose.
import org.jetbrains.compose.ExperimentalComposeLibrary
import java.security.MessageDigest

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

// Writes the service worker web/sw.js to the output, with the build ID and the list of the app files. The names of
// the .wasm files change with each build, so the list must come from the output.
val serviceWorker = layout.projectDirectory.file("web/sw.js")
tasks.named("wasmJsBrowserDistribution") {
    inputs.file(serviceWorker)
    doLast {
        val dist = outputs.files.singleFile
        val files = dist.walk()
            .filter { it.isFile && it.name != "index.html" && it.name != "sw.js" }
            .filterNot { it.name.endsWith(".map") || it.name.endsWith(".LICENSE.txt") }
            .map { it.relativeTo(dist).invariantSeparatorsPath }
            .sorted()
            .toList()
        val digest = MessageDigest.getInstance("SHA-256")
        (files + "index.html").forEach { digest.update(dist.resolve(it).readBytes()) }
        val build = digest.digest().joinToString("") { "%02x".format(it) }.take(16)
        val template = serviceWorker.asFile.readText()
        check("/* build */" in template && "/* app-files */" in template) { "$serviceWorker has no markers." }
        dist.resolve("sw.js").writeText(
            template
                .replace("/* build */", build)
                .replace("/* app-files */", files.joinToString(", ") { "'$it'" }),
        )
    }
}
