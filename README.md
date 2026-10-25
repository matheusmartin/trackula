<img src="design/logo/trackula-logo.png" alt="Trackula logo" width="400">

# Trackula

## Overview

- Web app to track habits and body measurements.
- Detail screen: tap a metric name to see all its data. It has numbers and charts for a period (week, month, year or all), a month calendar to edit any day and a year heatmap.
- Score: the app calculates a score for each day from the values and the `goal` of each metric, and writes it in the `Score` column of the sheet. A green line chart of the score is at the top of the "5 days" and "31 days" views. The "Score" view of the bottom navigation bar shows only the score: numbers and charts for a period, as the detail screen. Rules: [docs/data-model.md](docs/data-model.md#score).
- Charts over time have zoom buttons: 1 month to 5 years. Short spans show weeks, middle spans months, long spans quarters. A small chart below shows all data. Drag or use the mouse wheel to move.
- Storage: one Google Sheet in your Google Drive. You pick it with the Google Picker. You can edit the data by hand.
- If the picked sheet has no `Metrics` and `Log` tabs, the app adds them.
- Frontend only. No backend. The browser signs in with Google and calls the Sheets API.
- Language: Kotlin. Framework: [Compose Multiplatform](https://www.jetbrains.com/compose-multiplatform/). The app
  runs in the browser as WebAssembly (Kotlin/Wasm). Compose draws the whole UI on a canvas. The browser must support
  WebAssembly GC: Chrome and Edge 119, Firefox 120, Safari 18.2 or later.
- UI: Material Design 3 (`material3` of Compose). Icons: Material Symbols, in the font
  `kmp/app/src/commonMain/composeResources/font/symbols.ttf`. To make it again, run `design/symbols/make.py`.
- Theme: Ember, from the orange-red logo gradient. Neutrals: light slate grey in the light theme, dark slate blue in the dark theme. Day cells and main buttons have the same colors in both themes. The device setting selects the theme. Colors: `kmp/app/src/commonMain/kotlin/trackula/app/Theme.kt`.
- Hosting: static files (Cloudflare Pages or GitHub Pages).
- Content Security Policy: the deploy (`.github/workflows/deploy.yml`) adds it to `index.html`. It lets the page load
  code and data only from Google sign-in, the Google Picker, the Sheets API and the fallback fonts of Compose
  (`fonts.gstatic.com`). It also allows `'wasm-unsafe-eval'`, so the browser can start the WebAssembly code. The
  development server and a local build do not have it. If you add a script, a font or an API from another origin,
  add the origin to the policy in `deploy.yml`.
- Data model: [docs/data-model.md](docs/data-model.md).
- The app was a Dart and Jaspr app before. [docs/kotlin-port.md](docs/kotlin-port.md) tells how it was ported, and
  the differences from the Dart app.

## Install the app

- The app is a web app that you can install. On Android (Chrome): menu → "Install app" or "Add to Home screen". On
  iOS (Safari): Share → "Add to Home Screen". On a computer (Chrome or Edge): the install icon in the address bar.
- Files: in `kmp/app/src/wasmJsMain/resources/`: `manifest.webmanifest` (name, colors, icons), `register-sw.js` and
  the icons. The service worker is `kmp/app/web/sw.js`. It is a template: the production build writes `sw.js` with the
  list of the app files, because the names of the `.wasm` files change with each build.
- The service worker lets the app open without a network. It uses the network first and keeps the last good copy of
  each app file. So a new deploy shows at the next open. Each build has its own cache, and a new build deletes the
  caches of the old builds. Google sign-in, the Picker and the Sheets API do not go through it: without a network,
  the app shows their errors. Demo mode works without a network.
- The app does not register the service worker on `localhost`, so the development server works as before. To test the
  worker, serve the production build and open it on `127.0.0.1`. Example:
  `python3 -m http.server 8080 --bind 127.0.0.1 -d kmp/app/build/dist/wasmJs/productionExecutable`.
- The icons come from `kmp/app/src/wasmJsMain/resources/logo.svg`. To make them again, run `design/logo/make.py`.

## Requirements

- JDK 21. The Gradle wrapper (`kmp/gradlew`) gets Gradle, Kotlin and Node.js.

## Configuration

- The app needs the Google OAuth client ID and the Picker API key. They are build values, not values in the code.
- These values are public in the built app. Git ignores them only to keep them out of the repository. Never add the OAuth client secret.
- Gradle reads them when it builds the app: from the environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY`,
  else from `config.env`. See `generateConfig` in `kmp/services/build.gradle.kts`.
- Local:
  1. Copy `config.example.env` to `config.env`. Git ignores `config.env`.
  2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY`.
- GitHub Actions: set the repository secrets `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY` in Settings → Secrets and variables → Actions → Secrets. The deploy fails if they are not set.
- If a value is missing, the app shows a message and does not start the sign-in.

## Commands

Run all commands in `kmp/`.

- Run the development server: `./gradlew :app:wasmJsBrowserDevelopmentRun`. It opens the app in the browser.
- Demo mode: add `?demo` to the URL. Example: `http://localhost:8080/?demo`. Sample data in memory, no Google sign-in, no writes to a sheet. A reload starts again from the sample data. Use it to test the UI.
- Check the code as CI does: `./gradlew build`. It compiles and packs each module with warnings as errors, runs the
  tests on the JVM and on Wasm (Node.js), and runs ktlint. `.github/workflows/ci.yml` runs it on each pull request
  and on each push to `main`.
- Correct the format: `./gradlew ktlintFormat`.
- Run the tests of one module: `./gradlew :model:jvmTest`. Modules: `model`, `sheets`, `services`, `app`.
- Build for production: `./gradlew :app:wasmJsBrowserDistribution`. The output goes to
  `kmp/app/build/dist/wasmJs/productionExecutable/`.
- When the npm dependencies change, run `./gradlew kotlinWasmUpgradePackageLock` and commit
  `kmp/kotlin-js-store/` in the same commit.

## Project structure

All code is in `kmp/`, a Gradle project with one module for each layer. Each module has `src/commonMain/` (code for
all targets), `src/commonTest/` (tests), and can have `src/wasmJsMain/` (browser code) and `src/jvmTest/`.

- `model/`: data model, parsing, validation and write planning. Pure Kotlin, no dependencies. `Stats.kt` and
  `Zoom.kt`: the numbers and zoom bars of the detail screen. `Score.kt`: the day score.
- `sheets/`: Google Sheets access (`SheetsStore`, with Ktor and the Sheets REST API) and the demo mode data
  (`DemoStore`). Both implement `Store`.
- `services/`: the build values (`Config`), the count input and the double tap logic. Browser code in `wasmJsMain`:
  Google sign-in (`Session`), the Google Picker, browser storage (`Prefs`) and today's date.
- `app/`: the UI in Compose. `pages/`, `components/`, the theme (`Theme.kt`) and `App.kt`. `Platform` holds the
  browser parts, so the UI tests on the JVM use a fake. `Main.kt` in `wasmJsMain` starts the app in the browser.
  `wasmJsMain/resources/`: the page (`index.html`), the icons and the manifest. `web/sw.js`: the service worker.
- `kotlin-js-store/`: the npm lock file.
- `gradle/libs.versions.toml`: the versions of all dependencies.
