# Design

Status: phase 1 of the consolidation, for review. This file gives the look of the app: colors, type, space, layout,
components, number formats and interaction. `docs/product.md` gives the behavior and the words. Phase 3 puts these
rules in the code, and phase 4 applies them to each screen. Until then, the app does not follow all of them.

The tokens are CSS variables in `src/app/theme.css`. A rule of the app uses a token, not a fixed value. Example:
`gap: var(--space-3)`, not `gap: 12px`.

## Color roles

Each color has one role, the same on all screens. The table gives the light and the dark value.

| Role | Tokens | Light | Dark | Use for | Do not use for |
|---|---|---|---|---|---|
| Brand | `--header-start`, `--header-end` | `#dc4a0c` → `#be123c` | the same | The app bar. | Data. |
| Main action | `--action-start`, `--action-end` | `#c2410c` → `#9f1239` | the same | The one main button of a screen. Example: "Add metric". | Other buttons. |
| Accent | `--primary` | `#b8321a` | `#ff8c66` | Links, text buttons, the focus ring. | Data, warnings. |
| Selected | `--primary-container` | `#ffdfd4` | `#7a2a14` | The selected item of the navigation and of the chips. | Data. |
| Data | `--cell-image`, `--cell`, `--on-cell` | `#c3540a` → `#b5470a`, `#bd4e0a`, white | the same gradient, `#ec7a3b` | The day cells (`--cell-image`), the bars, lines and dots of the charts (`--cell`), a done tile, the score, a change for the better. | Text. |
| Soft data | `--data-soft` | `#f4b393` | `#834a2d` | The second marks of the data: the range of the 4 weeks before, a `no` in the day strip, the start of the color scale of the day bars. | The main data. |
| No points | `--cell-value` | `#e2e6eb` | `#323c49` | A day cell with a value and 0 points. | — |
| Contrast | `--data-contrast` | `#7a2439` (wine) | `#b5596a` | The color next to the data: "less" in the score tables, the `no` days of a yes/no metric, a bar below 0, the diamond of this week. | The main data. |
| Warning | `--warning`, `--warning-container` | `#b45309`, `#fde7cf` | `#f0a35a`, `#4d2c0a` | Sheet warnings, the warning sign of a tile over a limit. | Day cells, charts. |
| Error | `--error`, `--error-container` | `#ba1a1a`, `#ffdad6` | `#ffb4ab`, `#93000a` | A failed write or load, an invalid field. | Data. |
| Neutral | `--surface…`, `--on-surface…`, `--outline…` | slate grey | slate blue | Pages, cards, text, borders. | — |
| Groups | `--group-1` to `--group-4` | `#732500`, `#b14c00`, `#e97e2b`, `#ffc394` | `#842c00`, `#c35401`, `#f78a3b`, `#ffd5b4` | The parts of each group in a stacked chart: tones of the data orange, deep to light. | Other data. |

Rules:

- **Decision (owner):** the data has the color of the brand. The day cells, the bars of the charts and the score all
  use it, in the same way. Example: a done day and a day with a score of 100% are the same full brand cell.
- **Decision (owner, 2026-11-28):** the data color is the deep orange of the brand gradient (`#c3540a` → `#b5470a`),
  not its red: red on all data was too strong. Option B of the color mocks. An orange this dark keeps white text at
  4.5:1 or more.
- **Decision (owner, 2026-11-28):** scheme R05, "Mono ember", of the color schemes canvas
  (https://claude.ai/artifact/C17UorNzgi5P3sugCKVU8N): one hue for the data. The second marks use the soft orange,
  not grey. "Less" and "no" use wine. The groups are 4 tones of the data orange, so they match the brand. The other
  colors of the app stay.
- The charts have no grey marks and no other hue next to the data: `--tertiary` (`#b45309`) is almost the data
  orange, and grey bars blend with the cards.
- The group tones differ only in lightness: a chart with groups always shows their names (a legend in the order of the
  stack) and a 2 px gap between the parts. A fifth group gets the first tone again.
- A score bar of a Saturday or a Sunday is lighter (50% opacity), so that the weeks show.
- The score has no own theme: it uses the Data role, as each day cell does.
- The current day has no special color and no ring. It is the last column of the table, or its day number in a
  calendar.
- Each text has a contrast of 4.5:1 or more on its background. Each border of a control, and each chart mark, has 3:1
  or more.

## Day cell

The day cell is the same component in the Days table, in the calendars and in the Days card of the Score screen. Its fill shows the
points of the day, so you can see your goals at a glance.

| State | Look | Example |
|---|---|---|
| No value | No fill. A 1 px border in `--outline`. | You did not record Water on that day. |
| Value, 0 points | `--cell-value` fill. The value in `--on-surface`. | Weight 84.1 for the goal `at most 80 from 83`. |
| Value, some points | `--cell-value`, with `--cell-image` on it at an opacity of 0.1 + 0.6 × points (10% to 70%). The value in `--on-surface`. | Water 5 for `at least 8`: 0.625 points, 48%. |
| Value, 1 point | `--cell-image` fill. The value in `--on-cell`. | Meditate yes for the goal `yes`. |
| Over a limit | 0 points: `--cell-value` fill. | Coffee 3 for `at most 2`. |
| After today | No cell. | — |
| Score | The same scale, from the score of the day: 0% is `--cell-value`, 100% is the full `--cell-image`. | 73.1% is a strong tint. |

- A cell shows the value of a number or count metric, and no text for a yes/no metric.
- Only a full point gets the full brand fill. So "goal reached" and "almost" look different, and the text has enough
  contrast: dark text up to 70%, white text on the full fill. In the dark theme the text is light on all fills.
- A number metric shows its points, also over its target. Example: Weight 82.6 for `at most 80 from 83` has 0.13
  points: a light tint.
- The current day looks like the other days (see "Color roles").
- Size: 40 px or more, in a touch target of 48 px where the screen has the space. Corners: `--radius-s`.
- Tooltip: the metric, the day, the value and the points. Example: "Water, Nov 26: 5 glasses, 0.6 points". Over a
  limit: "Coffee, Nov 24: 3 cups, over the limit".

## Type

One font: Roboto, with the weights 400, 500 and 700. The app serves it itself.

| Class | Size / line | Weight | Use for |
|---|---|---|---|
| `.headline-small` | 24 / 32 px | 400 | The title of a screen. |
| `.title-large` | 22 / 28 px | 400 | Key numbers. |
| `.title-medium` | 16 / 24 px | 500 | The title of a card. |
| `.title-small` | 14 / 20 px | 500 | Table headers, small titles. |
| `.body-large` | 16 / 24 px | 400 | Text fields, long text. |
| `.body-medium` | 14 / 20 px | 400 | Most text. |
| `.body-small` | 12 / 16 px | 400 | The description of a card, chart labels, the labels of key numbers. |
| `.label-large` | 14 / 20 px | 500 | Buttons and chips. |
| `.label-medium` | 12 / 16 px | 500 | The labels of the navigation. Text in a day cell. |

- No other font size, except the ruler, the logo of the sign-in screen, and the day number in a cell of a month
  calendar (10 / 12 px, weight 400).
- Numbers that line up in columns use `font-variant-numeric: tabular-nums`: tables, cells, key numbers and axes.
- Text starts with a capital letter, and the other words are in lowercase ("Add metric", not "Add Metric").

## Space, corners and sizes

| Token | Value | Use for |
|---|---|---|
| `--space-1` | 4 px | The space between an icon and its text. |
| `--space-2` | 8 px | The space between the cells and the chips. |
| `--space-3` | 12 px | The space between the cards. The space in a small card. |
| `--space-4` | 16 px | The padding of a card. The side margin of a page on a phone. |
| `--space-5` | 24 px | The space between the sections of a screen. The side margin of a page on a desktop. |
| `--space-6` | 32 px | The space above the title of a screen. |
| `--space-7` | 48 px | The space around an empty state. |
| `--radius-s` | 8 px | Day cells, text fields, menus. |
| `--radius-m` | 12 px | Cards, tiles. |
| `--radius-l` | 16 px | Dialogs. |
| `--radius-full` | 999 px | Buttons, chips, the navigation indicator. |
| `--touch-target` | 48 px | The smallest touch target. |

- A border or a line can be 1 px or 2 px. Other spaces use the tokens.
- Cards have no shadow. Only the menus, the dialogs and the Undo message have a shadow (`--elevate2`).

## Layout

- Two window classes: narrow (less than 840 px) and wide (840 px or more). A narrow window has the bottom navigation
  bar. A wide window has the navigation rail.
- The content of a page is 1200 px wide or less (`--page-max-width`). A form is 640 px wide or less (`--form-width`).
- Cards go in a grid: `repeat(auto-fill, minmax(var(--card-min-width), 1fr))`, with `--card-min-width` 340 px. So a
  phone shows 1 column and a desktop 2 or 3 columns. A small chart does not fill a wide card: the grid gives it a
  narrow column.
- Each part of a screen is a card with a title and one sentence that tells what it shows. Also the calendars.
- The period panel (P9 of the canvas): the span chips (1W to 5Y and All), the dates with arrows, and the day strip:
  one bar for each day of all data, a lighter bar on a Saturday or a Sunday, a box on the period. A strip too narrow
  for days (less than 1.5 px a day) shows weeks. When the page scrolls past the panel, a thin row with the span, the
  dates and the bars of the period stays below the app bar. A tap on it opens the panel.
- The day bars: yes is a full bar, no a short soft bar; a count, a number and the score have the height of their
  value. The color goes from the soft data color (0 points) to the data color (1 point). No value: a thin line.

| Screen | Narrow | Wide |
|---|---|---|
| Today | Number tiles in 1 column. Yes/no and count tiles in 2 columns. | Number tiles in 2 columns. Yes/no and count tiles in 4 to 6 columns (`--tile-min-width` 160 px). A ruler is not wider than its tile. |
| Days, table | One card. Its first row has the score bars, each bar in the column of its day, so that a bar is exactly above the cells of its day. Then the day headers and one row for each metric. 5 days. | The same card, with as many days as the width holds, up to 14. |
| Days, calendars | The score bars first, in one card, as in the table. Then 1 calendar card for each metric. | The same, with the card grid: 2 or 3 calendars in each row, all of the same size. |
| Score, metric detail | The period panel (chips, then the dates, then the strip), the key numbers in 2 columns, then the cards in 1 column. | The period panel (chips and dates in one row), the key numbers in one row, then the card grid. The last small card of a row that is not full fills the row. |
| Metric detail, Days card | One month, with arrows to change it. Each cell shows its day number and its value. | Up to 3 months side by side, each with its name. A tap on a bar over time shows its month in the card. |
| Metrics | The list. A tap opens the form as a screen. | The list on the left and the form on the right. |

## Components

The shared components. Each one replaces the parts in the right column. Phases 2 and 3 made `PeriodBar`, `Notice`,
`Snackbar` (with Undo), `Button`, `Dialog`, `KeyNumbers` (in `ChartParts.jsx`) and a first `TextField`. Phase 4 makes
the others with the redraw of their screens: the Days screen made `DayCell`, the metric detail made the first
`Calendar`.

| Component | Variants | Replaces |
|---|---|---|
| `Button` | `main` (the main action, the gradient), `filled`, `outlined`, `text`; 40 or 48 px high; tones primary, error, neutral, inverse, inherit | `PrimaryButton` and the button classes of the screens (done) |
| `IconButton` | standard, small | `AppIconButton` |
| `Chip` | filter (one or more selected) | `GroupChips`, the kind and goal chips of the form |
| `Card` | with title, description and content | the chart cards, the calendar headings, the tiles' frame |
| `KeyNumbers` | — | `KeyNumbers` in `ChartParts.jsx` (done) |
| `DayCell` | see "Day cell" | the cells of `HabitTable`, `MonthCalendar` and `ScoreCalendar` (done: `DayCell` and `ScoreCell` in `DayCell.jsx`) |
| `Calendar` | editable, read-only | `MonthCalendar` and `ScoreCalendar` (done: both are a `MonthsCard` in `MonthCalendar.jsx`; the cells of the metric come from `useDayCells`) |
| `PeriodBar` | — | `WindowBar` (done in phase 2: `Period.jsx`). Since the detail redraw: P9 of the canvas, with `DayStrip` |
| `Notice` | info, warning, error | `Notice`, the sheet warnings |
| `Snackbar` | with Undo, with Try again | new |
| `Dialog` | confirm | the alert dialog of the metrics screen (done: `ConfirmDialog` in `Dialog.jsx`) |
| `TextField` | text, number | the fields of the form (done) and of the number editor |
| `EmptyState` | — | the empty states of the Today page and of the metrics screen |

The charts (`TimeBars`, `LineChart`, `RangeBars`, `Distribution`, `StackedBars`, `ChangeTable`) use the Data role
(`--cell`) for a metric and for the score. The `ChangeTable` tints a better cell with `--cell` and a worse cell with
`--data-contrast`.

## Numbers and dates

`Format.js` gives each format. Phase 4 adds the year to a day of another year, and checks the rule for today in each
chart.

| Kind | Rule | Example |
|---|---|---|
| Value | The decimals of the step of the metric, then the unit. | `82.6 kg`, `8 glasses` |
| Large value | A comma between the thousands, from 10,000. | `12,500 steps` |
| Score | 1 decimal and `%`. | `57.0%` |
| Change of a score | A sign, 1 decimal and `%`. | `+4.0%`, `−1.2%` |
| Rate (a part of the days) | No decimals and `%`. | `86%` |
| Change of a value | A sign, the decimals of the step, the unit. | `−1.4 kg` |
| Points | 1 decimal. | `0.6 points` |
| Days | A whole number and the word. | `105 days`, `1 day` |
| No number | An en dash. | `–` |
| Day | Month and day. The year only if it is not this year. | `Nov 26`, `Nov 26, 2025` |
| Period | Two days and the year. | `Jul 30 – Nov 26, 2026` |
| Month | The month and the year. | `November 2026` |
| Weekday | Two letters. | `Mo` |

- The minus sign is `−` (U+2212), not a hyphen.
- Today is not over. If today has no value yet, a chart shows no bar and no label for it, not a 0.

## Interaction

| State | Look |
|---|---|
| Hover | A layer of the text color at 8% on the element. |
| Focus | A 2 px ring in `--primary`, 2 px outside the element. |
| Pressed | A layer of the text color at 12%. |
| Selected | `--primary-container` with `--on-primary-container`. |
| Disabled | 38% opacity. No hover. |
| Dragged | `--elevate2` and the hover layer. |

- A write: the new value shows at once. The app bar shows a progress circle while the write runs. When the write
  ends, the Undo message shows at the bottom, above the navigation bar: `--inverse-surface`, `--radius-s`,
  `--elevate2`, the text and an Undo button in `--inverse-primary`. It has `role="status"`.
- An error: the cell shows the value of the sheet again. The message shows the error and a "Try again" button.
- Loading: a progress circle in the page and in the app bar. No skeleton.
- Empty: an icon, a title, one sentence and one button. Example: "No metrics yet" with "Add metric".
- Motion: `--duration-short` (150 ms) for a state, `--duration-medium` (250 ms) for a new view or the Undo message,
  with `--easing-standard`. With `prefers-reduced-motion`, there is no movement: only fades.

## Accessibility

- Each action works with touch, a mouse and the keyboard. The focus is always visible.
- Each icon button has a `title` and an `aria-label`. Each cell, tile and chart mark with a value has a `title`.
- A color is never the only sign. Example: an over-limit tile also has a warning icon, and a done tile a check mark.
- Touch targets are 48 px or more. Day cells are 40 px or more.

## Base styles

Phase 3 removed BeerCSS. `src/app/base.css` gives the base look of the HTML elements, in the cascade layer `base`: a
rule of the app replaces a base rule without a more specific selector.

- No browser margins and paddings, and `box-sizing: border-box`.
- A heading has the font of the text around it. A type class gives its size.
- A `button` has no look of its own, only a state layer: the text color at 10% while the mouse is on it or it has the
  keyboard focus.
- Thin scroll bars with a mouse.

Each component sets the rest of its look in its own CSS file. `theme.css` keeps the tokens, the type classes and the
progress circle.

## Findings that this file closes

| Finding | Rule |
|---|---|
| U2: colors with conflicting meanings | Color roles, day cell |
| U3: numbers without one format | Numbers and dates |
| U4: widths that change from screen to screen | Layout |
| U5: sections with two styles | Layout: each part is a card |
| U6: buttons with many looks | Components: `Button` |
| C4: BeerCSS | Base styles |
| C6: no spacing or radius tokens | Space, corners and sizes |
| D4: no design document | This file |
