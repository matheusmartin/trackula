import { daysBetween } from '../../model/Day.js';
import { shortDay } from '../../model/Format.js';
import { ChartCard, MAX_HEATMAP_DAYS } from './ChartParts.jsx';
import './Charts.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */

/**
 * The days from `from` to `to` in week columns, Monday at the top. A day that `filled` gives true for is filled. A tap
 * on a day calls `onDay`. Without `onDay`, a tap does nothing. Each day has a tooltip from `dayTitle`.
 * @param {object} props
 * @param {string} props.title
 * @param {Day} props.from
 * @param {Day} props.to
 * @param {(day: Day) => boolean} props.filled
 * @param {Day} props.today
 * @param {((day: Day) => void) | null} [props.onDay] Default: null.
 * @param {(day: Day) => string} [props.dayTitle] Default: the day, for example "Oct 3".
 * @returns {JSX.Element}
 */
export function DayHeatmap({ title, from, to, filled, today, onDay = null, dayTitle = shortDay }) {
  const description =
    onDay == null ? 'One cell for each day of the period.' : 'Tap a day to show its month in the calendar.';
  if (to.serial - from.serial + 1 > MAX_HEATMAP_DAYS) {
    return (
      <ChartCard title={title} description={description}>
        <p class="chart-label chart-label-trim chart-text">Zoom in to 1 year or less to see single days.</p>
      </ChartCard>
    );
  }
  const offset = from.weekday - 1;
  const days = daysBetween(from, to);
  const columns = Math.ceil((offset + days.length) / 7);
  return (
    <ChartCard title={title} description={description}>
      <svg
        class={onDay == null ? 'day-heatmap' : 'day-heatmap day-heatmap-taps'}
        // Short windows: cells at most about 28 px, centered, not the full width.
        style={{ maxInlineSize: `${columns * 28}px` }}
        viewBox={`0 0 ${columns * 12} ${7 * 12}`}
        role="img"
        aria-label={`Days from ${from} to ${to}`}
      >
        {days.map((d, i) => (
          // The gap is 2 of 12 units.
          <rect
            key={d.toString()}
            class={[
              'day-heatmap-cell',
              filled(d) ? 'day-heatmap-filled' : null,
              d === today ? 'day-heatmap-today' : null,
            ]
              .filter(Boolean)
              .join(' ')}
            x={Math.trunc((i + offset) / 7) * 12}
            y={((i + offset) % 7) * 12}
            width="10"
            height="10"
            rx="2"
            onClick={onDay == null ? undefined : () => onDay(d)}
          >
            <title>{dayTitle(d)}</title>
          </rect>
        ))}
      </svg>
    </ChartCard>
  );
}
