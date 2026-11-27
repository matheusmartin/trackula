// The Platform of the browser. Only main.jsx uses it: the UI tests use a fake (testing/FakePlatform.js).
import { Config } from '../services/Config.js';
import { currentHash, currentIndex, historyBack, onHistoryChange, pushHash, replaceHash } from '../services/History.js';
import { pickSpreadsheet } from '../services/Picker.js';
import { readPref, writePref } from '../services/Prefs.js';
import { Session as GoogleSession } from '../services/Session.js';
import { today } from '../services/Today.js';

/** @import { Store } from '../sheets/Store.js' */
/** @import { Platform, Session } from './Platform.js' */

/**
 * A {@link Session} with the Google access token of a signed-in user.
 * @implements {Session}
 */
class BrowserSession {
  /** @type {GoogleSession} */
  #google;

  /** @param {GoogleSession} google */
  constructor(google) {
    this.#google = google;
  }

  /** @returns {boolean} True if the access token expired. */
  get expired() {
    return this.#google.expired;
  }

  /** @returns {Promise<string | null>} */
  pickSpreadsheet() {
    return pickSpreadsheet(this.#google.accessToken);
  }

  /**
   * @param {string} spreadsheetId
   * @returns {Promise<void>}
   */
  prepare(spreadsheetId) {
    return this.#google.store(spreadsheetId).ensureTabs();
  }

  /**
   * @param {string} spreadsheetId
   * @returns {Store}
   */
  store(spreadsheetId) {
    return this.#google.store(spreadsheetId);
  }
}

/**
 * The {@link Platform} of the browser. It reads the URL and the pointer of the device when the module loads.
 * @type {Platform}
 */
export const browserPlatform = {
  config: Config.build,
  isDemo: hasDemoParameter(),
  hasMouse: hasFinePointer(),
  today,
  readPref,
  writePref,
  history: {
    hash: currentHash,
    index: currentIndex,
    push: pushHash,
    replace: replaceHash,
    back: historyBack,
    onChange: onHistoryChange,
  },
  async signIn(selectAccount) {
    return new BrowserSession(await GoogleSession.signIn(selectAccount, browserPlatform.config));
  },
};

/**
 * True if the main pointer of the device is precise, as a mouse or a touchpad: the CSS media query `pointer: fine`.
 * @returns {boolean}
 */
function hasFinePointer() {
  return window.matchMedia('(pointer: fine)').matches;
}

/**
 * True if the URL of the page has the parameter `demo`, for example `?demo`.
 * @returns {boolean}
 */
function hasDemoParameter() {
  return new URLSearchParams(window.location.search).has('demo');
}
