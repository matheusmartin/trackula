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
  CDN. The colors of `kmp/app/src/commonMain/kotlin/trackula/app/Theme.kt` go in the BeerCSS CSS variables
  (`src/app/theme.css`). The app styles are plain CSS files next to their components.
  - BeerCSS is in the cascade layer `beer` (`src/app/beer.css`). A rule of the app replaces a BeerCSS rule without a
    more specific selector.
  - Do not use a BeerCSS helper class as the name of an app class, for example `.error`, `.small` or `.large`: the
    helpers use `!important`. Use the name of the component: `.notice-error`.
  - `theme.css` has the type scale of Compose as classes (`.title-medium`, `.body-small`, …), the extra colors
    (`--cell`, `--done`, `--action-start`, …) and `.score-theme`. A button with its own corners sets them in
    `--button-shape` too, so that a press does not change its shape.
- **Icons: Material Symbols**, in a font that the app serves itself. No CDN. `src/app/symbols.woff2` (0.33 MB) has the
  glyphs of the KMP font: outlined, weight 400, not filled. `design/symbols/make.py` makes it.
- **Text font: Roboto** (`@fontsource/roboto`), the font of the KMP app. The app serves it itself: the weights 400,
  500, 600 and 700, with the subsets `latin` and `latin-ext` (`src/app/roboto.css`).
- **Emojis: the font of the device.** The app downloads no emoji font.
- **Scroll: the page of the browser.** The app bar stays at the top and the navigation bar at the bottom
  (`position: sticky`). A screen that must start at the top calls `window.scrollTo(0, 0)`: the Kotlin code uses
  `LocalPageScroll`.
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
| `Double`, `Int`, `Float` | `number`. Text for the user comes from `Format.js` or `Numbers.js`. `String(3)` gives "3", as the KMP app. |
| A cell (`Any?`) | `Cell` in `src/model/Parse.js`: `string \| number \| boolean \| null`. |
| `Day` | `Day` in `src/model/Day.js`. There is one object for each date, so `===` compares days, and a day can be a `Map` key. Use `day.isBefore(other)`, not `<`. |
| `data class` | A frozen class if it has methods, getters or default values, or if it is a subclass of a sealed class. Else a JSDoc `@typedef` of a plain object, for example `LogEntry` and `ZoomBar`: make it with `{ row, date, … }`. Tests compare them with `toEqual`. If the code compares two of them with `==`, give the class an `equals(other)` method, for example `MetricDraft`. If the code uses one as a `Map` key, make a text key. Example: `MetricDay` → `metricDayKey(metricId, day)`, and `parseMetricDay(key)` gives the id and the day back. |
| Constructor with default values, or with more than 3 fields | One object with the Kotlin names: `new NumberMetric({ id, name, icon, goal, isCount: true })`. `copy(changes)` gives a copy with other values. Other constructors take the fields in the Kotlin order: `new SetCell(row, column, value)`. |
| Named optional arguments | The optional parameters in the Kotlin order, or one last object of options if callers set them by name: `chartPoints(days, values, { height: 40, fromZero: true })`. |
| `sealed class` | A JSDoc `@typedef` with the Kotlin name of the union of the subclasses: `Metric` is `YesNoMetric \| NumberMetric`, `LogWrite` and `MetricsWrite` are the same. The code checks the type with `instanceof`, and TypeScript then knows the subclass. |
| `Pair`, `Triple` | An array: `[first, second]`. |
| Functions with the same name and other parameter types | One function that checks the type of its parameter. Example: `draftOf`. |
| `internal` | `export`. Example: `logDate` in `Parse.js`. |
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
- Text weights: the JavaScript app uses Roboto Medium and SemiBold. The KMP app has only Roboto Regular: it shows
  Medium as Regular, and SemiBold as a bolder Regular.
- The tooltip of an icon button is the tooltip of the browser (`title`).
- The 5-day view is an HTML table: the metric names are row headers, and the days are column headers. A day cell has
  a tooltip with the metric, the day and the value. A count tile has a tooltip with its value and its inputs, and a
  done yes/no tile has the tooltip "Yes" and the mark of its goal, for example "Yes, goal reached".
- A change of the view fades in the new view. Compose fades out the old view at the same time.
- Compose draws the texts of the charts and the ruler at the natural height of the font, without their line height:
  the JavaScript app gives them a line height of 14 px.
