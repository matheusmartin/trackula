# Trackula: repository rules

Read `README.md` first. It has the overview, the commands, the configuration and the project structure. This file
adds the rules for the code.

## Standards

- Follow the [Kotlin coding conventions](https://kotlinlang.org/docs/coding-conventions.html) and the Compose API
  guidelines (`compose/docs/compose-api-guidelines.md` in the `androidx/androidx` repository).
- Follow *Clean Code* by Robert C. Martin. If Clean Code and the Kotlin conventions give different rules, follow the
  Kotlin conventions.
- This project differs from the Kotlin conventions in these points:
  - The maximum line length is 120. ktlint uses the `intellij_idea` style. See `kmp/.editorconfig`.
  - Write all KDoc, comments and commit messages in ASD-STE100 Simplified Technical English, as in `README.md`.
  - The KDoc of a boolean starts with "True if", "True while" or a similar phrase, not with "Whether".
    Example: "True if the window shows the newest bar."
  - A KDoc can have more than one short sentence before its first blank line, as STE text does.
- `cd kmp && ./gradlew build` must pass. The compiler treats warnings as errors.
- Text for the user never uses `Double.toString()`: it gives "3.0" and "1.0E-7". Use the functions in `Format.kt`.
  Example: `formatNumber(3.0)` gives "3".

## Dependencies between modules

- `model` uses no other module and no library. It is pure Kotlin: you can test it on the JVM and on Wasm. Put logic
  here when you can.
- `sheets` can use `model`, Ktor, coroutines and `kotlinx.serialization`.
- `services` can use `model` and `sheets`. Browser code goes in its `wasmJsMain`, with the Ktor JS client and
  `kotlinx-browser`.
- `app` can use all the modules above and Compose. Browser code goes in its `wasmJsMain`: `commonMain` gets the
  browser parts through `Platform`, so the UI tests can run on the JVM.
- If you add a module, add it to this list and to "Project structure" in `README.md`.
- All library versions are in `kmp/gradle/libs.versions.toml`.

## Build

- Put the build settings that more than one module uses in a convention plugin in `kmp/build-logic/`. Do not use
  `allprojects {}` or `subprojects {}`.
- Declare repositories only in `settings.gradle.kts`.
- Use the lazy Gradle APIs: `tasks.register`, providers, and `get()` only in a task action.

## Tests

- The tests of `<Name>.kt` are in `<Name>Test.kt`, in `src/commonTest/` of the same module and package. Example:
  `kmp/model/src/commonTest/kotlin/trackula/model/ZoomTest.kt` tests `Zoom.kt`.
- The UI tests use `runComposeUiTest`. Use `waitUntil(timeoutMillis = …)` with the named argument.
- When you change code that has tests, change or add tests in the same commit.

## Docs

- If you change the sheet format (tabs, columns, values), update `docs/data-model.md` in the same commit.
- If you change a command, a requirement or the configuration, update `README.md` in the same commit.

## Commits

- Use Conventional Commits: `type(scope): summary`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
  Scopes: `ui`, `data`. Example: `feat(data): require a metric icon and show it in the detail title`.
- Write the summary in lowercase, in the imperative.
