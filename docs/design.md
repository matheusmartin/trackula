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
| Accent | `--primary` | `#b8321a` | `#ff8c66` | Links, text buttons, the focus ring, the current day. | Data, "done", warnings. |
| Selected | `--primary-container` | `#ffdfd4` | `#7a2a14` | The selected item of the navigation and of the chips. | Data. |
| Value | `--data` | `#5b6b82` | `#9fb0c6` | The bars, lines and dots of the values of a metric. | Text. |
| Good | `--good`, `--good-container` | `#2e7d32`, `#d7eed8` | `#81c784`, `#1e3d22` | A goal reached, the points, the score, a change for the better. | Brand parts. |
| Warning | `--warning`, `--warning-container` | `#b45309`, `#fde7cf` | `#f0a35a`, `#4d2c0a` | A value over a limit, a change for the worse, sheet warnings. | Errors that stop an action. |
| Error | `--error`, `--error-container` | `#ba1a1a`, `#ffdad6` | `#ffb4ab`, `#93000a` | A failed write or load, an invalid field. | Data. |
| Neutral | `--surface…`, `--on-surface…`, `--outline…` | slate grey | slate blue | Pages, cards, text, borders. | — |
| Groups | `--group-1` to `--group-8` | 8 hues | lighter tones | The parts of each group in a stacked chart. | Other data. |

Rules:

- Red and orange-red are the brand. No day cell, chart mark or key number uses them. Example: now a done day is a red
  cell. After phase 4 it is a green cell.
- Green means good, everywhere: a done day, a goal reached, the score, a better week. Amber means "look at this": a
  value over a limit, a worse week, a sheet warning.
- The group colors do not use green, amber or red, so that a group does not look good or bad. Now `--group-1` is green
  and `--group-3` is orange: phase 4 gives them other hues, and checks that each pair of groups differs in hue or in
  lightness.
- The score has no own theme. Now `.score-theme` makes the score screens green. After phase 3, the score uses the
  Good role, as each points cell does.
- Each text has a contrast of 4.5:1 or more on its background. Each border of a control, and each chart mark, has 3:1
  or more.

## Day cell

The day cell is the same component in the Days table, in the calendars and on the Score calendar. Its fill shows the
points of the day, so you can see your goals at a glance.

| State | Look | Example |
|---|---|---|
| No value | No fill. A 1 px border in `--outline`. | You did not record Water on that day. |
| Value, 0 points | `--cell-value` fill. The value in `--on-surface`. | Weight 84.1 for the goal `at most 80 from 83`. |
| Value, some points | A mix of `--cell-value` and `--good`, from the points: 0.5 points is half of each. | Water 5 for `at least 8`: 0.625 points. |
| Value, 1 point | `--good` fill. The value in `--on-good`. | Meditate yes for the goal `yes`. |
| Over a limit | `--warning` fill. The value in `--on-warning`. | Coffee 3 for `at most 2`. |
| Today | The state above, and a 2 px ring in `--primary`. | — |
| After today | No cell. | — |
| Score | The same scale, from the score of the day: 0% is `--cell-value`, 100% is `--good`. | 73.1% is mostly green. |

- A cell shows the value of a number or count metric, and no text for a yes/no metric.
- The text color comes from the fill: dark text on a light fill, light text on a dark fill.
- "Over a limit" applies to a yes/no or count metric with a limit goal (`no`, `at most`). A number metric shows its
  points only, also over its target. Example: Weight 82.6 for `at most 80 from 83` has 0.13 points: a light green
  cell, not an amber one.
- Size: 40 px or more, in a touch target of 48 px where the screen has the space. Corners: `--radius-s`.
- Tooltip: the metric, the day, the value and the points. Example: "Water, Nov 26: 5 glasses, 0.6 points".

## Type

One font: Roboto, with the weights 400, 500 and 700. The app serves it itself. Phase 3 adds the weight 500: now the
app has no Medium font, so Medium text shows as Regular.

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

- No other font size, except the ruler and the logo of the sign-in screen.
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
- Each part of a screen is a card with a title and one sentence that tells what it shows. Also the calendars. Now
  "Edit days" and "Score by month" are headings without a card.
- The bar of a screen (for example the period bar) stays at the top while the page scrolls.

| Screen | Narrow | Wide |
|---|---|---|
| Today | Number tiles in 1 column. Yes/no and count tiles in 2 columns. | Number tiles in 2 columns. Yes/no and count tiles in 4 to 6 columns (`--tile-min-width` 160 px). A ruler is not wider than its tile. |
| Days, table | 5 days. The names of the metrics in the first column. | As many days as the width holds, up to 14. |
| Days, calendars | 1 calendar card in each row. | The card grid: 2 or 3 calendars in each row. |
| Score, metric detail | The period bar, the key numbers in 2 columns, then the cards in 1 column. | The period bar in one row, the key numbers in one row, then the card grid. |
| Metrics | The list. A tap opens the form as a screen. | The list on the left and the form on the right. |

## Components

Phase 3 makes these shared components. Each one replaces the current parts in the right column.

| Component | Variants | Replaces |
|---|---|---|
| `Button` | `filled` (main action, the gradient), `tonal`, `outlined`, `text` | `PrimaryButton`, `today-page-button`, `today-page-text-button`, `metrics-add-button`, `metric-outlined-button`, `metric-form-text-button`, `number-editor-text-button` |
| `IconButton` | standard, small | `AppIconButton` |
| `Chip` | filter (one or more selected) | `GroupChips`, the kind and goal chips of the form |
| `Card` | with title, description and content | the chart cards, the calendar headings, the tiles' frame |
| `KeyNumbers` | — | `KeyNumbers` in `Charts.jsx` |
| `DayCell` | see "Day cell" | the cells of `HabitTable`, `MonthCalendar` and `ScoreCalendar` |
| `Calendar` | editable, read-only | `MonthCalendar`, `ScoreCalendar` |
| `PeriodBar` | — | `WindowBar` |
| `Notice` | info, warning, error | `Notice`, the sheet warnings |
| `Snackbar` | with Undo, with Try again | new |
| `Dialog` | confirm | the alert dialog of the metrics screen |
| `TextField` | text, number | the fields of the form and of the number editor |
| `EmptyState` | — | the empty states of the Today page and of the metrics screen |

The charts (`TimeBars`, `LineChart`, `RangeBars`, `Distribution`, `StackedBars`, `ChangeTable`) use the Value role for
a metric and the Good role for the score.

## Numbers and dates

`Format.js` gives each format. Phase 3 changes it to these rules.

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
- Today is not over. A chart shows today without a value as open (an outline), not as 0.

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

## BeerCSS

**Decision:** phase 3 removes BeerCSS. The app now uses 3 of its classes (`circle`, `page`, `invalid`), and it works
around the others. In its place:

- `src/app/base.css`: the reset (box sizing, margins, the font of the form fields) and the default look of `button`,
  `input`, `table`, `dialog` and `progress`.
- The components of this file, each with its CSS file.
- `theme.css` keeps the tokens and the type classes. The `override` layer and the list of class names that you must
  not use go.

Each screen gets a screenshot before and after the removal, at 390 px and 1280 px, in the light and the dark theme.

## Findings that this file closes

| Finding | Rule |
|---|---|
| U2: colors with conflicting meanings | Color roles, day cell |
| U3: numbers without one format | Numbers and dates |
| U4: widths that change from screen to screen | Layout |
| U5: sections with two styles | Layout: each part is a card |
| U6: buttons with many looks | Components: `Button` |
| C4: BeerCSS | BeerCSS |
| C6: no spacing or radius tokens | Space, corners and sizes |
| D4: no design document | This file |
