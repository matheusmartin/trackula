// The charts that compare a period with the periods before it.
import { formatNumber, formatSigned } from '../../model/Format.js';
import { stepChanges } from '../../model/ScoreStats.js';
import { ChartCard, NoValues } from './ChartParts.jsx';
import { Legend } from './Charts.jsx';
import { useElementWidth } from './ElementWidth.js';
import './CompareCharts.css';

/** @import { ComponentChildren, JSX } from 'preact' */

/**
 * The text of a value: at most 1 decimal.
 * @param {number} value
 * @returns {string}
 */
function defaultFormat(value) {
  return formatNumber(value);
}

/** The largest width of the row labels of a {@link ChangeTable}, in CSS pixels. */
const ROW_LABEL_WIDTH = 112;

/** The lowest share of the full color in a cell of a {@link ChangeTable} with a change, so that a small change shows. */
const MIN_CHANGE_FILL = 0.2;

/** The highest share of the full color in a cell of a {@link ChangeTable}, so that the number on it stays readable. */
const MAX_FILL = 0.7;

/**
 * The CSS color of a cell: `share` (0 to 1) of `color` on the grey of a cell without change. The colors mix in Oklab.
 * @param {string} color
 * @param {number} share
 * @returns {string}
 */
function changeFill(color, share) {
  return `color-mix(in oklab, var(--cell-value), ${color} ${Math.round(share * 10000) / 100}%)`;
}

/**
 * A table of numbers: one row for each of `rows`, one column for each of `columns`. A row is a label and one value for
 * each column. The color of a cell shows the change from the cell on its left (see `stepChanges`): the cell color for
 * more, the contrast color for less. A larger change has a stronger color, up to the largest change of the table. A
 * cell without change is grey (`--cell-value`): a cell of the first column, a cell with the same value as the cell on its
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
 * @param {ComponentChildren} [props.action] A control in the title row. See `ChartCard`. Default: null.
 * @returns {JSX.Element}
 */
export function ChangeTable({
  title,
  description,
  columns,
  rows,
  upLabel,
  downLabel,
  format = defaultFormat,
  action = null,
}) {
  const [measure, width] = useElementWidth();
  if (rows.length === 0) {
    return (
      <ChartCard title={title} description={description} action={action}>
        <NoValues />
      </ChartCard>
    );
  }
  const up = 'var(--cell)';
  const down = 'var(--data-contrast)';
  const changes = rows.map(([, values]) => stepChanges(values));
  const largest = Math.max(0, ...changes.flat().map((c) => Math.abs(c ?? 0)));
  // Narrow cards: a smaller label column, so that the numbers fit in their cells.
  const labelWidth = width > 0 ? Math.min(ROW_LABEL_WIDTH, width * 0.3) : ROW_LABEL_WIDTH;
  return (
    <ChartCard title={title} description={description} action={action}>
      <div ref={measure}>
        <table class="change-table" aria-label={title}>
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
                      ? 'var(--cell-value)'
                      : changeFill(
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
