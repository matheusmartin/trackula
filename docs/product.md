# Product

Status: approved on 2026-11-26, in phase 0 of the consolidation. The owner decided the items marked **Decision** and
approved all proposals (P1 to P8). This file gives the behavior of the app. Some parts are not in the app yet: phases
2 to 4 of the consolidation make them. `docs/data-model.md` gives the sheet format. `docs/design.md` gives the look.

## Purpose

Trackula is a personal tracker for daily habits and body measurements. Each day, you record a few values: a yes or a
no, a count, or a measurement. Each metric has a goal. The app shows how near you are to your goals, day by day, as a
score from 0 to 100%. All data stays in one Google Sheet that you own. You can read and change the sheet by hand.

## User and devices

- One user: the owner of the sheet. There are no accounts, no sharing and no backend.
- **Decision:** the phone and the desktop are equal. Each screen has a layout for a narrow window (360 px to 839 px)
  and a layout for a wide window (840 px or more). A wide layout uses the width. It is not a phone layout in the
  center of the window, and it is not a phone layout made wider.
- Each action works with touch, with a mouse and with the keyboard.

## Principles

1. **The sheet belongs to you.** The app is a view of the sheet and a fast way to change it. A person can read the
   sheet without the app: clear headers, one row for each day, words and numbers. **Decision:** the sheet format can
   change, but only to a format that is equally easy to read and change by hand. The app accepts changes by hand.
2. **One tap records a value.** **Decision:** a change goes to the sheet at once, on each screen. There is no Save
   button. After each write, the app shows a message with an Undo button.
3. **One meaning for each color.** **Decision:** the Ember brand colors stay. The data has the brand color: the day
   cells, the bars of the charts and the score, in the same way. A warning, an error and a selected item each get
   their own color, the same on all screens. The current day has no special color.
4. **The same thing looks and works the same everywhere.** A day cell, a chart card, a button and a number each have
   one component and one format.
5. **Each screen has an address.** A reload shows the same screen. You can keep a link to a metric.
6. **The app explains itself.** Each chart has a title and one sentence that tells what it shows. Each value has a
   tooltip. The texts use the words of the list in "Words".
7. **Fast and light.** The first open downloads less than 0.5 MB with gzip. The app opens without a network. Demo
   mode works without a network.
8. **Clear text.** All text for the user is in ASD-STE100 Simplified Technical English. Each kind of number has one
   format (see "Numbers").

## Words

The app uses these words, in the texts for the user, in the docs and in the code. The right column gives the words
that the app must not use for the same thing.

| Word | Meaning | Do not use |
|---|---|---|
| Metric | A thing that you track each day. Examples: Weight, Meditate. | habit (except as an example), item, measure |
| Kind | The kind of a metric: yes/no, number or count. | type |
| Value | What you record for a metric on a day: yes, no or a number. | entry, record (noun), log entry |
| Record | To set the value of a metric on a day. | log (verb), enter |
| No value | A day without a value for a metric. A yes/no metric counts it as no in the score. | no entry, empty, missing |
| Done | A yes/no metric with the value yes. | completed |
| Goal | The value that you want: a target or a limit. Examples: `at least 8`, `no`. | objective |
| Target | A goal that you must reach: `yes` and `at least`. | — |
| Limit | A goal that you must not go over: `no` and `at most`. | — |
| Points | 0 to 1, from the goal of a metric on a day. | — |
| Score | The average of the points of a day, from 0 to 100%. | — |
| Trend | The smooth line of a number metric. Each new value moves it 25% of the way to that value. | 7-day trend, smooth average |
| Strength | A slow average of the score, or of the done days of a yes/no metric. | habit strength |
| Group | A set of metrics, from the `group` column. | category |
| Period | The days that a screen or a chart shows. | window, range |
| Sheet | The Google Sheet with the data. | spreadsheet, file |

Phase 3 applied this list to the texts of the app (P8). The names in the code can still use other words, for example
`ZoomWindow` for a period.

## Numbers

**Decision.** `docs/design.md` gives the exact formats. Phase 3 puts them in `Format.js`.

- A value uses the decimals of the step of its metric. Example: step 0.1 gives `82.6`, step 1 gives `8`.
- A score always has 1 decimal: `57.0%`. A change of a score has 1 decimal and a sign: `+4.0%`. Now the app shows
  `57%`, `+3.95%` and `91.3%` on one screen.
- Today is not over. A chart does not show today as 0 before you record a value: it shows no bar for today.

## Write model

**Decision:** instant writes, with Undo, on all screens.

- Yes/no: a tap sets yes, or no if the value is yes. The value goes to the sheet at once. A yes/no cell or tile waits
  while a write runs, so that a second tap reads the new value.
- Count: a tap adds the step. A right-click or a double tap subtracts it. The taps go to the sheet at once, in one
  write for each cell (as now: see `CountQueue`).
- Number: the ruler and the text field change the value on the screen. The value goes to the sheet when you release
  the ruler, press Enter, or move the focus out of the editor. A press on the ruler without a move confirms the value.
  An empty field clears the day. In a table or a calendar, Enter also closes the editor, and the editor has Close and
  Clear buttons.
- An input that comes while a write runs waits, and goes in the next write.
- After each write, a message shows at the bottom for 6 seconds. Example: "Weight: 82.4 kg on Nov 26." with an Undo
  button. Undo writes the value before the change. A new input removes the message. Inputs that wait for the next
  write share one message: Undo writes the values before all of them. Example: 3 quick taps on Water, then Undo, give
  the value before the first tap.
- If a write fails, the cells and the tiles show the value of the sheet again, and a message gives the error with
  "Try again". A number editor keeps the value of the user, so that Enter sends it again.
- The Today screen stays on Today after a write.

## Screens

The screens after phase 2 of the consolidation. Phase 4 redraws them.

| Screen | Address | How you open it | What it does |
|---|---|---|---|
| Sign-in | — | First open | Google sign-in. |
| Setup | — | After the sign-in, without a sheet | Pick a sheet with the Google Picker. The app adds the tabs. |
| Today | `#/today` | Navigation | One tile for each metric. A number tile has a ruler. A yes/no tile has a check mark. A count tile adds its step at each tap. |
| Days | `#/days` | Navigation | The recent days in one of two layouts. Table: one card with the score bars on top, then one row for each metric and one column for each day, 5 to 14 days. Calendars: the score bars of the days, then a month grid for each metric for 31 days, and a chart of each number or count metric. The cell color shows the points of the day. |
| Score | `#/score` | Navigation | The score of a period: the period panel (span chips, dates, a bar for each day), key numbers, 4 charts and tables, and the Days card with the score of each day. A tap on a bar over time shows its month in the Days card. |
| Metric detail | `#/metric/<id>` | A tap on a metric name | The values of a period: the period panel (span chips, dates, a bar for each day), key numbers, 3 to 5 charts, and the Days card: a month calendar to see and edit the days. A tap on a bar over time shows its month in the calendar. |
| Metrics | `#/metrics` | `tune` button in the app bar, or Show in the line of the sheet problems | The problems of the sheet first, then the list of metrics, in order. Add, move and delete metrics. Restore deleted metrics. Fix the rows with problems. |
| Metric form | `#/metrics/new`, `#/metrics/edit/<id>`, `#/metrics/fix/<row>`, `#/metrics/restore/<column>` | A tap on a metric, Add metric, Fix or Restore | Name, icon, kind, unit, step, group and goal. |
| More menu | — | App bar | Change sheet, Sign out. |

Shared parts: the group chips filter Today, Days and Score. Each input writes at once, with an Undo message. When the
sheet has problems, the navigation screens show one line with their number and a Show button.

The charts of the metric detail and of the Score screen:

| Kind | Key numbers | Charts | Days |
|---|---|---|---|
| yes/no | done days, rate, missed (no), no value, current streak, longest streak | done rate, strength, yes and no and no value, weekday pattern, streak lengths | month calendar |
| count | total, per day, best day, days recorded | totals, running total, weekday averages, distribution | month calendar |
| number | latest, change, lowest, highest, average, days recorded | averages and range, values and trend, distribution | month calendar |
| score | per day, change, best day, best weekday | average per day, strength, score by group (a Week and Month switch), weekday averages | month calendar |

## Proposals

The owner approved all proposals on 2026-11-26. Phase 2 makes P1, P5, P6 and P7. Phase 3 makes P8. Phase 4 makes
P2, P3 and P4 with the redraw of their screens.

| ID | Proposal | Why |
|---|---|---|
| P1 | Merge "5 days" and "31 days" into one screen, "Days", with two layouts: Table and Calendars. The table shows as many days as the width can hold: 5 on a phone, up to 14 on a desktop. The navigation then has 3 items: Today, Days, Score. | The two screens show the recent days of all metrics, to check and fix them. The table of 5 days leaves half of a desktop empty. |
| P2 | Remove the heatmap from the metric detail. The month calendar shows the days of the period and lets you edit them. A tap on a bar of a chart shows its month in the calendar. | The heatmap and the calendar show the same days. The Score screen already has only the calendar. |
| P3 | Merge "Score by group and week" and "Score by group and month" into one table, with a Week and Month switch. | The two tables have the same rows and the same colors. |
| P4 | Remove "This week and the 4 weeks before" from the Score screen. | The group table and the weekday averages show the same data in a simpler form. |
| P5 | Show the sheet warnings as one line at the top of the navigation screens, with a "Show" button that opens the problems in the Metrics screen. | Now a long list of warnings shows at the bottom of each navigation screen. |
| P6 | The score is a screen of its own, not a metric. | The detail screen now has a branch for the score in each part. No visible change. |
| P7 | Give each screen an address: `#/today`, `#/days`, `#/score`, `#/metric/<id>`, `#/metrics`, `#/metrics/new`, `#/metrics/edit/<id>`, `#/metrics/fix/<row>`, `#/metrics/restore/<column>`. An edit has `edit/`, so that a metric with the id `new` has its own address. The Back button of the browser goes to the screen before. | A reload now goes back to Today, and you cannot keep a link to a metric. |
| P8 | Apply the list of "Words" to all texts. Example: "no entry" becomes "no value", "Habit strength" becomes "Strength". | The same thing has two names now. |

The sheet format: P1 to P8 need no change of the sheet. A later phase proposes a change only if a screen needs it, and
only to a format that stays easy to read and change by hand.

## Not in this work

- More users, sharing, accounts or a backend.
- Other storage than one Google Sheet.
- Reminders and notifications.
- New metric kinds.
- Apps for Android or iOS. The installed web app stays.
