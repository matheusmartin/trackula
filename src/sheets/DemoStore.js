// Demo mode: sample data in memory, with the same parsers and write plans as SheetsStore. See README.md.
import { deletedMetrics } from '../model/DeletedMetric.js';
import { AppendRow, SetCell } from '../model/LogEntry.js';
import { AddMetricsColumns, DeleteMetricRow, MoveMetricRow, SetMetricCells } from '../model/MetricsWrite.js';
import { roundToStep } from '../model/NumberInput.js';
import { roundHalfAwayFromZero } from '../model/Numbers.js';
import { metricsHeader, parseLog, parseMetrics } from '../model/Parse.js';
import { Random } from './Random.js';
import { Snapshot, Store } from './Store.js';

/** @import { Day } from '../model/Day.js' */
/** @import { LogWrite } from '../model/LogEntry.js' */
/** @import { MetricsWrite } from '../model/MetricsWrite.js' */
/** @import { Cell } from '../model/Parse.js' */

/** The time that each call of a {@link DemoStore} waits by default, in milliseconds, as a network call. */
const DEFAULT_DELAY = 400;

/**
 * Demo mode: sample metrics and 120 days of sample values in memory. Nothing goes to Google Sheets, and a reload
 * starts again from the sample data. Open the app with `?demo`. See README.md.
 *
 * It keeps the tabs as rows of cells, as the Sheets API returns them, and uses the same parsers and write plans as
 * `SheetsStore`. `today` has no values, so that all inputs can be tried. Each call waits `delay` milliseconds, as a
 * network call. It has no `Score` column: the app calculates the scores that it shows from the values.
 */
export class DemoStore extends Store {
  /** @type {number} */
  #delay;

  /** @type {Cell[][]} */
  #metricRows;

  /** @type {Cell[][]} */
  #log;

  /**
   * @param {Day} today
   * @param {number} [delay] The wait of each call, in milliseconds. 400 by default. 0 does not wait.
   */
  constructor(today, delay = DEFAULT_DELAY) {
    super();
    this.#delay = delay;
    this.#metricRows = [metricsHeader, ...DemoStore.sampleMetrics].map((row) => [...row]);
    this.#log = DemoStore.sampleLog(today);
  }

  /** @returns {Promise<void>} */
  refreshRules() {
    return this.#wait();
  }

  /**
   * Reads the sample data. Demo mode has no `Score` column, so `writesScores` does nothing. As in `SheetsStore`, a
   * metric without a `Log` column gets one at the end.
   * @param {boolean} [_writesScores]
   * @returns {Promise<Snapshot>}
   */
  async load(_writesScores = true) {
    await this.#wait();
    const metrics = parseMetrics(this.#metricRows);
    const header = this.#log[0];
    header.push(...metrics.items.map((m) => m.id).filter((id) => !header.includes(id)));
    const ids = new Map(metrics.items.map((m) => [m.id, m]));
    const parsed = parseLog(this.#log, ids);
    const known = new Set([...ids.keys(), ...metrics.invalid.map((row) => row.id)]);
    return new Snapshot({
      metricsTable: metrics,
      log: parsed.table,
      warnings: [...metrics.warnings, ...parsed.warnings],
      deleted: deletedMetrics(this.#log, known),
    });
  }

  /**
   * @param {LogWrite} write
   * @returns {Promise<void>}
   */
  async apply(write) {
    await this.#wait();
    if (write instanceof AppendRow) this.#log.push([...write.toCells()]);
    else if (write instanceof SetCell) set(this.#log[write.row - 1], write.column, write.value ?? '');
  }

  /**
   * @param {MetricsWrite} write
   * @returns {Promise<void>}
   */
  async applyMetrics(write) {
    await this.#wait();
    const rows = this.#metricRows;
    if (write instanceof SetMetricCells) {
      while (rows.length < write.row) rows.push([]);
      for (const [column, value] of write.cells) set(rows[write.row - 1], column, value);
    } else if (write instanceof AddMetricsColumns) {
      write.names.forEach((name, i) => set(rows[0], write.start + i, name));
    } else if (write instanceof DeleteMetricRow) {
      rows.splice(write.row - 1, 1);
    } else if (write instanceof MoveMetricRow) {
      const [row] = rows.splice(write.row - 1, 1);
      rows.splice(write.before > write.row ? write.before - 2 : write.before - 1, 0, row);
    }
  }

  /**
   * Waits `delay` milliseconds, as a network call. A delay of 0 or less does not wait, as Kotlin `delay`.
   * @returns {Promise<void>}
   */
  async #wait() {
    if (this.#delay > 0) await new Promise((resolve) => setTimeout(resolve, this.#delay));
  }

  /**
   * The rows of the sample metrics, without the header.
   * @type {Cell[][]}
   */
  static sampleMetrics = [
    ['weight', 'Weight', 'number', 'kg', 0.1, 'Health', 'monitor_weight', 'at most 80 from 84 trend'],
    ['waist', 'Waist', 'number', 'cm', 0.5, 'Health', 'straighten', 'at most 90 from 95'],
    ['teeth', 'Morning teeth', 'yesno', '', '', 'Hygiene', 'dentistry', 'yes'],
    ['shower', 'Morning shower', 'yesno', '', '', 'Hygiene', 'shower', 'yes'],
    ['meditate', 'Meditate', 'yesno', '', '', 'Activities', 'self_improvement', 'yes'],
    ['read', 'Read', 'yesno', '', '', 'Activities', 'menu_book', 'yes'],
    ['water', 'Water', 'count', 'glasses', 1, 'Nutrition', 'water_drop', 'at least 8'],
    ['walk', 'Walk', 'count', 'min', 10, 'Activities', 'directions_walk', 'at least 30'],
    ['vitamins', 'Vitamins', 'yesno', '', '', 'Nutrition', 'pill', 'yes'],
  ];

  /**
   * The waist `daysAgo` days before today, for the 120 days of {@link DemoStore.sampleLog}: once a week, it goes down
   * from 95 cm (119 days ago) to 92 cm (7 days ago), in steps of 0.5 cm. Null on the other days.
   * @param {number} daysAgo
   * @returns {number | null}
   */
  static sampleWaist(daysAgo) {
    return daysAgo % 7 === 0 ? roundHalfAwayFromZero((95 - (120 - daysAgo) / 40) * 2) / 2 : null;
  }

  /**
   * One row for each of the 120 days before `today`. Values are random, with a fixed seed: the same each time.
   * @param {Day} today
   * @returns {Cell[][]}
   */
  static sampleLog(today) {
    const random = new Random(7);
    let weight = 84;
    /** @type {Cell[][]} */
    const rows = [['date', ...DemoStore.sampleMetrics.map((m) => m[0])]];
    for (let i = 120; i >= 1; i--) {
      /** @type {Cell[]} */
      const row = [today.addDays(-i).toString()];
      for (const m of DemoStore.sampleMetrics) {
        if (random.nextDouble() < 0.15) {
          row.push('');
        } else if (m[0] === 'weight') {
          weight += (random.nextDouble() - 0.55) * 0.4;
          row.push(roundToStep(weight, 0.1));
        } else if (m[0] === 'waist') {
          row.push(DemoStore.sampleWaist(i) ?? '');
        } else if (m[2] === 'yesno') {
          row.push(random.nextDouble() < 0.75 ? 'yes' : 'no');
        } else if (m[0] === 'water') {
          row.push(3 + random.nextInt(6));
        } else {
          row.push(10 * (1 + random.nextInt(6)));
        }
      }
      rows.push(row);
    }
    return rows;
  }
}

/**
 * Sets the cell `column` of `cells` to `value`. Adds empty cells before it if the row is shorter.
 * @param {Cell[]} cells
 * @param {number} column
 * @param {Cell} value
 */
function set(cells, column, value) {
  while (cells.length <= column) cells.push('');
  cells[column] = value;
}
