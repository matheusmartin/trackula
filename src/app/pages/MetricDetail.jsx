import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { earliestDay, monthOf } from '../../model/Day.js';
import { formatDateRange, formatNumber, shortDay, withUnit } from '../../model/Format.js';
import { NumberMetric, YesNoMetric } from '../../model/Metric.js';
import { roundHalfAwayFromZero } from '../../model/Numbers.js';
import { isScore } from '../../model/Score.js';
import { yesNoStates } from '../../model/Stats.js';
import { dayValues } from '../../model/Summary.js';
import {
  Aggregate,
  BarUnit,
  ZoomWindow,
  barStarts,
  defaultStepIndex,
  threeMonthsStepIndex,
  zoomBars,
  zoomSteps,
} from '../../model/Zoom.js';
import { AppIconButton } from '../components/AppIconButton.jsx';
import { DayHeatmap, Overview } from '../components/Charts.jsx';
import { useElementWidth } from '../components/ElementWidth.js';
import { MetricCharts } from '../components/MetricCharts.jsx';
import { MetricIcon } from '../components/MetricIcon.jsx';
import { MonthCalendar } from '../components/MonthCalendar.jsx';
import { ScoreCalendar } from '../components/ScoreCalendar.jsx';
import { WIDE_CONTENT } from '../components/Sizes.js';
import './MetricDetail.css';

/** @import { ComponentChildren, JSX } from 'preact' */
/** @import { Day, MonthKey } from '../../model/Day.js' */
/** @import { CountStep, LogTable, LogWrite, MetricDay } from '../../model/LogEntry.js' */
/** @import { Metric } from '../../model/Metric.js' */
/** @import { ZoomStep } from '../../model/Zoom.js' */

/** The side wheel movement for one bar, in CSS pixels. */
const WHEEL_STEP = 40;

/** The distance that a pointer moves to the side before a drag on the charts starts, in CSS pixels, as in Compose. */
const TOUCH_SLOP = 18;

/** The metrics of the score of a metric that is not the score. */
const NO_METRICS = /** @type {Metric[]} */ ([]);

/** The points of a metric that is not the score. */
const NO_POINTS = /** @type {Map<string, Map<Day, number>>} */ (new Map());

/** The yes/no states of a metric that is not a yes/no metric. */
const NO_STATES = /** @type {Map<Day, boolean>} */ (new Map());

/**
 * All data of one metric: key numbers, charts and a day heatmap for one time window, and a month calendar to edit
 * days.
 *
 * - Time window: the zoom buttons set its span and the bar size (see `ZoomStep`). It opens at All for a metric of kind
 *   `number` and for the score, and at 3 months for the other kinds (see `defaultStepIndex`). A tap on the zoom label
 *   goes to All, and a second tap goes back. At All without an earlier step, the tap goes to 3 months. The arrows move
 *   the window by its full span. A tap or a drag on the overview moves it there. When the window shows all data, there
 *   is no overview: it shows the same bars as the first chart. A side drag or a side wheel on the charts moves it by
 *   bars. All numbers and charts show the same window. The bar with the zoom buttons and the dates stays at the top
 *   while the page scrolls.
 * - Day heatmap: the days of the window. A tap on a day shows its month in the calendar.
 * - Edit days: any month, with the same day cells and inputs as the Today page. It shows the month of the window end
 *   until the arrows, a swipe or a heatmap tap change it. Wide screens also show the month before.
 * - Score (`scoreMetric` or a `groupScoreMetric`): key numbers and charts over time, by weekday, by group and by
 *   metric, from `scores`, in green. `scoreMetrics` and `points`: the metrics of the score and the points of each
 *   metric (see `pointsByMetric`), for the charts by group and by metric. In place of the heatmap and Edit days, a
 *   read-only month calendar shows the score of each day: the app calculates the scores.
 *
 * The parent gives the screen the key of the metric id: another metric starts with its own window.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {boolean} props.busy
 * @param {(plan: (log: LogTable) => LogWrite | null) => void} props.onWrite
 * @param {Map<MetricDay, CountStep[]>} props.pending
 * @param {(metric: NumberMetric, day: Day, step: CountStep) => void} props.onCount
 * @param {Map<Day, number>} props.scores
 * @param {(() => void) | null} [props.onBack] Closes the screen. Null: the screen has no back button, for example the
 *   Score view.
 * @param {Metric[]} [props.scoreMetrics] The metrics of the score.
 * @param {Map<string, Map<Day, number>>} [props.points] The points of each metric of the score.
 * @returns {JSX.Element}
 */
export function MetricDetail({
  metric,
  log,
  today,
  busy,
  onWrite,
  pending,
  onCount,
  scores,
  onBack = null,
  scoreMetrics = NO_METRICS,
  points = NO_POINTS,
}) {
  // The index in zoomSteps. Null: defaultStepIndex.
  const [stepIndex, setStepIndex] = useState(/** @type {number | null} */ (null));
  // The step index before a tap on the zoom label went to All. A second tap goes back to it.
  const [beforeAll, setBeforeAll] = useState(/** @type {number | null} */ (null));
  // A day in the newest bar of the window. Null: the newest bar of all. A day, not an index, so that a zoom keeps the
  // same time in view.
  const [end, setEnd] = useState(/** @type {Day | null} */ (null));
  // The month in the calendar. Null: the month of the window end.
  const [month, setMonth] = useState(/** @type {MonthKey | null} */ (null));
  // The end of the last move: a drag can move again before the next render.
  const lastEnd = useRef(end);
  lastEnd.current = end;
  const [measure, width] = useElementWidth();
  const score = isScore(metric);

  const states = useMemo(() => (metric instanceof YesNoMetric ? yesNoStates(metric, log) : NO_STATES), [metric, log]);
  // For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
  const values = useMemo(() => {
    if (metric instanceof YesNoMetric) return new Map([...states].map(([d, yes]) => [d, yes ? 1 : 0]));
    return score ? scores : dayValues(metric, log, pending);
  }, [metric, states, score, scores, log, pending]);
  const first = earliestDay(values.keys()) ?? today;
  const steps = zoomSteps(first, today);
  const index = Math.min(stepIndex ?? defaultStepIndex(metric, steps), steps.length - 1);
  const window = new ZoomWindow(steps[index], first, today, end);

  /**
   * Moves the window to end in the bar of `newEnd`. The calendar then shows the month of the window end.
   * @param {Day | null} newEnd Null: the newest bar.
   */
  function moveTo(newEnd) {
    if (newEnd === lastEnd.current) return;
    lastEnd.current = newEnd;
    setEnd(newEnd);
    setMonth(null);
  }

  /**
   * Zooms to the step `to`. At the newest bar, the window stays at the newest bar. Else it keeps the same time in view.
   * @param {number} to
   * @param {number | null} all The step that a tap on the All label goes back to.
   */
  function zoom(to, all) {
    if (!window.atEnd) {
      lastEnd.current = window.to;
      setEnd(window.to);
    }
    setStepIndex(to);
    setBeforeAll(all);
  }

  /**
   * The tooltip of a heatmap day. Examples: "Oct 3: yes", "Oct 3: 82.5 kg", "Oct 3: no value".
   * @param {Day} d
   * @returns {string}
   */
  function dayTitle(d) {
    if (metric instanceof YesNoMetric) {
      const state = states.get(d);
      return `${shortDay(d)}: ${state == null ? 'no entry' : state ? 'yes' : 'no'}`;
    }
    const value = values.get(d);
    const unit = metric instanceof NumberMetric ? metric.unit : null;
    return `${shortDay(d)}: ${value == null ? 'no value' : withUnit(formatNumber(value, 2), unit)}`;
  }

  // The full width of the page, as the group chips above the Score view. On wide screens, the chart grid has more
  // columns, so that the cards keep their shape.
  return (
    <div ref={measure} class={score ? 'metric-detail score-theme' : 'metric-detail'}>
      <div class="metric-detail-header">
        {onBack != null && <AppIconButton icon="arrow_back" title="Back" onClick={onBack} />}
        {!score && <MetricIcon icon={metric.icon} large />}
        <h2 class="metric-detail-title headline-small">{metric.name}</h2>
      </div>
      <WindowBar
        metric={metric}
        window={window}
        steps={steps}
        index={index}
        beforeAll={beforeAll}
        values={values}
        wide={width >= WIDE_CONTENT}
        zoom={zoom}
        moveTo={moveTo}
      />
      <ChartsArea window={window} moveTo={moveTo}>
        <MetricCharts
          metric={metric}
          window={window}
          values={values}
          states={states}
          scoreMetrics={scoreMetrics}
          points={points}
        />
        {/* The score has no heatmap: its month calendar shows the same days, with the score of each day. */}
        {!score && (
          <DayHeatmap
            title={metric instanceof YesNoMetric ? 'Yes days' : 'Days with a value'}
            from={window.from}
            to={window.to}
            today={today}
            filled={(d) => (metric instanceof YesNoMetric ? states.get(d) === true : values.has(d))}
            onDay={(d) => setMonth(monthOf(d))}
            dayTitle={dayTitle}
          />
        )}
      </ChartsArea>
      {score ? (
        <ScoreCalendar scores={values} today={today} month={month ?? monthOf(window.to)} onMonth={setMonth} />
      ) : (
        <MonthCalendar
          metric={metric}
          log={log}
          today={today}
          busy={busy}
          onWrite={onWrite}
          pending={pending}
          onCount={onCount}
          month={month ?? monthOf(window.to)}
          onMonth={setMonth}
        />
      )}
    </div>
  );
}

/**
 * The zoom buttons, the dates of the window with arrows, and the overview of all data. The bar with the buttons stays
 * at the top while the page scrolls. When the window shows all data, there is no overview: the first chart shows the
 * same bars, and there is no other part of the data to move to.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {ZoomWindow} props.window
 * @param {ZoomStep[]} props.steps
 * @param {number} props.index
 * @param {number | null} props.beforeAll
 * @param {Map<Day, number>} props.values
 * @param {boolean} props.wide True on wide screens: one row.
 * @param {(to: number, all: number | null) => void} props.zoom
 * @param {(end: Day | null) => void} props.moveTo
 * @returns {JSX.Element}
 */
function WindowBar({ metric, window, steps, index, beforeAll, values, wide, zoom, moveTo }) {
  const aggregate =
    metric instanceof YesNoMetric
      ? Aggregate.RATE
      : metric instanceof NumberMetric && metric.isCount
        ? Aggregate.SUM
        : Aggregate.AVERAGE;
  // The last step shows all data. See zoomSteps.
  const last = steps.length - 1;
  const atAll = index === last;
  // The window can open at All (see defaultStepIndex): then the tap goes to 3 months.
  const back = Math.min(beforeAll ?? threeMonthsStepIndex(steps), last);
  const count = window.starts.length;
  const box = window.boxOn(BarUnit.WEEK);
  const labelName = atAll ? `Back to ${steps[back].label}` : 'Show all';
  // One tool bar in a soft color. Wide screens: the zoom buttons on the left and the dates on the right, in one row.
  // Phones: 2 rows, each with its buttons at the edges and its label in the center.
  return (
    <>
      <div class="window-bar-band">
        <div class={wide ? 'window-bar window-bar-wide' : 'window-bar'}>
          <div class="window-bar-row">
            <AppIconButton icon="zoom_in" title="Zoom in" onClick={() => zoom(index - 1, null)} enabled={index > 0} />
            <button
              type="button"
              class="window-zoom-label label-large"
              title={labelName}
              aria-label={labelName}
              onClick={() => (atAll ? zoom(back, null) : zoom(last, index))}
            >
              {atAll ? 'All' : steps[index].label}
            </button>
            <AppIconButton icon="zoom_out" title="Zoom out" onClick={() => zoom(index + 1, null)} enabled={!atAll} />
          </div>
          <div class="window-bar-row">
            <AppIconButton
              icon="chevron_left"
              title="Earlier"
              onClick={() => moveTo(window.endMovedBy(-count))}
              enabled={!window.atStart}
            />
            <span class="window-dates body-medium">{formatDateRange(window.from, window.to)}</span>
            <AppIconButton
              icon="chevron_right"
              title="Later"
              onClick={() => moveTo(window.endMovedBy(count))}
              enabled={!window.atEnd}
            />
          </div>
        </div>
      </div>
      {!window.showsAll && (
        <div class="metric-detail-overview">
          <Overview
            weeks={zoomBars(
              values,
              aggregate,
              barStarts(window.first, window.today, BarUnit.WEEK),
              BarUnit.WEEK,
              window.first,
              window.today,
            )}
            fromZero={aggregate !== Aggregate.AVERAGE}
            from={box.from}
            to={box.to}
            onPoint={(d) => moveTo(window.endCenteredOn(d))}
          />
        </div>
      )}
    </>
  );
}

/**
 * A drag on the charts: the pointer, its start, the window at the press, and true after the touch slop.
 * @typedef {object} ChartDrag
 * @property {number} pointerId
 * @property {number} x
 * @property {ZoomWindow} start
 * @property {boolean} moving
 */

/**
 * `children` with side drags and side wheel moves that move the window by bars. A drag starts only after the touch
 * slop, so that a tap on a heatmap day still works. A vertical drag of a finger scrolls the page.
 * @param {object} props
 * @param {ZoomWindow} props.window
 * @param {(end: Day | null) => void} props.moveTo
 * @param {ComponentChildren} props.children
 * @returns {JSX.Element}
 */
function ChartsArea({ window, moveTo, children }) {
  const area = useRef(/** @type {HTMLDivElement | null} */ (null));
  // The latest window and move function, for the wheel listener.
  const latest = useRef({ window, moveTo });
  latest.current = { window, moveTo };
  const drag = useRef(/** @type {ChartDrag | null} */ (null));
  // True after a drag, so that the click at its end does not tap a heatmap day.
  const dragged = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const element = area.current;
    if (element == null) return;
    // Side wheel movement that is less than one bar, in pixels.
    let wheel = 0;
    /** @param {WheelEvent} event */
    const onWheel = (event) => {
      // Vertical wheel moves scroll the page. A chart that scrolls to the side gets its own wheel moves.
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      if (event.target instanceof Element && event.target.closest('.chart-scroller') != null) return;
      event.preventDefault();
      wheel += event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaX * WHEEL_STEP : event.deltaX;
      const bars = Math.trunc(wheel / WHEEL_STEP);
      if (bars === 0) return;
      wheel -= bars * WHEEL_STEP;
      latest.current.moveTo(latest.current.window.endMovedBy(bars));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  /**
   * Moves the window by the bars from the press to `x`, as in the Dart app: not from the end of the touch slop.
   * @param {ChartDrag} d
   * @param {number} x
   */
  function dragTo(d, x) {
    // No bars, for example with a value after today: nothing to move.
    const count = d.start.starts.length;
    const width = area.current?.getBoundingClientRect().width ?? 0;
    if (count === 0 || width === 0) return;
    const bars = roundHalfAwayFromZero((x - d.x) / (width / count));
    moveTo(d.start.endMovedBy(-bars));
  }

  /** Ends the drag. */
  function stop() {
    if (drag.current?.moving) dragged.current = true;
    drag.current = null;
    setDragging(false);
  }

  return (
    <div
      ref={area}
      class={dragging ? 'charts-area charts-area-dragging' : 'charts-area'}
      onPointerDown={(event) => {
        dragged.current = false;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        drag.current = { pointerId: event.pointerId, x: event.clientX, start: window, moving: false };
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (d == null || d.pointerId !== event.pointerId) return;
        if (!d.moving) {
          if (Math.abs(event.clientX - d.x) <= TOUCH_SLOP) return;
          // Also the move that crosses the touch slop moves the window: a fast swipe can have only one move.
          d.moving = true;
          setDragging(true);
          event.currentTarget.setPointerCapture?.(event.pointerId);
          globalThis.getSelection?.()?.removeAllRanges();
        }
        dragTo(d, event.clientX);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onClickCapture={(event) => {
        if (!dragged.current) return;
        dragged.current = false;
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      {children}
    </div>
  );
}
