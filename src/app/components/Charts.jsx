// The chart cards of the detail screen and their chart kinds. See Charts.kt.
import { useLayoutEffect, useRef } from 'preact/hooks';
import { daysBetween } from '../../model/Day.js';
import { barLabel, barTitle, formatNumber, formatPercent, shortDay } from '../../model/Format.js';
import { roundHalfAwayFromZero } from '../../model/Numbers.js';
import { useElementWidth } from './ElementWidth.js';
import { tileRows } from './TileRows.js';
import { SMALL_TEXT, WIDE_CONTENT } from './Sizes.js';
import './Charts.css';

/** @import { ComponentChildren, JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { BarUnit, ValueRange, ZoomBar } from '../../model/Zoom.js' */

/** The height of the bar and line charts, in chart units. */
const PLOT_UNITS = 50;

/** The width of one bar column, in chart units. */
const COLUMN_UNITS = 10;

/** The largest number of bars that always fit in the card. A chart with more bars can scroll to the side. */
const SCROLL_BARS = 12;

/** The smallest width of one bar column in a chart that scrolls, in CSS pixels. */
const COLUMN_WIDTH = 41.6;

/** The largest width of one bar column, in CSS pixels. A wide card with few bars shows them centered, not stretched. */
const MAX_COLUMN_WIDTH = 56;

/** The height of a bar or line chart, in CSS pixels. */
const PLOT_HEIGHT = 96;

/** The CSS pixels of one chart unit on the Y axis of a bar or line chart. */
const PLOT_SCALE = PLOT_HEIGHT / PLOT_UNITS;

/** The content width from which the chart grid has 3 columns, in CSS pixels. */
const THREE_COLUMNS = 1000;

/** The smallest space between two labels or two values in a row of columns, in CSS pixels. */
const LABEL_GAP = 4;

/** The largest number of values that {@link spokenValues} gives one by one. */
const MAX_SPOKEN = 14;

/** The largest number of bars that show their values above them. */
const MAX_BARS_WITH_VALUES = 13;

/** The largest number of days that show as single cells. Single days of a longer window are too small. */
const MAX_HEATMAP_DAYS = 371;

/**
 * The text of a value: at most 1 decimal.
 * @param {number} value
 * @returns {string}
 */
function defaultFormat(value) {
  return formatNumber(value);
}

/**
 * A number for an SVG attribute.
 * @param {number} value
 * @returns {string}
 */
function coordinate(value) {
  return String(Math.round(value * 100) / 100);
}

/**
 * The share `part` of `whole` as a CSS percentage, for an SVG attribute.
 * @param {number} part
 * @param {number} whole
 * @returns {string}
 */
function percent(part, whole) {
  return `${coordinate((100 * part) / whole)}%`;
}

/**
 * The data of a chart in a short text for screen readers: the `title` and each label with its value. With more than
 * 14 values, only the number of values, the lowest and the highest value.
 * @param {string} title
 * @param {string[]} labels
 * @param {(number | null)[]} values
 * @param {(value: number) => string} format
 * @returns {string}
 */
export function spokenValues(title, labels, values, format) {
  /** @type {[string, number][]} */
  const pairs = [];
  labels.forEach((label, i) => {
    const value = values[i];
    if (value != null) pairs.push([label, value]);
  });
  if (pairs.length === 0) return `${title}: no values`;
  if (pairs.length <= MAX_SPOKEN)
    return `${title}: ${pairs.map(([label, value]) => `${label} ${format(value)}`).join(', ')}`;
  const all = pairs.map(([, value]) => value);
  return `${title}: ${pairs.length} values, from ${format(Math.min(...all))} to ${format(Math.max(...all))}`;
}

/**
 * The y coordinate of a value from `low` (bottom) to `high` (top), in chart units, with 2 units of space at the top
 * and the bottom.
 * @param {number} high
 * @param {number} low
 * @returns {(value: number) => number}
 */
function yScale(high, low) {
  return (value) => (high === low ? PLOT_UNITS / 2 : 2 + ((PLOT_UNITS - 4) * (high - value)) / (high - low));
}

/** The canvas that measures the chart texts. Null if the browser has no canvas, for example in the tests. */
let measureContext = /** @type {CanvasRenderingContext2D | null} */ (null);

/** True after the first measure made {@link measureContext}. */
let measureReady = false;

/**
 * The width of `text` in the chart label font, in CSS pixels. Without a canvas, for example in the tests, an estimate:
 * the digits of Roboto are 0.56 em wide.
 * @param {string} text
 * @returns {number}
 */
function textWidth(text) {
  if (!measureReady) {
    measureReady = true;
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    measureContext = canvas?.getContext('2d') ?? null;
    if (measureContext != null) {
      const font = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'sans-serif';
      measureContext.font = `400 ${SMALL_TEXT}px ${font}`;
    }
  }
  if (measureContext == null) return text.length * 0.56 * SMALL_TEXT;
  return measureContext.measureText(text).width;
}

/**
 * A chart card: a title, a one-sentence description, the chart, and labels below it. The title is a heading.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {ComponentChildren} props.children
 * @returns {JSX.Element}
 */
export function ChartCard({ title, description, children }) {
  return (
    <section class="chart-card">
      <h3 class="chart-card-title title-small">{title}</h3>
      <p class="chart-card-description chart-label chart-label-trim">{description}</p>
      {children}
    </section>
  );
}

/**
 * The text of a chart card with no chart.
 * @returns {JSX.Element}
 */
export function NoValues() {
  return <p class="chart-no-values body-small">No values in this period.</p>;
}

/**
 * A card of a {@link ChartGrid}: `wide` cards take a full row. `key` tells the cards apart when the grid changes.
 * @typedef {object} ChartItem
 * @property {string} key
 * @property {boolean} wide
 * @property {() => JSX.Element} content
 */

/**
 * The chart cards of the detail screen: 1 column on phones, 2 on wider screens, 3 from 1000 px. Wide cards take the
 * full width. Dense: a small card fills the gap before a wide card (see `tileRows`). The cards are in the order of the
 * rows, so that the order of the keyboard focus is the order on the screen. Each card has its own height.
 * @param {object} props
 * @param {ChartItem[]} props.items
 * @returns {JSX.Element}
 */
export function ChartGrid({ items }) {
  const [measure, width] = useElementWidth();
  const columns = width >= THREE_COLUMNS ? 3 : width >= WIDE_CONTENT ? 2 : 1;
  const rows = tileRows(items, columns, (item) => item.wide);
  return (
    <div ref={measure} class="chart-grid" style={{ '--chart-columns': columns }}>
      {rows.flat().map((i) => (
        <div key={items[i].key} class={items[i].wide ? 'chart-grid-item chart-grid-wide' : 'chart-grid-item'}>
          {items[i].content()}
        </div>
      ))}
    </div>
  );
}

/**
 * Key numbers in tiles, as many columns as fit, each at least 144 px wide. Few tiles stretch to fill the row. Each
 * tile has a tooltip with its label and its value.
 * @param {object} props
 * @param {[string, string][]} props.items Pairs of label and value.
 * @returns {JSX.Element}
 */
export function KeyNumbers({ items }) {
  return (
    <ul class="key-numbers">
      {items.map(([label, value]) => (
        <li key={label} class="key-number" title={`${label}: ${value}`}>
          <span class="key-number-value title-large">{value}</span>
          <span class="key-number-label chart-label">{label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One bar of a {@link BarChart}. A null value draws no bar.
 * @typedef {object} Bar
 * @property {string} label
 * @property {number | null} value
 */

/**
 * One text for each column of a chart, each in the center of its column. `texts` has one entry for each column: a
 * null or empty entry shows nothing. If the widest text does not fit in a column, only each second, third or later
 * text shows, so that the texts do not overlap: counted from the last column with `fromEnd`, else from the first
 * column. A text at an edge stays inside the chart.
 * @param {object} props
 * @param {(string | null)[]} props.texts
 * @param {string} props.class The CSS classes of the row: the text style and the space.
 * @param {boolean} [props.fromEnd] Default: false.
 * @returns {JSX.Element | null}
 */
export function ColumnTexts({ texts, class: className, fromEnd = false }) {
  const [measure, width] = useElementWidth();
  if (texts.length === 0) return null;
  const widths = texts.map((text) => (text ? textWidth(text) : 0));
  const needed = Math.max(...widths) + LABEL_GAP;
  const column = width / texts.length;
  // Before the first layout, and in the tests without layout, all texts show.
  const stride = width > 0 ? Math.max(1, Math.ceil(needed / column)) : 1;
  const last = texts.length - 1;
  return (
    <div ref={measure} class={`column-texts ${className}`}>
      {texts.map((text, i) => {
        if (!text || (fromEnd ? last - i : i) % stride !== 0) return null;
        const left = Math.min(Math.max(0, (i + 0.5) * column - widths[i] / 2), Math.max(0, width - widths[i]));
        return (
          <span
            key={i}
            class="column-text"
            style={
              width > 0
                ? { left: `${coordinate(left)}px` }
                : { left: percent(i + 0.5, texts.length), transform: 'translateX(-50%)' }
            }
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The labels under a chart. With 12 labels or fewer, or with `all`: one label in each column, and only each second or
 * later label if the columns are too narrow (see {@link ColumnTexts}). Else the first and the last label.
 * @param {object} props
 * @param {string[]} props.labels
 * @param {boolean} [props.all] Default: false.
 * @returns {JSX.Element | null}
 */
export function Labels({ labels, all = false }) {
  if (labels.length === 0) return null;
  if (all || labels.length <= 12) return <ColumnTexts texts={labels} class="chart-labels chart-label" />;
  return (
    <div class="chart-labels chart-ends chart-label">
      <span>{labels[0]}</span>
      <span>{labels[labels.length - 1]}</span>
    </div>
  );
}

/**
 * `children` at most `columns` × 56 px wide, centered. With more than 12 columns, also at least `columns` × 41.6 px
 * wide. If that is wider than the card, the chart scrolls to the side: with a finger, a trackpad, the mouse wheel or
 * the arrow keys. It starts at the right end, with the newest bars.
 * @param {object} props
 * @param {number} props.columns
 * @param {ComponentChildren} props.children
 * @returns {JSX.Element}
 */
export function Scroller({ columns, children }) {
  const scroller = useRef(/** @type {HTMLDivElement | null} */ (null));
  const scrolls = columns > SCROLL_BARS;
  // The scroll width of the last render: a new width scrolls to the right end again.
  const scrollWidth = useRef(0);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element == null || element.scrollWidth === scrollWidth.current) return;
    scrollWidth.current = element.scrollWidth;
    element.scrollLeft = element.scrollWidth;
  });
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element == null) return;
    // A vertical mouse wheel scrolls to the side. At an end, the page scrolls as usual.
    /** @param {WheelEvent} event */
    const wheel = (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const before = element.scrollLeft;
      element.scrollLeft += event.deltaY;
      if (element.scrollLeft !== before) event.preventDefault();
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [scrolls]);
  if (!scrolls) {
    return (
      <div class="chart-columns" style={{ maxInlineSize: `${MAX_COLUMN_WIDTH * columns}px` }}>
        {children}
      </div>
    );
  }
  return (
    // The keyboard can scroll the chart: arrow keys on the focused chart.
    <div ref={scroller} class="chart-scroller" tabIndex={0}>
      <div
        class="chart-scroller-content"
        style={{
          inlineSize: `max(min(100%, ${MAX_COLUMN_WIDTH * columns}px), ${coordinate(COLUMN_WIDTH * columns)}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The values above the bars of a bar chart, one in each column. A null value has no text. If the columns are too
 * narrow for the values, only each second or later value shows, and the newest value always shows. A negative value
 * has a minus sign.
 * @param {object} props
 * @param {(number | null)[]} props.values
 * @param {(value: number) => string} props.format
 * @returns {JSX.Element | null}
 */
export function ValueRow({ values, format }) {
  return (
    <ColumnTexts
      texts={values.map((v) => (v == null ? null : format(v).replace('-', '−')))}
      class="chart-values chart-label"
      fromEnd
    />
  );
}

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
 * @param {string} [props.bar] Default: the theme primary color.
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
  bar = 'var(--primary)',
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
    onDay == null ? 'One cell for each day of the window.' : 'Tap a day to show its month in the calendar.';
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
