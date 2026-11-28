import { useRef } from 'preact/hooks';
import { addMonths, daysOfMonth, monthOf, sameMonth } from '../../model/Day.js';
import { monthRangeTitle, monthTitle, weekdayNames } from '../../model/Format.js';
import { AppIconButton } from './AppIconButton.jsx';
import { ChartCard } from './ChartParts.jsx';
import { useDayCells } from './DayCells.jsx';
import { useElementWidth } from './ElementWidth.js';
import { CellLegend } from './HabitTable.jsx';
import './MonthCalendar.css';

/** @import { ComponentChildren, JSX } from 'preact' */
/** @import { Day, MonthKey } from '../../model/Day.js' */
/** @import { CountStep, LogTable, MetricDay } from '../../model/LogEntry.js' */
/** @import { Metric, NumberMetric } from '../../model/Metric.js' */

/** The smallest side move of a swipe, in CSS pixels. A swipe also moves more to the side than up or down. */
const SWIPE_DISTANCE = 50;

/** The width of a month: 7 cells of 40 px and 6 spaces of 4 px between them, in CSS pixels. */
const MONTH_WIDTH = 7 * 40 + 6 * 4;

/** The space between two months, and the padding of the card at each side, in CSS pixels. */
const MONTH_GAP = 32;
const CARD_PADDING = 16;

/** The largest number of months side by side: a quarter. */
const MAX_MONTHS = 3;

/**
 * The number of months side by side in a card of `width` CSS pixels: 1 on a phone, up to 3 on a wide screen.
 * @param {number} width
 * @returns {number}
 */
export function monthCount(width) {
  const fit = Math.floor((width - 2 * CARD_PADDING + MONTH_GAP) / (MONTH_WIDTH + MONTH_GAP));
  return Math.min(MAX_MONTHS, Math.max(1, fit));
}

/**
 * The Days card of the detail screen, to see and edit the days of one metric in any month. It has the same day cells
 * and inputs as the Days screen (see `useDayCells`), and each cell also shows its day number. The editor of a number
 * metric opens below the months. A legend tells the cell colors. See {@link MonthsCard}.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {boolean} props.busy
 * @param {(metric: Metric, day: Day, value: number | null) => void} props.onRecord Sets the value of a day. See
 *   `useDayCells`.
 * @param {Map<MetricDay, CountStep[]>} props.pending
 * @param {(metric: NumberMetric, day: Day, step: CountStep) => void} props.onCount
 * @param {MonthKey} props.month The last month in view.
 * @param {(month: MonthKey) => void} props.onMonth Called when the arrows or a swipe change the month.
 * @returns {JSX.Element}
 */
export function MonthCalendar({ metric, log, today, busy, onRecord, pending, onCount, month, onMonth }) {
  const { cell, editorOf } = useDayCells({ metrics: [metric], log, today, busy, onRecord, pending, onCount });
  return (
    <MonthsCard
      title="Days"
      description="Tap a day to change its value. The color shows the points."
      today={today}
      month={month}
      onMonth={onMonth}
      cell={(d) => cell(metric, d, true)}
    >
      {editorOf(metric)}
      <CellLegend />
    </MonthsCard>
  );
}

/**
 * A card with months of day cells: the Days card of the detail screen and of the Score screen. Below the title and the
 * sentence: a bar with the months in view and arrows, the months side by side, then `children`, for example a legend.
 *
 * The card shows as many months side by side as its width holds, up to 3. `month` is the last of them. The arrows and
 * the swipes change the months, but not after the month of today. With more than one month, each has its name.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {Day} props.today
 * @param {MonthKey} props.month The last month in view.
 * @param {(month: MonthKey) => void} props.onMonth Called when the arrows or a swipe change the month.
 * @param {(day: Day) => ComponentChildren} props.cell The cell of a day.
 * @param {ComponentChildren} props.children
 * @returns {JSX.Element}
 */
export function MonthsCard({ title, description, today, month, onMonth, cell, children }) {
  const [measure, width] = useElementWidth();
  const count = monthCount(width);
  const months = Array.from({ length: count }, (_, i) => addMonths(month, i + 1 - count));
  const isThisMonth = sameMonth(month, monthOf(today));
  // The pointer position at the start of a swipe.
  const swipe = useRef(/** @type {{ pointerId: number, x: number, y: number } | null} */ (null));

  /**
   * Shows the months `delta` months after the months in view.
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

  return (
    <div ref={measure} class="month-calendar">
      <ChartCard title={title} description={description}>
        <div class="month-calendar-body">
          <div class="month-calendar-bar">
            <AppIconButton icon="chevron_left" title="Previous month" onClick={() => move(-1)} />
            <span class="month-calendar-title title-small">{monthRangeTitle(months[0], month)}</span>
            <AppIconButton icon="chevron_right" title="Next month" onClick={() => move(1)} enabled={!isThisMonth} />
          </div>
          <div
            class="month-calendar-months"
            onPointerDown={(event) => {
              swipe.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
            }}
            onPointerUp={swipeEnd}
            onPointerCancel={() => {
              swipe.current = null;
            }}
          >
            {months.map((m) => (
              <MonthDays key={`${m.year}-${m.month}`} month={m} today={today} titled={count > 1} cell={cell} />
            ))}
          </div>
          {children}
        </div>
      </ChartCard>
    </div>
  );
}

/**
 * The days of one month: the weekday names on top, then one row for each week, Monday to Sunday. The days after today
 * have no place, so that the month of today has no empty row. With `titled`, the name of the month above them.
 * @param {object} props
 * @param {MonthKey} props.month
 * @param {Day} props.today
 * @param {boolean} props.titled
 * @param {(day: Day) => ComponentChildren} props.cell
 * @returns {JSX.Element}
 */
function MonthDays({ month, today, titled, cell }) {
  const days = daysOfMonth(month).filter((d) => !d.isAfter(today));
  const blanks = days[0].weekday - 1;
  return (
    <div class="month-days">
      {titled && <h4 class="month-days-title title-small">{monthTitle(month)}</h4>}
      <div class="month-days-grid">
        {weekdayNames.map((name) => (
          <span key={name} class="month-days-weekday body-small" aria-hidden="true">
            {name}
          </span>
        ))}
        {blanks > 0 && <span style={{ gridColumn: `span ${blanks}` }} />}
        {days.map((d) => (
          <span key={d.toString()} class="month-days-day">
            {cell(d)}
          </span>
        ))}
      </div>
    </div>
  );
}
