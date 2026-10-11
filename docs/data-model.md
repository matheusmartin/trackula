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
| `Score`         | number | No       | number ≥ 0    | The [score](#score) of the row. The app writes it. Do not edit it: the app writes it again. |

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
| 2026-09-29 | 82.4   |          | 8     | 20      | 9     |
| 2026-09-30 | 82.1   | yes      | 5     | 25      | 7     |

Result in the app for 2026-09-30: weight 82.1 kg, meditate done, water 5 glasses, reading 25 min, score 7.

## Score

The score of a day is the sum of the points of all metrics on that day. You do not log it: the app calculates it from
the values and the goals.

| Kind     | Points | Example |
|----------|--------|---------|
| `yesno`  | 1 if the value is the goal. 0 for the other value or for no value. | Goal `yes`: `yes` gives 1. Goal `no`: `no` gives 1. |
| `count`  | 1 for each `step`, also above the goal. The goal does not change the points. | `water` 5 with step 1 gives 5. `walk` 30 min with step 10 gives 3. |
| `number` | 1 if the value reaches the goal. 0 without goal. | Goal `<= 80`: 79.5 gives 1, 82.1 gives 0. Goal `20`: 25 gives 1. |

Example, with the metrics above, for 2026-09-30: weight 82.1 is above 80 (0), meditate `yes` (1), water 5 (5),
reading 25 ≥ 20 (1). The score is 7.

Rules:

- The app writes the score in the `Score` column of each `Log` row. A row without a metric value has an empty score.
- The app calculates all scores again each time it loads the sheet: when it opens the sheet, after the reload button,
  and after each value that you log in the app. It writes only the cells that changed. So the scores follow:
  - a new or changed value, also of a past day, in the app or by hand in the sheet,
  - a new goal, a new `step` or a new `kind` in the `Metrics` tab,
  - a deleted metric: its values do not give points.
- If you change the sheet by hand while the app is open, the scores change at the next load. Use the reload button.
- The app does not read the `Score` column. It shows the scores that it calculates, also for count taps that it did not
  write yet. Demo mode has no `Score` column.
- In the app, a green line chart of the score is at the top of the "5 days" and "31 days" views. A tap on "Score"
  opens the "Score" view of the bottom navigation bar: the numbers and charts of the score only, in green. The Today
  tiles do not show the score.

## Consistency

- Google Sheets has no schema, foreign keys, unique constraints or transactions.
- 3 layers protect the data:

| Layer | Protects against | Strength |
|-------|------------------|----------|
| 1. App validates before it writes | App bugs | Strong. Main protection. |
| 2. Sheet data validation, mode "Reject input" | Manual edits in the Sheets UI | Medium |
| 3. App validates when it reads | All other invalid rows | Last defense |

### Layer 1: app writes

- Dart types allow only valid writes. Example: a `YesNoMetric` can only write `yes` or `no`.
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
