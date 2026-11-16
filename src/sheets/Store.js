// The storage of the metrics and the log.
//
// The sheets port (docs/js-port.md, phase 3) replaces the loose types below with the types of the model:
// MetricsTable, LogTable, LogWrite, MetricsWrite, Metric and DeletedMetric.

/**
 * The data of the spreadsheet at one point in time.
 * @typedef {object} Snapshot
 * @property {any} metricsTable The `Metrics` tab: the metrics, their rows and the invalid rows.
 * @property {any[]} metrics All valid metrics, in sheet order: `metricsTable.items`.
 * @property {any} log The `Log` tab.
 * @property {string[]} warnings
 * @property {any[]} deleted The `Log` columns without a metric, in column order.
 */

/**
 * The storage of the metrics and the log. `SheetsStore` uses Google Sheets. `DemoStore` keeps sample data in memory,
 * for demo mode. A subclass gives `refreshRules`, `load`, `apply` and `applyMetrics`.
 * @abstract
 */
export class Store {
  /**
   * Sets the data validation rules of the sheet again. Nothing in demo mode.
   * @abstract
   * @returns {Promise<void>}
   */
  async refreshRules() {
    throw new Error('Not implemented');
  }

  /**
   * Reads the metrics and the log, and validates each row.
   * @abstract
   * @param {boolean} [_writesScores] True if the load also writes the scores that changed in the `Score` column. Only
   *   `SheetsStore` writes them. See docs/data-model.md.
   * @returns {Promise<Snapshot>}
   */
  async load(_writesScores = true) {
    throw new Error('Not implemented');
  }

  /**
   * Writes a change to the `Log` tab. Callers use {@link Store#change} or {@link Store#changeAll}, which plan the
   * write on the latest data.
   * @abstract
   * @param {any} _write
   * @returns {Promise<void>}
   */
  async apply(_write) {
    throw new Error('Not implemented');
  }

  /**
   * Writes a change to the `Metrics` tab. Callers use {@link Store#changeMetrics}, which plans the write on the latest
   * data.
   * @abstract
   * @param {any} _write
   * @returns {Promise<void>}
   */
  async applyMetrics(_write) {
    throw new Error('Not implemented');
  }

  /**
   * Reads the latest data, writes the changes of `plan` to the `Metrics` tab, sets the rules again and reads the data
   * again. The last load adds the `Log` column of a new metric and writes the new scores, for example after a new
   * goal. The rules follow the new kinds and the new columns.
   * @param {(metricsTable: any) => any[]} plan
   * @returns {Promise<Snapshot>}
   */
  async changeMetrics(plan) {
    const writes = plan((await this.load(false)).metricsTable);
    for (const write of writes) await this.applyMetrics(write);
    if (writes.length > 0) await this.refreshRules();
    return this.load();
  }

  /**
   * Reads the latest data, writes the change of `plan` on it, and reads the data again. The read before the write
   * keeps row numbers correct after manual edits in the sheet.
   * @param {(log: any) => any | null} plan
   * @returns {Promise<Snapshot>}
   */
  async change(plan) {
    return this.changeAll([plan]);
  }

  /**
   * Runs the plans one after the other, each on the latest data. So a plan sees the row that an earlier plan added for
   * the same day. It writes the scores once, after the last write: not after each plan. Example: the Save button of 9
   * Today tiles writes the score of today once, not 9 times.
   * @param {((log: any) => any | null)[]} plans
   * @returns {Promise<Snapshot>}
   */
  async changeAll(plans) {
    let data = await this.load(false);
    // True if a write came after the last load that wrote the scores.
    let scoresStale = false;
    for (const [i, plan] of plans.entries()) {
      const write = plan(data.log);
      if (write == null) continue;
      await this.apply(write);
      const isLast = i === plans.length - 1;
      data = await this.load(isLast);
      scoresStale = !isLast;
    }
    return scoresStale ? this.load() : data;
  }
}
