import { useMemo, useRef, useState } from 'preact/hooks';
import { shortDay } from '../../model/Format.js';
import { metricDayKey, parseMetricDay } from '../../model/LogEntry.js';
import { NumberMetric, YesNoMetric } from '../../model/Metric.js';
import { pointsByMetric } from '../../model/Score.js';
import { metricValues, nearestDay } from '../../model/Summary.js';
import { useCountInput } from './CountInputModifier.js';
import { DayCell } from './DayCell.jsx';
import { NumberEditor } from './NumberEditor.jsx';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { CountStep, LogTable, MetricDay } from '../../model/LogEntry.js' */
/** @import { Metric } from '../../model/Metric.js' */

/**
 * The day cells of some metrics, with their inputs and their editor. See {@link useDayCells}.
 * @typedef {object} DayCells
 * @property {(metric: Metric) => Map<Day, number>} valuesOf The value of each day of `metric`. For a yes/no metric: 1
 *   for `yes` and 0 for `no`.
 * @property {(metric: Metric, day: Day, showsDay?: boolean) => JSX.Element} cell The cell of `metric` on `day`. With
 *   `showsDay`, the cell also shows the day number.
 * @property {(metric: Metric) => JSX.Element | null} editorOf The open editor of `metric`. Null if it has none.
 * @property {boolean} todayOpen True if no metric has a value on today. Today is not over, so it has no score yet.
 */

/**
 * The day cells of `metrics` and their inputs. The Days screen and the calendar of the detail screen use them.
 *
 * - Yes/no: a click writes `yes`, or `no` if the day is `yes`.
 * - Count: see `CountInput`. A count has no reset: it goes to empty with subtractions.
 * - Number: a click opens the {@link NumberEditor} for that metric and day. A second click closes it. One editor is
 *   open at a time.
 *
 * The cells show the count taps of `pending` at once. The fill of a cell shows the points of the day, as the score
 * has them: a goal with a trend gets its points from the trend.
 * @param {object} props
 * @param {Metric[]} props.metrics
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {boolean} props.busy
 * @param {(metric: Metric, day: Day, value: number | null) => void} props.onRecord Sets the value of a day: 1 or 0 for
 *   a yes/no metric. Null clears the day. See `planValue`.
 * @param {Map<MetricDay, CountStep[]>} props.pending Count taps that are not written yet.
 * @param {(metric: NumberMetric, day: Day, step: CountStep) => void} props.onCount
 * @returns {DayCells}
 */
export function useDayCells({ metrics, log, today, busy, onRecord, pending, onCount }) {
  // The metric and day open in the editor.
  const [editing, setEditing] = useState(/** @type {MetricDay | null} */ (null));
  const countInput = useCountInput();
  // The latest count function: a touch tap runs after a wait.
  const latestOnCount = useRef(onCount);
  latestOnCount.current = onCount;
  // The values of yes/no metrics hold 0 for `no`: a `no` day is a value with 0 points, not an empty day.
  const valuesById = useMemo(
    () => new Map(metrics.map((m) => [m.id, metricValues(m, log, pending)])),
    [metrics, log, pending],
  );
  const points = useMemo(() => pointsByMetric(metrics, log, today, pending), [metrics, log, today, pending]);
  const open = editing == null ? null : parseMetricDay(editing);

  /**
   * @param {Metric} m
   * @returns {Map<Day, number>}
   */
  const valuesOf = (m) => valuesById.get(m.id) ?? new Map();

  /**
   * @param {Metric} m
   * @param {Day} d
   */
  function click(m, d) {
    if (m instanceof YesNoMetric) {
      onRecord(m, d, valuesOf(m).get(d) === 1 ? 0 : 1);
    } else if (!m.isCount) {
      const key = metricDayKey(m.id, d);
      setEditing(editing === key ? null : key);
    }
  }

  /**
   * @param {Metric} m
   * @param {Day} d
   * @param {boolean} [showsDay]
   * @returns {JSX.Element}
   */
  const cell = (m, d, showsDay = false) => (
    <DayCell
      key={d.toString()}
      metric={m}
      day={d}
      today={today}
      value={valuesOf(m).get(d) ?? null}
      points={points.get(m.id)?.get(d) ?? null}
      selected={editing === metricDayKey(m.id, d)}
      enabled={!(busy && m instanceof YesNoMetric)}
      countInput={m instanceof NumberMetric && m.isCount ? countInput : null}
      showsDay={showsDay}
      onAdd={(sign) => {
        if (m instanceof NumberMetric) latestOnCount.current(m, d, { delta: sign * m.step });
      }}
      onClick={() => click(m, d)}
    />
  );

  /**
   * The editor of a `number` metric if it is open. An empty day starts at the value of the nearest other day.
   * @param {Metric} m
   * @returns {JSX.Element | null}
   */
  function editorOf(m) {
    if (!(m instanceof NumberMetric) || open == null || open.metricId !== m.id) return null;
    const d = open.day;
    const values = valuesOf(m);
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
  }

  const todayOpen = !metrics.some((m) => valuesOf(m).has(today));
  return { valuesOf, cell, editorOf, todayOpen };
}
