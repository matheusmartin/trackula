// The data model: parsing, validation, write planning, statistics and the score. Pure Kotlin, no dependencies.
plugins {
    id("trackula.kotlin-multiplatform")
}

kotlin {
    // The app uses the Wasm target. The Wasm tests run on Node.js.
    @OptIn(org.jetbrains.kotlin.gradle.ExperimentalWasmDsl::class)
    wasmJs {
        nodejs()
    }
}
