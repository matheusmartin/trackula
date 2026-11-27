<img src="design/logo/trackula-logo.png" alt="Trackula logo" width="400">

# Trackula

## Overview

- Detail screen: tap a metric name to see all its data. It has numbers and charts for a period (week, month, year or all), a month calendar to edit any day and a year heatmap. The bar with the zoom buttons and the dates stays at the top while the page scrolls. When the screen opens, the period is all the data of a `number` metric and of the score, and 3 months for the other kinds.
- Score: the app calculates a score for each day, from 0 to 100%, and writes it in the `Score` column of the sheet. Each metric must have a `goal`. It gives 0 to 1 point on a day, and the score is the average of these points. A goal is in words, for example `yes`, `at least 8` or `at most 80 from 83 trend`. A green bar chart of the score, one bar for each day, is at the top of the "Days" view. The "Score" view of the bottom navigation bar shows only the score for a period, and each part shows different data. Key numbers: the average per day, its change from the first half of the period to the second half, the best day and the best weekday. Charts: the average per day over time, the strength (it goes up slowly on days with a high score and down slowly on days with a low score), each weekday of this week in the range of the 4 weeks before, the score of each group (or of each metric of one group) in this week and in each of the 4 weeks before, the same in this month and in each of the 3 months before, and the average on each weekday (with the part of each group). A month calendar shows the score of each day. The group filter also applies to the score: with a group selected, the chart and the "Score" view show the score of the metrics of that group only. Rules: [docs/data-model.md](docs/data-model.md#score).
- Charts over time have zoom buttons: 1 month to 5 years. Short spans show weeks, middle spans months, long spans quarters. A small chart below shows all data, but not when the period is all data: then the first chart shows the same bars. Drag or use the mouse wheel to move.
- Metrics screen: the `tune` button in the app bar opens it. It lists the metrics in the order of the app. On a phone or a tablet, the arrows move a metric up or down. With a mouse or a touchpad, drag a metric to a new place. A tap on a metric opens its form: name, icon, kind, unit, step, group and goal. The icon is an emoji: the form has a grid of all the emojis that the app can show, with the default skin tone. A Material Symbols icon or an emoji with a skin tone can go only in the sheet. The form shows the points of the goal. "Add metric" adds a new metric. Delete hides a metric, and its values stay in the sheet: "Deleted metrics" can restore it with all its values. "Rows with problems" lists the rows of the `Metrics` tab that the app cannot read, for example a row without icon or without goal, and "Fix" opens them in the form. So you do not need to open the sheet to change the metrics. Rules: [docs/data-model.md](docs/data-model.md#metrics-screen).
- Navigation: a narrow window has a bottom navigation bar with the views Today, Days and Score. A window of 840 px or more has a navigation rail on the left. Each screen has an address after `#` in the URL, for example `#/days`, `#/metric/weight` or `#/metrics/edit/weight`: a reload shows the same screen, and you can keep a link to it. The Back button of the browser, and the back gesture of a phone, go to the screen before and do not leave the app. A view of the navigation changes the address without a new history entry. A form with changes asks before it closes. "Change sheet" and "Sign out" are in the "More" menu of the app bar. The Save button of the Today view stays above the navigation bar while the page scrolls.
- Days view: the recent days of all metrics, to check and change them. It has two layouts. Table: one row for each metric and one column for each day, with as many days as the width holds, from 5 on a phone to 14 on a wide screen. Calendars: one month calendar for each metric for the last 31 days, and a chart of each `number` and `count` metric. The layout stays in the browser, as the group filter.
- Storage: one Google Sheet in your Google Drive. You pick it with the Google Picker. You can edit the data by hand.
- If the picked sheet has no `Metrics` and `Log` tabs, the app adds them.
- Frontend only. No backend. The browser signs in with Google and calls the Sheets API.
- Language: JavaScript, with JSDoc types that TypeScript checks. UI: [Preact](https://preactjs.com/) with normal
  HTML elements, so the browser gives text selection, find in page, tooltips, the keyboard and screen readers. The
  browser must be Chrome or Edge 111, Firefox 114, Safari 16.4 or later.
- UI: Material Design 3, with [BeerCSS](https://www.beercss.com/) and the app styles. Text font: Roboto. Icons:
  Material Symbols, in the font `src/app/symbols.woff2`. To make it again, run `design/symbols/make.py`. The app
  serves its fonts itself. Emojis use the emoji font of the device. The emoji picker of the metrics form uses the list
  `src/app/components/emoji.txt`. To make it again, run `design/emoji/make.py`.
- Charts: SVG. Each bar, dot and day has a tooltip with its value.
- Theme: Ember, from the orange-red logo gradient. Neutrals: light slate grey in the light theme, dark slate blue in the dark theme. Day cells and main buttons have the same colors in both themes. The device setting selects the theme. Colors: `src/app/theme.css`.
- Hosting: static files (Cloudflare Pages or GitHub Pages).
- Content Security Policy: the deploy (`.github/workflows/deploy.yml`) adds it to `index.html`. It lets the page load
  code and data only from Google sign-in, the Google Picker and the Sheets API. The development server and a local
  build do not have it. If you add a script, a font or an API from another origin,
  add the origin to the policy in `deploy.yml`.
- Data model: [docs/data-model.md](docs/data-model.md).
- The app was a Dart and Jaspr app, then a Kotlin Multiplatform (Compose) app. [docs/kotlin-port.md](docs/kotlin-port.md)
  tells how the Dart app was ported to Kotlin. [docs/js-port.md](docs/js-port.md) tells how the Kotlin app was ported
  to JavaScript, and the differences from the Kotlin app.

## Install the app

- The app is a web app that you can install. On Android (Chrome): menu → "Install app" or "Add to Home screen". On
  iOS (Safari): Share → "Add to Home Screen". On a computer (Chrome or Edge): the install icon in the address bar.
- Files: in `public/`: `manifest.webmanifest` (name, colors, icons), `register-sw.js` and the icons. `index.html`
  shows a start screen with the logo while the browser loads the app, and `public/splash.js` shows a message there if
  the app cannot start, for example in an old browser. The service worker is `web/sw.js`. It is a template: the
  production build writes `dist/sw.js` with the list of the app files, because the names of the code, style and font
  files change with each build. See `serviceWorker` in `vite.config.js`.
- The service worker lets the app open without a network. It uses the network first and keeps the last good copy of
  each app file. So a new deploy shows at the next open. Each build has its own cache, and a new build deletes the
  caches of the old builds. Google sign-in, the Picker and the Sheets API do not go through it: without a network,
  the app shows their errors. Demo mode works without a network.
- The app does not register the service worker on `localhost`, so the development server works as before. To test the
  worker, build the app and open it on `127.0.0.1`. Example: `npm run build`, then
  `npx vite preview --host 127.0.0.1`.
- The icons come from `public/logo.svg`. To make them again, run `design/logo/make.py`.

## Requirements

- Node.js 22 or later, with npm.

## Configuration

- The app needs the Google OAuth client ID and the Picker API key. They are build values, not values in the code.
- These values are public in the built app. Git ignores them only to keep them out of the repository. Never add the OAuth client secret.
- Vite reads them when it builds the app or runs the development server: from the environment variables
  `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY`, else from `config.env`. See `buildValue` in `vite.config.js`.
- Local:
  1. Copy `config.example.env` to `config.env`. Git ignores `config.env`.
  2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY`.
- GitHub Actions: set the repository secrets `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY` in Settings → Secrets and variables → Actions → Secrets. The deploy fails if they are not set.
- If a value is missing, the app shows a message and does not start the sign-in.

## Commands

Run all commands in the root folder.

- Install the packages: `npm ci`.
- Run the development server: `npm run dev`. It serves the app on `http://localhost:8080/`.
- Demo mode: add `?demo` to the URL. Example: `http://localhost:8080/?demo`. Sample data in memory, no Google sign-in, no writes to a sheet. A reload starts again from the sample data. Use it to test the UI.
- Check the code as CI does: `npm run check`. It runs ESLint, Prettier, the type check (`npm run typecheck`), the
  tests (`npm test`) and the build. `.github/workflows/ci.yml` runs it on each pull request and on each push to
  `main`.
- Correct the format: `npm run format`.
- Run the tests while you change the code: `npm run test:watch`.
- Build for production: `npm run build`. The output goes to `dist/`.

## Project structure

All code is in `src/`, with one folder for each layer. The tests of `<Name>.js` are in `<Name>.test.js`, in the same
folder. `CLAUDE.md` gives the rules for the layers.

- `src/model/`: data model, parsing, validation and write planning. Plain JavaScript, no packages, no browser API.
  `Stats.js` and `Zoom.js`: the numbers and zoom bars of the detail screen. `Score.js`: the day score.
  `MetricsWrite.js` and `MetricDraft.js`: the changes and the form of the metrics screen. `Emoji.js`: the list of the
  emoji picker. `Route.js`: the screens and their addresses. `MainView.js`: the views of the navigation and the
  layouts of the Days view.
- `src/sheets/`: Google Sheets access (`SheetsStore` and `SheetsClient`, with `fetch` and the Sheets REST API) and the
  demo mode data (`DemoStore`). Both stores extend `Store`. `testing/FakeSheets.js`: an in-memory sheet for the tests.
- `src/services/`: the build values (`Config`), the count input, the double tap logic, Google sign-in (`Session`), the
  Google Picker, browser storage (`Prefs`), the browser history (`History`) and today's date.
- `src/app/`: the UI in Preact. `pages/`, `components/`, the theme (`theme.css`, `beer.css`, `roboto.css`) and
  `App.jsx`. `Platform.js` holds the browser parts, so the UI tests use a fake (`testing/FakePlatform.js`).
  `BrowserPlatform.js` is the browser version. `Navigation.js` keeps the screen and the address of the browser tab the same.
  `main.jsx` starts the app.
- `index.html`: the page. `public/`: the icons, the manifest and the scripts that the page loads as they are.
  `web/sw.js`: the service worker template.
- `design/`: the scripts that make the logo files, the icon font and the emoji list.
- `package.json` and `package-lock.json`: the packages, with exact versions. `vite.config.js`: the build, the
  development server and the test settings. `eslint.config.js`, `.prettierrc.json` and `tsconfig.json`: the checks.
