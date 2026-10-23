// The data model: parsing, validation, write planning, statistics and the score. Pure Kotlin, no dependencies.
plugins {
    alias(libs.plugins.kotlin.multiplatform)
}

kotlin {
    // The JVM target runs the tests fast. The app uses the Wasm target. The Wasm tests run on Node.js.
    jvm()
    @OptIn(org.jetbrains.kotlin.gradle.ExperimentalWasmDsl::class)
    wasmJs {
        nodejs()
    }

    compilerOptions {
        allWarningsAsErrors.set(true)
    }

    sourceSets {
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}
