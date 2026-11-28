// The chart kinds of the chart cards: bars, stacked bars, lines, a donut, bars over time and range bars.
import { barLabel, barTitle, formatNumber, formatPercent, shortDay } from '../../model/Format.js';
import {
  COLUMN_UNITS,
  ChartCard,
  Labels,
  MAX_BARS_WITH_VALUES,
  MAX_COLUMN_WIDTH,
  NoValues,
  PLOT_SCALE,
  PLOT_UNITS,
  Scroller,
  ValueRow,
  coordinate,
  defaultFormat,
  percent,
  spokenValues,
  yScale,
} from './ChartParts.jsx';
import './Charts.css';

/** @import { JSX } from 'preact' */
/** @import { Bar } from './ChartParts.jsx' */
/** @import { Day } from '../../model/Day.js' */
/** @import { BarUnit, ValueRange, ZoomBar } from '../../model/Zoom.js' */

/**
 * The value row and the bars of a bar chart, without labels. Bars start at 0. `max` fixes the top of the scale, for
 * example to the highest value of all bars of a zoom chart, so that the scale stays the same while it moves.
 *
 * Negative values: the 0 line goes up, and their bars go down from it, in the second color. Example: the change of a
 * weekday average. Each bar has a tooltip: its entry of `titles` and its value.
 * @param {object} props
 * @param {Bar[]} props.bars
 * @param {string[]} props.titles
 * @param {string} props.label The title of the chart, for screen readers.
 * @param {number | null} props.max
 * @param {(value: number) => string} props.format
 * @param {boolean} props.showValues
 * @returns {JSX.Element}
 */
function BarRows({ bars, titles, label, max, format, showValues }) {
  const values = bars.flatMap((b) => (b.value == null ? [] : [b.value]));
  const above = max ?? Math.max(0, ...values);
  const below = Math.max(0, ...values.map((v) => -v));
  const scale = above + below === 0 ? 1 : above + below;
  // The y of 0, in chart units: the bottom without negative values.
  const zero = below === 0 ? PLOT_UNITS : (above / scale) * PLOT_UNITS;
  const total = bars.length * COLUMN_UNITS;
  return (
    <>
      {showValues && <ValueRow values={bars.map((b) => b.value)} format={format} />}
      <svg
        class="chart-plot"
        role="img"
        aria-label={spokenValues(
          label,
          bars.map((b) => b.label),
          bars.map((b) => b.value),
          format,
        )}
      >
        {bars.map((b, i) => {
          if (b.value == null) return null;
          const height = Math.max(0.4, (Math.abs(b.value) / scale) * PLOT_UNITS);
          const top = b.value >= 0 ? zero - height : zero;
          return (
            <rect
              key={i}
              class={b.value >= 0 ? 'chart-bar' : 'chart-bar chart-bar-negative'}
              x={percent(i * COLUMN_UNITS + 1.5, total)}
              y={coordinate(top * PLOT_SCALE)}
              width={percent(7, total)}
              height={coordinate(height * PLOT_SCALE)}
            >
              <title>{`${titles[i]}: ${format(b.value)}`}</title>
            </rect>
          );
        })}
      </svg>
    </>
  );
}

/**
 * Bars from 0 to the highest value, with their values above them and their labels below them. `max` fixes the top of
 * the scale, for example 100 for percentages. If no bar has a value, the card says so.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {Bar[]} props.bars
 * @param {number | null} [props.max] Default: null, the highest value.
 * @param {(value: number) => string} [props.format] Default: at most 1 decimal.
 * @returns {JSX.Element}
 */
export function BarChart({ title, description, bars, max = null, format = defaultFormat }) {
  return (
    <ChartCard title={title} description={description}>
      {bars.every((b) => b.value == null) ? (
        <NoValues />
      ) : (
        <Scroller columns={bars.length}>
          <BarRows bars={bars} titles={bars.map((b) => b.label)} label={title} max={max} format={format} showValues />
          <Labels labels={bars.map((b) => b.label)} all />
        </Scroller>
      )}
    </ChartCard>
  );
}

/**
 * One part of each bar of a {@link StackedBarChart}: the `label` in the legend, its CSS `color`, and a value for each
 * bar.
 * @typedef {object} StackPart
 * @property {string} label
 * @property {string} color
 * @property {(number | null)[]} values
 */

/** The gap above each part of a stacked bar, in CSS pixels. */
const STACK_GAP = 1.5;

/**
 * Bars from 0 that stack the `parts`, the first part at the bottom, with `labels` below and a legend. The sum of each
 * bar is above it. A bar with only null values has no bar and no sum. A value below 0 counts as 0. A thin gap is above
 * each part, so that parts with near colors stay apart. Each part has a tooltip with its bar, its name and its value.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {string[]} props.labels
 * @param {StackPart[]} props.parts
 * @param {(value: number) => string} [props.format] Default: at most 1 decimal.
 * @returns {JSX.Element}
 */
export function StackedBarChart({ title, description, labels, parts, format = defaultFormat }) {
  const sums = labels.map((_, i) => {
    const values = parts.flatMap((p) => (p.values[i] == null ? [] : [Math.max(0, p.values[i])]));
    return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0);
  });
  const present = sums.filter((s) => s != null);
  if (present.length === 0) {
    return (
      <ChartCard title={title} description={description}>
        <NoValues />
      </ChartCard>
    );
  }
  const high = Math.max(...present);
  const scale = high === 0 ? 1 : high;
  const total = labels.length * COLUMN_UNITS;
  /** @type {JSX.Element[]} */
  const rects = [];
  labels.forEach((label, i) => {
    let bottom = PLOT_UNITS;
    parts.forEach((part, p) => {
      const value = part.values[i];
      if (value == null) return;
      const height = (Math.max(0, value) / scale) * PLOT_UNITS;
      // The gap is taken from the top of the part, so that the bar keeps its full height.
      const shown = Math.max(0, height * PLOT_SCALE - STACK_GAP);
      rects.push(
        <rect
          key={`${i}-${p}`}
          x={percent(i * COLUMN_UNITS + 1.5, total)}
          y={coordinate(bottom * PLOT_SCALE - shown)}
          width={percent(7, total)}
          height={coordinate(shown)}
          style={{ fill: part.color }}
        >
          <title>{`${label}, ${part.label}: ${format(value)}`}</title>
        </rect>,
      );
      bottom -= height;
    });
  });
  return (
    <ChartCard title={title} description={description}>
      <Scroller columns={labels.length}>
        <ValueRow values={sums} format={format} />
        <svg class="chart-plot" role="img" aria-label={spokenValues(title, labels, sums, format)}>
          {rects}
        </svg>
        <Labels labels={labels} all />
      </Scroller>
      <Legend parts={parts} />
    </ChartCard>
  );
}

/**
 * The legend of a chart with more than one series: a color square and the label of each of `parts`.
 * @param {object} props
 * @param {StackPart[]} props.parts
 * @returns {JSX.Element}
 */
export function Legend({ parts }) {
  return (
    <ul class="chart-legend">
      {parts.map((part) => (
        <li key={part.label} class="chart-legend-item body-small">
          <span class="chart-swatch" style={{ backgroundColor: part.color }} />
          {part.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Dots for each value, and a line: the `trend` if given, else through the dots. `dots` is false for long series, for
 * example the habit strength. `decimals` are the decimals of the axis labels and the tooltips. `range` fixes the
 * scale, for example [0, 100] for percentages. Null: from the lowest to the highest value. Each dot has a tooltip with
 * its day and its value.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {Day[]} props.days
 * @param {(number | null)[]} props.values One value for each day.
 * @param {(number | null)[] | null} [props.trend] Default: null.
 * @param {boolean} [props.dots] Default: true.
 * @param {number} [props.decimals] Default: 2.
 * @param {[number, number] | null} [props.range] Default: null.
 * @returns {JSX.Element}
 */
export function LineChart({ title, description, days, values, trend = null, dots = true, decimals = 2, range = null }) {
  const present = values.filter((v) => v != null);
  const all = [...present, ...(trend ?? []).filter((v) => v != null)];
  if (all.length === 0) {
    return (
      <ChartCard title={title} description={description}>
        <NoValues />
      </ChartCard>
    );
  }
  const high = range?.[1] ?? Math.max(...all);
  const low = range?.[0] ?? Math.min(...all);
  const y = yScale(high, low);
  const series = trend ?? values;
  const fromSeries = series.filter((v) => v != null);
  const shown = fromSeries.length === 0 ? all : fromSeries;
  /**
   * @param {number} value
   * @returns {string}
   */
  const format = (value) => formatNumber(value, decimals);
  const spoken =
    `${title}: from ${format(shown[0])} on ${shortDay(days[0])} to ` +
    `${format(shown[shown.length - 1])} on ${shortDay(days[days.length - 1])}, lowest ` +
    `${format(Math.min(...shown))}, highest ${format(Math.max(...shown))}`;
  const width = Math.max(1, values.length - 1);
  /**
   * @param {number} i
   * @returns {number}
   */
  const x = (i) => (values.length === 1 ? width / 2 : i);
  const path = series
    .flatMap((v, i) => (v == null ? [] : [`${coordinate(x(i))} ${coordinate(y(v))}`]))
    .map((point, n) => `${n === 0 ? 'M' : 'L'}${point}`)
    .join(' ');
  return (
    <ChartCard title={title} description={description}>
      <div class="line-chart">
        <div class="line-chart-y chart-label">
          <span>{format(high)}</span>
          {high !== low && <span>{format(low)}</span>}
        </div>
        <div class="line-chart-plot">
          <svg class="chart-plot" role="img" aria-label={spoken}>
            <svg
              class="line-chart-lines"
              width="100%"
              height="100%"
              viewBox={`0 0 ${width} ${PLOT_UNITS}`}
              preserveAspectRatio="none"
            >
              <path class="line-chart-line" d={path} />
            </svg>
            {dots &&
              values.map((v, i) =>
                v == null ? null : (
                  <circle
                    key={i}
                    class={trend == null ? 'line-chart-dot' : 'line-chart-dot line-chart-dot-value'}
                    cx={percent(x(i), width)}
                    cy={coordinate(y(v) * PLOT_SCALE)}
                    r={values.length > 60 ? '1.5' : '2.5'}
                  >
                    <title>{`${shortDay(days[i])}: ${format(v)}`}</title>
                  </circle>
                ),
              )}
          </svg>
          <div class="chart-ends chart-labels chart-label">
            <span>{shortDay(days[0])}</span>
            <span>{shortDay(days[days.length - 1])}</span>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

/**
 * One part of a {@link DonutChart}, with a CSS `color`.
 * @typedef {object} DonutPart
 * @property {string} label
 * @property {number} value
 * @property {string} color
 */

/** The size of a {@link DonutChart}, in CSS pixels. */
const DONUT_SIZE = 104;

/**
 * A ring with one arc for each part, the `center` text in the middle, and a legend with totals and percentages. Each
 * arc has a tooltip with its label, its total and its percentage.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {DonutPart[]} props.parts
 * @param {string} props.center
 * @returns {JSX.Element}
 */
export function DonutChart({ title, description, parts, center }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) {
    return (
      <ChartCard title={title} description={description}>
        <NoValues />
      </ChartCard>
    );
  }
  // The radius of the ring is 40 % of the size, and its width 16 %.
  const radius = DONUT_SIZE * 0.4;
  const circumference = 2 * Math.PI * radius;
  /**
   * @param {DonutPart} part
   * @returns {string}
   */
  const text = (part) => `${part.label}: ${part.value} · ${formatPercent(part.value / total)}`;
  let start = 0;
  return (
    <ChartCard title={title} description={description}>
      <div class="donut-chart">
        <div class="donut-chart-ring">
          <svg
            class="donut-chart-svg"
            viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
            role="img"
            aria-label={`${title}: ${parts.map((p) => `${p.label} ${p.value}`).join(', ')}`}
          >
            {parts.map((part) => {
              if (part.value === 0) return null;
              const length = (part.value / total) * circumference;
              const offset = start;
              start += length;
              // A dash of the arc length on a circle that starts at the top and goes clockwise.
              return (
                <circle
                  key={part.label}
                  class="donut-chart-arc"
                  cx={DONUT_SIZE / 2}
                  cy={DONUT_SIZE / 2}
                  r={coordinate(radius)}
                  style={{
                    stroke: part.color,
                    strokeDasharray: `${coordinate(length)} ${coordinate(circumference)}`,
                    strokeDashoffset: coordinate(-offset),
                  }}
                >
                  <title>{text(part)}</title>
                </circle>
              );
            })}
          </svg>
          <span class="donut-chart-center title-medium">{center}</span>
        </div>
        <ul class="donut-chart-legend">
          {parts.map((part) => (
            <li key={part.label} class="chart-legend-item body-small">
              <span class="chart-swatch" style={{ backgroundColor: part.color }} />
              {text(part)}
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

/**
 * Bars over time: one bar for each week, month or quarter of the time window. See `ZoomWindow`.
 *
 * - `max` fixes the top of the scale, for example to all bars of rates and sums, so that the scale does not change
 *   while the window moves. Null: the bars in view.
 * - Values show above the bars when 13 bars or fewer are in view.
 * - With `showsRange`, each bar goes from the lowest to the highest value, and a dot shows the average.
 *
 * Each bar has a tooltip with the name of its week, month or quarter and its value.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {ZoomBar[]} props.bars
 * @param {BarUnit} props.barUnit
 * @param {(value: number) => string} [props.format] Default: at most 1 decimal.
 * @param {number | null} [props.max] Default: null.
 * @param {boolean} [props.showsRange] Default: false.
 * @returns {JSX.Element}
 */
export function TimeBars({
  title,
  description,
  bars,
  barUnit,
  format = defaultFormat,
  max = null,
  showsRange = false,
}) {
  const highs = bars.flatMap((b) => {
    const v = showsRange ? b.high : b.value;
    return v == null ? [] : [v];
  });
  const lows = bars.flatMap((b) => {
    const v = showsRange ? b.low : b.value;
    return v == null ? [] : [v];
  });
  if (highs.length === 0) {
    return (
      <ChartCard title={title} description={description}>
        <NoValues />
      </ChartCard>
    );
  }
  const high = max ?? Math.max(...highs);
  const low = Math.min(...lows);
  const labels = bars.map((b) => barLabel(b.start, barUnit));
  const titles = bars.map((b) => barTitle(b.start, barUnit));
  return (
    <ChartCard title={title} description={description}>
      <div class="chart-columns" style={{ maxInlineSize: `${MAX_COLUMN_WIDTH * bars.length}px` }}>
        {showsRange ? (
          <RangeBars
            ranges={bars.map(toRange)}
            high={high}
            low={low}
            label={spokenValues(
              title,
              labels,
              bars.map((b) => b.value),
              format,
            )}
            titles={titles}
            format={format}
          />
        ) : (
          <BarRows
            bars={bars.map((b, i) => ({ label: labels[i], value: b.value }))}
            titles={titles}
            label={title}
            max={high}
            format={format}
            showValues={bars.length <= MAX_BARS_WITH_VALUES}
          />
        )}
        <Labels labels={bars.map((b, i) => barLabel(b.start, barUnit, i === 0))} />
      </div>
    </ChartCard>
  );
}

/**
 * The range of a bar with a lowest and a highest value. Null if the bar has no value.
 * @param {ZoomBar} bar
 * @returns {ValueRange | null}
 */
function toRange(bar) {
  if (bar.low == null || bar.high == null || bar.value == null) return null;
  return { low: bar.low, high: bar.high, average: bar.value };
}

/**
 * One bar in the CSS color `bar` from the lowest to the highest value for each of `ranges`, and the average as a dot
 * in the CSS color `dot`. A null range has no bar. With `marks`, a diamond in the cell color shows the mark of each
 * column, also in a column without a range. A null mark has no diamond. The scale goes from `low` (bottom) to `high`
 * (top). Each bar, dot and diamond has a tooltip: its entry of `titles`, the name of the range or the mark, and its
 * value.
 *
 * The default colors have a contrast of 3:1 or more in both themes: the bar on the card, and the dot on the bar. A
 * diamond has a thin frame in the card color, so that it stays apart from a bar below it.
 * @param {object} props
 * @param {(ValueRange | null)[]} props.ranges
 * @param {number} props.high
 * @param {number} props.low
 * @param {string} props.label The text for screen readers.
 * @param {string[]} props.titles The name of each column, for the tooltips.
 * @param {(value: number) => string} props.format
 * @param {string} [props.bar] Default: the data color (`--cell`).
 * @param {string} [props.dot] Default: the lowest surface container color.
 * @param {(number | null)[]} [props.marks] Default: no marks.
 * @param {string | null} [props.rangeName] The name of a bar and its dot in their tooltips. Default: null, no name.
 * @param {string | null} [props.markName] The name of a mark in its tooltip. Default: null, no name.
 * @returns {JSX.Element}
 */
export function RangeBars({
  ranges,
  high,
  low,
  label,
  titles,
  format,
  bar = 'var(--cell)',
  dot = 'var(--surface-container-lowest)',
  marks = [],
  rangeName = null,
  markName = null,
}) {
  const y = yScale(high, low);
  const total = ranges.length * COLUMN_UNITS;
  /**
   * @param {number} i
   * @returns {string}
   */
  const x = (i) => percent(i * COLUMN_UNITS + 5, total);
  /**
   * The start of a tooltip: the column and the name, for example "Mo, This week".
   * @param {number} i
   * @param {string | null} name
   * @returns {string}
   */
  const tip = (i, name) => (name == null ? titles[i] : `${titles[i]}, ${name}`);
  return (
    <svg class="chart-plot" role="img" aria-label={label}>
      {ranges.map((r, i) => {
        if (r == null) return null;
        return (
          <g key={i}>
            {/* A stroke with round ends that keeps its width. */}
            <line
              class="range-bar"
              x1={x(i)}
              x2={x(i)}
              y1={coordinate(y(r.high) * PLOT_SCALE)}
              y2={coordinate(Math.max(y(r.high) + 0.5, y(r.low)) * PLOT_SCALE)}
              style={{ stroke: bar }}
            >
              <title>{`${tip(i, rangeName)}: ${format(r.low)} to ${format(r.high)}`}</title>
            </line>
            <circle
              class="range-dot"
              cx={x(i)}
              cy={coordinate(y(r.average) * PLOT_SCALE)}
              r="2.5"
              style={{ fill: dot }}
            >
              <title>{`${tip(i, rangeName)}: average ${format(r.average)}`}</title>
            </circle>
          </g>
        );
      })}
      {marks.map((v, i) =>
        v == null ? null : (
          // A diamond of 12 px around the point of the mark.
          <svg key={`mark-${i}`} x={x(i)} y={coordinate(y(v) * PLOT_SCALE)} overflow="visible">
            <path class="range-mark" d="M0 -6 L6 0 L0 6 L-6 0 Z">
              <title>{`${tip(i, markName)}: ${format(v)}`}</title>
            </path>
          </svg>
        ),
      )}
    </svg>
  );
}
