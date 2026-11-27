// The plans of the changes to the `Metrics` tab. See docs/data-model.md.
import { metricCells } from './MetricCells.js';
import { metricsHeader } from './Parse.js';

/** @import { Metric } from './Metric.js' */
/** @import { InvalidMetricRow, MetricsTable } from './MetricsTable.js' */
/** @import { Cell } from './Parse.js' */

/**
 * A change to the `Metrics` tab: a {@link SetMetricCells}, a {@link DeleteMetricRow}, a {@link MoveMetricRow} or an
 * {@link AddMetricsColumns}. Check the kind with `instanceof`. The `plan` functions below make them from the latest
 * {@link MetricsTable}, so the row numbers are correct after manual edits in the sheet.
 * @typedef {SetMetricCells | DeleteMetricRow | MoveMetricRow | AddMetricsColumns} MetricsWrite
 */

/**
 * Writes the value of each 0-based column of `cells` in the 1-based `row`. The other cells of the row do not change.
 * An empty text clears a cell. A row after the last row is a new row.
 */
export class SetMetricCells {
  /**
   * @param {number} row
   * @param {Map<number, string | number>} cells
   */
  constructor(row, cells) {
    this.row = row;
    this.cells = cells;
    Object.freeze(this);
  }
}

/** Deletes the 1-based `row`. The rows below it move up. */
export class DeleteMetricRow {
  /** @param {number} row */
  constructor(row) {
    this.row = row;
    Object.freeze(this);
  }
}

/**
 * Moves the 1-based `row` to the place before the row `before`. Both numbers are the row numbers before the move.
 * Examples: `new MoveMetricRow(5, 3)` moves row 5 to row 3. `new MoveMetricRow(3, 6)` moves row 3 to row 5.
 */
export class MoveMetricRow {
  /**
   * @param {number} row
   * @param {number} before
   */
  constructor(row, before) {
    this.row = row;
    this.before = before;
    Object.freeze(this);
  }
}

/** Writes the header `names` in row 1, from the 0-based column `start`. */
export class AddMetricsColumns {
  /**
   * @param {number} start
   * @param {string[]} names
   */
  constructor(start, names) {
    this.start = start;
    this.names = names;
    Object.freeze(this);
  }
}

/**
 * Thrown when the `Metrics` tab has no row for a metric now, for example after a manual edit while the app is open.
 * The message is the text for the user.
 */
export class MissingMetricException extends Error {
  /** @param {string} metricId */
  constructor(metricId) {
    super(`The Metrics tab has no row "${metricId}" now. Reload to see the latest data.`);
    this.name = 'MissingMetricException';
    this.metricId = metricId;
  }

  /** @returns {string} The message only, without the class name. The app shows this text. */
  toString() {
    return this.message;
  }
}

/**
 * Thrown when an invalid row of the `Metrics` tab changed in the sheet after the app read it. The message is the text
 * for the user.
 */
export class ChangedRowException extends Error {
  /** @param {number} row */
  constructor(row) {
    super(`Row ${row} of the Metrics tab changed in the sheet. Reload to see the latest data.`);
    this.name = 'ChangedRowException';
    this.row = row;
  }

  /** @returns {string} The message only, without the class name. The app shows this text. */
  toString() {
    return this.message;
  }
}

/**
 * The writes that put `metric` in the `Metrics` tab `table`: in the row with its id, or in a new row after the last
 * row. If the tab has no column of {@link metricsHeader}, for example the `goal` column of an older sheet, the writes
 * add it first.
 * @param {MetricsTable} table
 * @param {Metric} metric
 * @returns {MetricsWrite[]}
 */
export function planSaveMetric(table, metric) {
  return planCells(table, table.rows.get(metric.id) ?? table.lastRow + 1, metricCells(metric));
}

/**
 * The writes that change the row of `metric` in `table`: the row with its id. Throws a {@link MissingMetricException}
 * if `table` has no row with the id, for example after a deletion in the sheet: a change does not add the metric
 * again.
 * @param {MetricsTable} table
 * @param {Metric} metric
 * @returns {MetricsWrite[]}
 */
export function planEditMetric(table, metric) {
  if (!table.rows.has(metric.id)) throw new MissingMetricException(metric.id);
  return planSaveMetric(table, metric);
}

/**
 * The writes that replace the invalid row `old` with `metric`. The row is found by its cells, not by its number, as a
 * manual edit can move it. Throws a {@link ChangedRowException} if `table` has no invalid row with the cells of `old`.
 * @param {MetricsTable} table
 * @param {InvalidMetricRow} old
 * @param {Metric} metric
 * @returns {MetricsWrite[]}
 */
export function planFixRow(table, old, metric) {
  return planCells(table, rowOf(table, old), metricCells(metric));
}

/**
 * The write that deletes the row of the metric `id`. Throws a {@link MissingMetricException} if `table` has no such
 * row.
 * @param {MetricsTable} table
 * @param {string} id
 * @returns {MetricsWrite}
 */
export function planDeleteMetric(table, id) {
  const row = table.rows.get(id);
  if (row === undefined) throw new MissingMetricException(id);
  return new DeleteMetricRow(row);
}

/**
 * The write that deletes the invalid row `old`. Throws a {@link ChangedRowException} if the row changed. See
 * {@link planFixRow}.
 * @param {MetricsTable} table
 * @param {InvalidMetricRow} old
 * @returns {MetricsWrite}
 */
export function planDeleteRow(table, old) {
  return new DeleteMetricRow(rowOf(table, old));
}

/**
 * The write that moves the metric `id` one place up (`up`) or down: before the metric above it, or after the metric
 * below it. Other rows between the two, for example empty or invalid rows, do not move. Null if the metric is the
 * first one (`up`) or the last one. Throws a {@link MissingMetricException} if `table` has no row for `id`.
 * @param {MetricsTable} table
 * @param {string} id
 * @param {boolean} up
 * @returns {MetricsWrite | null}
 */
export function planMoveMetric(table, id, up) {
  const index = table.items.findIndex((m) => m.id === id);
  // The same id gives null: the first metric does not move up, and the last one does not move down.
  const otherId = table.items[up ? index - 1 : index + 1]?.id ?? id;
  return planMoveMetricTo(table, id, otherId);
}

/**
 * The write that moves the metric `id` to the place of the metric `otherId`, as a drag does: before the row of
 * `otherId` if `id` is below it now, or after it if `id` is above it. The rows between them move one place. Null if
 * `otherId` is `id`, or if `table` has no metric `otherId`. Throws a {@link MissingMetricException} if `table` has no
 * row for `id`.
 *
 * Example: the metrics weight (row 2), waist (row 3) and water (row 4). Weight to the place of water gives
 * `new MoveMetricRow(2, 5)`: the order is waist, water, weight.
 * @param {MetricsTable} table
 * @param {string} id
 * @param {string} otherId
 * @returns {MetricsWrite | null}
 */
export function planMoveMetricTo(table, id, otherId) {
  const row = table.rows.get(id);
  if (row === undefined) throw new MissingMetricException(id);
  if (otherId === id || !table.items.some((m) => m.id === otherId)) return null;
  const otherRow = /** @type {number} */ (table.rows.get(otherId));
  return new MoveMetricRow(row, row > otherRow ? otherRow : otherRow + 1);
}

/**
 * The row of the invalid row `old` in `table`, found by its cells. Throws a {@link ChangedRowException} if it is gone.
 * @param {MetricsTable} table
 * @param {InvalidMetricRow} old
 * @returns {number}
 */
function rowOf(table, old) {
  const row = table.invalid.find((r) => sameCells(r.cells, old.cells));
  if (row === undefined) throw new ChangedRowException(old.row);
  return row.row;
}

/**
 * True if `a` and `b` have the same names and the same values.
 * @param {Map<string, Cell>} a
 * @param {Map<string, Cell>} b
 * @returns {boolean}
 */
function sameCells(a, b) {
  if (a.size !== b.size) return false;
  for (const [name, value] of a) if (!b.has(name) || !Object.is(b.get(name), value)) return false;
  return true;
}

/**
 * Writes `cells` by header name in `row`, and adds the missing columns of {@link metricsHeader} first.
 * @param {MetricsTable} table
 * @param {number} row
 * @param {Map<string, string | number>} cells
 * @returns {MetricsWrite[]}
 */
function planCells(table, row, cells) {
  const missing = metricsHeader.filter((name) => !table.columns.has(name));
  const columns = new Map(table.columns);
  missing.forEach((name, i) => columns.set(name, table.width + i));
  /** @type {Map<number, string | number>} */
  const byColumn = new Map();
  for (const [name, value] of cells) byColumn.set(/** @type {number} */ (columns.get(name)), value);
  const write = new SetMetricCells(row, byColumn);
  return missing.length === 0 ? [write] : [new AddMetricsColumns(table.width, missing), write];
}
