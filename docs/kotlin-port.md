# Port to Kotlin Multiplatform

## Goal

- Port Trackula from Dart and Jaspr to Kotlin Multiplatform (KMP).
- Keep the behavior and the sheet format. `docs/data-model.md` continues to give the rules for the sheet.
- Port each Dart test to Kotlin before or with the code that it tests. A step is done only when its tests pass.

## Rules during the port

- The Kotlin code is in `kmp/`. The Dart app stays in `lib/` and keeps working until the last phase.
- Each Kotlin file has the same name as its Dart file, in UpperCamelCase. Example: `lib/model/log_entry.dart` →
  `kmp/model/src/commonMain/kotlin/trackula/model/LogEntry.kt`.
- The tests of `<Name>.kt` are in `<Name>Test.kt` in `src/commonTest/`. They run on the JVM and on Wasm (Node.js).
- Write KDoc and comments in ASD-STE100 Simplified Technical English, as in the Dart code.
- `cd kmp && ./gradlew build` must pass. The compiler treats warnings as errors. ktlint checks the format
  (`intellij_idea` style, 120 characters). `./gradlew ktlintFormat` corrects most problems.
- A reviewer agent reviews each commit before the next step starts.

## Type mapping

| Dart | Kotlin |
|---|---|
| `num` | `Double`. A whole number is a `Double` with no fraction: 3 is 3.0. The app runs as JavaScript, where 3 and 3.0 are the same, so the ported tests compare `Double` values. |
| `int` | `Int` |
| A cell (`Object?`) | `Any?`: a `String`, a `Number`, a `Boolean` or null. The code reads each `Number` as a `Double`, and `cellText` gives the same text as Dart compiled to JavaScript. A sealed `Cell` type is safer, but it makes each test row longer. The Sheets code converts the JSON values at the boundary. |
| Record, `typedef` of a record | `data class` |
| `(String, Day)` key | `MetricDay` |
| `sealed class`, `enum` | `sealed class`, `enum class` |
| `FormatException`, `StateError` | `IllegalArgumentException`, `IllegalStateException` |
| `DateTime` | `Day` does its own calendar math. The model has no clock: the caller gives today. |
| `toStringAsFixed`, `round()` | `toFixed` and `roundHalfAwayFromZero` in `Numbers.kt`. They give the same results as Dart compiled to JavaScript. Text for the user never uses `Double.toString()`: it gives "3.0" and "1.0E-7", JavaScript gives "3" and "1e-7". |

## Phases

1. **Project.** Gradle project in `kmp/`, version catalog, wrapper and a CI job. Done.
2. **Model** (`lib/model/` → `kmp/model/`, targets JVM and Wasm). Pure Kotlin, no dependencies. Done.
   1. `Numbers` (`toFixed`, `roundHalfAwayFromZero`), `Day`, `Format`, `Zoom`, `NumberInput`, `MainView`, `Chart`. `Format` uses `BarUnit` of `Zoom`.
   2. `Metric`, `LogEntry`, `Parse`, `CountQueue`, `Summary`.
   3. `Score`, `Stats`.
3. **Sheets** (`lib/sheets/` → `kmp/sheets/`). The `Store` class, `DemoStore` and `SheetsStore`. KMP has no Sheets
   client: `SheetsClient` calls the Sheets REST API with Ktor and the JSON elements of `kotlinx.serialization`, and
   the `HttpClient` that the caller gives sends the access token. Tests use the Ktor `MockEngine` with an in-memory
   sheet, as the Dart tests did. Done.
4. **Services** (`lib/services/`, `lib/config.dart` → `kmp/services/`). Done.
   - Common code with tests: `DoubleTap` (coroutines, tests with a virtual clock), `CountInput` (the input logic
     without browser types, so it works with each UI), `AccessToken` (the expiry) and `Config`.
   - Wasm only: `Session` (the Google Identity Services token client), `Picker`, `Prefs` (local storage), `today()`
     and the script loader. These call browser APIs, so only a test in a browser can test them: see phase 6.
   - `Config` gets its values from the `generateConfig` Gradle task: the environment variables `GOOGLE_CLIENT_ID` and
     `GOOGLE_API_KEY`, else `config.env`.
   - `capturePointer` waits for phase 5: only a DOM UI needs it.
5. **UI** (`lib/components/`, `lib/pages/`, `lib/constants/` → `kmp/app/`), in Compose Multiplatform. Done. The app runs in
   the browser as Wasm. The UI tests run on the JVM with the desktop version of Compose (`runComposeUiTest`).
   - `Platform` and `Session` hold the browser parts, so the tests use a fake. `Main.kt` in wasmJsMain has the
     browser version.
   - The theme has the colors of `web/theme.css`: `Theme.kt`. Material Design 3 does not have the cell, done and
     gradient colors, so `ExtraColors` has them.
   - All icons come from `symbols.ttf`: Material Symbols as a static TTF (1.4 MB, 0.5 MB with gzip), made by
     `design/symbols/make.py`. The Skia build of Compose for the web cannot read WOFF2.
   1. App shell: theme, header, bottom navigation bar, sign-in, setup and demo mode. Done.
   2. Today page: tiles, the 5-day table, the 31-day calendars, the number editor and the count input. Done.
   3. The trend chart and the score chart of the 5-day and 31-day views, on a Compose `Canvas`. Done.
   4. Detail page with its charts (`charts.dart`, `metric_charts.dart`), month calendar and the score view. Done.
6. **Build and deploy.** `web/` files, service worker, Content Security Policy, `deploy.yml`, CI. Then remove the
   Dart code and update `README.md` and `CLAUDE.md`.

## Decisions

- **UI technology (phase 5): Compose Multiplatform.** It draws on a canvas: it removes BeerCSS, `theme.css` and the
  SVG charts, and the download is larger (about 12 MB of Wasm, 8 MB of it for Skia). In return, the same UI code can
  later run as an Android or iOS app.

## Risks

- A Wasm app needs `'wasm-unsafe-eval'` in `script-src` of the Content Security Policy in `deploy.yml`.
- Wasm needs WasmGC. Safari before 18.2 does not have it. A Kotlin/JS target can be a fallback for old browsers.
- `kmp/kotlin-js-store/` has the npm lock file. When the npm dependencies change, run
  `./gradlew kotlinWasmUpgradePackageLock` and commit the lock file in the same commit.

## Differences from the Dart code

- `Day.today()` is not in the model. The model has no clock, so the platform code gives the day.
- Number text in a cell, for example `"8"` in a `Log` cell, must be a decimal number: `8`, `-8`, `8.5`, `.5` or
  `1e3`. Dart also accepted `0x10`, `NaN` and `Infinity`.
- `stepDecimals` gives at most 6 decimals for any step. Dart read the text of the step, so it gave 0 for `1e-7`.
- `Day.fromSerial` returns null for NaN and for days after 9999-12-31. Dart threw an error.
- `yesNoStats` with no days gives an empty strength list. Dart threw an error.
- `trim()` in Kotlin does not remove U+FEFF, and `\s` in a regular expression on the JVM does not find a no-break
  space. Dart removed and found both. So a cell with only U+FEFF is not empty, and the goal `<=`, no-break space, `75`
  is not valid.
- `DemoStore` gets today from the caller, and its sample values are different: Kotlin `Random(7)` gives other numbers
  than Dart `Random(7)`.
- `Session.signIn` calls the Google Identity Services token client itself. Dart used the googleapis_auth package,
  which does the same.
- `CountInput` gets the event values (`pointerType`, `key`) from the UI, not the browser events.
- The `Store` functions are `suspend` functions, in place of functions that return a `Future`.
- The sign-in page has the layout of the Dart page, but not all of its CSS: the logo and text sizes are near the CSS
  `min()` and `clamp()` values, and the page has no logo shadow, no Helvetica Neue wordmark font and no rules for short
  screens. Compose draws text in its default font.
- The table cells, tiles and the ruler have no tooltip: their text is for screen readers and tests
  (`contentDescription`).
- The count input reads raw pointer events: a mouse press with the right button subtracts, and a touch press longer
  than the long-press time does nothing. The browser does not send a `contextmenu` event to the canvas.
- The charts have no tooltip for each bar, dot or day. A screen reader gets one text for each chart.
- The window bar of the detail screen does not stay at the top while the page scrolls.
- The buttons have no tooltip. Their name is for screen readers and tests (`contentDescription`).
- `Metric` and the other model classes are data classes: two equal metrics are equal. Dart compared them by identity.
