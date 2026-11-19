// The charts that compare a period with the periods before it. See CompareCharts.kt.
import { formatNumber, formatSigned } from '../../model/Format.js';
import { stepChanges } from '../../model/ScoreStats.js';
import { ChartCard, Labels, Legend, NoValues, RangeBars, Scroller, ValueRow, spokenValues } from './Charts.jsx';
import { useElementWidth } from './ElementWidth.js';
import './CompareCharts.css';

/** @import { JSX } from 'preact' */
/** @import { ValueRange } from '../../model/Zoom.js' */

/**
 * The text of a value: at most 1 decimal.
 * @param {number} value
 * @returns {string}
 */
function defaultFormat(value) {
  return formatNumber(value);
}

/**
 * For each of `labels`, a bar from the lowest to the highest value of `ranges`, a dot at their average, and a diamond
 * at the value of `marks`. The values of `marks` are above the bars. A null range has no bar, and a null mark has no
 * diamond and no value. The scale goes from a little below the lowest value to the highest value, but not below 0, so
 * that the bars are tall enough to compare. The legend names the bar `rangeLabel`, the dot "Average" and the diamond
 * `markLabel`. Example: the score of each weekday of this week in the range of the 4 weeks before.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {string[]} props.labels
 * @param {(ValueRange | null)[]} props.ranges
 * @param {(number | null)[]} props.marks
 * @param {string} props.rangeLabel
 * @param {string} props.markLabel
 * @param {(value: number) => string} [props.format] Default: at most 1 decimal.
 * @returns {JSX.Element}
 */
export function RangeBarChart({
  title,
  description,
  labels,
  ranges,
  marks,
  rangeLabel,
  markLabel,
  format = defaultFormat,
}) {
  const values = [
    ...ranges.flatMap((r) => (r == null ? [] : [r.low, r.high])),
    ...marks.flatMap((v) => (v == null ? [] : [v])),
  ];
  if (values.length === 0) {
    return (
      <ChartCard title={title} description={description}>
        <NoValues />
      </ChartCard>
    );
  }
  const high = Math.max(...values);
  const lowest = Math.min(...values);
  // Space below the lowest value, so that its bar or diamond is not on the bottom line.
  const low = Math.max(0, lowest - Math.max(high - lowest, 1) * 0.25);
  // A grey bar, not the primary color: in the score view, that is the green of the diamonds. The grey has a contrast
  // of 3:1 or more on the card, and the dot on the grey, in both themes.
  const bar = 'var(--outline)';
  const dot = 'var(--surface-container-lowest)';
  return (
    <ChartCard title={title} description={description}>
      <Scroller columns={labels.length}>
        <ValueRow values={marks} format={format} />
        <RangeBars
          ranges={ranges}
          high={Math.max(high, low + 1)}
          low={low}
          label={spokenValues(title, labels, marks, format)}
          titles={labels}
          format={format}
          bar={bar}
          dot={dot}
          marks={marks}
          rangeName={rangeLabel}
          markName={markLabel}
        />
        <Labels labels={labels} all />
      </Scroller>
      <Legend
        parts={[
          { label: rangeLabel, color: bar, values: [] },
          // The dot is on the bar: the legend shows it in the color of the text, not in the color of the card.
          { label: 'Average', color: 'var(--on-surface-variant)', values: [] },
          { label: markLabel, color: 'var(--cell)', values: [] },
        ]}
      />
    </ChartCard>
  );
}

/** The largest width of the row labels of a {@link ChangeTable}, in CSS pixels. */
const ROW_LABEL_WIDTH = 112;

/** The lowest share of the full color in a cell of a {@link ChangeTable} with a change, so that a small change shows. */
const MIN_CHANGE_FILL = 0.2;

/**
 * The highest share of the full color in a day of the score calendar or a cell of a {@link ChangeTable}, so that the
 * number on it stays readable.
 */
export const MAX_FILL = 0.7;

/**
 * The CSS color of a cell: `share` (0 to 1) of `color` on the empty cell color. The colors mix in Oklab, as `lerp` of
 * Compose.
 * @param {string} color
 * @param {number} share
 * @returns {string}
 */
export function cellFill(color, share) {
  return `color-mix(in oklab, var(--cell-empty), ${color} ${Math.round(share * 10000) / 100}%)`;
}

/**
 * A table of numbers: one row for each of `rows`, one column for each of `columns`. A row is a label and one value for
 * each column. The color of a cell shows the change from the cell on its left (see `stepChanges`): the cell color for
 * more, the tertiary color for less. A larger change has a stronger color, up to the largest change of the table. A
 * cell without change has the empty color: a cell of the first column, a cell with the same value as the cell on its
 * left, and a cell with no value on it or on its left. A null value shows "–". The legend names the 2 colors `upLabel`
 * and `downLabel`. If `rows` is empty, the card says that there are no values. Each cell has a tooltip and a name for
 * screen readers with its row, its column, its value and its change.
 *
 * Example: the average score of each group in each of the last 5 weeks.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {string[]} props.columns
 * @param {[string, (number | null)[]][]} props.rows
 * @param {string} props.upLabel
 * @param {string} props.downLabel
 * @param {(value: number) => string} [props.format] Default: at most 1 decimal.
 * @returns {JSX.Element}
 */
export function ChangeTable({ title, description, columns, rows, upLabel, downLabel, format = defaultFormat }) {
  const [measure, width] = useElementWidth();
  if (rows.length === 0) {
    return (
      <ChartCard title={title} description={description}>
        <NoValues />
      </ChartCard>
    );
  }
  const up = 'var(--cell)';
  const down = 'var(--tertiary)';
  const changes = rows.map(([, values]) => stepChanges(values));
  const largest = Math.max(0, ...changes.flat().map((c) => Math.abs(c ?? 0)));
  // Narrow cards: a smaller label column, so that the numbers fit in their cells.
  const labelWidth = width > 0 ? Math.min(ROW_LABEL_WIDTH, width * 0.3) : ROW_LABEL_WIDTH;
  return (
    <ChartCard title={title} description={description}>
      <div ref={measure}>
        <table class="change-table">
          <thead>
            <tr>
              <td class="change-table-corner" style={{ inlineSize: `${Math.round(labelWidth * 100) / 100}px` }} />
              {columns.map((c) => (
                <th key={c} scope="col" class="change-table-column chart-label">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, values], r) => (
              <tr key={label}>
                <th scope="row" class="change-table-label chart-label">
                  <span class="change-table-label-text chart-label-trim">{label}</span>
                </th>
                {values.map((v, i) => {
                  const change = changes[r][i];
                  const fill =
                    change == null || change === 0 || largest === 0
                      ? 'var(--cell-empty)'
                      : cellFill(
                          change > 0 ? up : down,
                          MIN_CHANGE_FILL + (MAX_FILL - MIN_CHANGE_FILL) * (Math.abs(change) / largest),
                        );
                  const text = v == null ? null : format(v);
                  // Example: "Habits, Nov 9: 6.8, +2.1 from Nov 2".
                  const spoken =
                    `${label}, ${columns[i]}: ${text ?? 'no value'}` +
                    (change == null ? '' : `, ${formatSigned(change, null)} from ${columns[i - 1]}`);
                  return (
                    <td key={i} class="change-table-cell" aria-label={spoken} title={spoken}>
                      <span class="change-table-fill chart-ink" style={{ '--fill': fill }} aria-hidden="true">
                        {text ?? '–'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Legend
        parts={[
          { label: upLabel, color: up, values: [] },
          { label: downLabel, color: down, values: [] },
        ]}
      />
    </ChartCard>
  );
}
