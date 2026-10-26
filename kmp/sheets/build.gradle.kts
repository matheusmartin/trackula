// Google Sheets access (SheetsStore) and the demo mode data (DemoStore). Both implement Store.
plugins {
    id("trackula.kotlin-multiplatform")
}

kotlin {
    // The app uses the Wasm target. The Wasm tests run on Node.js.
    @OptIn(org.jetbrains.kotlin.gradle.ExperimentalWasmDsl::class)
    wasmJs {
        nodejs()
    }

    sourceSets {
        commonMain.dependencies {
            api(project(":model"))
            api(libs.ktor.client.core)
            api(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.serialization.json)
        }
        commonTest.dependencies {
            implementation(libs.ktor.client.mock)
            implementation(libs.kotlinx.coroutines.test)
        }
    }
}
