// The parts of the chart cards: the card, the grid of cards, the key numbers, the column texts, the scroller, and
// the sizes and helpers of the charts.
import { useLayoutEffect, useRef } from 'preact/hooks';
import { formatNumber } from '../../model/Format.js';
import { useElementWidth } from './ElementWidth.js';
import { tileRows } from './TileRows.js';
import { SMALL_TEXT, WIDE_CONTENT } from './Sizes.js';
import './Charts.css';

/** @import { ComponentChildren, JSX } from 'preact' */

/** The height of the bar and line charts, in chart units. */
export const PLOT_UNITS = 50;

/** The width of one bar column, in chart units. */
export const COLUMN_UNITS = 10;

/** The largest number of bars that always fit in the card. A chart with more bars can scroll to the side. */
const SCROLL_BARS = 12;

/** The smallest width of one bar column in a chart that scrolls, in CSS pixels. */
const COLUMN_WIDTH = 41.6;

/** The largest width of one bar column, in CSS pixels. A wide card with few bars shows them centered, not stretched. */
export const MAX_COLUMN_WIDTH = 56;

/** The height of a bar or line chart, in CSS pixels. */
const PLOT_HEIGHT = 96;

/** The CSS pixels of one chart unit on the Y axis of a bar or line chart. */
export const PLOT_SCALE = PLOT_HEIGHT / PLOT_UNITS;

/** The content width from which the chart grid has 3 columns, in CSS pixels. */
const THREE_COLUMNS = 1000;

/** The smallest space between two labels or two values in a row of columns, in CSS pixels. */
const LABEL_GAP = 4;

/** The largest number of values that {@link spokenValues} gives one by one. */
const MAX_SPOKEN = 14;

/** The largest number of bars that show their values above them. */
export const MAX_BARS_WITH_VALUES = 13;

/** The largest number of days that show as single cells. Single days of a longer window are too small. */
export const MAX_HEATMAP_DAYS = 371;

/**
 * The text of a value: at most 1 decimal.
 * @param {number} value
 * @returns {string}
 */
export function defaultFormat(value) {
  return formatNumber(value);
}

/**
 * A number for an SVG attribute.
 * @param {number} value
 * @returns {string}
 */
export function coordinate(value) {
  return String(Math.round(value * 100) / 100);
}

/**
 * The share `part` of `whole` as a CSS percentage, for an SVG attribute.
 * @param {number} part
 * @param {number} whole
 * @returns {string}
 */
export function percent(part, whole) {
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
export function yScale(high, low) {
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
