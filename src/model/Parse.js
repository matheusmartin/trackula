// Reads and checks the `Metrics` and `Log` tabs. See docs/data-model.md.
import { Day } from './Day.js';
import { LogTable } from './LogEntry.js';
import { NumberGoal, NumberMetric, YesNoMetric } from './Metric.js';
import { InvalidMetricRow, MetricsTable } from './MetricsTable.js';
import { numberOf, numberText, parseNumber } from './Numbers.js';

/** @import { LogEntry } from './LogEntry.js' */
/** @import { Metric } from './Metric.js' */

/**
 * A cell value as the Sheets API gives it. Null is an empty cell. An unchecked checkbox is `false`.
 * @typedef {string | number | boolean | null} Cell
 */

/** The title of the `Metrics` tab. Exact case: the app finds the tabs by title. See docs/data-model.md. */
export const METRICS_TITLE = 'Metrics';

/** The title of the `Log` tab. Exact case: the app finds the tabs by title. */
export const LOG_TITLE = 'Log';

/**
 * Column names of the `Metrics` tab, in the order the app creates them. All are required, except `goal`: older sheets
 * do not have it. Without the column, each row has no goal, so each row is invalid: the metrics screen can fix the
 * rows, and its first save adds the column. The app ignores other columns, for example `per_day` and `active` of
 * older sheets. Do not change this list.
 * @type {string[]}
 */
export const metricsHeader = ['id', 'name', 'kind', 'unit', 'step', 'group', 'icon', 'goal'];

/** The columns of {@link metricsHeader} that a `Metrics` tab must have. */
const requiredMetricsColumns = metricsHeader.filter((name) => name !== 'goal');

/** Thrown when a header row does not contain a required column. The message is the text for the user. */
export class HeaderException extends Error {
  /**
   * @param {string} tab
   * @param {string[]} missing
   */
  constructor(tab, missing) {
    super(`Tab "${tab}" has no column(s): ${missing.join(', ')}`);
    this.name = 'HeaderException';
    this.tab = tab;
    this.missing = missing;
  }

  /** @returns {string} The message only, without the class name, as in Dart. The app shows this text. */
  toString() {
    return this.message;
  }
}

/** Thrown when a row of the `Metrics` tab is not valid. The message tells the problem, for the user. */
export class InvalidMetricException extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'InvalidMetricException';
  }

  /** @returns {string} The message only, without the class name. The app shows this text. */
  toString() {
    return this.message;
  }
}

const idPattern = /^[a-z0-9_-]+$/;

/**
 * True if `id` is a valid metric id: lowercase letters, digits, `_` and `-`. Example: `morning_teeth`.
 * @param {string} id
 * @returns {boolean}
 */
export function isValidMetricId(id) {
  return idPattern.test(id);
}

/**
 * Parses the `Metrics` tab. `rows` includes the header row. Throws a {@link HeaderException} if a column is missing.
 * @param {Cell[][]} rows
 * @returns {MetricsTable}
 */
export function parseMetrics(rows) {
  const columns = headerColumns(METRICS_TITLE, rows, requiredMetricsColumns);
  /** @type {Metric[]} */
  const items = [];
  /** @type {Map<string, number>} */
  const rowOf = new Map();
  /** @type {InvalidMetricRow[]} */
  const invalid = [];
  /** @type {string[]} */
  const warnings = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = cellsByName(rows[i], columns);
    const row = new MetricRow(cells);
    if (row.isEmpty) continue;
    const at = `${METRICS_TITLE} row ${i + 1}`;

    const id = row.text('id');
    let problem = null;
    if (id === null || !isValidMetricId(id)) {
      problem = `invalid id "${id ?? ''}". Use only lowercase letters, digits, "_" and "-".`;
    } else if (rowOf.has(id)) {
      problem = `duplicate id "${id}"`;
    } else {
      try {
        items.push(metric(row, id));
        rowOf.set(id, i + 1);
      } catch (e) {
        if (!(e instanceof InvalidMetricException)) throw e;
        problem = e.message;
      }
    }
    if (problem !== null) {
      warnings.push(`${at}: ${problem}`);
      invalid.push(new InvalidMetricRow(i + 1, cells, problem));
    }
  }
  return new MetricsTable({
    items,
    warnings,
    rows: rowOf,
    columns,
    width: (rows[0] ?? []).length,
    invalid,
    // The Sheets API omits the empty rows at the end. A row with only unchecked checkboxes is not empty in Sheets.
    lastRow: Math.max(rows.length, 1),
  });
}

/**
 * The metric of the `Metrics` row `cells`, with the id `id`. The keys of `cells` are the lowercase header names, as in
 * {@link metricsHeader}. Throws an {@link InvalidMetricException} with the problem if the row is not valid. The app
 * checks the values of its metrics form with this function, so that the form and the parser accept the same rows.
 * @param {string} id
 * @param {Map<string, Cell>} cells
 * @returns {Metric}
 */
export function parseMetricRow(id, cells) {
  return metric(new MetricRow(cells), id);
}

/**
 * The metric of `row`. `id` is valid. Throws an {@link InvalidMetricException} with the problem if the row is not
 * valid.
 * @param {MetricRow} row
 * @param {string} id
 * @returns {Metric}
 */
function metric(row, id) {
  const name = row.text('name') ?? id;
  const group = row.text('group');
  const icon = row.text('icon');
  if (icon === null) {
    throw new InvalidMetricException('no icon. Use a Material Symbols name, such as "water_drop", or an emoji.');
  }
  const goal = row.cell('goal');
  const kind = row.text('kind');
  switch (kind) {
    case 'yesno':
      return new YesNoMetric({ id, name, icon, group, goalIsYes: yesNoGoal(goal) });
    case 'number':
    case 'count': {
      const step = row.number('step');
      return new NumberMetric({
        id,
        name,
        icon,
        unit: row.text('unit'),
        step: step !== null && step > 0 ? step : 1,
        isCount: kind === 'count',
        goal: numberGoal(goal, kind === 'count'),
        group,
      });
    }
    default:
      throw new InvalidMetricException(`invalid kind "${kind ?? ''}"`);
  }
}

/**
 * The goal of a yesno metric in the `goal` `cell`: true for `yes`, false for `no`. Throws an
 * {@link InvalidMetricException} if the cell is empty or has other values.
 * @param {Cell} cell
 * @returns {boolean}
 */
function yesNoGoal(cell) {
  if (isEmpty(cell)) throw new InvalidMetricException('no goal. For a yesno metric, use yes or no.');
  const value = yesNoValue(cell);
  if (value === null) {
    throw new InvalidMetricException(`invalid goal "${cellText(cell)}". For a yesno metric, use yes or no.`);
  }
  return value === 1;
}

/**
 * The goal of a number or count metric in the `goal` `cell`. See {@link NumberGoal} and docs/data-model.md.
 *
 * The cell has a direction, a target, an optional start after `from`, and an optional `trend`. Examples: `at least 8`,
 * `at most 80 from 83`, `at most 80 from 83 trend`. A number without a direction, such as `8`, is a minimum. The signs
 * `>=` and `<=` of older app versions are the same as `at least` and `at most`. Case does not matter.
 *
 * Throws an {@link InvalidMetricException} if the cell is empty or has a different form, if the start is not on the
 * other side of the target, or if a count metric (`isCount`) has `trend`.
 * @param {Cell} cell
 * @param {boolean} isCount
 * @returns {NumberGoal}
 */
function numberGoal(cell, isCount) {
  if (isEmpty(cell)) throw new InvalidMetricException(`no goal. ${NUMBER_GOAL_EXAMPLES}`);
  const number = numberOf(cell);
  if (number !== null) return new NumberGoal({ target: number });
  const text = cellText(cell);
  const match = numberGoalPattern.exec(text.trim());
  if (match === null) throw new InvalidMetricException(`invalid goal "${text}". ${NUMBER_GOAL_EXAMPLES}`);
  const [, direction = '', target, from = '', trend = ''] = match;
  const goal = new NumberGoal({
    target: Number(target),
    isMaximum: direction === '<=' || direction.toLowerCase().endsWith('most'),
    from: from === '' ? null : Number(from),
    usesTrend: trend !== '',
  });
  const start = goal.from;
  if (start !== null && goal.isReachedBy(start)) {
    const side = goal.isMaximum ? 'above' : 'below';
    throw new InvalidMetricException(`invalid goal "${text}". The value after from must be ${side} the target.`);
  }
  if (isCount && goal.usesTrend) {
    throw new InvalidMetricException(`invalid goal "${text}". Only a number metric can have a trend.`);
  }
  return goal;
}

/** Examples of number goals, for the problems of a goal cell. */
const NUMBER_GOAL_EXAMPLES = 'Use for example at least 8, at most 80, or at most 80 from 83 trend.';

/** A number in a goal: an optional minus sign, digits, and optional decimals after a period. */
const NUMBER = String.raw`-?\d+(?:\.\d+)?`;

/**
 * A number goal as text: an optional direction, the target, an optional `from` and a start, and an optional `trend`.
 * The groups: the direction, the target, the start and `trend`. Examples: `8`, `>= 8`, `at least 8`, `<=75.5`,
 * `at most 80 from 83 trend`.
 */
const numberGoalPattern = new RegExp(
  String.raw`^(at\s+least|at\s+most|>=|<=)?\s*(${NUMBER})(?:\s+from\s+(${NUMBER}))?(\s+trend)?$`,
  'i',
);

/**
 * The `Log` tab and a warning for each invalid cell or row.
 * @typedef {object} ParsedLog
 * @property {LogTable} table
 * @property {string[]} warnings
 */

/**
 * Parses the `Log` tab: column A is `date`, the other headers are metric ids. `rows` includes the header row. Throws a
 * {@link HeaderException} if column A is not `date`.
 * @param {Cell[][]} rows
 * @param {Map<string, Metric>} metrics The metrics by id.
 * @returns {ParsedLog}
 */
export function parseLog(rows, metrics) {
  const header = rows[0] ?? [];
  if (header.length === 0 || cellText(header[0]).trim().toLowerCase() !== 'date') {
    throw new HeaderException(LOG_TITLE, ['date']);
  }

  /** @type {string[]} */
  const warnings = [];
  const columns = logColumns(header, metrics, warnings);
  /** @type {LogEntry[]} */
  const entries = [];
  /** @type {Map<Day, number>} */
  const days = new Map();
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.every(isEmpty)) continue;
    const at = `${LOG_TITLE} row ${i + 1}`;
    const first = cellAt(cells, 0);
    const date = logDate(first);
    if (date === null) {
      warnings.push(`${at}: invalid date "${cellText(first).trim()}"`);
      continue;
    }
    if (days.has(date)) warnings.push(`${at}: ${date} has more than one row. The app uses the last row.`);
    days.set(date, i + 1);

    for (const [id, c] of columns) {
      const cell = cellAt(cells, c);
      if (isEmpty(cell)) continue;
      const metric = /** @type {Metric} */ (metrics.get(id));
      const value = logValue(metric, cell);
      if (value !== null) {
        entries.push({ row: i + 1, date, metricId: id, value });
      } else {
        const problem = metric instanceof YesNoMetric ? 'yesno value must be yes or no' : 'value is not a number';
        warnings.push(`${at}, column ${columnLetter(c)}: ${problem}`);
      }
    }
  }
  return { table: new LogTable(entries, days, columns), warnings };
}

/**
 * The 0-based column index of each metric in the `Log` `header`. Adds a warning to `warnings` for each duplicate
 * column.
 * @param {Cell[]} header
 * @param {Map<string, Metric>} metrics
 * @param {string[]} warnings
 * @returns {Map<string, number>}
 */
function logColumns(header, metrics, warnings) {
  /** @type {Map<string, number>} */
  const columns = new Map();
  for (let c = 1; c < header.length; c++) {
    const id = cellText(header[c]).trim();
    // A column with no metric, for example of a deleted metric: the app ignores the column and its values.
    if (id === '' || !metrics.has(id)) continue;
    if (columns.has(id)) {
      warnings.push(`${LOG_TITLE} column ${columnLetter(c)}: duplicate column "${id}". The app uses the first one.`);
    } else {
      columns.set(id, c);
    }
  }
  return columns;
}

/**
 * The date of a `date` cell. A real date is a serial number. Older app versions wrote the date as text: YYYY-MM-DD.
 * Null if the cell is not a valid date.
 * @param {Cell} cell
 * @returns {Day | null}
 */
export function logDate(cell) {
  if (typeof cell === 'number') return Day.fromSerial(cell);
  if (typeof cell === 'string') return Day.tryParse(cell);
  return null;
}

/**
 * The value of a non-empty `Log` `cell` of `metric`. Null if the value is not valid for the metric kind.
 * @param {Metric} metric
 * @param {Cell} cell
 * @returns {number | null}
 */
function logValue(metric, cell) {
  if (metric instanceof YesNoMetric) return yesNoValue(cell);
  if (typeof cell === 'number') return cell;
  if (typeof cell === 'string') return parseNumber(cell.trim());
  return null;
}

/**
 * A row of the `Log` tab with a date stored as text, and that date.
 * @typedef {object} TextDateRow
 * @property {number} row The 1-based row number.
 * @property {Day} date
 */

/**
 * The `Log` rows with a date stored as text (`YYYY-MM-DD`), as older app versions wrote it, and that date.
 *
 * The app changes these cells to real dates. Real dates (serial numbers) and invalid text do not change. `rows`
 * includes the header row.
 * @param {Cell[][]} rows
 * @returns {TextDateRow[]}
 */
export function textDateRows(rows) {
  /** @type {TextDateRow[]} */
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const first = cellAt(rows[i], 0);
    if (typeof first !== 'string') continue;
    const date = Day.tryParse(first);
    if (date !== null) result.push({ row: i + 1, date });
  }
  return result;
}

/**
 * Reads a yesno cell: `yes` is 1, `no` is 0. Case and spaces do not matter.
 *
 * Old app versions wrote `1` for yes, and a checked checkbox is `TRUE`: both are yes. `0` and `FALSE` are no. Returns
 * null for other values.
 * @param {Cell} cell
 * @returns {number | null}
 */
function yesNoValue(cell) {
  if (cell === true) return 1;
  if (typeof cell === 'number') {
    if (cell === 1) return 1;
    if (cell === 0) return 0;
    return null;
  }
  if (typeof cell === 'string') {
    const text = cell.trim().toLowerCase();
    if (text === 'yes' || text === 'true' || text === '1') return 1;
    if (text === 'no' || text === 'false' || text === '0') return 0;
  }
  return null;
}

/**
 * A `Log` cell with a yesno value of an old app version, and its new value.
 * @typedef {object} LegacyCell
 * @property {number} row The 1-based row number.
 * @property {number} column The 0-based column index.
 * @property {string} value `yes` or `no`.
 */

/**
 * The `Log` cells of yesno metrics that have a value of an old app version, and the new value of each cell.
 *
 * Old versions wrote `1` for yes. `1`, `TRUE` and `0`, also as text, become `yes` or `no`. Cells with `yes` or `no`,
 * empty cells and invalid values do not change. `rows` includes the header row.
 * @param {Cell[][]} rows
 * @param {Map<string, Metric>} metrics The metrics by id.
 * @returns {LegacyCell[]}
 */
export function legacyYesNoCells(rows, metrics) {
  if (rows.length === 0) return [];
  const seen = new Set();
  /** @type {number[]} */
  const columns = [];
  for (let c = 1; c < rows[0].length; c++) {
    const id = cellText(rows[0][c]).trim();
    if (metrics.get(id) instanceof YesNoMetric && !seen.has(id)) {
      seen.add(id);
      columns.push(c);
    }
  }
  /**
   * @param {Cell} cell
   * @returns {boolean} True if the cell has a value of this app version.
   */
  const isNew = (cell) => typeof cell === 'string' && ['yes', 'no'].includes(cell.trim().toLowerCase());
  /** @type {LegacyCell[]} */
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    for (const c of columns) {
      const cell = cellAt(rows[i], c);
      if (isEmpty(cell) || isNew(cell)) continue;
      const value = yesNoValue(cell);
      if (value !== null) result.push({ row: i + 1, column: c, value: value === 1 ? 'yes' : 'no' });
    }
  }
  return result;
}

/**
 * Spreadsheet column letter for a 0-based `index`. Example: 0 → A, 26 → AA.
 * @param {number} index
 * @returns {string}
 */
export function columnLetter(index) {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
    n = Math.trunc((n - 1) / 26);
  }
  return letters;
}

/**
 * True if the cell is empty. Empty checkbox cells return `false`, so `false` counts as empty.
 * @param {Cell} cell
 * @returns {boolean}
 */
export function isEmpty(cell) {
  return cell == null || cell === false || (typeof cell === 'string' && cell.trim() === '');
}

/**
 * The text of a `cell`, as Dart compiled to JavaScript gives it. A number has no ".0": 8 is "8". Null is "".
 * @param {Cell} cell
 * @returns {string}
 */
export function cellText(cell) {
  if (cell == null) return '';
  if (typeof cell === 'number') return numberText(cell);
  return String(cell);
}

/**
 * The cell at the 0-based `index` of `cells`. Null after the last cell: the Sheets API omits empty cells at the end of
 * a row.
 * @param {Cell[]} cells
 * @param {number} index
 * @returns {Cell}
 */
function cellAt(cells, index) {
  return cells[index] ?? null;
}

/**
 * The column index of each lowercase header name of `rows`. Throws a {@link HeaderException} if a `required` name is
 * missing.
 * @param {string} tab
 * @param {Cell[][]} rows
 * @param {string[]} required
 * @returns {Map<string, number>}
 */
function headerColumns(tab, rows, required) {
  const header = rows[0] ?? [];
  /** @type {Map<string, number>} */
  const columns = new Map();
  for (let i = 0; i < header.length; i++) columns.set(cellText(header[i]).trim().toLowerCase(), i);
  const missing = required.filter((name) => !columns.has(name));
  if (missing.length > 0) throw new HeaderException(tab, missing);
  return columns;
}

/**
 * The cells of a `Metrics` row by lowercase header name, for each of `columns`. The Sheets API omits empty cells at the
 * end of a row: they are null.
 * @param {Cell[]} cells
 * @param {Map<string, number>} columns
 * @returns {Map<string, Cell>}
 */
function cellsByName(cells, columns) {
  /** @type {Map<string, Cell>} */
  const result = new Map();
  for (const [name, c] of columns) if (name !== '') result.set(name, cellAt(cells, c));
  return result;
}

/** One row of the `Metrics` tab: its cells by lowercase header name. */
class MetricRow {
  /** @param {Map<string, Cell>} cells */
  constructor(cells) {
    this.cells = cells;
  }

  /** @returns {boolean} True if all cells are empty. */
  get isEmpty() {
    return [...this.cells.values()].every(isEmpty);
  }

  /**
   * The cell in column `name`. Null if the cell is empty, or if the tab has no such column.
   * @param {string} name
   * @returns {Cell}
   */
  cell(name) {
    return this.cells.get(name) ?? null;
  }

  /**
   * The trimmed text of the cell in column `name`. Null if the cell is empty.
   * @param {string} name
   * @returns {string | null}
   */
  text(name) {
    const cell = this.cell(name);
    if (cell === null) return null;
    const text = cellText(cell).trim();
    return text === '' ? null : text;
  }

  /**
   * The number in the cell in column `name`. Null if the cell is empty or not a number.
   * @param {string} name
   * @returns {number | null}
   */
  number(name) {
    const cell = this.cell(name);
    if (typeof cell === 'number') return cell;
    if (typeof cell === 'string') return parseNumber(cell.trim());
    return null;
  }
}
