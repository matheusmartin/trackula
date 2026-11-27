import { Fragment } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { weekRows } from '../../model/Day.js';
import { formatNumber, shortDay, weekdayNames, weekLabels } from '../../model/Format.js';
import { metricDayKey, parseMetricDay } from '../../model/LogEntry.js';
import { DayLayout, tableDayCount } from '../../model/MainView.js';
import { NumberMetric, YesNoMetric } from '../../model/Metric.js';
import { goalSummary } from '../../model/MetricDraft.js';
import { pointsByMetric } from '../../model/Score.js';
import { metricValues, nearestDay } from '../../model/Summary.js';
import { AppCard } from './AppCard.jsx';
import { useCountInput } from './CountInputModifier.js';
import { DayCell, ScoreCell } from './DayCell.jsx';
import { useElementWidth } from './ElementWidth.js';
import { MetricIcon } from './MetricIcon.jsx';
import { NumberEditor } from './NumberEditor.jsx';
import { outset } from './Outset.js';
import './HabitTable.css';

/** @import { ComponentChildren, JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { CountStep, LogTable, MetricDay } from '../../model/LogEntry.js' */
/** @import { DayLayout as Layout } from '../../model/MainView.js' */
/** @import { Metric } from '../../model/Metric.js' */

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
 * - Calendars: the score calendar first, then one calendar card for each metric, in the card grid.
 *
 * The cells (see {@link DayCell}):
 * - Yes/no: a click writes `yes`, or `no` if the day is `yes`.
 * - Count: see `CountInput`. A count has no reset: it goes to empty with subtractions.
 * - Number: a click opens the {@link NumberEditor} for that metric and day, below the metric. A second click closes it.
 *
 * Today is not over: without a value on today, today has no score bar.
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
 *   table and the score calendar. Null: no score.
 * @param {string} [props.scoreTitle] The name of the score. Example: "Score · Habits". Default: "Score".
 * @param {(() => void) | null} [props.onScore] Opens the Score screen. Null: the score name is not a link.
 * @param {boolean} [props.showsTitle] True if each calendar shows the metric name. Default: true.
 * @param {((metric: Metric, values: Map<Day, number>) => ComponentChildren) | null} [props.calendarExtra] More content
 *   below each calendar, for example a chart of the metric. The table has none.
 * @param {number | null} [props.calendarColumns] A fixed number of calendar columns. Null: the card grid.
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
  showsTitle = true,
  calendarExtra = null,
  calendarColumns = null,
}) {
  // The metric and day open in the editor.
  const [editing, setEditing] = useState(/** @type {MetricDay | null} */ (null));
  const countInput = useCountInput();
  const [measure, width] = useElementWidth();
  // The latest count function: a touch tap runs after a wait.
  const latestOnCount = useRef(onCount);
  latestOnCount.current = onCount;
  // The values of yes/no metrics hold 0 for `no`: a `no` day is a value with 0 points, not an empty day.
  const valuesById = useMemo(
    () => new Map(metrics.map((m) => [m.id, metricValues(m, log, pending)])),
    [metrics, log, pending],
  );
  // The points of each day with a value, as the score has them. A goal with a trend gets its points from the trend.
  const points = useMemo(() => pointsByMetric(metrics, log, today, pending), [metrics, log, today, pending]);
  const open = editing == null ? null : parseMetricDay(editing);

  /**
   * @param {Metric} m
   * @param {Day} d
   * @param {Map<Day, number>} values
   */
  function click(m, d, values) {
    if (m instanceof YesNoMetric) {
      onRecord(m, d, values.get(d) === 1 ? 0 : 1);
    } else if (!m.isCount) {
      const cell = metricDayKey(m.id, d);
      setEditing(editing === cell ? null : cell);
    }
  }

  /**
   * @param {Metric} m
   * @param {Day} d
   * @param {Map<Day, number>} values
   * @returns {JSX.Element}
   */
  const cell = (m, d, values) => (
    <DayCell
      key={d.toString()}
      metric={m}
      day={d}
      today={today}
      value={values.get(d) ?? null}
      points={points.get(m.id)?.get(d) ?? null}
      selected={editing === metricDayKey(m.id, d)}
      enabled={!(busy && m instanceof YesNoMetric)}
      countInput={m instanceof NumberMetric && m.isCount ? countInput : null}
      onAdd={(sign) => {
        if (m instanceof NumberMetric) latestOnCount.current(m, d, { delta: sign * m.step });
      }}
      onClick={() => click(m, d, values)}
    />
  );

  /**
   * The editor of a `number` metric. An empty day starts at the value of the nearest other day.
   * @param {NumberMetric} m
   * @param {Day} d
   * @param {Map<Day, number>} values
   * @returns {JSX.Element}
   */
  const editor = (m, d, values) => {
    const near = nearestDay(values.keys(), d);
    return (
      <NumberEditor
        key={`${m.id} ${d}`}
        metric={m}
        label={`${m.name} · ${d === today ? 'today' : shortDay(d)}`}
        current={values.get(d) ?? null}
        start={near == null ? null : (values.get(near) ?? null)}
        busy={busy}
        onCommit={(value) => onRecord(m, d, value)}
        onClose={() => setEditing(null)}
      />
    );
  };

  /**
   * The editor of `m` if it is open.
   * @param {Metric} m
   * @param {Map<Day, number>} values
   * @returns {JSX.Element | null}
   */
  const openEditor = (m, values) =>
    m instanceof NumberMetric && open != null && open.metricId === m.id ? editor(m, open.day, values) : null;

  // Today is not over: without a value on today, today has no score yet.
  const todayOpen = !metrics.some((m) => valuesById.get(m.id)?.has(today));
  /**
   * @param {Day} d
   * @returns {number | null}
   */
  const scoreOf = (d) => (d === today && todayOpen ? null : (scores?.get(d) ?? null));

  if (layout === DayLayout.CALENDARS) {
    const columns =
      calendarColumns == null ? null : { gridTemplateColumns: `repeat(${calendarColumns}, minmax(0, 1fr))` };
    return (
      <div class="habit-calendars" style={columns ?? undefined}>
        {scores != null && (
          <AppCard class="habit-calendar">
            <div class="habit-calendar-head">
              <ScoreName title={scoreTitle} onScore={onScore} withUnit={false} />
              <p class="habit-calendar-text body-small">
                The score of each day, in % of the points. More points give a stronger color.
              </p>
            </div>
            <MonthGrid days={days} cell={(d) => <ScoreCell day={d} today={today} score={scoreOf(d)} />} />
          </AppCard>
        )}
        {metrics.map((m) => {
          const values = /** @type {Map<Day, number>} */ (valuesById.get(m.id));
          return (
            <AppCard key={m.id} class="habit-calendar">
              {showsTitle && <MetricName metric={m} onOpen={onOpen} withGoal />}
              <MonthGrid days={days} cell={(d) => cell(m, d, values)} />
              {calendarExtra?.(m, values)}
              {openEditor(m, values)}
            </AppCard>
          );
        })}
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
                const values = /** @type {Map<Day, number>} */ (valuesById.get(m.id));
                const shownEditor = openEditor(m, values);
                return (
                  <Fragment key={m.id}>
                    <tr class="habit-table-row">
                      <th scope="row" class="habit-table-name">
                        <MetricName metric={m} onOpen={onOpen} withGoal={withGoal} />
                      </th>
                      {days.map((d) => (
                        <td key={d.toString()}>{cell(m, d, values)}</td>
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
 * The name of the score at the start of the score bars and on the score calendar. With `withUnit`, the unit of the
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
 * The bar of the score of a day, with the score above it. No score: no bar.
 * @param {object} props
 * @param {Day} props.day
 * @param {number | null} props.score From 0 to 100.
 * @returns {JSX.Element}
 */
function ScoreBar({ day, score }) {
  if (score == null) return <div class="score-bar-box" />;
  const text = `${shortDay(day)}: score ${formatNumber(score)}%`;
  return (
    <div class="score-bar-box" role="img" title={text} aria-label={text}>
      <span class="score-bar-value label-medium">{formatNumber(score)}</span>
      <span class="score-bar" style={{ blockSize: `${Math.max(2, Math.round((score / 100) * BAR_HEIGHT))}px` }} />
    </div>
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
 * The colors of the day cells: no value, 0 points, some points, 1 point.
 * @returns {JSX.Element}
 */
export function CellLegend() {
  return (
    <ul class="cell-legend" aria-label="Cell colors">
      <li class="cell-legend-item">
        <span class="cell-swatch day-cell-none" />
        No value
      </li>
      <li class="cell-legend-item">
        <span class="cell-swatch day-cell-value" style={{ '--cell-fill': 0 }} />0 points
      </li>
      <li class="cell-legend-item">
        <span class="cell-swatch day-cell-value" style={{ '--cell-fill': 0.4 }} />
        Some points
      </li>
      <li class="cell-legend-item">
        <span class="cell-swatch day-cell-value" style={{ '--cell-fill': 1 }} />1 point
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
