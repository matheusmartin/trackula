import { useRef } from 'preact/hooks';
import { addMonths, daysOfMonth, monthOf, sameMonth } from '../../model/Day.js';
import { monthPairTitle, monthTitle } from '../../model/Format.js';
import { DayLayout } from '../../model/MainView.js';
import { AppIconButton } from './AppIconButton.jsx';
import { useElementWidth } from './ElementWidth.js';
import { HabitTable } from './HabitTable.jsx';
import { WIDE_CONTENT } from './Sizes.js';
import './MonthCalendar.css';

/** @import { JSX } from 'preact' */
/** @import { Day, MonthKey } from '../../model/Day.js' */
/** @import { CountStep, LogTable, LogWrite, MetricDay } from '../../model/LogEntry.js' */
/** @import { Metric, NumberMetric } from '../../model/Metric.js' */

/** The smallest side move of a swipe, in CSS pixels. A swipe also moves more to the side than up or down. */
const SWIPE_DISTANCE = 50;

/**
 * The calendar of the detail screen, to edit the days of one metric in any month. It has the same day cells and
 * inputs as the Today page, and its own month arrows and swipes. Wide screens also show the month before on the left.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {boolean} props.busy
 * @param {(plan: (log: LogTable) => LogWrite | null) => void} props.onWrite
 * @param {Map<MetricDay, CountStep[]>} props.pending
 * @param {(metric: NumberMetric, day: Day, step: CountStep) => void} props.onCount
 * @param {MonthKey} props.month The month in view.
 * @param {(month: MonthKey) => void} props.onMonth Called when the arrows or a swipe change the month.
 * @returns {JSX.Element}
 */
export function MonthCalendar({ metric, log, today, busy, onWrite, pending, onCount, month, onMonth }) {
  const [measure, width] = useElementWidth();
  const before = addMonths(month, -1);
  const isThisMonth = sameMonth(month, monthOf(today));
  // Phones: one month. Wider screens: the month before on the left, and a title with both months.
  const two = width >= WIDE_CONTENT;
  // The pointer position at the start of a swipe.
  const swipe = useRef(/** @type {{ pointerId: number, x: number, y: number } | null} */ (null));

  /**
   * Shows the month `delta` months after the month in view.
   * @param {number} delta
   * @returns {void}
   */
  const move = (delta) => onMonth(addMonths(month, delta));

  /**
   * A swipe to the left shows the next month, a swipe to the right the month before. The cells still get their taps:
   * the swipe only reads the pointer positions.
   * @param {JSX.TargetedPointerEvent<HTMLDivElement>} event
   */
  function swipeEnd(event) {
    const start = swipe.current;
    swipe.current = null;
    if (start == null || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < 2 * Math.abs(dy)) return;
    if (dx > 0) move(-1);
    else if (!isThisMonth) move(1);
  }

  /**
   * @param {Day[]} days
   * @returns {JSX.Element}
   */
  const calendar = (days) => (
    <HabitTable
      metrics={[metric]}
      log={log}
      today={today}
      days={days}
      layout={DayLayout.CALENDARS}
      busy={busy}
      onWrite={onWrite}
      pending={pending}
      onCount={onCount}
      showsTitle={false}
      calendarColumns={1}
      calendarCellSize={34}
    />
  );

  return (
    <div ref={measure} class="month-calendar">
      <h3 class="month-calendar-heading title-medium">Edit days</h3>
      <div class="month-calendar-bar">
        <AppIconButton icon="chevron_left" title="Previous month" onClick={() => move(-1)} />
        <span class="month-calendar-title title-small">{two ? monthPairTitle(before, month) : monthTitle(month)}</span>
        <AppIconButton icon="chevron_right" title="Next month" onClick={() => move(1)} enabled={!isThisMonth} />
      </div>
      <div
        class={two ? 'month-calendar-months month-calendar-two' : 'month-calendar-months'}
        onPointerDown={(event) => {
          swipe.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerUp={swipeEnd}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        {/* Keys: when the width changes, each month keeps its own state, for example an open editor. */}
        {two && <div key="previous">{calendar(daysOfMonth(before))}</div>}
        <div key="calendar">{calendar(daysOfMonth(month))}</div>
      </div>
    </div>
  );
}
