# Data model

## Overview

- Storage is one Google Sheet.
- The sheet has 2 tabs:
  - `Metrics`: the list of things you track. You edit it by hand.
  - `Log`: the values for each day. The app writes it. You can edit it by hand.
- Row 1 of each tab is the header row. Do not change the header names.
- The tab names are `Metrics` and `Log`, with a capital first letter.

## Tab `Metrics`

One row for each metric. The row order is the display order in the app.

| Column    | Type    | Required | Values                  | Description |
|-----------|---------|----------|-------------------------|-------------|
| `id`      | text    | Yes      | lowercase, `a-z0-9_-`   | Stable key. It is the column header in the `Log` tab. Do not change it after first use. |
| `name`    | text    | Yes      | any                     | Name that the app shows. You can change it at any time. |
| `kind`    | text    | Yes      | `yesno`, `number`, `count` | Type of the metric. See [Metric kinds](#metric-kinds). |
| `unit`    | text    | No       | any                     | Example: `kg`, `glasses`, `steps`. Empty for `yesno`. |
| `step`    | number  | No       | > 0                     | Input step for `number` and `count`. Example: `0.1` for weight. Default: `1`. |
| `group`   | text    | No       | any                     | Groups metrics on the screen. Example: `habits`, `body`. |
| `icon`    | text    | Yes      | Material Symbols name or emoji | Icon next to the name, and in the title of the detail screen. A lowercase name (`a-z`, `0-9`, `_`) is a [Material Symbols](https://fonts.google.com/icons) icon, for example `water_drop`. Other text shows as it is, for example `💧`. A row without icon is invalid: the app shows a warning and does not show the metric. |

### Rules

- To hide a metric, delete its row. Its `Log` column and values stay in the sheet, and the app ignores them. To show the metric again, add the row again with the same `id`.
- The app ignores other columns.

### Metric kinds

| Kind     | `Log` value                     | Main chart                                      | Input in the app |
|----------|---------------------------------|-------------------------------------------------|------------------|
| `yesno`  | `yes` (done) or `no` (not done) | Bar chart of the yes rate, from 0 to 100 %      | A tap writes `yes`, or `no` if the day is `yes`. |
| `number` | number                          | Line chart, from the lowest to the highest value | A tap opens an editor with a ruler, a text field and a Save button. Save with an empty field clears the day. |
| `count`  | number                          | Bar chart, from 0                               | A click or tap adds `step`. A right-click (mouse) or a double-tap (touch) subtracts it. A count goes to empty only with subtractions: there is no reset. |

### Example

| id       | name     | kind   | unit    | step | group  | icon             |
|----------|----------|--------|---------|------|--------|------------------|
| weight   | Weight   | number | kg      | 0.1  | body   | monitor_weight   |
| waist    | Waist    | number | cm      | 0.5  | body   | straighten       |
| meditate | Meditate | yesno  |         |      | habits | self_improvement |
| water    | Water    | number | glasses | 1    | habits | 💧               |
| reading  | Reading  | number | min     | 5    | habits | menu_book        |

## Tab `Log`

One row for each day, one column for each metric. Rows are not sorted. The app sorts them.

| Column          | Type   | Required | Values        | Description |
|-----------------|--------|----------|---------------|-------------|
| A: `date`       | date   | Yes      | a date, shown as `YYYY-MM-DD` | The day. Maximum one row for each day. Can be a past day. |
| B, C, …: metric `id` | number or text | No | number, `yes`, `no` | The value of the metric on that day. Empty means no value. |

### Rules

- The header of each metric column is the metric `id`, not the `name`.
- The app adds a column at the end when a metric has no column. The app does this when it loads the sheet.
- The column order does not matter. You can move columns.
- `yesno`: case does not matter. An empty cell means no entry: the app shows it like `no`.
- `number` and `count`: one value per day. For amounts, for example glasses of water, it is the day total. Single entries are not stored.
- The app adds a row when a day has no row. It does not delete rows. A row with only a date is valid.

### Example

| date       | weight | meditate | water | reading |
|------------|--------|----------|-------|---------|
| 2026-09-29 | 82.4   |          | 8     | 20      |
| 2026-09-30 | 82.1   | yes      | 5     | 25      |

Result in the app for 2026-09-30: weight 82.1 kg, meditate done, water 5 glasses, reading 25 min.

## Sheet format

- When the app adds a tab, it freezes row 1.
- Each time it opens the sheet, the app formats `Log!A2:A` as a date with the pattern `yyyy-mm-dd`. So the dates show the same in every locale.

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

The app sets these rules each time it opens the sheet, and when it adds a missing tab or a missing `Log` column:

| Range                            | Rule                                                                 | Similar DB constraint |
|----------------------------------|----------------------------------------------------------------------|-----------------------|
| `Log!A2:A`                       | Valid date. Sheets also shows a date picker.                         | Column type           |
| `Log` `number` or `count` column | Custom formula: `=ISNUMBER(B2)`                                      | Column type           |
| `Log` `yesno` column             | Dropdown: `yes`, `no`                                                | Enum                  |
| `Metrics` column `kind`          | Dropdown: `yesno`, `number`, `count`                                 | Enum                  |
| `Metrics` column `icon`          | Custom formula: `=OR(REGEXMATCH(G2, "^[a-z0-9_]+$"), LEN(G2) <= 16)` | Check constraint      |

The app finds the columns by header name, so the column letters can change. The formulas use the columns of the examples: `B` is the first metric column of `Log`, and `G` is the `icon` column of `Metrics`.

#### `Metrics` rules

- Before it sets the rules, the app removes all validation rules below row 1 of the `Metrics` tab. So a moved column leaves no old rule behind. Do not add your own rules to this tab: the app removes them.

#### `Log` rules

- Each metric column gets the rule of its metric `kind`. So a changed `kind` also changes the rule.
- Do not add your own rules to the metric columns: the app replaces them.

#### Limits

- API writes skip data validation. Sheets accepts the value and marks the cell as invalid. Layer 1 is necessary.
- No cascade: a changed metric `id` breaks the link to its `Log` column. If you must change it, rename the column header too. The app does not warn: it does not show the values of the old column.
- No transactions: "read, then update" is not atomic.

### Layer 3: app reads

- The app ignores a `Log` row with an invalid `date`, and shows a warning.
- The app ignores a `Log` cell that is not a number (or not `yes` or `no` for `yesno`), and shows a warning.
- The app ignores a `Log` column with no metric, for example of a deleted metric. It shows no warning.
- If a day has 2 or more rows, the app uses the last row and shows a warning. Sheets does not block a second row for the same day: a cell can have only one rule, and the date column uses the valid-date rule.
- The app ignores a `Metrics` row with a missing or invalid `id` or `kind`, and shows a warning.

## Older sheets

Sheets from older app versions can be different. The app changes some of these differences. You must change the others.

| Difference                                   | Who changes it | Change |
|----------------------------------------------|----------------|--------|
| Tab names `metrics` and `log`                | You            | Rename the tabs to `Metrics` and `Log`. |
| `per_day` and `active` columns in `Metrics`  | You (optional) | Delete the columns. The app ignores them. |
| No `icon` column in `Metrics`                | You            | Add the column with an icon in each row. Until then, the app shows an error. |
| `1` and `0` in `yesno` columns of `Log`      | The app        | When it opens the sheet, it changes `1` to `yes` and `0` to `no`. It does not change empty cells. |
| Dates as text in `Log`                       | The app        | When it opens the sheet, it changes them to real dates once. |
| Old validation rules                         | The app        | When it opens the sheet, it sets the rules of [Layer 2](#layer-2-sheet-data-validation) again. So the sheet accepts new values, for example `count`, `yes` and `no`. |
