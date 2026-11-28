// The period of the metric detail screen and of the Score view: the spans, the moves, the period panel and the drags.
import { useEffect, useRef, useState } from 'preact/hooks';
import { earliestDay } from '../../model/Day.js';
import { formatDateRange } from '../../model/Format.js';
import { roundHalfAwayFromZero } from '../../model/Numbers.js';
import { ZoomWindow, zoomSteps } from '../../model/Zoom.js';
import { AppIconButton } from './AppIconButton.jsx';
import { DayStrip } from './DayStrip.jsx';
import { FilterChip } from './GroupChips.jsx';
import { useScrolledPast } from './ScrolledPast.js';
import { useStickyHeight } from './StickyHeight.js';
import { Symbol } from './Symbol.jsx';

/** @import { ComponentChildren, JSX } from 'preact' */
/** @import { Day, MonthKey } from '../../model/Day.js' */
/** @import { DayBar } from '../../model/DayBars.js' */
/** @import { ZoomStep } from '../../model/Zoom.js' */

/** The side wheel movement for one bar, in CSS pixels. */
const WHEEL_STEP = 40;

/** The distance that a pointer moves to the side before a drag on the charts starts, in CSS pixels. */
const TOUCH_SLOP = 18;

/**
 * The period of a screen and the functions that change it. See {@link usePeriod}.
 * @typedef {object} Period
 * @property {ZoomWindow} window The days that the screen shows.
 * @property {ZoomStep[]} steps The zoom steps, from the shortest to all data.
 * @property {number} index The index of the step of the window in `steps`.
 * @property {(to: number) => void} zoom Zooms to the step `to`.
 * @property {(end: Day | null) => void} moveTo Moves the window to end in the bar of a day. Null: the newest bar.
 * @property {MonthKey | null} month The month of the calendar. Null: the month of the window end.
 * @property {(month: MonthKey | null) => void} setMonth
 */

/**
 * The period of a screen with charts over time.
 *
 * - The span chips set its span and the bar size (see `ZoomStep`). It opens at the step `defaultIndex`.
 * - The arrows move the window by its full span. A tap or a drag on the day strip, or a side drag or a side wheel on
 *   the charts, moves it by bars. A zoom keeps the same time in view, except at the newest bar.
 * - The calendar shows the month of the window end until the user changes the month.
 * @param {Map<Day, number>} values The value of each day: the first value sets the start of the steps.
 * @param {Day} today
 * @param {(steps: ZoomStep[]) => number} defaultIndex The step index that the screen opens with.
 * @returns {Period}
 */
export function usePeriod(values, today, defaultIndex) {
  // The index in zoomSteps. Null: defaultIndex.
  const [stepIndex, setStepIndex] = useState(/** @type {number | null} */ (null));
  // A day in the newest bar of the window. Null: the newest bar of all. A day, not an index, so that a zoom keeps the
  // same time in view.
  const [end, setEnd] = useState(/** @type {Day | null} */ (null));
  const [month, setMonth] = useState(/** @type {MonthKey | null} */ (null));
  // The end of the last move: a drag can move again before the next render.
  const lastEnd = useRef(end);
  lastEnd.current = end;
  const first = earliestDay(values.keys()) ?? today;
  const steps = zoomSteps(first, today);
  const index = Math.min(stepIndex ?? defaultIndex(steps), steps.length - 1);
  const window = new ZoomWindow(steps[index], first, today, end);

  /** @param {Day | null} newEnd */
  function moveTo(newEnd) {
    if (newEnd === lastEnd.current) return;
    lastEnd.current = newEnd;
    setEnd(newEnd);
    setMonth(null);
  }

  /** @param {number} to */
  function zoom(to) {
    if (!window.atEnd) {
      lastEnd.current = window.to;
      setEnd(window.to);
    }
    setStepIndex(to);
  }

  return { window, steps, index, zoom, moveTo, month, setMonth };
}

/**
 * The period panel: the span chips, the dates of the window with arrows, and the day strip of all data with a box on
 * the window. A tap or a drag on the strip moves the window there. Wide screens: the chips and the dates in one row.
 *
 * When the page scrolls past the panel, a thin row stays below the app bar: the span, the dates and the bars of the
 * window. A tap on the row opens the panel below it. A second tap, Escape, or a scroll back to the panel closes it.
 * @param {object} props
 * @param {Period} props.period
 * @param {DayBar[]} props.bars One bar for each day of all data. See `dayBars`.
 * @param {(bar: DayBar) => string} props.valueText The value of a bar in its tooltip. Example: "6 glasses, 0.8 points".
 * @param {boolean} props.wide True on wide screens.
 * @returns {JSX.Element}
 */
export function PeriodBar({ period, bars, valueText, wide }) {
  const { window, steps, index, zoom, moveTo } = period;
  // The last step shows all data. See zoomSteps.
  const last = steps.length - 1;
  const count = window.starts.length;
  const panel = useRef(/** @type {HTMLDivElement | null} */ (null));
  const scrolledPast = useScrolledPast(panel);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!scrolledPast) setOpen(false);
  }, [scrolledPast]);
  const dates = formatDateRange(window.from, window.to);
  const span = index === last ? 'All' : wide ? steps[index].label : steps[index].short;
  const inWindow = bars.filter((b) => !b.start.isBefore(window.from) && !b.start.isAfter(window.to));

  // A function, not one element: the panel can show twice, in the page and below the thin row.
  const content = () => (
    <div class={wide ? 'period-panel period-panel-wide' : 'period-panel'}>
      <div class="period-panel-top">
        <div class="period-chips" role="group" aria-label="Span">
          {steps.map((step, i) => (
            <FilterChip
              key={step.name}
              label={i === last ? 'All' : step.short}
              description={i === last ? 'All data' : step.label}
              selected={i === index}
              onClick={() => zoom(i)}
            />
          ))}
        </div>
        <div class="period-dates">
          <AppIconButton
            icon="chevron_left"
            title="Earlier"
            onClick={() => moveTo(window.endMovedBy(-count))}
            enabled={!window.atStart}
          />
          <span class="period-dates-text body-medium">{dates}</span>
          <AppIconButton
            icon="chevron_right"
            title="Later"
            onClick={() => moveTo(window.endMovedBy(count))}
            enabled={!window.atEnd}
          />
        </div>
      </div>
      <DayStrip
        bars={bars}
        label={`All data, ${formatDateRange(window.first, window.today)}. The box shows the period.`}
        valueText={valueText}
        from={window.from}
        to={window.to}
        onPoint={(d) => moveTo(window.endCenteredOn(d))}
      />
    </div>
  );

  return (
    <>
      <div ref={panel}>{content()}</div>
      {/* The row is in the page only after the scroll: before it, the panel shows all of it. */}
      <div
        class="period-row"
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        {scrolledPast && (
          <PeriodRow
            span={span}
            name={`Period: ${index === last ? 'all data' : steps[index].label}, ${dates}`}
            dates={dates}
            bars={inWindow}
            valueText={valueText}
            open={open}
            onToggle={() => setOpen(!open)}
          />
        )}
        {open && scrolledPast && <div class="period-row-panel">{content()}</div>}
      </div>
    </>
  );
}

/**
 * The thin row of the period after a scroll: the span, the dates and the bars of the window, and an arrow. While it
 * shows, the page keeps its height free at the top for the keyboard focus (see `useStickyHeight`).
 * @param {object} props
 * @param {string} props.span Example: "3M".
 * @param {string} props.name The name for screen readers. Example: "Period: 3 months, Aug 30 – Nov 28, 2026".
 * @param {string} props.dates
 * @param {DayBar[]} props.bars The bars of the window.
 * @param {(bar: DayBar) => string} props.valueText
 * @param {boolean} props.open True while the panel shows below the row.
 * @param {() => void} props.onToggle
 * @returns {JSX.Element}
 */
function PeriodRow({ span, name, dates, bars, valueText, open, onToggle }) {
  const row = useRef(/** @type {HTMLButtonElement | null} */ (null));
  useStickyHeight(row);
  return (
    <button
      ref={row}
      type="button"
      class="period-row-button"
      aria-expanded={open}
      aria-label={name}
      title={open ? 'Close the period panel' : 'Open the period panel'}
      onClick={onToggle}
    >
      <span class="period-row-span label-large">{span}</span>
      <span class="period-row-dates body-medium">{dates}</span>
      <span class="period-row-bars" aria-hidden="true">
        <DayStrip bars={bars} label="" valueText={valueText} height={14} months={false} />
      </span>
      <Symbol name={open ? 'expand_less' : 'expand_more'} />
    </button>
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
 * slop, so that a tap on a bar still works. A vertical drag of a finger scrolls the page.
 * @param {object} props
 * @param {Period} props.period
 * @param {ComponentChildren} props.children
 * @returns {JSX.Element}
 */
export function ChartsArea({ period, children }) {
  const { window, moveTo } = period;
  const area = useRef(/** @type {HTMLDivElement | null} */ (null));
  // The latest window and move function, for the wheel listener.
  const latest = useRef({ window, moveTo });
  latest.current = { window, moveTo };
  const drag = useRef(/** @type {ChartDrag | null} */ (null));
  // True after a drag, so that the click at its end does not tap a bar.
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
   * Moves the window by the bars from the press to `x`: not from the end of the touch slop.
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
