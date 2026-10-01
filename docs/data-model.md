# Data model

## Overview

- Storage is one Google Sheet.
- The sheet has 2 tabs:
  - `metrics`: the list of things you track. You edit it by hand.
  - `log`: one row for each day, one column for each metric. The app writes it. You can edit it by hand.
- Row 1 of each tab is the header row. Do not change the header names.

## Tab `metrics`

One row for each metric. The row order is the display order in the app.

| Column    | Type    | Required | Values                  | Description |
|-----------|---------|----------|-------------------------|-------------|
| `id`      | text    | Yes      | lowercase, `a-z0-9_-`   | Stable key. It is the column header in the `log` tab. Do not change it after first use. |
| `name`    | text    | Yes      | any                     | Name that the app shows. You can change it at any time. |
| `kind`    | text    | Yes      | `yesno`, `number`, `count` | `yesno`: done or not done. `number`: a value, with a line chart from the lowest to the highest value. `count`: the same as `number`, but with a bar chart from 0. |
| `unit`    | text    | No       | any                     | Example: `kg`, `glasses`, `steps`. Empty for `yesno`. |
| `per_day` | text    | Yes      | `one`, `many`           | `one`: a measurement, for example weight. `many`: a day total, for example glasses of water. Both use one cell per day. `many` cells get a stronger color for higher totals. |
| `step`    | number  | No       | > 0                     | Input step for `number` and `count`. Example: `0.1` for weight. Default: `1`. |
| `group`   | text    | No       | any                     | Groups metrics on the screen. Example: `habits`, `body`. |
| `active`  | boolean | Yes      | `TRUE`, `FALSE`         | `FALSE` hides the metric in the entry form. Its history stays. |
| `icon`    | text    | No       | Material Symbols name or emoji | Icon next to the name. A lowercase name (`a-z`, `0-9`, `_`) is a [Material Symbols](https://fonts.google.com/icons) icon, for example `water_drop`. Other text shows as it is, for example `💧`. Empty: the first letter of `name`. Older sheets can omit the column. |

Rules:

- `yesno` metrics always use `per_day` = `one`.
- Do not delete a metric that has values in the `log` tab. Set `active` to `FALSE`.

Example:

| id       | name     | kind   | unit    | per_day | step | group  | active | icon             |
|----------|----------|--------|---------|---------|------|--------|--------|------------------|
| weight   | Weight   | number | kg      | one     | 0.1  | body   | TRUE   | monitor_weight   |
| waist    | Waist    | number | cm      | one     | 0.5  | body   | TRUE   | straighten       |
| meditate | Meditate | yesno  |         | one     |      | habits | TRUE   | self_improvement |
| water    | Water    | number | glasses | many    | 1    | habits | TRUE   | 💧               |
| reading  | Reading  | number | min     | many    | 5    | habits | TRUE   |                  |

## Tab `log`

One row for each day, one column for each metric. Rows are not sorted. The app sorts them.

| Column          | Type   | Required | Values        | Description |
|-----------------|--------|----------|---------------|-------------|
| A: `date`       | text   | Yes      | `YYYY-MM-DD`  | The day. Maximum one row for each day. Can be a past day. |
| B, C, …: metric `id` | number | No  | number        | The value of the metric on that day. Empty means no value. For `yesno`: `1` means done. |

Rules:

- The header of each metric column is the metric `id`, not the name.
- The app adds a column at the end when a metric has no column. The app does this when it loads the sheet.
- The column order does not matter. You can move columns.
- `yesno`: `1` means "done". An empty cell means "not done". Uncheck in the app clears the cell.
- `number` and `count`: the app sets the cell. For `per_day` = `many` the value is the day total. Single entries are not stored.
- The app adds a row when a day has no row. It does not delete rows. A row with only a date is valid.

Example:

| date       | weight | meditate | water | reading |
|------------|--------|----------|-------|---------|
| 2026-09-29 | 82.4   |          | 8     | 20      |
| 2026-09-30 | 82.1   | 1        | 5     | 25      |

Result in the app for 2026-09-30: weight 82.1 kg, meditate done, water 5 glasses, reading 25 min.

### Old format

The first version of the app used one row for each entry in the `log` tab: `date`, `metric`, `value`.

- When the app finds the old header, it converts the tab once:
  1. It copies the old tab to `log_old` (or `log_old_2`, …).
  2. It rewrites `log` in the new format. `many` metrics get the day total. `one` metrics get the last value of the day.
- Delete `log_old` when you no longer need it.

## Consistency

- Google Sheets has no schema, foreign keys, unique constraints or transactions.
- 3 layers protect the data:

| Layer | Protects against | Strength |
|-------|------------------|----------|
| 1. App validates before it writes | App bugs | Strong. Main protection. |
| 2. Sheet data validation, mode "Reject input" | Manual edits in the Sheets UI | Medium |
| 3. App validates when it reads | All other invalid rows | Last defense |

### Layer 1: app writes

- Dart types allow only valid writes. Example: a `YesNoMetric` can only write the value `1`.
- The app reads the `log` tab again before each write. This keeps row numbers correct after manual edits.

### Layer 2: sheet data validation

The app adds these rules when it adds a missing tab or a missing `log` column:

| Range                 | Rule                                                                               | Similar DB constraint |
|-----------------------|------------------------------------------------------------------------------------|-----------------------|
| `log!A2:A`            | Custom formula: `=AND(REGEXMATCH(A2, "^\d{4}-\d{2}-\d{2}$"), COUNTIF($A$2:$A, A2) = 1)` | Column type + unique key |
| `log` `number` or `count` column | Custom formula: `=ISNUMBER(B2)`                                         | Column type           |
| `log` `yesno` column  | Custom formula: `=B2 = 1`                                                          | Check constraint      |
| `metrics` column `kind`    | Dropdown: `yesno`, `number`, `count`                                          | Enum                  |
| `metrics` column `per_day` | Dropdown: `one`, `many`                                                       | Enum                  |
| `metrics` column `active`  | Checkbox (`TRUE`, `FALSE`)                                                    | Boolean               |
| `metrics` column `icon`    | Custom formula: `=OR(REGEXMATCH(I2, "^[a-z0-9_]+$"), LEN(I2) <= 16)`          | Check constraint      |

The `metrics` rules:

- The app finds the columns by header name. The column letters can change. The `icon` example uses column `I`.
- The app sets the rules again each time it opens the sheet. So a sheet from an older app version accepts new values, for example `count`, and a new column gets its rule, for example `icon`.
- Before that, the app removes all validation rules below row 1 of the `metrics` tab. So a moved column leaves no old rule behind. Do not add your own rules to this tab: the app removes them.

Other setup:

- Freeze row 1 in both tabs.
- Set `log!A:A` to plain text format. This stops Google Sheets from changing the date format.

Limits:

- API writes skip data validation. Sheets accepts the value and marks the cell as invalid. Layer 1 is necessary.
- A column rule uses the metric `kind` at the time the app adds the column. If you change the `kind` later, change the rule by hand.
- No cascade: a changed metric `id` breaks the link to its `log` column. If you must change it, rename the column header too.
- No transactions: "read, then update" is not atomic.

### Layer 3: app reads

- The app ignores a `log` row with an invalid `date`, and shows a warning.
- The app ignores a `log` cell that is not a number (or not `1` for `yesno`), and shows a warning.
- The app ignores a `log` column with an unknown metric `id`, and shows a warning.
- If a day has 2 or more rows, the app uses the last row and shows a warning.
- The app ignores a `metrics` row with a missing `id`, `kind` or `per_day`, and shows a warning.
