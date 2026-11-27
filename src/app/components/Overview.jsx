import { useRef } from 'preact/hooks';
import { roundHalfAwayFromZero } from '../../model/Numbers.js';
import { COLUMN_UNITS, coordinate, percent } from './ChartParts.jsx';
import './Charts.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { ZoomBar } from '../../model/Zoom.js' */

/** The height of the overview, in CSS pixels. */
const OVERVIEW_HEIGHT = 40;

/** The height of the overview bars, in chart units. */
const OVERVIEW_BAR_UNITS = 30;

/**
 * A small chart of all data in weeks, with a box on the days from `from` to `to`. A press, a tap or a drag calls
 * `onPoint` with the day under the pointer. All moves of the drag go to the overview, also vertical moves.
 *
 * - `weeks`: one bar for each week of all data, oldest first.
 * - `fromZero`: the bars start at 0, for rates and sums. Else they start a little below the lowest week, so that
 *   changes show.
 * @param {object} props
 * @param {ZoomBar[]} props.weeks
 * @param {boolean} props.fromZero
 * @param {Day} props.from
 * @param {Day} props.to
 * @param {(day: Day) => void} props.onPoint
 * @returns {JSX.Element | null}
 */
export function Overview({ weeks, fromZero, from, to, onPoint }) {
  // The pointer that drags on the overview. Null: no drag.
  const dragging = useRef(/** @type {number | null} */ (null));
  if (weeks.length === 0) return null;
  const values = weeks.flatMap((b) => (b.value == null ? [] : [b.value]));
  const high = values.length === 0 ? 1 : Math.max(...values);
  const lowest = values.length === 0 ? 0 : Math.min(...values);
  const low = fromZero ? 0 : lowest - (high - lowest) * 0.15;
  const first = weeks[0].start;
  const last = weeks[weeks.length - 1].start.addDays(6);
  const total = weeks.length * COLUMN_UNITS;
  const scale = OVERVIEW_HEIGHT / (OVERVIEW_BAR_UNITS + 2);
  /**
   * @param {Day} d
   * @returns {number}
   */
  const x = (d) => ((d.serial - first.serial) / 7) * COLUMN_UNITS;
  /**
   * @param {number} v
   * @returns {number}
   */
  const bar = (v) => Math.max(0.5, ((v - low) / (high - low === 0 ? 1 : high - low)) * OVERVIEW_BAR_UNITS);

  /**
   * Calls `onPoint` with the day under the pointer.
   * @param {PointerEvent} event
   */
  function point(event) {
    const rect = /** @type {Element} */ (event.currentTarget).getBoundingClientRect();
    const fraction = rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0;
    onPoint(first.addDays(roundHalfAwayFromZero(fraction * (last.serial - first.serial))));
  }

  const boxLeft = x(from);
  return (
    <svg
      class="overview"
      role="img"
      aria-label="All data"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        dragging.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        point(event);
      }}
      onPointerMove={(event) => {
        if (dragging.current === event.pointerId) point(event);
      }}
      onPointerUp={() => {
        dragging.current = null;
      }}
      onPointerCancel={() => {
        dragging.current = null;
      }}
    >
      {weeks.map((b, i) => {
        if (b.value == null) return null;
        const inWindow = !b.start.addDays(6).isBefore(from) && !b.start.isAfter(to);
        const height = bar(b.value);
        return (
          <rect
            key={i}
            class={inWindow ? 'overview-bar overview-bar-in' : 'overview-bar'}
            x={percent(i * COLUMN_UNITS + 1, total)}
            y={coordinate((OVERVIEW_BAR_UNITS + 1 - height) * scale)}
            width={percent(8, total)}
            height={coordinate(height * scale)}
          />
        );
      })}
      <rect
        class="overview-box"
        x={percent(boxLeft, total)}
        y={coordinate(0.5 * scale)}
        width={percent(Math.max(4, x(to.addDays(1)) - boxLeft), total)}
        height={coordinate((OVERVIEW_BAR_UNITS + 1) * scale)}
      />
    </svg>
  );
}
