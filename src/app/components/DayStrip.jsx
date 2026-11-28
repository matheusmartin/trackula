import { useRef } from 'preact/hooks';
import { weekBars } from '../../model/DayBars.js';
import { barLabel, shortDay } from '../../model/Format.js';
import { roundHalfAwayFromZero } from '../../model/Numbers.js';
import { BarUnit } from '../../model/Zoom.js';
import { useElementWidth } from './ElementWidth.js';
import './DayStrip.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { DayBar } from '../../model/DayBars.js' */

/** The smallest width of one day bar, in CSS pixels. A narrower strip shows one bar for each week. */
const MIN_DAY_WIDTH = 1.5;

/** The smallest width of a bar with a gap on each side, in CSS pixels. Narrower bars touch. */
const MIN_GAP_WIDTH = 3;

/** The width of one bar in the units of the plot. */
const UNITS = 10;

/** The smallest width of a month for its name below the strip, in CSS pixels. */
const MIN_MONTH_WIDTH = 28;

/**
 * The CSS color of a bar: the soft data color for a `no`, and from the soft data color to the data color for 0 to 1
 * point.
 * @param {DayBar} bar
 * @returns {string}
 */
function barColor(bar) {
  if (bar.points == null) return 'var(--data-soft)';
  return `color-mix(in oklab, var(--data-soft), var(--cell) ${Math.round(25 + 75 * bar.points)}%)`;
}

/**
 * A strip of thin bars: one bar for each day of `bars`, or one for each week when the strip is too narrow for days.
 * The bar of a Saturday or a Sunday is lighter, so that the weeks show. A day without a value is a thin line.
 *
 * - With `from` and `to`: a box on these days, and the bars out of the box are dim.
 * - With `onPoint`: a press, a tap or a drag calls it with the day under the pointer. All moves of a drag go to the
 *   strip, also vertical moves.
 * - With `months`: the names of the months below the strip, where they have the space.
 *
 * Each bar has a tooltip: its day or its week and `valueText` of the bar.
 * @param {object} props
 * @param {DayBar[]} props.bars One bar for each day, oldest first.
 * @param {string} props.label The text for screen readers.
 * @param {(bar: DayBar) => string} props.valueText Example: "yes", "6 glasses", "score 64%".
 * @param {Day | null} [props.from] Default: null, no box.
 * @param {Day | null} [props.to] Default: null.
 * @param {((day: Day) => void) | null} [props.onPoint] Default: null.
 * @param {number} [props.height] The height of the bars, in CSS pixels. Default: 32.
 * @param {boolean} [props.months] Default: true.
 * @returns {JSX.Element | null}
 */
export function DayStrip({
  bars,
  label,
  valueText,
  from = null,
  to = null,
  onPoint = null,
  height = 32,
  months = true,
}) {
  const [measure, width] = useElementWidth();
  // The pointer that drags on the strip. Null: no drag.
  const dragging = useRef(/** @type {number | null} */ (null));
  const plot = useRef(/** @type {HTMLDivElement | null} */ (null));
  if (bars.length === 0) return null;
  const first = bars[0].start;
  const last = bars[bars.length - 1].end;
  const days = last.serial - first.serial + 1;
  // Before the first layout, and in the tests without layout, the strip shows days.
  const shown = width > 0 && width / bars.length < MIN_DAY_WIDTH ? weekBars(bars) : bars;
  const gap = width > 0 && width / shown.length < MIN_GAP_WIDTH ? 0 : UNITS * 0.2;
  /**
   * The share of the strip before `day`, in %.
   * @param {Day} day
   * @returns {number}
   */
  const at = (day) => ((day.serial - first.serial) / days) * 100;

  /**
   * Calls `onPoint` with the day under the pointer.
   * @param {JSX.TargetedPointerEvent<HTMLDivElement>} event
   */
  function point(event) {
    const rect = plot.current?.getBoundingClientRect();
    if (onPoint == null || rect == null) return;
    const fraction = rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0;
    onPoint(first.addDays(roundHalfAwayFromZero(fraction * (days - 1))));
  }

  const handlers =
    onPoint == null
      ? {}
      : {
          onPointerDown: (/** @type {JSX.TargetedPointerEvent<HTMLDivElement>} */ event) => {
            if (event.button !== 0) return;
            dragging.current = event.pointerId;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            point(event);
          },
          onPointerMove: (/** @type {JSX.TargetedPointerEvent<HTMLDivElement>} */ event) => {
            if (dragging.current === event.pointerId) point(event);
          },
          onPointerUp: () => {
            dragging.current = null;
          },
          onPointerCancel: () => {
            dragging.current = null;
          },
        };
  return (
    <div ref={measure} class="day-strip">
      <div ref={plot} class={onPoint == null ? 'day-strip-plot' : 'day-strip-plot day-strip-taps'} {...handlers}>
        <svg
          class="day-strip-bars"
          style={{ blockSize: `${height}px` }}
          viewBox={`0 0 ${shown.length * UNITS} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={label}
        >
          {shown.map((bar, i) => {
            const out = from != null && to != null && (bar.end.isBefore(from) || bar.start.isAfter(to));
            const opacity = (bar.weekend ? 0.5 : 1) * (out ? 0.3 : 1);
            const day = bar.start === bar.end ? shortDay(bar.start) : `Week of ${shortDay(bar.start)}`;
            const h = bar.height == null ? 1.5 : Math.max(1, bar.height * height);
            return (
              <rect
                key={bar.start.toString()}
                class={bar.height == null ? 'day-strip-none' : 'day-strip-bar'}
                x={i * UNITS + gap / 2}
                y={height - h}
                width={UNITS - gap}
                height={h}
                style={bar.height == null ? { opacity: out ? 0.15 : 0.45 } : { fill: barColor(bar), opacity }}
              >
                <title>{`${day}: ${bar.height == null ? 'no value' : valueText(bar)}`}</title>
              </rect>
            );
          })}
        </svg>
        {from != null && to != null && (
          <span
            class="day-strip-box"
            style={{ left: `${at(from)}%`, width: `${Math.max(0.5, at(to.addDays(1)) - at(from))}%` }}
          />
        )}
      </div>
      {months && <MonthNames first={first} last={last} width={width} />}
    </div>
  );
}

/**
 * The names of the months from `first` to `last` below a strip of `width` CSS pixels, each at the start of its month.
 * A month that is too narrow for its name has none. The first name and January have the year.
 * @param {object} props
 * @param {Day} props.first
 * @param {Day} props.last
 * @param {number} props.width
 * @returns {JSX.Element}
 */
function MonthNames({ first, last, width }) {
  const days = last.serial - first.serial + 1;
  /** @type {{ start: Day, count: number }[]} */
  const months = [];
  for (let d = first; !d.isAfter(last); d = d.addDays(1)) {
    const month = months[months.length - 1];
    if (month == null || d.day === 1) months.push({ start: d, count: 1 });
    else month.count++;
  }
  let named = false;
  return (
    <div class="day-strip-months" aria-hidden="true">
      {months.map((m) => {
        // Before the first layout, all months have a name.
        const fits = width === 0 || (m.count / days) * width >= MIN_MONTH_WIDTH;
        const text = fits ? barLabel(m.start, BarUnit.MONTH, !named) : '';
        if (fits) named = true;
        return (
          <span
            key={m.start.toString()}
            class="day-strip-month"
            style={{
              left: `${((m.start.serial - first.serial) / days) * 100}%`,
              width: `${(m.count / days) * 100}%`,
            }}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}
