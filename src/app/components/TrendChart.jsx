import { chartBars, chartPoints } from '../../model/Chart.js';
import { formatNumber, shortDay, withUnit } from '../../model/Format.js';
import './TrendChart.css';

/** @import { JSX } from 'preact' */
/** @import { ChartBar, ChartPoint } from '../../model/Chart.js' */
/** @import { Day } from '../../model/Day.js' */

/** The size of the chart, in chart units. */
const CHART_WIDTH = 100;
const CHART_HEIGHT = 40;

/**
 * The text of a value on the chart: at most 3 decimals.
 * @param {number} value
 * @returns {string}
 */
function format(value) {
  return formatNumber(value, 3);
}

/**
 * A coordinate in the SVG.
 * @param {number} value
 * @returns {string}
 */
function coordinate(value) {
  return value.toFixed(2);
}

/**
 * A small chart of one number metric or of the score over `days`, with the first and last day below it. The chart
 * stretches to the card width, in `color`: the data color (`--cell`) by default.
 *
 * - Line (default): the Y axis goes from the lowest to the highest value, or from 0 with `fromZero`. Lines and dots
 *   keep their size.
 * - Bars (`showsBars` true, for `count` metrics and the score): the Y axis goes from 0 to the highest value.
 * - `showsValues`: each dot or bar has its value above it. For short series only, for example 5 days.
 *
 * Each bar and dot has a tooltip with its day and value. Screen readers get one text for the whole chart: the range
 * and the days. Without values, the chart shows nothing.
 * @param {object} props
 * @param {Day[]} props.days
 * @param {Map<Day, number>} props.values
 * @param {string | null} [props.unit] Default: null.
 * @param {boolean} [props.showsBars] Default: false.
 * @param {boolean} [props.fromZero] Default: false.
 * @param {boolean} [props.showsValues] Default: false.
 * @param {string | null} [props.color] A CSS color. Null: the data color (`--cell`).
 * @returns {JSX.Element | null}
 */
export function TrendChart({
  days,
  values,
  unit = null,
  showsBars = false,
  fromZero = false,
  showsValues = false,
  color = null,
}) {
  const points = chartPoints(days, values, { width: CHART_WIDTH, height: CHART_HEIGHT, fromZero });
  if (points.length === 0) return null;
  const high = Math.max(...points.map((p) => p.value));
  const low = showsBars || fromZero ? 0 : Math.min(...points.map((p) => p.value));
  const bars = showsBars ? chartBars(days, values, { width: CHART_WIDTH, height: CHART_HEIGHT }) : [];
  const label =
    `Values from ${format(low)} to ${withUnit(format(high), unit)}, ` +
    `${shortDay(days[0])} to ${shortDay(days[days.length - 1])}`;
  // All values 0 on a scale from 0: the only label is at the bottom, with the line or the bars.
  const onlyBottom = high === 0 && (showsBars || fromZero);
  const classes = ['trend-chart', showsValues && !showsBars ? 'trend-chart-side-padding' : null].filter(Boolean);

  /**
   * The tooltip of a bar or a dot.
   * @param {Day} day
   * @param {number} value
   * @returns {JSX.Element}
   */
  const tooltip = (day, value) => <title>{`${shortDay(day)}: ${withUnit(format(value), unit)}`}</title>;

  // A grid: the Y axis labels on the left of the plot, and the first and last day below it.
  return (
    <div class={classes.join(' ')} role="img" aria-label={label} style={color == null ? undefined : { color }}>
      <div class={onlyBottom ? 'trend-chart-y trend-chart-y-bottom' : 'trend-chart-y'}>
        <span class="trend-chart-label">{format(high)}</span>
        {high !== low && <span class="trend-chart-label">{format(low)}</span>}
      </div>
      <div class="trend-chart-plot">
        <div class="trend-chart-canvas">
          <svg
            class="trend-chart-svg"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {showsBars ? <Bars bars={bars} tooltip={tooltip} /> : <Line points={points} tooltip={tooltip} />}
          </svg>
          {showsValues &&
            (showsBars ? bars : points).map((p) => (
              <span
                key={p.day.toString()}
                class={showsBars ? 'trend-chart-value trend-chart-bar-value' : 'trend-chart-value'}
                style={{
                  left: `${(100 * (showsBars ? p.x + /** @type {ChartBar} */ (p).w / 2 : p.x)) / CHART_WIDTH}%`,
                  top: `${(100 * p.y) / CHART_HEIGHT}%`,
                }}
              >
                {format(p.value)}
              </span>
            ))}
        </div>
        <div class="trend-chart-x">
          <span class="trend-chart-label">{shortDay(days[0])}</span>
          <span class="trend-chart-label">{shortDay(days[days.length - 1])}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The bars of a {@link TrendChart}, from the bottom.
 * @param {object} props
 * @param {ChartBar[]} props.bars
 * @param {(day: Day, value: number) => JSX.Element} props.tooltip
 * @returns {JSX.Element}
 */
function Bars({ bars, tooltip }) {
  return (
    <>
      {bars.map((b) => (
        <rect
          key={b.day.toString()}
          class="trend-chart-bar"
          x={coordinate(b.x)}
          y={coordinate(b.y)}
          width={coordinate(b.w)}
          height={coordinate(CHART_HEIGHT - b.y)}
        >
          {tooltip(b.day, b.value)}
        </rect>
      ))}
    </>
  );
}

/**
 * The line and the dots of a {@link TrendChart}. The line and the dots keep their size when the chart stretches.
 * @param {object} props
 * @param {ChartPoint[]} props.points
 * @param {(day: Day, value: number) => JSX.Element} props.tooltip
 * @returns {JSX.Element}
 */
function Line({ points, tooltip }) {
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${coordinate(p.x)} ${coordinate(p.y)}`).join(' ');
  return (
    <>
      <path class="trend-chart-line" d={path} />
      {points.map((p) => (
        // A path of length 0 with a round cap is a round dot as large as the line width.
        <path key={p.day.toString()} class="trend-chart-dot" d={`M${coordinate(p.x)} ${coordinate(p.y)} h0`}>
          {tooltip(p.day, p.value)}
        </path>
      ))}
    </>
  );
}
