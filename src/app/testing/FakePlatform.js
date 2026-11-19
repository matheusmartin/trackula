// The platform of the UI tests: no browser storage, no browser history and no Google sign-in.
import { Day } from '../../model/Day.js';
import { Config } from '../../services/Config.js';
import { DemoStore } from '../../sheets/DemoStore.js';
import { CountingStore } from './CountingStore.js';

/** @import { BrowserHistory, Platform, Session } from '../Platform.js' */

/**
 * A {@link BrowserHistory} in memory. `entries` is the number of entries that the app added and that are still there.
 * `userBack()` is the Back button of the browser.
 * @implements {BrowserHistory}
 */
export class FakeHistory {
  constructor() {
    this.entries = 0;
    /** @private */
    this.handler = () => {};
  }

  push() {
    this.entries++;
  }

  back() {
    if (this.entries === 0) return;
    this.entries--;
    this.handler();
  }

  /** @param {() => void} handler */
  onBack(handler) {
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
   */
  constructor({
    config = new Config('123-abc.apps.googleusercontent.com', 'key'),
    isDemo = false,
    hasMouse = false,
    savedSpreadsheetId = null,
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
    this.history = new FakeHistory();
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
