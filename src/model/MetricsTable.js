// The `Metrics` tab: the valid metrics, the invalid rows, and where each row and column is. See docs/data-model.md.
import { cellText } from './Parse.js';

/** @import { Metric } from './Metric.js' */
/** @import { Cell } from './Parse.js' */

/**
 * The fields of a {@link MetricsTable}.
 * @typedef {object} MetricsTableFields
 * @property {Metric[]} items
 * @property {string[]} [warnings] Empty by default.
 * @property {Map<string, number>} [rows] Empty by default.
 * @property {Map<string, number>} [columns] Empty by default.
 * @property {number} [width] 0 by default.
 * @property {InvalidMetricRow[]} [invalid] Empty by default.
 * @property {number} [lastRow] 1 by default.
 */

/** The `Metrics` tab: the valid metrics, and where each row and column is. See docs/data-model.md. */
export class MetricsTable {
  /** @param {MetricsTableFields} fields */
  constructor({ items, warnings = [], rows = new Map(), columns = new Map(), width = 0, invalid = [], lastRow = 1 }) {
    /** The valid metrics, in row order. */
    this.items = items;
    /** One warning for each row in `invalid`. */
    this.warnings = warnings;
    /** The 1-based row number of each metric, by id. */
    this.rows = rows;
    /**
     * The 0-based column index of each lowercase header name. The app ignores the columns that are not in
     * `metricsHeader`, but they can be in this map.
     */
    this.columns = columns;
    /** The number of cells of the header row. A new column goes after them. */
    this.width = width;
    /** The rows that the app does not show, with their problem. Examples: no icon, an invalid goal. */
    this.invalid = invalid;
    /**
     * The 1-based number of the last row with a value. 1 if the tab has only the header. A new metric goes in the row
     * after it.
     */
    this.lastRow = lastRow;
    Object.freeze(this);
  }
}

/** A row of the `Metrics` tab that is not valid, so the app does not show it. */
export class InvalidMetricRow {
  /**
   * @param {number} row The 1-based row number.
   * @param {Map<string, Cell>} cells The cells of the row, by lowercase header name. An empty cell is null or an empty
   *   text.
   * @param {string} problem The problem, for the user. Example: `no icon. Use a Material Symbols name …`.
   */
  constructor(row, cells, problem) {
    this.row = row;
    this.cells = cells;
    this.problem = problem;
    Object.freeze(this);
  }

  /** @returns {string} The text in the `id` cell, trimmed. Empty if the cell is empty. */
  get id() {
    return cellText(this.cells.get('id') ?? null).trim();
  }
}
