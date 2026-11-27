// The platform of the UI tests: no browser storage, no browser history and no Google sign-in.
import { Day } from '../../model/Day.js';
import { Config } from '../../services/Config.js';
import { DemoStore } from '../../sheets/DemoStore.js';
import { CountingStore } from './CountingStore.js';

/** @import { BrowserHistory, Platform, Session } from '../Platform.js' */

/**
 * A {@link BrowserHistory} in memory, as the history of a browser tab: a list of entries and the current one. `depth`
 * is the position of the current entry. `userBack()` is the Back button of the browser. As in a browser, the function
 * of `onChange` runs after a back, not during it.
 * @implements {BrowserHistory}
 */
export class FakeHistory {
  /** @param {string} [hash] The address of the first page, for example `#/days`. */
  constructor(hash = '') {
    /**
     * @private
     * @type {{ hash: string, index: number }[]}
     */
    this.entries = [{ hash, index: 0 }];
    this.depth = 0;
    /** @private */
    this.handler = () => {};
  }

  /** @returns {string} */
  hash() {
    return this.entries[this.depth].hash;
  }

  /** @returns {number} */
  index() {
    return this.entries[this.depth].index;
  }

  /**
   * @param {string} hash
   * @param {number} index
   */
  push(hash, index) {
    this.entries.splice(this.depth + 1);
    this.entries.push({ hash, index });
    this.depth++;
  }

  /**
   * @param {string} hash
   * @param {number} index
   */
  replace(hash, index) {
    this.entries[this.depth] = { hash, index };
  }

  back() {
    if (this.depth === 0) return;
    this.depth--;
    queueMicrotask(() => this.handler());
  }

  /** @param {() => void} handler */
  onChange(handler) {
    this.handler = handler;
  }

  /** The user presses the Back button of the browser. */
  userBack() {
    this.back();
  }
}

/**
 * A {@link Session} that picks the spreadsheet `sheet-1` and stores demo data in memory.
 * @implements {Session}
 */
export class FakeSession {
  /** @param {Day} today */
  constructor(today) {
    this.expired = false;
    /** @type {string[]} */
    this.prepared = [];
    this.countingStore = new CountingStore(new DemoStore(today, 0));
  }

  /** @returns {Promise<string | null>} */
  async pickSpreadsheet() {
    return 'sheet-1';
  }

  /**
   * @param {string} spreadsheetId
   * @returns {Promise<void>}
   */
  async prepare(spreadsheetId) {
    this.prepared.push(spreadsheetId);
  }

  /**
   * @param {string} _spreadsheetId
   * @returns {CountingStore}
   */
  store(_spreadsheetId) {
    return this.countingStore;
  }
}

/**
 * A {@link Platform} for the UI tests. `signIn` gives a {@link FakeSession} with demo data.
 * @implements {Platform}
 */
export class FakePlatform {
  /**
   * @param {object} [options]
   * @param {Config} [options.config]
   * @param {boolean} [options.isDemo]
   * @param {boolean} [options.hasMouse]
   * @param {string | null} [options.savedSpreadsheetId]
   * @param {string} [options.hash] The address of the first page, for example `#/metric/weight`.
   */
  constructor({
    config = new Config('123-abc.apps.googleusercontent.com', 'key'),
    isDemo = false,
    hasMouse = false,
    savedSpreadsheetId = null,
    hash = '',
  } = {}) {
    this.config = config;
    this.isDemo = isDemo;
    this.hasMouse = hasMouse;
    /**
     * The local storage.
     * @type {Map<string, string>}
     */
    this.prefs = new Map();
    if (savedSpreadsheetId != null) this.prefs.set('spreadsheetId', savedSpreadsheetId);
    this.history = new FakeHistory(hash);
    this.todayValue = Day.of(2026, 10, 3);
    /**
     * The `selectAccount` argument of each sign-in.
     * @type {boolean[]}
     */
    this.signIns = [];
    this.session = new FakeSession(this.todayValue);
  }

  /** @returns {Day} */
  today() {
    return this.todayValue;
  }

  /**
   * @param {string} key
   * @returns {string | null}
   */
  readPref(key) {
    return this.prefs.get(key) ?? null;
  }

  /**
   * @param {string} key
   * @param {string | null} value
   */
  writePref(key, value) {
    if (value == null) this.prefs.delete(key);
    else this.prefs.set(key, value);
  }

  /**
   * @param {boolean} selectAccount
   * @returns {Promise<Session>}
   */
  async signIn(selectAccount) {
    this.signIns.push(selectAccount);
    return this.session;
  }
}
