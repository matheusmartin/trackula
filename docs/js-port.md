# Port to JavaScript

This file has the plan, the decisions and the rules of the port from Kotlin Multiplatform (`kmp/`) to JavaScript
(`src/`). When the port is done, it keeps the decisions and the differences from the KMP app.

## Goal

- Port Trackula from Kotlin and Compose Multiplatform to JavaScript with HTML elements, as the Dart app was.
- Keep the behavior, the sheet format, the UX and the look of the KMP app. The reference is the KMP app at commit
  `e4e818a`. `docs/data-model.md` continues to give the rules for the sheet.
- Fix the problems that the canvas of Compose caused:
  - The first open downloads 5.6 MB and takes 4 to 8 times longer than the Dart app.
  - A tap shows its result 2 to 4 times slower.
  - Emojis show as empty boxes until the app downloads an emoji font.
  - The table cells, the tiles and the charts have no tooltips.
  - The user cannot select text or find text with Ctrl+F.
  - The keyboard focus is difficult to see.
  - The window bar of the detail screen does not stay at the top while the page scrolls.
- Port each Kotlin test to JavaScript, with the same cases.

## Decisions

- **Language: JavaScript** (ES2022 modules). JSDoc comments give the types, and TypeScript checks them
  (`npm run typecheck`, `checkJs` and `strict`). The only TypeScript file is `src/globals.d.ts`.
- **UI: Preact 10** with JSX and hooks: function components, as Jaspr in the Dart app. No other UI library.
- **Styles: BeerCSS 5.0.3** (Material Design 3), from npm, in the bundle. The Dart app used the same version from a
  CDN. The colors of `kmp/app/src/commonMain/kotlin/trackula/app/Theme.kt` go in the BeerCSS CSS variables. The app
  styles are plain CSS files next to their components.
- **Icons: Material Symbols**, in a font that the app serves itself. No CDN.
- **Text font: Roboto** (`@fontsource/roboto`), the font of the KMP app. The app serves it itself.
- **Emojis: the font of the device.** The app downloads no emoji font.
- **Charts: SVG.** Each bar, dot or day has a `<title>`, so the browser shows a tooltip, as in the Dart app.
- **Build: Vite.** **Tests: Vitest**: Node.js for `model`, `sheets` and `services`, and happy-dom with Testing Library
  for `app`. **Checks: ESLint and Prettier.**

## Project structure

- `src/model/`: data model, parsing, validation and write planning. No package, no browser API.
- `src/sheets/`: the `Store` class, `SheetsStore` (the Sheets REST API with `fetch`) and `DemoStore`.
- `src/services/`: the build values, Google sign-in, the Google Picker, browser storage, the browser history, today's
  date, the count input and the double tap logic.
- `src/app/`: the UI. `components/`, `pages/`, `App.jsx`, `main.jsx` and the CSS files.
- `public/`: files that the build copies as they are: icons, the manifest and the service worker template.
- `index.html`: the page.

## Rules during the port

- The JavaScript code is in `src/`. The KMP app stays in `kmp/` and keeps working until the last phase.
- Each JavaScript file has the name of its Kotlin file. A file with JSX ends with `.jsx`. Examples:
  `kmp/model/.../Zoom.kt` → `src/model/Zoom.js`, `kmp/app/.../components/TodayTiles.kt` →
  `src/app/components/TodayTiles.jsx`. Its tests are in `Zoom.test.js` or `TodayTiles.test.jsx`, in the same folder.
- Keep the names of the classes, functions and properties of the Kotlin code, so that the two are easy to compare.
- Port the KDoc to JSDoc. Write it in ASD-STE100 Simplified Technical English. Give each parameter and each return
  value a type.
- `npm run check` must pass: ESLint, Prettier, the type check, the tests and the build. `npm run format` corrects the
  format.
- The look must be the same as the KMP app, at a phone width (390 px) and at a computer width (1280 px), in the light
  and the dark theme. Compare the two apps in demo mode with Playwright screenshots. See "Compare with the KMP app".

## Type mapping

| Kotlin | JavaScript |
|---|---|
| `Double`, `Int` | `number`. Text for the user comes from `Format.js` or `Numbers.js`. `String(3)` gives "3", as the KMP app. |
| A cell (`Any?`) | `string \| number \| boolean \| null`. |
| `Day` | `Day` in `src/model/Day.js`. There is one object for each date, so `===` compares days, and a day can be a `Map` key. Use `day.isBefore(other)`, not `<`. |
| `data class` | A class with fields, or a JSDoc `@typedef` of a plain object. Tests compare them with `toEqual`. If the code compares two of them or uses one as a `Map` key, make a text key. Example: `MetricDay` → `` `${metricId}\|${day}` ``. |
| `sealed class` | A base class and subclasses. The code checks the type with `instanceof`. |
| `enum class` | A class with one static instance for each value and `entries`, as `MainView.js`. A simple enum can be a frozen object of texts. |
| `List`, `Map`, `Set` | `Array`, `Map`, `Set`. |
| `T?` | `T \| null`. Use `null` for "no value", not `undefined`. |
| `suspend fun` | `async function`. |
| Exceptions | `Error`, or a subclass of `Error` if code catches that type. |
| `require`, `check` | `if (!condition) throw new Error(…)`. |
| `@Composable` function | Preact function component. |
| `remember`, `mutableStateOf` | `useState`, `useRef`, `useMemo`. |
| `LaunchedEffect`, `DisposableEffect` | `useEffect`. |
| `CompositionLocal` | Preact context. |
| `contentDescription` | `aria-label`, and `title` when a tooltip helps. |
| `Canvas` | SVG. |
| `ScrollState` | The scroll of the page. |

## Phases

1. **Skeleton.** `package.json`, Vite, Vitest, ESLint, Prettier, the type check, `Numbers.js`, `Day.js` and
   `MainView.js`. Done.
2. In parallel:
   - **Model**: all other files of `kmp/model/` with their tests.
   - **Services**: `kmp/services/`. `Session`, `Picker`, `Prefs`, `History`, `Today` and `Scripts` call browser APIs.
   - **UI shell**: `index.html` with the start screen, the theme, the fonts, the icons, `App.jsx` with the app bar,
     the navigation bar and rail, the More menu and the Back button, the sign-in page, the setup page, and the small
     shared components.
3. **Sheets**: `kmp/sheets/`, after the model.
4. In parallel, after the sheets and the UI shell:
   - **Today page**: `TodayPage`, `TodayTiles`, `NumberEditor`, `HabitTable`, `MonthCalendar`, the count input,
     `TileRows`, `TrendChart` and `ScoreChart`.
   - **Charts**: `Charts`, `MetricCharts`, `CompareCharts` and `ScoreCalendar`.
   - **Metrics screen**: `MetricsPage`, `MetricForm` and `EmojiPicker`.
5. **Detail screen and parity**: `MetricDetail`, then a full comparison with the KMP app and the fixes.
6. **Switch**: the service worker, the manifest, the deploy and CI. Remove `kmp/`. Update `README.md` and
   `CLAUDE.md`.

## Compare with the KMP app

- Build the KMP app: `cd kmp && ./gradlew :app:wasmJsBrowserDistribution`. Serve it:
  `python3 -m http.server 8082 --bind 127.0.0.1 -d kmp/app/build/dist/wasmJs/productionExecutable`. Open
  `http://127.0.0.1:8082/?demo`.
- Serve the JavaScript app: `npm run dev`, then open `http://localhost:8080/?demo`.
- Playwright with Chromium: set `locale: 'en-US'`, or Compose shows nothing. Wait until the element `splash` is gone.
- Compose draws on a canvas, but it puts an accessibility tree in a shadow root. `page.getByRole('button', { name })`
  finds its buttons. Click at the center of `boundingBox()` with `page.mouse.click`, or with `page.touchscreen.tap`
  in a phone context (`hasTouch: true, isMobile: true`).
- The demo data of the two apps is not the same: the KMP `DemoStore` uses Kotlin `Random(7)`. Compare the layout, the
  sizes, the colors and the text, not the values.
- The Dart app (commit `0902f54`) used BeerCSS and SVG charts. Its files are a good start for the HTML and the CSS:
  `git show 0902f54:lib/constants/theme.dart`, `git show 0902f54:web/theme.css`.

## Differences from the KMP app

- `Day` objects come from `Day.of` and the other static functions, never from `new`. There is one object for each
  date. `Day.of` corrects values out of range: the Kotlin constructor kept them.
