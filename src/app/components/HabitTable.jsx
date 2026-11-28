import { Fragment } from 'preact';
import { weekRows } from '../../model/Day.js';
import { formatNumber, shortDay, weekdayNames, weekLabels } from '../../model/Format.js';
import { DayLayout, tableDayCount } from '../../model/MainView.js';
import { goalSummary } from '../../model/MetricDraft.js';
import { AppCard } from './AppCard.jsx';
import { useDayCells } from './DayCells.jsx';
import { useElementWidth } from './ElementWidth.js';
import { MetricIcon } from './MetricIcon.jsx';
import { outset } from './Outset.js';
import './HabitTable.css';

/** @import { ComponentChildren, JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { CountStep, LogTable, MetricDay } from '../../model/LogEntry.js' */
/** @import { DayLayout as Layout } from '../../model/MainView.js' */
/** @import { Metric, NumberMetric } from '../../model/Metric.js' */

/** The size of a day cell and the space between two cells, in CSS pixels. See "Day cell" in docs/design.md. */
const CELL = 40;
const CELL_GAP = 4;

/** The smallest width of the name column, and the width from which it also shows the goal of each metric. */
const NAME_WIDTH = 104;
const NAME_WITH_GOAL = 180;

/** The padding of the table card at each side, in CSS pixels. */
const CARD_PADDING = 12;

/** The height of the bar of a score of 100%, in CSS pixels. */
const BAR_HEIGHT = 72;

/** The smallest width of a score bar column that holds the score above the bar, for example "64.3". */
const VALUE_COLUMN = 30;

/**
 * The number of days that a table of `width` CSS pixels holds: 5 on a phone, up to 14 on a wide screen. See
 * `tableDayCount`.
 * @param {number} width
 * @returns {number}
 */
export function tableDays(width) {
  return tableDayCount(width - 2 * CARD_PADDING - CELL_GAP, NAME_WIDTH, CELL + CELL_GAP);
}

/**
 * The days of all metrics, in a table or in calendars. See "Days" in docs/design.md.
 *
 * - Table: one card. Its first row has the score bars, each bar above the cells of its day. Then the day headers, and
 *   one row for each metric, today on the right. A legend tells the cell colors.
 * - Calendars: the score bars of the days first, in one card, then one calendar card for each metric, in the card
 *   grid. On a wide screen, all calendar cards have the same size.
 *
 * The cells and their inputs: see `useDayCells`. The editor of a number metric opens below the metric.
 *
 * A score bar of a Saturday or a Sunday is lighter. Today is not over: without a value on today, today has no score
 * bar.
 * @param {object} props
 * @param {Metric[]} props.metrics
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {Day[]} props.days The days of the table or of the calendars, oldest first.
 * @param {Layout} props.layout
 * @param {boolean} props.busy
 * @param {(metric: Metric, day: Day, value: number | null) => void} props.onRecord Sets the value of a day: 1 or 0 for
 *   a yes/no metric. Null clears the day. See `planValue`.
 * @param {Map<MetricDay, CountStep[]>} props.pending Count taps that are not written yet. The table shows them at once.
 * @param {(metric: NumberMetric, day: Day, step: CountStep) => void} props.onCount
 * @param {((metric: Metric) => void) | null} [props.onOpen] Opens the detail screen of a metric. Null: the metric names
 *   are not links.
 * @param {Map<Day, number> | null} [props.scores] The score of each day (see `dayScores`), for the score bars of the
 *   table and of the calendars. Null: no score.
 * @param {string} [props.scoreTitle] The name of the score. Example: "Score · Habits". Default: "Score".
 * @param {(() => void) | null} [props.onScore] Opens the Score screen. Null: the score name is not a link.
 * @param {((metric: Metric, values: Map<Day, number>) => ComponentChildren) | null} [props.calendarExtra] More content
 *   below each calendar, for example a chart of the metric. The table has none.
 * @returns {JSX.Element}
 */
export function HabitTable({
  metrics,
  log,
  today,
  days,
  layout,
  busy,
  onRecord,
  pending,
  onCount,
  onOpen = null,
  scores = null,
  scoreTitle = 'Score',
  onScore = null,
  calendarExtra = null,
}) {
  const [measure, width] = useElementWidth();
  const { valuesOf, cell, editorOf, todayOpen } = useDayCells({
    metrics,
    log,
    today,
    busy,
    onRecord,
    pending,
    onCount,
  });

  /**
   * The score of `d`. Null if it has no score, also for today without a value.
   * @param {Day} d
   * @returns {number | null}
   */
  const scoreOf = (d) => (d === today && todayOpen ? null : (scores?.get(d) ?? null));

  if (layout === DayLayout.CALENDARS) {
    // The scores show above the bars only if each column has the space for them.
    const roomy = (width - 2 * CARD_PADDING + CELL_GAP) / days.length - CELL_GAP >= VALUE_COLUMN;
    return (
      <div ref={measure} class="habit-calendars-view">
        {scores != null && (
          <AppCard class="habit-scores-card">
            <div class="habit-table-head">
              <ScoreName title={scoreTitle} onScore={onScore} withUnit={false} />
              <p class="habit-table-text body-small">
                The score of each day, in % of the points, as in the table. A weekend day is lighter.
              </p>
            </div>
            <div class="habit-scores" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((d) => (
                <ScoreBar key={d.toString()} day={d} score={scoreOf(d)} withValue={roomy} />
              ))}
              {days.map((d) => (
                <ScoreDay key={d.toString()} day={d} full={roomy} first={d === days[0]} />
              ))}
            </div>
          </AppCard>
        )}
        <div class="habit-calendars">
          {metrics.map((m) => (
            <AppCard key={m.id} class="habit-calendar">
              <MetricName metric={m} onOpen={onOpen} withGoal />
              <MonthGrid days={days} cell={(d) => cell(m, d)} />
              {calendarExtra?.(m, valuesOf(m))}
              {editorOf(m)}
            </AppCard>
          ))}
        </div>
      </div>
    );
  }

  // The name column takes the space that the day columns leave. The table scrolls sideways in its card if it is too
  // narrow.
  const nameWidth = Math.max(NAME_WIDTH, width - 2 * CARD_PADDING - CELL_GAP - (CELL + CELL_GAP) * days.length);
  const withGoal = nameWidth >= NAME_WITH_GOAL;
  return (
    <div ref={measure} class="habit-table-box">
      <AppCard class="habit-table-card">
        <div class="habit-table-head">
          <h2 class="title-medium">{`Last ${formatNumber(days.length)} days`}</h2>
          <p class="habit-table-text body-small">
            The bars show the score of each day. Tap a cell to change its value. More points give a stronger color.
          </p>
        </div>
        <div class="habit-table-scroll">
          <table class="habit-table">
            <colgroup>
              <col style={{ inlineSize: `${nameWidth}px` }} />
              {days.map((d) => (
                <col key={d.toString()} style={{ inlineSize: `${CELL}px` }} />
              ))}
            </colgroup>
            <thead>
              {scores != null && (
                <tr class="habit-table-scores">
                  <th scope="row" class="habit-table-name">
                    <ScoreName title={scoreTitle} onScore={onScore} />
                  </th>
                  {days.map((d) => (
                    <td key={d.toString()}>
                      <ScoreBar day={d} score={scoreOf(d)} />
                    </td>
                  ))}
                </tr>
              )}
              <tr class="habit-table-days">
                <td />
                {days.map((d) => (
                  <DayHeader key={d.toString()} day={d} />
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const shownEditor = editorOf(m);
                return (
                  <Fragment key={m.id}>
                    <tr class="habit-table-row">
                      <th scope="row" class="habit-table-name">
                        <MetricName metric={m} onOpen={onOpen} withGoal={withGoal} />
                      </th>
                      {days.map((d) => (
                        <td key={d.toString()}>{cell(m, d)}</td>
                      ))}
                    </tr>
                    {shownEditor != null && (
                      <tr class="habit-table-editor-row">
                        <td colSpan={days.length + 1}>{shownEditor}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <CellLegend />
      </AppCard>
    </div>
  );
}

/**
 * The name of the score at the start of the score bars of the table, and above the score bars of the calendars. With `withUnit`, the unit of the
 * score below the name. With `onScore`, a link to the Score screen.
 * @param {object} props
 * @param {string} props.title
 * @param {(() => void) | null} props.onScore
 * @param {boolean} [props.withUnit] Default: true.
 * @returns {JSX.Element}
 */
function ScoreName({ title, onScore, withUnit = true }) {
  const content = (
    <>
      <span class={withUnit ? 'title-small' : 'title-medium'}>{title}</span>
      {withUnit && <span class="habit-table-text body-small">% of the points</span>}
    </>
  );
  if (onScore == null) return <span class="score-name">{content}</span>;
  return (
    <button
      type="button"
      class="score-name score-name-link"
      style={outset(4, 4)}
      title="Show the Score screen"
      aria-label={`${title}: show the Score screen`}
      onClick={() => onScore()}
    >
      {content}
    </button>
  );
}

/**
 * The bar of the score of a day, with the score above it if `withValue`. The bar of a Saturday or a Sunday is lighter,
 * so that the weeks show. No score: no bar.
 * @param {object} props
 * @param {Day} props.day
 * @param {number | null} props.score From 0 to 100.
 * @param {boolean} [props.withValue] Default: true.
 * @returns {JSX.Element}
 */
function ScoreBar({ day, score, withValue = true }) {
  if (score == null) return <div class="score-bar-box" />;
  const text = `${shortDay(day)}: score ${formatNumber(score)}%`;
  return (
    <div class="score-bar-box" role="img" title={text} aria-label={text}>
      {withValue && <span class="score-bar-value label-medium">{formatNumber(score)}</span>}
      <span
        class={isWeekend(day) ? 'score-bar score-bar-weekend' : 'score-bar'}
        style={{ blockSize: `${Math.max(2, Math.round((score / 100) * BAR_HEIGHT))}px` }}
      />
    </div>
  );
}

/**
 * True if `day` is a Saturday or a Sunday.
 * @param {Day} day
 * @returns {boolean}
 */
function isWeekend(day) {
  return day.weekday >= 6;
}

/**
 * The day below a score bar of the calendars layout. With `full`, the weekday and the day number. Else only the day
 * number of the first day and of each Monday, because the columns are narrow.
 * @param {object} props
 * @param {Day} props.day
 * @param {boolean} props.full
 * @param {boolean} props.first
 * @returns {JSX.Element}
 */
function ScoreDay({ day, full, first }) {
  if (!full) {
    return (
      <span class="score-day" aria-hidden="true">
        {first || day.weekday === 1 ? <span class="score-day-number label-medium">{day.day}</span> : null}
      </span>
    );
  }
  return (
    <span class="score-day" aria-hidden="true">
      <span class="body-small day-header-weekday">{weekdayNames[day.weekday - 1]}</span>
      <span class="score-day-number label-medium">{day.day}</span>
    </span>
  );
}

/**
 * The weekday and the day number of a table column. Today looks as the other days.
 * @param {object} props
 * @param {Day} props.day
 * @returns {JSX.Element}
 */
function DayHeader({ day }) {
  return (
    <th scope="col" class="day-header">
      <span class="day-header-weekday body-small">{weekdayNames[day.weekday - 1]}</span>
      <span class="day-header-day title-small">{day.day}</span>
    </th>
  );
}

/**
 * The colors of the day cells: no value, 0 points, some points, 1 point. `labels` names them, in this order.
 * @param {object} props
 * @param {[string, string, string, string]} [props.labels] Default: "No value", "0 points", "Some points", "1 point".
 * @returns {JSX.Element}
 */
export function CellLegend({ labels = ['No value', '0 points', 'Some points', '1 point'] }) {
  return (
    <ul class="cell-legend" aria-label="Cell colors">
      <li class="cell-legend-item">
        <span class="cell-swatch day-cell-none" />
        {labels[0]}
      </li>
      <li class="cell-legend-item">
        <span class="cell-swatch day-cell-value" style={{ '--cell-fill': 0 }} />
        {labels[1]}
      </li>
      <li class="cell-legend-item">
        <span class="cell-swatch day-cell-value" style={{ '--cell-fill': 0.4 }} />
        {labels[2]}
      </li>
      <li class="cell-legend-item">
        <span class="cell-swatch day-cell-value" style={{ '--cell-fill': 1 }} />
        {labels[3]}
      </li>
    </ul>
  );
}

/**
 * The days of a month calendar: weekday letters on top, and the first day of each week row on the left, with the month
 * when it changes. Columns are Monday to Sunday.
 * @param {object} props
 * @param {Day[]} props.days
 * @param {(day: Day) => ComponentChildren} props.cell
 * @returns {JSX.Element}
 */
export function MonthGrid({ days, cell }) {
  const weeks = weekRows(days);
  const labels = weekLabels(weeks);
  return (
    <div class="month-grid">
      <span />
      {weekdayNames.map((name) => (
        <span key={name} class="month-grid-label month-grid-weekday" aria-hidden="true">
          {name.charAt(0)}
        </span>
      ))}
      {weeks.map((week, i) => (
        <Fragment key={labels[i]}>
          <span class="month-grid-label month-grid-week" aria-hidden="true">
            {labels[i]}
          </span>
          {week.map((day, j) => (
            <span key={j} class="month-grid-day">
              {day != null && cell(day)}
            </span>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * The icon and the name of `metric`. With `withGoal`, the goal below the name. With `onOpen`, a link to its detail
 * screen.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {((metric: Metric) => void) | null} [props.onOpen] Null: the name is not a link.
 * @param {boolean} [props.withGoal] Default: false.
 * @returns {JSX.Element}
 */
export function MetricName({ metric, onOpen = null, withGoal = false }) {
  const content = (
    <>
      <MetricIcon icon={metric.icon} />
      <span class="metric-name-texts">
        <span class="metric-name-text">{metric.name}</span>
        {withGoal && <span class="metric-name-goal body-small">{`Goal: ${goalSummary(metric)}`}</span>}
      </span>
    </>
  );
  if (onOpen == null) return <span class="metric-name">{content}</span>;
  const description = `Show all data of ${metric.name}`;
  // 4 px, not more: the end padding of the name column is 4 px, and the day cells come after it.
  return (
    <button
      type="button"
      class="metric-name metric-name-link"
      style={outset(4, 4)}
      title={description}
      aria-label={description}
      onClick={() => onOpen(metric)}
    >
      {content}
    </button>
  );
}
