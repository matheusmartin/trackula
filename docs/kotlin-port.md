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
- `cd kmp && ./gradlew check` must pass. The compiler treats warnings as errors. ktlint checks the format
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
4. **Services** (`lib/services/`). Google sign-in (Google Identity Services token client), the Google Picker, browser
   storage, pointer input and double tap. Wasm interop with JavaScript.
5. **UI** (`lib/components/`, `lib/pages/`, `lib/constants/`). This phase needs a decision: Compose Multiplatform for web
   (canvas, Beta) or a DOM UI that keeps BeerCSS. See "Open decisions".
6. **Build and deploy.** `web/` files, service worker, Content Security Policy, `deploy.yml`, CI. Then remove the
   Dart code and update `README.md` and `CLAUDE.md`.

## Open decisions

- **UI technology (phase 5).** Compose Multiplatform draws on a canvas: it removes BeerCSS, `theme.css` and the SVG
  charts, and the download is larger. A DOM UI keeps them, but its Kotlin libraries get less work from JetBrains.

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
- The `Store` functions are `suspend` functions, in place of functions that return a `Future`.
- `Metric` and the other model classes are data classes: two equal metrics are equal. Dart compared them by identity.
