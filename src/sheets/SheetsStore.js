// STUB until the sheets port (docs/js-port.md, phase 3). Only the constructor and the names are final.
import { Store } from './Store.js';

/** @import { SheetsClient } from './SheetsClient.js' */

/** The store of one Google spreadsheet. */
export class SheetsStore extends Store {
  /** @param {SheetsClient} api */
  constructor(api) {
    super();
    this.api = api;
  }

  /**
   * Adds the `Metrics` and `Log` tabs if they are missing.
   * @returns {Promise<void>}
   */
  async ensureTabs() {
    throw new Error('Not implemented');
  }
}
