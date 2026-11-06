# Data model

## Overview

- Storage is one Google Sheet.
- The sheet has 2 tabs:
  - `Metrics`: the list of things you track. You edit it by hand.
  - `Log`: one row for each day, one column for each metric, and the `Score` column. The app writes it. You can edit
    the metric columns by hand.
- Row 1 of each tab is the header row. Do not change the header names.
- The tab names are `Metrics` and `Log`, with a capital first letter. Older app versions used `metrics` and `log`: rename these tabs.

## Tab `Metrics`

One row for each metric. The row order is the display order in the app.

| Column    | Type    | Required | Values                  | Description |
|-----------|---------|----------|-------------------------|-------------|
| `id`      | text    | Yes      | lowercase, `a-z0-9_-`   | Stable key. It is the column header in the `Log` tab. Do not change it after first use. |
| `name`    | text    | Yes      | any                     | Name that the app shows. You can change it at any time. |
| `kind`    | text    | Yes      | `yesno`, `number`, `count` | `yesno`: done (`yes`) or not done (`no`). `number`: a value, with a line chart from the lowest to the highest value. In the app, a tap on a `number` cell opens an editor with a ruler, a text field and a Save button. Save with an empty field clears the day. `count`: the same as `number`, but with a bar chart from 0. In the app, a click or tap on a `count` cell adds `step`. A right-click (mouse) or a double-tap (touch) subtracts it. A count goes to empty only with subtractions: there is no reset. |
| `unit`    | text    | No       | any                     | Example: `kg`, `glasses`, `steps`. Empty for `yesno`. |
| `step`    | number  | No       | > 0                     | Input step for `number` and `count`. Example: `0.1` for weight. Default: `1`. |
| `group`   | text    | No       | any                     | Groups metrics on the screen. Example: `habits`, `body`. |
| `icon`    | text    | Yes      | Material Symbols name or emoji | Icon next to the name, and in the title of the detail screen. A lowercase name (`a-z`, `0-9`, `_`) is a [Material Symbols](https://fonts.google.com/icons) icon, for example `water_drop`. Other text shows as it is, for example `💧`. A row without icon is invalid: the app shows a warning and does not show the metric. |
| `goal`    | text or number | No | `yesno`: `yes`, `no`. `number`, `count`: a number, `>=` number, `<=` number | The day goal. It changes the [score](#score). `yesno`: the value to log. Empty means `yes`. Use `no` for a habit to stop, for example `smoke`. `number` and `count`: `8` or `>= 8` means at least 8. `<= 75` means at most 75. Use a period for decimals: `<= 75.5`. Empty means no goal. An invalid goal makes the row invalid: the app shows a warning and does not show the metric. |

Rules:

- To hide a metric, delete its row. Its `Log` column and values stay in the sheet, and the app ignores them. To show the metric again, add the row again with the same `id`.
- The app ignores other columns. Older sheets have `per_day` and `active` columns: you can delete them.
- Older sheets can have no `icon` column. Then the app shows an error. Add the column with an icon in each row.
- Older sheets can have no `goal` column. Then no metric has a goal. Add the column to set goals.

Example:

| id       | name     | kind   | unit    | step | group  | icon             | goal  |
|----------|----------|--------|---------|------|--------|------------------|-------|
| weight   | Weight   | number | kg      | 0.1  | body   | monitor_weight   | <= 80 |
| waist    | Waist    | number | cm      | 0.5  | body   | straighten       |       |
| meditate | Meditate | yesno  |         |      | habits | self_improvement | yes   |
| water    | Water    | count  | glasses | 1    | habits | 💧               | 8     |
| reading  | Reading  | number | min     | 5    | habits | menu_book        | 20    |

## Tab `Log`

One row for each day, one column for each metric. Rows are not sorted. The app sorts them.

| Column          | Type   | Required | Values        | Description |
|-----------------|--------|----------|---------------|-------------|
| A: `date`       | date   | Yes      | a date, shown as `YYYY-MM-DD` | The day. Maximum one row for each day. Can be a past day. |
| B, C, …: metric `id` | number, or `yes` / `no` | No | number, `yes`, `no` | The value of the metric on that day. Empty means no value. For `yesno`: `yes` or `no`. |
| `Score`         | number | No       | 0 to 100      | The [score](#score) of the row: the percent of the goals met, with one decimal. The app writes it. Do not edit it: the app writes it again. |

Rules:

- The header of each metric column is the metric `id`, not the name.
- The app adds a column at the end when a metric has no column, or when the tab has no `Score` column. The app does
  this when it loads the sheet.
- The column order does not matter. You can move columns.
- `yesno`: `yes` means "done", `no` means "not done". Case does not matter. An empty cell means no entry: the app shows it like `no`.
  - A tap in the app writes `yes`, or `no` if the day is `yes`.
  - Old app versions wrote `1` for `yes`. When the app opens the sheet, it changes these cells to `yes` (and `0` to `no`). It does not change empty cells.
- `number` and `count`: one value per day. For amounts, for example glasses of water, it is the day total. Single entries are not stored.
- The app adds a row when a day has no row. It does not delete rows. A row with only a date is valid.

Example:

| date       | weight | meditate | water | reading | Score |
|------------|--------|----------|-------|---------|-------|
| 2026-09-29 | 82.4   |          | 8     | 20      | 100   |
| 2026-09-30 | 82.1   | yes      | 5     | 25      | 90.6  |

Result in the app for 2026-09-30: weight 82.1 kg, meditate done, water 5 glasses, reading 25 min, 90.6 % of the
goals met.

## Score

The score is "Goals met": the percent of the day goals that a day meets, from 0 to 100 %. You do not log it: the app
calculates it from the values and the goals. 100 % means that the day meets all goals.

Each metric meets its goal by a part from 0 to 1 on each day:

| Kind and goal | Part | Example |
|---------------|------|---------|
| `yesno` | 1 if the value is the goal. 0 for the other value or for no value. | Goal `yes`: `yes` gives 1. Goal `no`: `no` gives 1. |
| `count`, goal "at least" (`8` or `>= 8`) | The value divided by the goal, at most 1. | `water` 5 of 8 glasses gives 0.625. 10 glasses give 1. |
| `count`, goal "at most" (`<= 2`) | 1 if the value reaches the goal, else 0. | `coffee` 2 gives 1, 3 gives 0. |
| `number` with a goal | 1 if the value reaches the goal, if it is closer to the goal than the previous log, or if it is the first log. Else 0. | Goal `<= 80`: 83 (first log) gives 1, then 82.6 gives 1 (closer), then 82.8 gives 0 (farther), then 79.9 gives 1 (goal). |
| `count` or `number` without a goal | 1 for a logged value. A `count` must be above 0. So the work on a metric without a goal also counts. | `walk` 30 min gives 1. `waist` 92 cm gives 1. |
| Any kind, no value on the day | 0 | No `meditate` value gives 0. |

The score of a day is the average of the parts of the metrics that count on that day, in percent with one decimal.
A metric counts from the day of its first value. So a new metric does not lower the scores of the days before it.

Example, with the metrics above, for 2026-09-30: weight 82.1 is closer to 80 than 82.4 of the previous log (1),
meditate `yes` (1), water 5 of 8 (0.625), reading 25 ≥ 20 (1). Waist has no value yet, so it does not count. The
score is (1 + 1 + 0.625 + 1) / 4 = 90.6 %. On 2026-09-29, meditate does not count yet: (1 + 1 + 1) / 3 = 100 %.

The previous log of a `number` metric is the latest earlier day with a value of that metric. Missed days do not
matter: a weekly value compares with the value of the week before. If a day has 2 or more rows, its last row is the
value of the day.

Rules:

- The app writes the score in the `Score` column of each `Log` row. A row without a metric value has an empty score.
  A score as text, for example `'75`, changes to the number. The header stays `Score`.
- If a day has 2 or more rows, each row has the score of its own values. The app shows the score of the last row, as
  it does for the values.
- The app calculates all scores again each time it loads the sheet: when it opens the sheet, after the reload button,
  and after the values that you log in the app (one time for each save or tap). It writes only the cells that
  changed. So the scores follow:
  - a new or changed value, also of a past day, in the app or by hand in the sheet,
  - a new goal, a new `kind` in the `Metrics` tab,
  - a deleted metric: it does not count,
  - for a `number` metric, a new, changed or deleted value also changes the score of the next day with a value of
    that metric, because that day has a new previous log,
  - a new first value of a metric also changes the scores of the later days, because the metric counts from that
    day.
- If you change the sheet by hand while the app is open, the scores change at the next load. Use the reload button.
- If the app cannot write the scores, for example in a view-only sheet or at the request limit of the Sheets API, it
  shows a warning and continues. The next load tries again.
- The app does not read the `Score` column. It shows the scores that it calculates, also for count taps that it did not
  write yet. Demo mode has no `Score` column.
- Older app versions wrote a sum of points in the `Score` column. The next load writes the percent in its place.
- In the app, a green bar chart of the goals met, one bar for each day on a scale from 0 to 100 %, is at the top of
  the "5 days" and "31 days" views. A tap on "Goals met" opens the "Goals" view of the bottom navigation bar: the
  score only, in green, with bars. It shows the average, the change from the first half to the second half, the days
  with all goals met, the best weekday, and charts of the average per day, the average on each weekday, the change
  of each weekday and the distribution in ranges of 10 %. The Today tiles do not show the score.
  - The weekday averages of all metrics stack the part of each group, in one color for each group. The part of a
    group is the share of the goals that its metrics meet, of all goals that count. So the parts of a weekday add up
    to its average.
  - "Weekday change" and "change, 2nd half" compare the first half of the period with the second half, in percentage
    points. Example: in the 14 days from Oct 1 to Oct 14, the days from Oct 8 to Oct 14 compare with the days from
    Oct 1 to Oct 7. With an odd number of days, the second half has one day more. The change does not use the days
    before the period: at "All", there are none.
  - "Goals met by day": one cell for each day, one row for each weekday. A darker cell meets more of its goals. A day
    with 100 % has the full color.
- The group filter of the app (the `group` column) also applies to the score. With a group selected, the chart and
  the "Goals" view show the percent of the goals of that group only. The title shows the group, for example
  "Goals met · Habits". The `Score` column always has the score of all metrics.

## Consistency

- Google Sheets has no schema, foreign keys, unique constraints or transactions.
- 3 layers protect the data:

| Layer | Protects against | Strength |
|-------|------------------|----------|
| 1. App validates before it writes | App bugs | Strong. Main protection. |
| 2. Sheet data validation, mode "Reject input" | Manual edits in the Sheets UI | Medium |
| 3. App validates when it reads | All other invalid rows | Last defense |

### Layer 1: app writes

- Kotlin types allow only valid writes. Example: a `YesNoMetric` can only write `yes` or `no`.
- The app reads the `Log` tab again before each write. This keeps row numbers correct after manual edits.

### Layer 2: sheet data validation

The app adds these rules when it adds a missing tab or a missing `Log` column, and sets the `Metrics` and `Log` rules again each time it opens the sheet:

| Range                 | Rule                                                                               | Similar DB constraint |
|-----------------------|------------------------------------------------------------------------------------|-----------------------|
| `Log!A2:A`            | Valid date. Sheets also shows a date picker.                                       | Column type           |
| `Log` `number` or `count` column | Custom formula: `=ISNUMBER(B2)`                                         | Column type           |
| `Log` `Score` column  | Custom formula: `=ISNUMBER(G2)`                                                    | Column type           |
| `Log` `yesno` column  | Dropdown: `yes`, `no`                                                              | Enum                  |
| `Metrics` column `kind`    | Dropdown: `yesno`, `number`, `count`                                          | Enum                  |
| `Metrics` column `icon`    | Custom formula: `=OR(REGEXMATCH(I2, "^[a-z0-9_]+$"), LEN(I2) <= 16)`          | Check constraint      |
| `Metrics` column `goal`    | Custom formula: `=OR(ISNUMBER(J2), REGEXMATCH(LOWER(TO_TEXT(J2)), "^ *(yes\|no\|(<=\|>=)? *-?[0-9]+([.][0-9]+)?) *$"))` | Check constraint |

The `Metrics` rules:

- The app finds the columns by header name. The column letters can change. The `icon` example uses column `I`, the
  `goal` example column `J`.
- The `goal` rule does not compare the goal with the `kind`. Example: it accepts `yes` for a `number` metric. Then the
  app shows a warning when it reads the row.
- The app sets the rules again each time it opens the sheet. So a sheet from an older app version accepts new values, for example `count`, and a new column gets its rule, for example `icon`.
- Before that, the app removes all validation rules below row 1 of the `Metrics` tab. So a moved column leaves no old rule behind. Do not add your own rules to this tab: the app removes them.

The `Log` rules:

- Each metric column gets the rule of its metric `kind` each time the app opens the sheet. So a changed `kind` also changes the rule, and a sheet from an older app version accepts `yes` and `no`.
- The `Score` column gets the number rule.
- Do not add your own rules to the metric columns: the app replaces them.

Other setup:

- Freeze row 1 in both tabs.
- Format `Log!A2:A` as a date with the pattern `yyyy-mm-dd`. So the dates show the same in every locale.
- Older app versions stored the dates as text. When the app opens the sheet, it changes them to real dates once.

Limits:

- API writes skip data validation. Sheets accepts the value and marks the cell as invalid. Layer 1 is necessary.
- No cascade: a changed metric `id` breaks the link to its `Log` column. If you must change it, rename the column header too. The app does not warn: it does not show the values of the old column.
- No transactions: "read, then update" is not atomic.

### Layer 3: app reads

- The app ignores a `Log` row with an invalid `date`, and shows a warning.
- The app ignores a `Log` cell that is not a number (or not `yes` or `no` for `yesno`), and shows a warning.
- The app ignores a `Log` column with no metric, for example of a deleted metric. It shows no warning.
- If a day has 2 or more rows, the app uses the last row and shows a warning. Sheets does not block a second row for the same day: a cell can have only one rule, and the date column uses the valid-date rule.
- The app ignores a `Metrics` row with a missing or invalid `id` or `kind`, and shows a warning.
