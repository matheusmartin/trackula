import { useContext, useMemo, useRef, useState } from 'preact/hooks';
import { formatNumber, withUnit } from '../../model/Format.js';
import { applyCountSteps, planClear, planNumber, planYesNo } from '../../model/LogEntry.js';
import { GoalMark, NumberMetric, YesNoMetric, goalMark } from '../../model/Metric.js';
import { goalSummary } from '../../model/MetricDraft.js';
import { formatStep } from '../../model/NumberInput.js';
import { dayValues, nearestDay } from '../../model/Summary.js';
import { ActionBar, LocalActionBarHost } from './ActionBar.jsx';
import { countInputProps, useCountInput } from './CountInputModifier.js';
import { useElementWidth } from './ElementWidth.js';
import { MetricIcon } from './MetricIcon.jsx';
import { NumberEditor } from './NumberEditor.jsx';
import { PrimaryButton } from './PrimaryButton.jsx';
import { WIDE_CONTENT } from './Sizes.js';
import { Symbol } from './Symbol.jsx';
import { tileRows } from './TileRows.js';
import './TodayTiles.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { CountStep, LogTable, MetricDay } from '../../model/LogEntry.js' */
/** @import { Metric } from '../../model/Metric.js' */
/** @import { LogPlan } from '../../sheets/Store.js' */

/**
 * The values of the tiles that are not in the sheet yet, by metric id. Yes/no: 1 for `yes`, 0 for `no`. Null clears
 * the day.
 * @typedef {object} TileValues
 * @property {Map<string, number | null>} drafts Unsaved values.
 * @property {Map<string, number | null>} saving Values that the Save button sends now. The tiles show them until the
 *   write ends.
 */

/**
 * Today input mode: one tile for each metric, for today only. The fewest taps for each input.
 *
 * No tile writes at once. Each input makes the value of its tile unsaved, and the Save button saves all unsaved values
 * in one task. The Save button is the {@link ActionBar} of the page: the App shows it above the bottom navigation bar,
 * and only while there are values to save. Without the App, it shows at the end of the page. Unsaved values are lost
 * when the user leaves the screen. An input that gives the saved value again is not unsaved.
 *
 * - Yes/no: a tap on the tile sets done. A second tap goes back: to empty, or to `no` if the day was saved as `yes`.
 * - Count: as the table cells. See `CountInput`.
 * - Number: a full-width tile with the ruler of the {@link NumberEditor}. An empty day starts at the latest earlier
 *   value. A drag, a typed value, or a press on the ruler (to confirm the same value) makes the value unsaved.
 *
 * A tile with a value (saved or not) has the soft app color. A tile without a value has a thin outline. A yes/no or
 * count tile also shows the mark of its goal: a check mark for a target that it reaches (`yes`, `at least`), a warning
 * sign for a limit that it goes over (`no`, `at most`). See `goalMark`. A yes/no tile that is not done shows an empty
 * circle, so that it shows as a toggle. A count tile shows the target below its counter. An unsaved tile has a frame
 * of the app color. Phones: 2 columns. Wider screens: 4 columns. Number tiles take a full row.
 * @param {object} props
 * @param {Metric[]} props.metrics
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {boolean} props.busy
 * @param {(plans: LogPlan[], onDone: () => void) => void} props.onWriteAll Saves several values in one task, in order,
 *   for the Save button. It calls its `onDone` when the write ends, also after an error.
 * @param {Map<MetricDay, CountStep[]>} props.pending Count taps of the table views that are not written yet. The tiles
 *   show them.
 * @returns {JSX.Element}
 */
export function TodayTiles({ metrics, log, today, busy, onWriteAll, pending }) {
  const [values, setValues] = useState(/** @type {TileValues} */ ({ drafts: new Map(), saving: new Map() }));
  const countInput = useCountInput();
  const [measure, width] = useElementWidth();
  const hosted = useContext(LocalActionBarHost) != null;
  // The day values of each metric. Each move of a ruler changes a draft and shows the tiles again: the values change
  // only with new data.
  const valuesById = useMemo(
    () => new Map(metrics.map((m) => [m.id, dayValues(m, log, pending)])),
    [metrics, log, pending],
  );
  // The latest props for the inputs: a touch tap runs after a wait.
  const latest = useRef({ valuesById, today });
  latest.current = { valuesById, today };

  /**
   * Makes the value that `change` gives the unsaved value of the metric `id`. `change` gets the value that the tile
   * shows now. The saved value again is not unsaved.
   * @param {string} id
   * @param {(shown: number | null) => number | null} change
   */
  function set(id, change) {
    setValues((prev) => {
      const saved = savedValue(id);
      const value = change(shownValue(prev, id, saved));
      const drafts = new Map(prev.drafts);
      if (value === saved) drafts.delete(id);
      else drafts.set(id, value);
      return { ...prev, drafts };
    });
  }

  /**
   * The saved value of the metric `id` today, in the latest data.
   * @param {string} id
   * @returns {number | null}
   */
  function savedValue(id) {
    return latest.current.valuesById.get(id)?.get(latest.current.today) ?? null;
  }

  function save() {
    const plans = metrics
      .filter((m) => values.drafts.has(m.id))
      .map((m) => {
        const v = values.drafts.get(m.id) ?? null;
        /** @type {LogPlan} */
        let plan;
        if (v == null) plan = (l) => planClear(m, today, l);
        else if (m instanceof YesNoMetric) plan = (l) => planYesNo(m, today, l, v === 1);
        else plan = (l) => planNumber(m, today, v, l);
        return plan;
      });
    // The number editors keep their values: the new data shows the same values.
    setValues((prev) => ({ drafts: new Map(), saving: new Map([...prev.saving, ...prev.drafts]) }));
    // The write ended: the new data has the saved values, or the error shows.
    onWriteAll(plans, () => setValues((prev) => ({ ...prev, saving: new Map() })));
  }

  const unsaved = metrics.filter((m) => values.drafts.has(m.id)).map((m) => m.name);
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
    const saved = dayValuesOfMetric.get(today) ?? null;
    const shown = shownValue(values, m.id, saved);
    const unsavedTile = values.drafts.has(m.id);
    if (m instanceof YesNoMetric) {
      // Back from done: to empty, or to `no` if the day was saved as `yes`.
      const toggle = () =>
        set(m.id, (now) => {
          if (now !== 1) return 1;
          return savedValue(m.id) === 1 ? 0 : null;
        });
      return <YesNoTile key={m.id} metric={m} value={shown} unsaved={unsavedTile} onClick={toggle} />;
    }
    if (m.isCount) {
      // Reads the value when it runs: a touch tap runs after the double-tap wait.
      /**
       * Adds a step to the value (+1) or subtracts it (−1).
       * @param {number} sign
       * @returns {void}
       */
      const add = (sign) => set(m.id, (now) => applyCountSteps(now, [{ delta: sign * m.step }]));
      return (
        <CountTile
          key={m.id}
          metric={m}
          value={shown}
          unsaved={unsavedTile}
          input={countInputProps(countInput, m.id, add)}
        />
      );
    }
    const near = nearestDay(dayValuesOfMetric.keys(), today);
    return (
      // A number is a measurement: its tile has no mark. A trend goal does not use the value of the day.
      <div key={m.id} class={tileClass(shown != null, unsavedTile, 'tile-wide')}>
        <div class="tile-head">
          <MetricIcon icon={m.icon} />
          <TileName metric={m} />
        </div>
        <NumberEditor
          key={`${m.id} ${today}`}
          metric={m}
          label={`${m.name} · today`}
          current={saved}
          start={near == null ? null : (dayValuesOfMetric.get(near) ?? null)}
          busy={busy}
          // The Save button saves. These run only without onChange.
          onSave={() => {}}
          onClear={() => {}}
          onClose={() => {}}
          autofocus={false}
          onChange={(value) => set(m.id, () => value)}
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
      {/* In the App, the button shows only with values to save: it does not cover the page without a reason. */}
      {(!hosted || unsaved.length > 0 || values.saving.size > 0) && (
        <ActionBar>
          <PrimaryButton
            text={values.saving.size > 0 ? 'Saving…' : 'Save'}
            onClick={save}
            // In the page: space above, after the tiles, and below. The App gives the space of its bar.
            class={hosted ? 'fill-width' : 'fill-width today-tiles-save'}
            enabled={!busy && unsaved.length > 0}
            description={unsaved.length === 0 ? 'No changes' : `Save: ${unsaved.join(', ')}`}
          />
        </ActionBar>
      )}
    </div>
  );
}

/**
 * The value that the tile of the metric `id` shows: unsaved, then being saved, then `saved`.
 * @param {TileValues} values
 * @param {string} id
 * @param {number | null} saved
 * @returns {number | null}
 */
function shownValue(values, id, saved) {
  if (values.drafts.has(id)) return values.drafts.get(id) ?? null;
  if (values.saving.has(id)) return values.saving.get(id) ?? null;
  return saved;
}

/**
 * The classes of a tile: in the soft app color when `filled`, with a frame of the app color when `unsaved`. A tile that
 * is not filled has a thin outline, so that it shows on the page. The fill color changes smoothly. The tiles are not
 * green: a value is not always good. The {@link Mark} shows the goal.
 * @param {boolean} filled
 * @param {boolean} unsaved
 * @param {string} kind
 * @returns {string}
 */
function tileClass(filled, unsaved, kind) {
  return ['tile', kind, filled ? 'tile-filled' : null, unsaved ? 'tile-unsaved' : null].filter(Boolean).join(' ');
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
 * @param {boolean} props.unsaved
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function YesNoTile({ metric, value, unsaved, onClick }) {
  const done = value === 1;
  const mark = goalMark(metric, value);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      class={tileClass(done, unsaved, 'tile-button')}
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
 * @param {boolean} props.unsaved
 * @param {ReturnType<typeof countInputProps>} props.input
 * @returns {JSX.Element}
 */
function CountTile({ metric, value, unsaved, input }) {
  const step = formatStep(metric.step, metric.step);
  const counter = value == null ? '0' : formatStep(value, metric.step);
  const mark = goalMark(metric, value);
  return (
    <button
      type="button"
      class={tileClass(value != null, unsaved, 'tile-button tile-count')}
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
