import { Fragment } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { formatCompact, formatNumber, weekdayNames, weekLabels, withUnit } from '../../model/Format.js';
import { weekRows } from '../../model/Day.js';
import { metricDayKey, parseMetricDay, planClear, planNumber, planYesNo } from '../../model/LogEntry.js';
import { DayLayout, tableDayCount } from '../../model/MainView.js';
import { NumberMetric, YesNoMetric } from '../../model/Metric.js';
import { dayValues, nearestDay } from '../../model/Summary.js';
import { AppCard } from './AppCard.jsx';
import { countInputProps, useCountInput } from './CountInputModifier.js';
import { useElementWidth } from './ElementWidth.js';
import { MetricIcon } from './MetricIcon.jsx';
import { NumberEditor } from './NumberEditor.jsx';
import { outset } from './Outset.js';
import './HabitTable.css';

/** @import { ComponentChildren, JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { CountStep, LogTable, LogWrite, MetricDay } from '../../model/LogEntry.js' */
/** @import { DayLayout as Layout } from '../../model/MainView.js' */
/** @import { Metric } from '../../model/Metric.js' */
/** @import { CountInput } from '../../services/CountInput.js' */

/** The smallest and the largest size of a table cell, and the space between two cells, in CSS pixels. */
const MIN_CELL = 28;
const MAX_CELL = 36;
const CELL_GAP = 4;

/** The width of the name column that the cell size leaves when the window allows it. */
const NAME_WIDTH = 136;

/** The largest width of a window that the table gives smaller paddings: a phone. */
const NARROW = 480;

/** The space around the table, in CSS pixels. */
const TABLE_PADDING = 8;

/**
 * The number of days that a table of `width` CSS pixels holds with cells of the largest size: 5 on a phone, up to 14
 * on a wide screen. See `tableDayCount`.
 * @param {number} width
 * @returns {number}
 */
export function tableDays(width) {
  return tableDayCount(width - TABLE_PADDING, NAME_WIDTH, MAX_CELL + CELL_GAP);
}

/**
 * HabitKit-style input table: one row per metric, one column per day, today on the right.
 *
 * - Yes/no: a cell click writes `yes`, or `no` if the day is `yes`. A `no` day shows like an empty day.
 * - Count: see `CountInput`. A count has no reset: it goes to empty with subtractions.
 * - Number: a cell click opens the {@link NumberEditor} for that metric and day, below the metric. A second click
 *   closes it.
 *
 * The table cells are as large as the width allows, from 28 px to 36 px, and each row is 48 px high or more. So the
 * days and a name column of 136 px fit a phone without a side scroll.
 * @param {object} props
 * @param {Metric[]} props.metrics
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {Day[]} props.days The days of the table or of the calendars, oldest first.
 * @param {Layout} props.layout
 * @param {boolean} props.busy
 * @param {(plan: (log: LogTable) => LogWrite | null) => void} props.onWrite
 * @param {Map<MetricDay, CountStep[]>} props.pending Count taps that are not written yet. The table shows them at once.
 * @param {(metric: NumberMetric, day: Day, step: CountStep) => void} props.onCount
 * @param {((metric: Metric) => void) | null} [props.onOpen] Opens the detail screen of a metric. Null: the metric names
 *   are not links.
 * @param {boolean} [props.showsTitle] True if each calendar shows the metric name. Default: true.
 * @param {((metric: Metric, values: Map<Day, number>) => ComponentChildren) | null} [props.calendarExtra] More content
 *   below each calendar, for example a chart of the metric. The table has none.
 * @param {number | null} [props.calendarColumns] A fixed number of calendar columns. Null: as many as fit, each at
 *   least 280 px wide.
 * @param {number} [props.calendarCellSize] The size of a calendar cell. The detail screen has larger cells than the
 *   Today page. Default: 26.
 * @returns {JSX.Element}
 */
export function HabitTable({
  metrics,
  log,
  today,
  days,
  layout,
  busy,
  onWrite,
  pending,
  onCount,
  onOpen = null,
  showsTitle = true,
  calendarExtra = null,
  calendarColumns = null,
  calendarCellSize = 26,
}) {
  // The metric and day open in the editor.
  const [editing, setEditing] = useState(/** @type {MetricDay | null} */ (null));
  const countInput = useCountInput();
  const [measure, width] = useElementWidth();
  // The latest count function: a touch tap runs after a wait.
  const latestOnCount = useRef(onCount);
  latestOnCount.current = onCount;
  const valuesById = useMemo(
    () => new Map(metrics.map((m) => [m.id, dayValues(m, log, pending)])),
    [metrics, log, pending],
  );
  const open = editing == null ? null : parseMetricDay(editing);

  /**
   * @param {Metric} m
   * @param {Day} d
   * @param {Map<Day, number>} values
   */
  function click(m, d, values) {
    if (m instanceof YesNoMetric) {
      onWrite((l) => planYesNo(m, d, l, !values.has(d)));
    } else if (!m.isCount) {
      const cell = metricDayKey(m.id, d);
      setEditing(editing === cell ? null : cell);
    }
  }

  /**
   * @param {Metric} m
   * @param {Day} d
   * @param {Map<Day, number>} values
   * @param {number} size
   * @returns {JSX.Element}
   */
  const cell = (m, d, values, size) => (
    <DayCell
      key={d.toString()}
      metric={m}
      day={d}
      today={today}
      value={values.get(d) ?? null}
      selected={editing === metricDayKey(m.id, d)}
      enabled={!(busy && m instanceof YesNoMetric)}
      size={size}
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
        label={`${m.name} · ${d === today ? 'today' : d}`}
        current={values.get(d) ?? null}
        start={near == null ? null : (values.get(near) ?? null)}
        busy={busy}
        onSave={(value) => {
          onWrite((l) => planNumber(m, d, value, l));
          setEditing(null);
        }}
        onClear={() => {
          onWrite((l) => planClear(m, d, l));
          setEditing(null);
        }}
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

  if (layout === DayLayout.CALENDARS) {
    const columns =
      calendarColumns == null ? null : { gridTemplateColumns: `repeat(${calendarColumns}, minmax(0, 1fr))` };
    return (
      <div class="habit-calendars" style={columns ?? undefined}>
        {metrics.map((m) => {
          const values = /** @type {Map<Day, number>} */ (valuesById.get(m.id));
          return (
            <AppCard key={m.id} class="habit-calendar">
              {showsTitle && <MetricName metric={m} onOpen={onOpen} />}
              <MonthGrid days={days} cell={(d) => cell(m, d, values, calendarCellSize)} />
              {calendarExtra?.(m, values)}
              {openEditor(m, values)}
            </AppCard>
          );
        })}
      </div>
    );
  }

  // Phones: smaller cells, so that the days and the metric names fit without scrolling. Whole pixels, so that the
  // cells keep sharp edges.
  const narrow = width <= NARROW;
  const fitting = Math.trunc((width - TABLE_PADDING - NAME_WIDTH) / days.length - CELL_GAP);
  const cellSize = Math.min(MAX_CELL, Math.max(MIN_CELL, fitting));
  const columnWidth = cellSize + CELL_GAP;
  // The name column takes the space that the day columns leave, but at least 120 px: the table scrolls sideways on
  // very narrow screens.
  const nameWidth = Math.max(120, width - columnWidth * days.length - TABLE_PADDING);
  const rowWidth = nameWidth + columnWidth * days.length;
  return (
    <div ref={measure} class="habit-table-box">
      <AppCard class="habit-table-card">
        <table class="habit-table" style={{ inlineSize: `${rowWidth}px` }}>
          <colgroup>
            <col style={{ inlineSize: `${nameWidth}px` }} />
            {days.map((d) => (
              <col key={d.toString()} style={{ inlineSize: `${columnWidth}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <td />
              {days.map((d) => (
                <DayHeader key={d.toString()} day={d} isToday={d === today} />
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
                    <th scope="row" class={narrow ? 'habit-table-name habit-table-name-narrow' : 'habit-table-name'}>
                      <MetricName metric={m} onOpen={onOpen} />
                    </th>
                    {days.map((d) => (
                      <td key={d.toString()}>{cell(m, d, values, cellSize)}</td>
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
      </AppCard>
    </div>
  );
}

/**
 * The weekday and the day number of a table column. Today is bold, in the app color.
 * @param {object} props
 * @param {Day} props.day
 * @param {boolean} props.isToday
 * @returns {JSX.Element}
 */
function DayHeader({ day, isToday }) {
  return (
    <th scope="col" class={isToday ? 'day-header day-header-today' : 'day-header'}>
      <span class="day-header-weekday">{weekdayNames[day.weekday - 1]}</span>
      <span class="day-header-day">{day.day}</span>
    </th>
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
 * The icon and the name of `metric`. With `onOpen`, a link to its detail screen.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {((metric: Metric) => void) | null} [props.onOpen] Null: the name is not a link.
 * @returns {JSX.Element}
 */
export function MetricName({ metric, onOpen = null }) {
  const content = (
    <>
      <MetricIcon icon={metric.icon} />
      <span class="metric-name-text">{metric.name}</span>
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

/**
 * A day cell. A cell with a value has one fixed color, whatever the value: the logo gradient. A cell without a value
 * has the empty color and a thin border, so that it shows as a cell on the card. A day after today has only a thin
 * outline and does nothing. Today has a ring in the cell. The cell of the open editor and the cell with the keyboard
 * focus have a ring around the cell: it does not change the size of the cell.
 *
 * With `countInput`, the cell is a count cell: it is not disabled during a write, because taps queue and show at once.
 * Each cell has a tooltip with the metric, the day and the value.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {Day} props.day
 * @param {Day} props.today
 * @param {number | null} props.value
 * @param {boolean} props.selected
 * @param {boolean} props.enabled
 * @param {number} props.size The width and the height, in CSS pixels.
 * @param {CountInput<MetricDay> | null} props.countInput
 * @param {(sign: number) => void} props.onAdd
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
export function DayCell({ metric, day, today, value, selected, enabled, size, countInput, onAdd, onClick }) {
  const style = { '--cell-size': `${size}px` };
  if (day.isAfter(today)) {
    return <span class="day-cell day-cell-future" style={style} role="img" aria-label={`${day}`} title={`${day}`} />;
  }
  const description = `${metric.name}, ${day}${valueText(metric, value)}${hint(metric)}`;
  const classes = [
    'day-cell',
    value != null ? 'day-cell-filled' : null,
    day === today ? 'day-cell-today' : null,
    selected ? 'day-cell-selected' : null,
  ].filter(Boolean);
  const input = countInput == null ? { onClick } : countInputProps(countInput, metricDayKey(metric.id, day), onAdd);
  return (
    <button
      type="button"
      class={classes.join(' ')}
      style={style}
      disabled={!enabled}
      title={description}
      aria-label={description}
      {...input}
    >
      {/* No letter spacing and no wrap: 4 characters such as "82.6" fit the smallest cell. */}
      {metric instanceof NumberMetric && value != null ? formatCompact(value) : null}
    </button>
  );
}

/**
 * The input help in the cell description of count metrics.
 * @param {Metric} m
 * @returns {string}
 */
function hint(m) {
  if (!(m instanceof NumberMetric) || !m.isCount) return '';
  const step = formatNumber(m.step, 3);
  return ` · Click or tap: +${step}. Right-click or double-tap: −${step}.`;
}

/**
 * The value part of the cell description. Example: ": 82.1 kg".
 * @param {Metric} m
 * @param {number | null} v
 * @returns {string}
 */
function valueText(m, v) {
  if (v == null) return '';
  if (m instanceof YesNoMetric) return ': yes';
  return `: ${withUnit(formatNumber(v, 3), m.unit)}`;
}
