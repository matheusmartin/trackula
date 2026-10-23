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
- Language: Dart. Framework: [Jaspr](https://jaspr.site), client mode.
- UI: [BeerCSS](https://www.beercss.com) 5.0.3 (Material Design 3 and Material Symbols icons), loaded from the jsdelivr CDN in `web/index.html`. Integrity hashes (`integrity`) make sure that the browser uses only the pinned files. If you change the BeerCSS version, set the new hashes.
- Theme: Ember, from the orange-red logo gradient. Neutrals: light slate grey in the light theme, dark slate blue in the dark theme. Day cells and main buttons have the same colors in both themes. The device setting selects the theme. Colors: `web/theme.css`.
- Hosting: static files (Cloudflare Pages or GitHub Pages).
- Content Security Policy: the deploy (`.github/workflows/deploy.yml`) adds it to `index.html`. It lets the page load
  code and data only from BeerCSS, Google sign-in, the Google Picker and the Sheets API. `jaspr serve` and a local
  `jaspr build` do not have it: the development server runs inline scripts, and the policy blocks them. If you add a
  script, a font or an API from another origin, add the origin to the policy in `deploy.yml`.
- Data model: [docs/data-model.md](docs/data-model.md).

## Install the app

- The app is a web app that you can install. On Android (Chrome): menu → "Install app" or "Add to Home screen". On
  iOS (Safari): Share → "Add to Home Screen". On a computer (Chrome or Edge): the install icon in the address bar.
- Files: `web/manifest.webmanifest` (name, colors, icons), `web/sw.js` (the service worker) and `web/register-sw.js`.
- The service worker lets the app open without a network. It uses the network first and keeps the last good copy of
  each app file and BeerCSS file. So a new deploy shows at the next open. Google sign-in, the Picker and the Sheets
  API do not go through it: without a network, the app shows their errors. Demo mode works without a network.
- The app does not register the service worker on `localhost`, so `jaspr serve` works as before. To test the worker,
  serve `build/jaspr/` and open it on `127.0.0.1`. Example: `python3 -m http.server 8080 --bind 127.0.0.1 -d build/jaspr`.
- If you change the BeerCSS version, change it also in `web/sw.js`.
- The icons come from `web/images/logo.svg`. To make them again, run `design/logo/make.py`.

## Requirements

- Dart SDK 3.10 or later. With Homebrew: `brew install dart-sdk`.
- Jaspr CLI: `dart pub global activate jaspr_cli`.
- JDK 21, for the Kotlin port in `kmp/`.
- Put the real SDK `bin` folder first in `PATH`. The Jaspr CLI does not accept the Homebrew `dart` link:

  ```bash
  export PATH="/opt/homebrew/opt/dart-sdk/libexec/bin:$PATH:$HOME/.pub-cache/bin"
  ```

## Configuration

- The app needs the Google OAuth client ID and the Picker API key. They are build defines, not values in the code.
- These values are public in the built app. Git ignores them only to keep them out of the repository. Never add the OAuth client secret.
- Local:
  1. Copy `config.example.env` to `config.env`. Git ignores `config.env`.
  2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY`.
  3. Add `--dart-define-from-file=config.env` to `jaspr serve` and `jaspr build`.
- GitHub Actions: set the repository secrets `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY` in Settings → Secrets and variables → Actions → Secrets. The deploy fails if they are not set.
- If a value is missing, the app shows a message and does not start the sign-in.
- The Kotlin port reads the same values when Gradle builds it: from the environment variables `GOOGLE_CLIENT_ID` and
  `GOOGLE_API_KEY`, else from `config.env`. See `generateConfig` in `kmp/services/build.gradle.kts`.

## Commands

- Run the development server: `jaspr serve --dart-define-from-file=config.env`
- Demo mode: open `http://localhost:8080/?demo`. Sample data in memory, no Google sign-in, no writes to a sheet. A reload starts again from the sample data. Use it to test the UI.
- Run the tests: `dart test`
- Build for production: `jaspr build --dart-define-from-file=config.env`. The output goes to `build/jaspr/`.
- Check the code as CI does: `dart format --output=none --set-exit-if-changed .`, `dart analyze --fatal-infos` and
  `dart test`. `.github/workflows/ci.yml` runs these checks on each pull request and on each push to `main`. It also
  checks that the Jaspr version in `pubspec.yaml` and the `jaspr_cli` version in `deploy.yml` are the same.
- Run the Kotlin app: `cd kmp && ./gradlew :app:wasmJsBrowserDevelopmentRun`. Add `?demo` to the URL for demo mode.
- Check the Kotlin port: `cd kmp && ./gradlew build`. It needs JDK 21. It compiles and packs each module, runs the
  tests on the JVM and on Wasm, and runs ktlint. `./gradlew ktlintFormat` corrects the format. CI runs the check too.

## Project structure

- `lib/model/`: data model, parsing, validation and write planning. Pure Dart, no browser code.
- `lib/sheets/`: Google Sheets access (`SheetsStore`) and the demo mode data (`DemoStore`). Both implement `Store`.
- `lib/services/`: browser code: Google sign-in, the Google Picker, browser storage and pointer input.
- `lib/pages/`, `lib/components/`: UI. `lib/model/stats.dart` and `lib/model/zoom.dart`: the numbers and zoom bars of the detail screen. `lib/model/score.dart`: the day score.
- `lib/constants/theme.dart`: app CSS (`@css`) on top of BeerCSS. Only the habit table and editor. Use Material theme variables (`var(--primary)`…) for colors.
  - Do not put `@css` in files that import browser-only code (`package:web`, `googleapis_auth/auth_browser`). Jaspr runs `@css` code on the Dart VM to create `main.css`, and browser-only imports make it fail.
- `lib/config.dart`: reads the OAuth client ID and the Picker API key from the build defines.
- `test/`: unit tests.
- `kmp/`: the port to Kotlin Multiplatform. Work in progress. See [docs/kotlin-port.md](docs/kotlin-port.md).
- `web/`: the page (`index.html`), the theme colors (`theme.css`), the icons, the manifest and the service worker.
