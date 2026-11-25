# Plan: simplify the app

Status: plan. No step is done.

## Goal

- Less code, fewer tools and fewer special rules. The behavior, the sheet format and the look stay the same.
- A step that removes a feature is in "Decisions for the owner". Do it only after the owner agrees.
- The language stays JavaScript with Preact and Vite. Phase 4 moves the code to TypeScript. Dart, Go, Kotlin, Rust,
  Gleam and other UI libraries give no gain for this app: they make the download larger, add JS interop, or change
  the UI library and give the same result.

## Measurements

Commit `a15d368`, 2026-11-25. Node.js 22.

| Item | Value |
|---|---|
| App code (no tests) | 13,605 lines of JS in 141 files, 3,121 lines of app CSS |
| Test code | 6,701 lines, 431 tests |
| `npm run check` | 25 s: ESLint 5.4 s, Prettier 2.1 s, `tsc` 4.1 s, Vitest 12.1 s, build 1.4 s |
| Type check with TypeScript 7.0.2 | 0.6 s, 1 error (`@enum` of `NoticeKind` in `Notice.jsx`) |
| JS bundle | 154 KB, 53 KB with gzip |
| CSS bundle | 150 KB, 28 KB with gzip. BeerCSS is 103 KB of it (17 KB with gzip). |
| Icon font `symbols.woff2` | 329 KB: about 70% of the first download (0.46 MB) |
| A font with only the 32 icons of the app UI | 3.3 KB |
| JSDoc type lines | 2,362 tag lines, 131 type casts, 154 `@import` lines, 96 `@param {object} props` blocks |
| Text about the old apps in `src/` | 126 mentions of Kotlin, KMP, Compose or Dart, in 70 files |

## Do not change

- Preact, Vite, Vitest, Testing Library and the SVG charts.
- The layers and `Platform`: the UI tests need the fake platform.
- `Day`: the browsers that the app supports do not all have `Temporal`.
- The service worker. It has 75 lines. A plugin such as `vite-plugin-pwa` adds Workbox and many packages.

## Phase 1: remove what the ports left

Small steps with no risk. One commit for each step.

1. `.claude/settings.json`: remove the Gradle permissions and the `kmp/` rules. Keep the rules for `config.env`.
2. Docs:
   - Delete `docs/kotlin-port.md`.
   - Replace `docs/js-port.md` with `docs/decisions.md`. Keep only the decisions that are true now: UI, styles,
     icons, fonts, emojis, scroll, charts and build.
   - Remove the port rules, the type mapping, the phases, "Compare with the KMP app" and "Differences from the KMP
     app". Git keeps them: the Dart app is in `0902f54`, the KMP app in `2da8d89`, the port plan in `a15d368`.
   - Update the links in `README.md` and `CLAUDE.md`.
3. Comments: remove the text about Kotlin, KMP, Compose and Dart. Keep the reason for the code, not its origin.
   Example: "Its highlight is a circle of 40 px, as in Compose." becomes "Its highlight is a circle of 40 px."
4. Small code:
   - Remove `BUTTON_TEXT` in `Sizes.js`: no code uses it.
   - Remove `export` from functions that only their own file uses: `MonthGrid`, `MetricName` and `DayCell` in
     `HabitTable.jsx`, `monthNames` and `quarterOf` in `Format.js`, `kindText` in `MetricCells.js`.
   - Put the two copies of `capitalized` (`MetricCharts.jsx`, `MetricsPage.jsx`) in `Format.js`.
   - Remove functions that only call one built-in function and that no `CLAUDE.md` rule needs. Example: `toFixed` in
     `Numbers.js` only calls `value.toFixed(decimals)`.
5. TypeScript 7: TypeScript 7 does not read the `@enum` tag. Replace the `@enum` tag of `NoticeKind` with a
   `@typedef` of its values. Then set `typescript` to 7.0.2. The type check goes from 4.1 s to 0.6 s.

## Phase 2: simpler build files

1. Build values from Vite env files:
   - Rename the values to `TRACKULA_GOOGLE_CLIENT_ID` and `TRACKULA_GOOGLE_API_KEY`. Set `envPrefix: 'TRACKULA_'`.
   - `config.env` becomes `.env.local`, and `config.example.env` becomes `.env.example`. Add `.env.local` to
     `.gitignore` and to the deny rules of `.claude/settings.json`.
   - `Config.build` reads `import.meta.env.TRACKULA_GOOGLE_CLIENT_ID`. Give `ImportMetaEnv` the two keys in a `.d.ts`
     file.
   - Remove `buildValue` and `define` from `vite.config.js`, the two globals from `src/globals.d.ts`, and the two
     globals from `eslint.config.js`.
   - CI: in `deploy.yml`, set `TRACKULA_GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}`, and the same for the key.
     The secrets keep their names. Vite gives the shell variables priority over the env files (`loadEnv` in Vite
     8.3.8).
   - Do not use the prefix `GOOGLE_`. Then the build can also get other `GOOGLE_*` values of the computer, for
     example `GOOGLE_APPLICATION_CREDENTIALS`.
   - Update "Configuration" in `README.md` in the same commit.
2. Content Security Policy in the build:
   - Move the policy from the Python step of `deploy.yml` to a small Vite plugin (`transformIndexHtml`, only for
     `vite build`).
   - Then `npm run build` and `vite preview` test the real policy on your computer. `deploy.yml` only runs
     `npm run check` and uploads `dist/`.
   - Remove the `<!-- content-security-policy -->` marker from `index.html`. Update `README.md`: the development
     server has no policy, but each build has it.

## Phase 3: remove BeerCSS

The app uses only a few parts of BeerCSS:

- The outlined text field with a floating label: `field label border invalid` in `MetricForm.jsx`.
- The progress circle: `<progress class="circle">` in 3 places.
- The reset and the default styles of the HTML elements.

All other parts of the UI have their own app classes and CSS. The app also works against BeerCSS:

- the cascade layer `beer`, and the layer `override` with `!important` for the shape of a pressed button,
- a `:where()` rule in `theme.css` that removes the BeerCSS margins,
- the rule "do not use a BeerCSS helper class as the name of an app class".

Steps:

1. Before the change, take Playwright screenshots of all screens in demo mode: 390 px and 1280 px wide, light and
   dark theme. Use a script outside the app.
2. Add `src/app/base.css`: a short reset, the text field (`.text-field`) and the progress circle. The theme variables
   in `theme.css` stay as they are.
3. Remove `beer.css`, the `beercss` package, the two layers and the override rules. Remove the BeerCSS rules from
   `docs/decisions.md`.
4. Take the screenshots again and compare them. Correct the differences. Test the keyboard focus, touch and the dark
   theme.

Gain: 17 KB less CSS with gzip, one package less, no cascade layers and no `!important` rules.

## Phase 4: TypeScript

The types move from the JSDoc comments into the code. The STE text of the JSDoc stays.

1. `tsconfig.json`: set `erasableSyntaxOnly` and `verbatimModuleSyntax`. Keep `allowJs` while the two languages are
   in the code.
2. ESLint cannot read TypeScript: add `typescript-eslint`. Keep `eslint-plugin-jsdoc` only for `require-jsdoc` (each
   export has a JSDoc). Remove its type rules.
3. Convert one layer at a time, with its tests: `model`, `sheets`, `services`, then `app`. `.js` becomes `.ts`, and
   `.jsx` becomes `.tsx`.
4. Change no logic in these commits. `npm run check` must pass after each commit.
5. At the end, remove `allowJs` and `checkJs`. Update `CLAUDE.md`: remove "Do not write `.ts` files", and change the
   JSDoc rule to "each export has a JSDoc in STE". Update `README.md`.

Example:

```ts
// Now
/**
 * A copy of this metric with other values in `changes`.
 * @param {Partial<YesNoMetricFields>} changes
 * @returns {YesNoMetric}
 */
copy(changes) {

// After
/** A copy of this metric with other values in `changes`. */
copy(changes: Partial<YesNoMetricFields>): YesNoMetric {
```

## Decisions for the owner

Each item removes a feature or changes what the user sees. Sizes are lines of code without tests, unless the text
says otherwise.

| # | Change | What goes | What the user loses | Recommendation |
|---|---|---|---|---|
| D1 | Metric icons are emojis only | The full icon font (329 KB) and `design/symbols/make.py` | A Material Symbols name in the `Metrics` tab does not show as an icon | Yes: the first download goes from 0.46 MB to about 0.14 MB |
| D2 | No code for old sheet formats | `#migrate` (text dates, old yes/no values), `textDateRows`, `legacyYesNoCells`, the `>=` and `<=` goals, sheets without a `goal` column | A sheet that no current app version has opened. The app does not change a `>=` or `<=` goal at a load, only at a save: change these cells to `at least` or `at most` first. | Yes, if the current app has opened your sheet and no goal uses `>=` or `<=` |
| D3 | A touch tap on a count adds at once | `DoubleTap`, `CountInput`, `CountInputModifier`: 282 lines, 206 test lines | A double-tap does not subtract. Use the number editor to subtract. | Your choice. The gain: no wait after each tap. |
| D4 | No emoji picker in the metric form | `EmojiPicker`, `Emoji.js`, `emoji.txt` (41 KB), `design/emoji/make.py`: about 270 lines | The emoji grid. Use the emoji keyboard of the phone, or Win + . (Windows) or Ctrl + Cmd + Space (macOS). | Your choice |
| D5 | Only the arrows move a metric | `Drag.js` and the drag part of `MetricList` in `MetricsPage.jsx` | Mouse drag on a computer | Your choice |
| D6 | Fewer charts in the Score view | Each chart that you do not use. The Score view has about 925 lines. | The charts that go | Look at which charts you use |

D1 in more detail:

- The app sends the full font because any Material Symbol can be a metric icon. The metric form already gives only
  emojis.
- The app UI needs only 32 icons. A font with these icons is 3.3 KB.
- A simpler way: SVG icons from the package `@material-symbols/svg-400` (version 0.49.0), as imports. The build then
  takes only the icons that the code imports. No font, no script, no list of names to keep.
- Change `docs/data-model.md`, the `icon` rule of the `Metrics` tab, and the demo data (it uses Material Symbols).
  A metric with a Material Symbols name gets a warning and shows its first letter.

## Later: one tool for lint and format

Vite+ (Oxlint and Oxfmt) or Biome 2 can replace ESLint and Prettier.

- Gain: speed only. ESLint and Prettier take 7.5 s now.
- Blocker: the layer rule in `eslint.config.js` uses a lookahead (`^(?![./])`). Oxlint uses Rust regular
  expressions, which have no lookahead.
- Not checked: an Oxlint rule that is the same as `jsdoc/require-jsdoc`.
- Recommendation: not now. Look at it again after phase 4.

## Order

| Step | Size | Risk | Gain |
|---|---|---|---|
| Phase 1 | Small | None | Fewer files and less text. Faster type check. |
| D1, D2 | Small | Low | Smaller first download. Less sheet code. |
| Phase 2 | Small | Low | No own parser for `config.env` and no Python in the deploy |
| Phase 3 | Medium | Medium: the look can change | One package and two cascade layers less. Smaller CSS. |
| Phase 4 | Large, but mechanical | Low | Types in the code. Most of the 2,362 JSDoc type lines go or get shorter. |
| D3 to D6 | Small to medium | Low | Less code, if you agree |

## Rules for each step

- `npm run check` must pass.
- One step is one commit, with a Conventional Commits message. Tests change in the same commit as the code.
- A step that changes the look needs the screenshot compare of phase 3.
- A step that changes the sheet format updates `docs/data-model.md` in the same commit.
