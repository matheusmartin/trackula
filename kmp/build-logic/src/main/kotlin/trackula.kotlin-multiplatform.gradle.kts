// The settings of all modules: Kotlin Multiplatform with JDK 21, the JVM target, warnings as errors, kotlin.test and
// ktlint. Each module adds its Wasm target: the app runs in the browser, the other modules run their tests on Node.js.
plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("trackula.ktlint")
}

kotlin {
    jvmToolchain(21)

    // The JVM target runs the tests fast.
    jvm()

    compilerOptions {
        allWarningsAsErrors = true
    }

    sourceSets {
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}
