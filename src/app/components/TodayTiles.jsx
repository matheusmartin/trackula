import { useMemo, useRef } from 'preact/hooks';
import { formatNumber, withUnit } from '../../model/Format.js';
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
import { tileRows } from './TileRows.js';
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
 * A tile with a value has the soft app color. A tile without a value has a thin outline. A yes/no or count tile also
 * shows the mark of its goal: a check mark for a target that it reaches (`yes`, `at least`), a warning sign for a limit
 * that it goes over (`no`, `at most`). See `goalMark`. A yes/no tile that is not done shows an empty circle, so that it
 * shows as a toggle. A count tile shows the target below its counter. Phones: 2 columns. Wider screens: 4 columns.
 * Number tiles take a full row.
 * @param {object} props
 * @param {Metric[]} props.metrics
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {boolean} props.busy
 * @param {(metric: Metric, day: Day, value: number | null) => void} props.onRecord Sets the value of today: 1 or 0 for a
 *   yes/no metric. Null clears the day.
 * @param {(metric: NumberMetric, day: Day, step: CountStep) => void} props.onCount Adds a count tap.
 * @param {Map<MetricDay, CountStep[]>} props.pending Count taps that are not written yet. The tiles show them.
 * @returns {JSX.Element}
 */
export function TodayTiles({ metrics, log, today, busy, onRecord, onCount, pending }) {
  const countInput = useCountInput();
  const [measure, width] = useElementWidth();
  const valuesById = useMemo(
    () => new Map(metrics.map((m) => [m.id, dayValues(m, log, pending)])),
    [metrics, log, pending],
  );
  // The latest count function: a touch tap runs after the double-tap wait.
  const latestOnCount = useRef(onCount);
  latestOnCount.current = onCount;

  const columns = width >= WIDE_CONTENT ? 4 : 2;
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
    if (m instanceof YesNoMetric) {
      return (
        <YesNoTile
          key={m.id}
          metric={m}
          value={value}
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
      return <CountTile key={m.id} metric={m} value={value} input={countInputProps(countInput, m.id, add)} />;
    }
    const near = nearestDay(dayValuesOfMetric.keys(), today);
    return (
      // A number is a measurement: its tile has no mark. A trend goal does not use the value of the day.
      <div key={m.id} class={tileClass(value != null, 'tile-wide')}>
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

  return (
    <div class="today-tiles">
      <div ref={measure} class="today-tiles-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {/* The order of the rows, so that the keyboard focus goes in the order of the screen. */}
        {tileRows(metrics, columns, isWide)
          .flat()
          .map((i) => tile(metrics[i]))}
      </div>
    </div>
  );
}

/**
 * The classes of a tile: in the soft app color when `filled`. A tile that is not filled has a thin outline, so that it
 * shows on the page. The fill color changes smoothly. The {@link Mark} shows the goal.
 * @param {boolean} filled
 * @param {string} kind
 * @returns {string}
 */
function tileClass(filled, kind) {
  return ['tile', kind, filled ? 'tile-filled' : null].filter(Boolean).join(' ');
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
 * the limit of the goal `no`, the tooltip and screen readers say the limit.
 * @param {object} props
 * @param {YesNoMetric} props.metric
 * @param {number | null} props.value
 * @param {boolean} props.enabled
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function YesNoTile({ metric, value, enabled, onClick }) {
  const done = value === 1;
  const mark = goalMark(metric, value);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      class={tileClass(done, 'tile-button')}
      disabled={!enabled}
      title={done ? `Yes${markText(metric, mark)}` : undefined}
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
 * right corner. Its tooltip has the value and the inputs.
 * @param {object} props
 * @param {NumberMetric} props.metric
 * @param {number | null} props.value
 * @param {ReturnType<typeof countInputProps>} props.input
 * @returns {JSX.Element}
 */
function CountTile({ metric, value, input }) {
  const step = formatStep(metric.step, metric.step);
  const counter = value == null ? '0' : formatStep(value, metric.step);
  const mark = goalMark(metric, value);
  return (
    <button
      type="button"
      class={tileClass(value != null, 'tile-button tile-count')}
      aria-label={metric.name}
      title={`${counter}${markText(metric, mark)}. Tap or click: +${step}. Double-tap or right-click: −${step}.`}
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
