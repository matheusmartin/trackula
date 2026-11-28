import { useMemo, useRef } from 'preact/hooks';
import { cellFill, isFullCell } from '../../model/CellFill.js';
import { formatNumber, formatPoints, withUnit } from '../../model/Format.js';
import { GoalMark, NumberMetric, YesNoMetric, goalMark } from '../../model/Metric.js';
import { goalSummary } from '../../model/MetricDraft.js';
import { formatStep } from '../../model/NumberInput.js';
import { dayValues, nearestDay } from '../../model/Summary.js';
import { countInputProps, useCountInput } from './CountInputModifier.js';
import { useElementWidth } from './ElementWidth.js';
import { MetricIcon } from './MetricIcon.jsx';
import { NumberEditor } from './NumberEditor.jsx';
import { WIDE_CONTENT } from './Sizes.js';
import { Symbol } from './Symbol.jsx';
import './TodayTiles.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { CountStep, LogTable, MetricDay } from '../../model/LogEntry.js' */
/** @import { Metric } from '../../model/Metric.js' */

/**
 * Today input mode: one tile for each metric, for today only. The fewest taps for each input. Each input goes to the
 * sheet at once, as on the other screens: there is no Save button.
 *
 * - Yes/no: a tap on the tile sets done. A second tap sets `no`.
 * - Count: as the table cells. See `CountInput`.
 * - Number: a full-width tile with the ruler of the {@link NumberEditor}. An empty day starts at the latest earlier
 *   value. The value goes to the sheet when the user releases the ruler, presses Enter or leaves the tile.
 *
 * The fill of a yes/no or count tile shows the points of today, as a day cell (see "Day cell" in docs/design.md): no
 * value is a thin outline, 0 points is grey, more points give a stronger brand gradient, and 1 point is the full
 * gradient with white text. A number tile is a measurement: it has no fill of points. A yes/no or count tile also shows
 * the mark of its goal: a check mark for a target that it reaches (`yes`, `at least`), a warning sign for a limit that
 * it goes over (`no`, `at most`). See `goalMark`. A yes/no tile that is not done shows an empty circle, so that it shows
 * as a toggle. A count tile shows the target below its counter.
 *
 * The tiles keep the order of the metrics. Each run of number tiles is one grid: 1 column on phones, 2 on wider
 * screens. Each run of the other tiles is one grid: 2 columns on phones, and as many columns of 160 px or more as fit
 * on wider screens (4 to 6).
 * @param {object} props
 * @param {Metric[]} props.metrics
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {boolean} props.busy
 * @param {(metric: Metric, day: Day, value: number | null) => void} props.onRecord Sets the value of today: 1 or 0 for a
 *   yes/no metric. Null clears the day.
 * @param {(metric: NumberMetric, day: Day, step: CountStep) => void} props.onCount Adds a count tap.
 * @param {Map<MetricDay, CountStep[]>} props.pending Count taps that are not written yet. The tiles show them.
 * @param {Map<string, Map<Day, number>>} props.points The points of each metric by day, by metric id. See
 *   `pointsByMetric`.
 * @returns {JSX.Element}
 */
export function TodayTiles({ metrics, log, today, busy, onRecord, onCount, pending, points }) {
  const countInput = useCountInput();
  const [measure, width] = useElementWidth();
  const valuesById = useMemo(
    () => new Map(metrics.map((m) => [m.id, dayValues(m, log, pending)])),
    [metrics, log, pending],
  );
  // The latest count function: a touch tap runs after the double-tap wait.
  const latestOnCount = useRef(onCount);
  latestOnCount.current = onCount;

  /**
   * True if the tile of `m` takes a full row: the tile of a number metric, with a ruler.
   * @param {Metric} m
   * @returns {boolean}
   */
  const isWide = (m) => m instanceof NumberMetric && !m.isCount;

  /**
   * The tile of `m`.
   * @param {Metric} m
   * @returns {JSX.Element}
   */
  function tile(m) {
    const dayValuesOfMetric = /** @type {Map<Day, number>} */ (valuesById.get(m.id));
    const value = dayValuesOfMetric.get(today) ?? null;
    // The points of today: only for a value. A goal `at most` gives points also to a day without a value.
    const todayPoints = value == null ? null : (points.get(m.id)?.get(today) ?? 0);
    if (m instanceof YesNoMetric) {
      return (
        <YesNoTile
          key={m.id}
          metric={m}
          value={value}
          points={todayPoints}
          // A second tap during the write would read the old value: it waits, as a table cell does.
          enabled={!busy}
          onClick={() => onRecord(m, today, value === 1 ? 0 : 1)}
        />
      );
    }
    if (m.isCount) {
      /**
       * Adds a step to the value (+1) or subtracts it (−1).
       * @param {number} sign
       * @returns {void}
       */
      const add = (sign) => latestOnCount.current(m, today, { delta: sign * m.step });
      return (
        <CountTile
          key={m.id}
          metric={m}
          value={value}
          points={todayPoints}
          input={countInputProps(countInput, m.id, add)}
        />
      );
    }
    const near = nearestDay(dayValuesOfMetric.keys(), today);
    return (
      // A number is a measurement: its tile has no mark. A trend goal does not use the value of the day.
      <div key={m.id} class={value == null ? 'tile tile-number' : 'tile tile-number tile-number-filled'}>
        <div class="tile-head">
          <MetricIcon icon={m.icon} />
          <TileName metric={m} />
        </div>
        <NumberEditor
          key={`${m.id} ${today}`}
          metric={m}
          label={`${m.name} · today`}
          current={value}
          start={near == null ? null : (dayValuesOfMetric.get(near) ?? null)}
          busy={busy}
          onCommit={(v) => onRecord(m, today, v)}
          autofocus={false}
          compact
        />
      </div>
    );
  }

  // The runs of metrics with tiles of the same kind, in the order of the metrics.
  /** @type {{ wide: boolean, metrics: Metric[] }[]} */
  const runs = [];
  for (const m of metrics) {
    const last = runs[runs.length - 1];
    if (last != null && last.wide === isWide(m)) last.metrics.push(m);
    else runs.push({ wide: isWide(m), metrics: [m] });
  }
  return (
    <div ref={measure} class={width >= WIDE_CONTENT ? 'today-tiles today-tiles-wide' : 'today-tiles'}>
      {runs.map((run) => (
        <div key={run.metrics[0].id} class={run.wide ? 'today-tiles-numbers' : 'today-tiles-grid'}>
          {run.metrics.map(tile)}
        </div>
      ))}
    </div>
  );
}

/**
 * The classes and the style of a tile with `points` of today, as a day cell: a thin outline without a value, the grey
 * cell color with the brand gradient at the opacity of the points, and white text for 1 point.
 * @param {number | null} points Null: no value.
 * @param {string} kind
 * @returns {{ class: string, style: Record<string, number> | undefined }}
 */
function tileFill(points, kind) {
  if (points == null) return { class: `tile ${kind}`, style: undefined };
  return {
    class: ['tile', kind, 'tile-value', isFullCell(points) ? 'tile-full' : null].filter(Boolean).join(' '),
    style: { '--cell-fill': cellFill(points) },
  };
}

/**
 * The icon of `mark`: a check mark for `REACHED`, a warning sign for `OVER_LIMIT`.
 * @param {object} props
 * @param {GoalMark} props.mark
 * @returns {JSX.Element | null}
 */
function Mark({ mark }) {
  if (mark === GoalMark.REACHED) return <Symbol name="check_circle" />;
  if (mark === GoalMark.OVER_LIMIT) return <Symbol name="warning" />;
  return null;
}

/**
 * The text of `mark` for screen readers, after the value. Empty for `NONE`. Examples: ", goal reached", ", over the
 * limit of the goal at most 2".
 * @param {Metric} m
 * @param {GoalMark} mark
 * @returns {string}
 */
function markText(m, mark) {
  if (mark === GoalMark.REACHED) return ', goal reached';
  if (mark === GoalMark.OVER_LIMIT) return `, over the limit of the goal ${goalSummary(m)}`;
  return '';
}

/**
 * The name of `metric` in a tile: at most 2 lines.
 * @param {object} props
 * @param {Metric} props.metric
 * @returns {JSX.Element}
 */
function TileName({ metric }) {
  return <span class="tile-name">{metric.name}</span>;
}

/**
 * A yes/no tile: a checkbox. A tap marks it done. A done tile shows the mark of the goal, else an empty circle. Over
 * the limit of the goal `no`, the tooltip and screen readers say the limit. The fill shows the points of today.
 * @param {object} props
 * @param {YesNoMetric} props.metric
 * @param {number | null} props.value
 * @param {number | null} props.points
 * @param {boolean} props.enabled
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function YesNoTile({ metric, value, points, enabled, onClick }) {
  const done = value === 1;
  const mark = goalMark(metric, value);
  const fill = tileFill(points, 'tile-button');
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      class={fill.class}
      style={fill.style}
      disabled={!enabled}
      title={
        value == null ? undefined : `${done ? 'Yes' : 'No'}${markText(metric, mark)}, ${formatPoints(points ?? 0)}`
      }
      onClick={onClick}
    >
      <span class="tile-top">
        <MetricIcon icon={metric.icon} />
        {/* Not done: an empty circle shows that a tap marks the tile. */}
        {done ? <Mark mark={mark} /> : <Symbol name="radio_button_unchecked" color="var(--outline)" />}
      </span>
      <TileName metric={metric} />
    </button>
  );
}

/**
 * The target of a count tile, below its counter: "of 8 glasses" for the goal `at least`, "max 2 glasses" for the goal
 * `at most`.
 * @param {NumberMetric} m
 * @returns {string}
 */
function targetText(m) {
  const target = withUnit(formatNumber(m.goal.target, 3), m.unit);
  return m.goal.isMaximum ? `max ${target}` : `of ${target}`;
}

/**
 * A tile with a counter: the value of today, 0 when empty, with the {@link Mark} and the target of the goal, in the top
 * right corner. Its tooltip has the value, the points and the inputs. The fill shows the points of today.
 * @param {object} props
 * @param {NumberMetric} props.metric
 * @param {number | null} props.value
 * @param {number | null} props.points
 * @param {ReturnType<typeof countInputProps>} props.input
 * @returns {JSX.Element}
 */
function CountTile({ metric, value, points, input }) {
  const step = formatStep(metric.step, metric.step);
  const counter = value == null ? '0' : formatStep(value, metric.step);
  const mark = goalMark(metric, value);
  const fill = tileFill(points, 'tile-button tile-count');
  const pointsText = points == null ? '' : `, ${formatPoints(points)}`;
  return (
    <button
      type="button"
      class={fill.class}
      style={fill.style}
      aria-label={metric.name}
      title={`${counter}${markText(metric, mark)}${pointsText}. Tap or click: +${step}. Double-tap or right-click: −${step}.`}
      {...input}
    >
      <span class="tile-top">
        <MetricIcon icon={metric.icon} />
        <span class="tile-goal">
          <span class="tile-counter-row">
            <Mark mark={mark} />
            <span class="tile-counter">{counter}</span>
          </span>
          <span class="tile-target">{targetText(metric)}</span>
        </span>
      </span>
      <TileName metric={metric} />
    </button>
  );
}
