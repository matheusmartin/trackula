// The period of the metric detail screen and of the Score view: the zoom, the moves, the period bar and the drags.
import { useEffect, useRef, useState } from 'preact/hooks';
import { earliestDay } from '../../model/Day.js';
import { formatDateRange } from '../../model/Format.js';
import { roundHalfAwayFromZero } from '../../model/Numbers.js';
import { BarUnit, ZoomWindow, barStarts, threeMonthsStepIndex, zoomBars, zoomSteps } from '../../model/Zoom.js';
import { AppIconButton } from './AppIconButton.jsx';
import { Button } from './Button.jsx';
import { Overview } from './Charts.jsx';
import { useStickyHeight } from './StickyHeight.js';

/** @import { ComponentChildren, JSX } from 'preact' */
/** @import { Day, MonthKey } from '../../model/Day.js' */
/** @import { Aggregate, ZoomStep } from '../../model/Zoom.js' */

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
 * @property {number | null} beforeAll The step before a tap on the zoom label went to All. A second tap goes back.
 * @property {(to: number, all: number | null) => void} zoom Zooms to the step `to`. `all` is the step that a tap on the
 *   All label goes back to.
 * @property {(end: Day | null) => void} moveTo Moves the window to end in the bar of a day. Null: the newest bar.
 * @property {MonthKey | null} month The month of the calendar. Null: the month of the window end.
 * @property {(month: MonthKey | null) => void} setMonth
 */

/**
 * The period of a screen with charts over time.
 *
 * - The zoom buttons set its span and the bar size (see `ZoomStep`). It opens at the step `defaultIndex`. A tap on the
 *   zoom label goes to All, and a second tap goes back. At All without an earlier step, the tap goes to 3 months.
 * - The arrows move the window by its full span. A tap or a drag on the overview, or a side drag or a side wheel on
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
  const [beforeAll, setBeforeAll] = useState(/** @type {number | null} */ (null));
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

  /**
   * @param {number} to
   * @param {number | null} all
   */
  function zoom(to, all) {
    if (!window.atEnd) {
      lastEnd.current = window.to;
      setEnd(window.to);
    }
    setStepIndex(to);
    setBeforeAll(all);
  }

  return { window, steps, index, beforeAll, zoom, moveTo, month, setMonth };
}

/**
 * The zoom buttons, the dates of the window with arrows, and the overview of all data. The bar with the buttons stays
 * at the top while the page scrolls. When the window shows all data, there is no overview: the first chart shows the
 * same bars, and there is no other part of the data to move to.
 * @param {object} props
 * @param {Period} props.period
 * @param {Map<Day, number>} props.values
 * @param {Aggregate} props.aggregate How the overview makes one bar of the days of a week.
 * @param {boolean} props.fromZero True if the bars of the overview start at 0.
 * @param {boolean} props.wide True on wide screens: one row.
 * @returns {JSX.Element}
 */
export function PeriodBar({ period, values, aggregate, fromZero, wide }) {
  const { window, steps, index, beforeAll, zoom, moveTo } = period;
  // The last step shows all data. See zoomSteps.
  const last = steps.length - 1;
  const atAll = index === last;
  // The window can open at All: then the tap goes to 3 months.
  const back = Math.min(beforeAll ?? threeMonthsStepIndex(steps), last);
  const count = window.starts.length;
  const box = window.boxOn(BarUnit.WEEK);
  const labelName = atAll ? `Back to ${steps[back].label}` : 'Show all';
  const band = useRef(/** @type {HTMLDivElement | null} */ (null));
  useStickyHeight(band);
  // One tool bar in a soft color. Wide screens: the zoom buttons on the left and the dates on the right, in one row.
  // Phones: 2 rows, each with its buttons at the edges and its label in the center.
  return (
    <>
      <div class="window-bar-band" ref={band}>
        <div class={wide ? 'window-bar window-bar-wide' : 'window-bar'}>
          <div class="window-bar-row">
            <AppIconButton icon="zoom_in" title="Zoom in" onClick={() => zoom(index - 1, null)} enabled={index > 0} />
            <Button
              text={atAll ? 'All' : steps[index].label}
              description={labelName}
              tooltip={labelName}
              onClick={() => (atAll ? zoom(back, null) : zoom(last, index))}
              class="window-zoom-label"
            />
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
            fromZero={fromZero}
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
