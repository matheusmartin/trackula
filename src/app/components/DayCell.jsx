import { cellFill, isFullCell } from '../../model/CellFill.js';
import { formatCompact, formatNumber, formatPoints, formatValue, shortDay } from '../../model/Format.js';
import { metricDayKey } from '../../model/LogEntry.js';
import { GoalMark, NumberMetric, YesNoMetric, goalMark } from '../../model/Metric.js';
import { countInputProps } from './CountInputModifier.js';
import './DayCell.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { MetricDay } from '../../model/LogEntry.js' */
/** @import { Metric } from '../../model/Metric.js' */
/** @import { CountInput } from '../../services/CountInput.js' */

/**
 * The day cell of a metric: its fill shows the points of the day. See "Day cell" in docs/design.md.
 *
 * - No value: no fill, a thin border.
 * - A value: the grey cell color, with the brand gradient on it. More points give a stronger gradient, and only 1
 *   point gives the full gradient. A value over a limit has 0 points.
 * - A day after today: no cell.
 *
 * A number or count cell shows its value. A yes/no cell has no text. The tooltip and the name for screen readers give
 * the metric, the day, the value and the points. With `countInput`, the cell is a count cell: it is not disabled during
 * a write, because taps queue and show at once. The cell of the open editor has a ring around it. With `showsDay`, the
 * day number is above the value, for a month calendar.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {Day} props.day
 * @param {Day} props.today
 * @param {number | null} props.value For a yes/no metric: 1 for `yes` and 0 for `no`. Null: no value.
 * @param {number | null} props.points The points of the day, from 0 to 1. Null: the points of `value`.
 * @param {boolean} props.selected
 * @param {boolean} props.enabled
 * @param {CountInput<MetricDay> | null} props.countInput
 * @param {(sign: number) => void} props.onAdd
 * @param {() => void} props.onClick
 * @param {boolean} [props.showsDay] Default: false.
 * @returns {JSX.Element}
 */
export function DayCell({
  metric,
  day,
  today,
  value,
  points,
  selected,
  enabled,
  countInput,
  onAdd,
  onClick,
  showsDay = false,
}) {
  if (day.isAfter(today)) return <span class="day-cell day-cell-after" aria-hidden="true" />;
  const shown = value == null ? null : (points ?? pointsOfValue(metric, value));
  const description = `${metric.name}, ${shortDay(day)}: ${valueText(metric, value, shown)}${hint(metric)}`;
  const classes = [
    'day-cell',
    ...fillClasses(shown),
    selected ? 'day-cell-selected' : null,
    showsDay ? 'day-cell-with-day' : null,
  ].filter(Boolean);
  const text = metric instanceof NumberMetric && value != null ? formatCompact(value) : null;
  const input = countInput == null ? { onClick } : countInputProps(countInput, metricDayKey(metric.id, day), onAdd);
  return (
    <button
      type="button"
      class={classes.join(' ')}
      style={shown == null ? undefined : { '--cell-fill': cellFill(shown) }}
      disabled={!enabled}
      title={description}
      aria-label={description}
      {...input}
    >
      {showsDay && (
        <span class="day-cell-day" aria-hidden="true">
          {day.day}
        </span>
      )}
      {text}
    </button>
  );
}

/**
 * The read-only day cell of the score: the same fill as a metric cell, from the score of the day (0 to 100). It shows
 * the score. A day without a score has only a border. A day after today has no cell. With `showsDay`, the day number
 * is above the score, for a month calendar.
 * @param {object} props
 * @param {Day} props.day
 * @param {Day} props.today
 * @param {number | null} props.score
 * @param {boolean} [props.showsDay] Default: false.
 * @returns {JSX.Element}
 */
export function ScoreCell({ day, today, score, showsDay = false }) {
  if (day.isAfter(today)) return <span class="day-cell day-cell-after" aria-hidden="true" />;
  const points = score == null ? null : score / 100;
  const description = `${shortDay(day)}: ${score == null ? 'no score' : `score ${formatNumber(score)}%`}`;
  return (
    <span
      class={['day-cell', ...fillClasses(points), showsDay ? 'day-cell-with-day' : null].filter(Boolean).join(' ')}
      style={points == null ? undefined : { '--cell-fill': cellFill(points) }}
      role="img"
      title={description}
      aria-label={description}
    >
      {showsDay && (
        <span class="day-cell-day" aria-hidden="true">
          {day.day}
        </span>
      )}
      {score == null ? null : formatNumber(score)}
    </span>
  );
}

/**
 * The classes of the fill of a cell with `points`. Null: no value.
 * @param {number | null} points
 * @returns {(string | null)[]}
 */
function fillClasses(points) {
  if (points == null) return ['day-cell-none'];
  return ['day-cell-value', isFullCell(points) ? 'day-cell-full' : null];
}

/**
 * The points of `value` without the score: 1 if the value reaches the goal, else the part of the way to the target.
 * A value over a limit gives 0.
 * @param {Metric} metric
 * @param {number} value
 * @returns {number}
 */
function pointsOfValue(metric, value) {
  if (metric instanceof YesNoMetric) return (value === 1) === metric.goalIsYes ? 1 : 0;
  return metric.goal.points(value);
}

/**
 * The value and the points in the cell description. Examples: "5 glasses, 0.6 points", "3 cups, over the limit",
 * "no value".
 * @param {Metric} metric
 * @param {number | null} value
 * @param {number | null} points
 * @returns {string}
 */
function valueText(metric, value, points) {
  if (value == null || points == null) return 'no value';
  const text =
    metric instanceof YesNoMetric ? (value === 1 ? 'yes' : 'no') : formatValue(value, metric.step, metric.unit);
  return goalMark(metric, value) === GoalMark.OVER_LIMIT
    ? `${text}, over the limit`
    : `${text}, ${formatPoints(points)}`;
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
