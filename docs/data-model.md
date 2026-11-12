# Data model

## Overview

- Storage is one Google Sheet.
- The sheet has 2 tabs:
  - `Metrics`: the list of things you track. You edit it in the [metrics screen](#metrics-screen) of the app, or by
    hand.
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
| `goal`    | text or number | Yes | `yesno`: `yes`, `no`. `number`, `count`: for example `at least 8`, `at most 80 from 83 trend` | The goal. It gives the points of the metric in the [score](#score). See [Goal](#goal). Each metric must have a goal. A row without goal or with an invalid goal is invalid: the app shows a warning and does not show the metric. |

Rules:

- To hide a metric, delete its row. Its `Log` column and values stay in the sheet, and the app ignores them. To show the metric again, add the row again with the same `id`. The metrics screen does both: Delete and Restore.
- The app ignores other columns. Older sheets have `per_day` and `active` columns: you can delete them.
- Older sheets can have no `icon` column. Then the app shows an error. Add the column with an icon in each row.
- Older sheets can have no `goal` column, or rows without goal. Older app versions accepted them: an empty goal was `yes` for `yesno`, and no goal for `number` and `count`. Now these rows are invalid. Fix them in the [metrics screen](#metrics-screen): "Fix" opens each row, and the first save adds the `goal` column. Or add the goals in the sheet.

Example:

| id       | name     | kind   | unit    | step | group  | icon             | goal               |
|----------|----------|--------|---------|------|--------|------------------|--------------------|
| weight   | Weight   | number | kg      | 0.1  | body   | monitor_weight   | at most 80 from 83 |
| waist    | Waist    | number | cm      | 0.5  | body   | straighten       | at most 90 from 95 |
| meditate | Meditate | yesno  |         |      | habits | self_improvement | yes                |
| water    | Water    | count  | glasses | 1    | habits | 💧               | at least 8         |
| reading  | Reading  | count  | min     | 5    | habits | menu_book        | at least 20        |

### Metrics screen

The metrics screen of the app changes the `Metrics` tab, so you do not need to open the sheet. Rules:

- The list shows the metrics in row order: the order in the app. The arrows move a row before the metric above it or
  after the metric below it. Empty rows and invalid rows between them do not move.
- "Add metric" writes a new row after the last row. The app makes the `id` from the name: lowercase letters and
  digits, with `_` between the words. Example: "Morning teeth" gives `morning_teeth`. If a metric, an invalid row or
  a `Log` column has this id, a number goes after it: `morning_teeth_2`. So a new metric does not get the values of a
  deleted metric. The `id` does not change after that.
- Save writes only the columns of the table above. The other columns of the row do not change. The app writes text
  as it is, so a name such as `=1+1` stays text. The goal is in words: `at least 8`, `at most 80 from 83 trend`. So
  an older goal such as `>= 8` becomes `at least 8` after a save.
- A metric with values cannot change between `yesno` and the other kinds: its values would become invalid. `number`
  and `count` use the same values, so a change between them is always possible.
- Delete removes the row of the metric. Its `Log` column and values stay. "Deleted metrics" lists the `Log` columns
  without a metric, with their number of values and the last day. Restore writes a new row with the `id` of the
  column, so the metric shows again with all its values.
- "Rows with problems" lists the rows that the app cannot read, with the problem. Examples: no icon, no goal, an
  invalid goal, a duplicate `id`. "Fix" opens the row in the form, and Save writes the same row. A row with an
  invalid or a duplicate `id` gets a new `id` from its name.
- If the `Metrics` tab has no `goal` column, the first save adds it.
- Each change reads the tab first and finds the row by its `id`, so manual edits in the sheet do not break it. After
  the change, the app sets the rules again and loads the sheet: a new metric gets its `Log` column, and a new goal
  gives new scores.

### Goal

The `goal` cell of a `number` or `count` metric has up to 4 parts, in this order. Case does not matter.

| Part      | Required | Values                         | Description |
|-----------|----------|--------------------------------|-------------|
| Direction | No       | `at least`, `at most`          | `at least`: a higher value is better. `at most`: a lower value is better. Empty means `at least`. |
| Target    | Yes      | a number                       | The value of the goal. A value at the target or better gives 1 point. Use a period for decimals: `at most 75.5`. |
| Start     | No       | `from` and a number            | The value of 0 points. A value between the start and the target gives a part of 1 point. The start is below the target for `at least`, and above it for `at most`. |
| Trend     | No       | `trend`                        | Only for `number`. The points come from the trend of the values, not from the value of the day. See [Score](#score). |

Without a start, `at least` starts at 0, and `at most` gives 1 or 0 points. If the target of `at least` is 0 or less, it also gives 1 or 0 points.

Examples:

| Goal                       | Meaning | Points |
|----------------------------|---------|--------|
| `at least 8`               | 8 or more, from 0. | 6 gives 0.75. 12 gives 1. |
| `at least 7 from 5`        | 7 or more, from 5. | 6 gives 0.5. 4 gives 0. |
| `at most 2`                | 2 or less. | 2 gives 1. 3 gives 0. |
| `at most 2 from 4`         | 2 or less, from 4. | 3 gives 0.5. |
| `at most 80 from 83`       | 80 or less, from 83. | 82.1 gives 0.3. 84 gives 0. |
| `at most 80 from 83 trend` | The same, from the trend. | A trend of 82.1 gives 0.3. |

- A number cell, for example `8`, means `at least 8`.
- Older app versions wrote `>=` and `<=`. They are the same as `at least` and `at most`. Example: `<= 80` is `at most 80`.
- When you reach a goal, set a new goal with a new start. Example: change `at most 80 from 83` to `at most 78 from 80`.
- The goals `yes` and `at least` are targets. The goals `no` and `at most` are limits. On the Today screen, a
  `yesno` or `count` tile with a value has a mark: a check mark if the value reaches a target, a warning sign if the
  value is over a limit. A value within a limit has no mark: the day is not over. Examples: Water `at least 8` with
  8 gets a check mark. Coffee `no` with `yes`, and Coffee `at most 2` with 3, get a warning sign. Coffee `at most 2`
  with 1 gets no mark.

## Tab `Log`

One row for each day, one column for each metric. Rows are not sorted. The app sorts them.

| Column          | Type   | Required | Values        | Description |
|-----------------|--------|----------|---------------|-------------|
| A: `date`       | date   | Yes      | a date, shown as `YYYY-MM-DD` | The day. Maximum one row for each day. Can be a past day. |
| B, C, …: metric `id` | number, or `yes` / `no` | No | number, `yes`, `no` | The value of the metric on that day. Empty means no value. For `yesno`: `yes` or `no`. |
| `Score`         | number | No       | 0 to 100      | The [score](#score) of the day of the row. The app writes it. Do not edit it: the app writes it again. |

Rules:

- The header of each metric column is the metric `id`, not the name.
- The app adds a column at the end when a metric has no column, or when the tab has no `Score` column. The app does
  this when it loads the sheet.
- The column order does not matter. You can move columns.
- `yesno`: `yes` means "done", `no` means "not done". Case does not matter. An empty cell means no entry: the app shows it like `no`, and the [score](#score) counts it as `no`.
  - A tap in the app writes `yes`, or `no` if the day is `yes`.
  - Old app versions wrote `1` for `yes`. When the app opens the sheet, it changes these cells to `yes` (and `0` to `no`). It does not change empty cells.
- `number` and `count`: one value per day. For amounts, for example glasses of water, it is the day total. Single entries are not stored.
- The app adds a row when a day has no row. It does not delete rows. A row with only a date is valid.

Example:

| date       | weight | meditate | water | reading | Score |
|------------|--------|----------|-------|---------|-------|
| 2026-09-29 | 82.4   |          | 8     | 20      | 73.3  |
| 2026-09-30 | 82.1   | yes      | 5     | 25      | 73.1  |

Result in the app for 2026-09-30: weight 82.1 kg, meditate done, water 5 glasses, reading 25 min, score 73.1%.

## Score

The score of a day is a percentage from 0 to 100. Each metric has a goal, and gives 0 to 1 point on a day. The score
is the average of these points, as a percentage with 1 decimal. You do not log it: the app calculates it from the
values and the goals.

Which metrics count on a day:

- A `yesno` or `count` metric counts on each day from its first value to today, and on each later day with a row,
  for example a row of a day after today. A day without a value has the value 0: `no` for `yesno`, and 0 for
  `count`. This is also true for a day without a row. So a day that you do not log gives the same points as a day
  with `no` or 0. Examples: the goal `yes` gives 0, the goal `no` gives 1, `at least 8` gives 0, `at most 2` gives 1.
- A `number` metric counts only on the days with a value. It is a measurement, not a task for each day. For an amount
  for each day, for example minutes of reading, use `count`.
- A day where no metric counts has no score. Example: the days before the first value.

| Kind     | Points | Example |
|----------|--------|---------|
| `yesno`  | 1 if the value is the goal. Else 0. No value is `no`. | Goal `yes`: `yes` gives 1, no value gives 0. Goal `no`: `no` and no value give 1. |
| `count`  | 1 if the value reaches the goal. Else the part of the way from the start to the target. See [Goal](#goal). No value is 0. | `at least 8`: 5 gives 0.625, 10 gives 1, no value gives 0. `at most 2`: no value gives 1. |
| `number` | The same as `count`, but only on the days with a value. With `trend`, the points come from the trend of the day. | `at most 80 from 83`: 82.1 gives 0.3. 79.5 gives 1. |

Example, with the metrics above, for 2026-09-30: weight 82.1 is 0.3 of the way from 83 to 80 (0.3), meditate `yes`
(1), water 5 of 8 (0.625), reading 25 for at least 20 (1). The average is (0.3 + 1 + 0.625 + 1) / 4 = 0.73125, so
the score is 73.1. On 2026-09-29, meditate does not count yet: its first value is on 2026-09-30.

The trend:

- It is the line of the charts of a `number` metric: an exponential moving average. The trend of the first value is
  that value. Each new value moves the trend 25% of the way to it, as in the Libra weight app. Example: the trend 82.4
  and the next value 82.0 give 82.3.
- Use `trend` for a value that changes much from day to day. Example: water and food change a weight by 1 kg or more.
  Then the points change only when the weight really changes.
- The trend of a day comes from all earlier values. So a changed value also changes the points of the later values.

Rules:

- The app writes the score in the `Score` column of each `Log` row. A row of a day without a score has an empty
  score. A score as text, for example `'3`, changes to the number.
- If a day has 2 or more rows, each row has the score of the day. The app uses the last row of the day, as it does
  for the values.
- A day without a row has a score in the app, for example 0, but no `Score` cell: the app does not add rows for it.
- The app calculates all scores again each time it loads the sheet: when it opens the sheet, after the reload button,
  and after the values that you log in the app (one time for each save or tap). It writes only the cells that
  changed. So the scores follow:
  - a new or changed value, also of a past day, in the app or by hand in the sheet,
  - a new goal, a new `kind` or a deleted metric in the `Metrics` tab. A new goal also changes the score of the past
    days.
  - for a `trend` goal, a new, changed or deleted value also changes the score of the later days with a value,
  - for a `yesno` or `count` metric, a new first value also changes the score of the days after it.
- If you change the sheet by hand while the app is open, the scores change at the next load. Use the reload button.
- If the app cannot write the scores, for example in a view-only sheet or at the request limit of the Sheets API, it
  shows a warning and continues. The next load tries again.
- The app does not read the `Score` column. It shows the scores that it calculates, also for count taps that it did not
  write yet. Demo mode has no `Score` column.
- In the app, a green bar chart of the score, one bar for each day, is at the top of the "5 days" and "31 days"
  views. A tap on "Score" opens the "Score" view of the bottom navigation bar: the score only, in green. Each part
  shows different data, so that no part shows again the days or the weekdays of another part. It does not show a
  total: the score of a day is a percentage. The Today tiles do not show the score.
  - Key numbers: "per day" (the average of the days with a score), "change", "best day" and "best weekday".
  - "change" compares the first half of the period with the second half. Example: in the 14 days from Oct 1 to Oct
    14, the days from Oct 8 to Oct 14 compare with the days from Oct 1 to Oct 7. With an odd number of days, the
    second half has one day more. The change does not use the days before the period: at "All", there are none.
  - "Average per day": one bar for each week, month or quarter of the period, with the average score of its days
    with a score. The scale is 0 to 100%.
  - "Strength (%)": how strong the habits are, as in Loop Habit Tracker. Each day with a score moves the strength 5%
    of the way to the score of that day. So it goes up slowly on days with a high score and down slowly on days with
    a low score. One bad day changes it only a little. Example: 20 days at 100% give 64%. The strength uses the days
    before the period too.
  - "This week and the 4 weeks before": for each weekday, the score of this week (a diamond), and a bar from the
    lowest to the highest score of that weekday in the 4 weeks before, with a dot at their average. A day after today
    has only the bar: the usual range of that weekday. "This week" is the week of the end of the period. If you move
    the period back, the chart shows the week of its end, for example "The week of Oct 5 and the 4 weeks before".
  - "Score by group and week": a table with one row for each group and one column for each week: the 4 weeks before
    and this week (the last column). Each cell has the average score of the group on the same weekdays as this week.
    Example: on a Wednesday, each week counts its Monday to Wednesday. The color of a cell shows the change from the
    week before: green for more, orange for less, darker for a larger change. A cell of the first column, or without
    change, has no color. A week without a score of the group shows "–".
  - "Score by group and month": the same table with one column for each month: the 3 months before and this month
    (the last column), up to the end of the period. Each cell has the average score of the group in the days of that
    month. The color shows the change from the month before. Example: on Nov 10, the columns are Aug, Sep, Oct and
    Nov, and Nov counts Nov 1 to Nov 10.
  - In these 2 tables, the score of a group is the average of the points of its metrics on a day, as a percentage.
    A group without a score in these weeks or months has no row. With a group selected, or with only one group, the
    tables are by metric: "Score by metric and week" and "Score by metric and month", with one row for each metric.
    The score of a metric is its points as a percentage. "This week" and "this month" are the week and the month of
    the end of the period.
  - "Weekday averages": the average score on each weekday. For the score of all metrics, with 2 or more groups,
    each bar stacks the part of each group, in one color for each group. The part of a group on a day is the sum of
    the points of its metrics, divided by the number of metrics that count on that day. So the parts of a weekday add
    up to its average. The colors have the soft tone of the strongest cells of the tables and the calendar, so that
    they match the other charts. A thin gap separates the parts.
  - "Score by month": a month calendar with the score of each day. A darker day has a higher score: 100 has the most
    color. It is read-only. It shows the month of the end of the period, and its arrows show the other months. The
    "Score" view has no day heatmap: the calendar shows the same days, with their scores.
- The group filter of the app (the `group` column) also applies to the score. With a group selected, the chart and
  the "Score" view show the group score: the average of the points of the metrics of that group only. The title shows
  the group, for example "Score · Habits". The `Score` column always has the score of all metrics.

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
| `Metrics` column `goal`    | Custom formula: `=OR(ISNUMBER(J2), REGEXMATCH(LOWER(TO_TEXT(J2)), "^ *(yes\|no\|(at +least\|at +most\|<=\|>=)? *-?[0-9]+([.][0-9]+)?( +from +-?[0-9]+([.][0-9]+)?)?( +trend)?) *$"))` | Check constraint |

The `Metrics` rules:

- The app finds the columns by header name. The column letters can change. The `icon` example uses column `I`, the
  `goal` example column `J`.
- The `goal` rule does not compare the goal with the `kind`, and it does not compare the start with the target.
  Examples: it accepts `yes` for a `number` metric, `trend` for a `count` metric, and `at most 80 from 78`. Then the
  app shows a warning when it reads the row.
- Sheets does not check empty cells, so the `goal` rule accepts an empty goal. Then the app shows a warning when it
  reads the row.
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
- The app ignores a `Metrics` row with a missing or invalid `id`, `kind` or `goal`, or without `icon`, and shows a
  warning.
