// The `Log` columns without a metric: the columns of deleted metrics. See docs/data-model.md.
import { cellText, isEmpty, isValidMetricId, logDate } from './Parse.js';

/** @import { Day } from './Day.js' */
/** @import { Cell } from './Parse.js' */

/**
 * A `Log` column without a metric: the column of a deleted metric. Its values stay in the sheet, so the app can show
 * the metric again. See docs/data-model.md.
 * @typedef {object} DeletedMetric
 * @property {string} id The column header: the id of the deleted metric.
 * @property {number} values The number of cells with a value.
 * @property {Day | null} lastDay The last day with a value. Null if the column has no values.
 * @property {boolean} isYesNo True if the column has values and all of them are `yes` or `no`: the metric was of kind
 *   `yesno`.
 */

/**
 * The deleted metrics of the `Log` tab: the columns whose header is a valid id that is not in `metricIds`. `rows`
 * includes the header row. A duplicate column counts once: the first one. The `date` and `Score` columns are not
 * metrics. `metricIds` also has the ids of the invalid rows of the `Metrics` tab: such a row is not deleted, and the
 * app fixes it, not restores it.
 *
 * Example: a `Log` header `date, weight, steps, Score` and the metric `weight` give the deleted metric `steps`.
 * @param {Cell[][]} rows
 * @param {Set<string>} metricIds
 * @returns {DeletedMetric[]}
 */
export function deletedMetrics(rows, metricIds) {
  const header = rows[0] ?? [];
  const seen = new Set();
  /** @type {number[]} */
  const columns = [];
  for (let c = 1; c < header.length; c++) {
    const id = cellText(header[c]).trim();
    if (isValidMetricId(id) && !metricIds.has(id) && !seen.has(id)) {
      seen.add(id);
      columns.push(c);
    }
  }
  return columns.map((c) => {
    const cells = rows.slice(1).filter((row) => !isEmpty(row[c] ?? null));
    /** @type {Day | null} */
    let lastDay = null;
    for (const row of cells) {
      const day = logDate(row[0] ?? null);
      if (day !== null && (lastDay === null || day.isAfter(lastDay))) lastDay = day;
    }
    return {
      id: cellText(header[c]).trim(),
      values: cells.length,
      lastDay,
      isYesNo: cells.length > 0 && cells.every((row) => ['yes', 'no'].includes(cellText(row[c]).trim().toLowerCase())),
    };
  });
}
