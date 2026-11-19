// The parts of the app that need the browser. `BrowserPlatform.js` uses the browser. The UI tests use a fake
// (`testing/FakePlatform.js`).

/** @import { Day } from '../model/Day.js' */
/** @import { Config } from '../services/Config.js' */
/** @import { Store } from '../sheets/Store.js' */

/**
 * The history of the browser tab, for the Back button of the browser and the back gesture of a phone. See
 * `BackDispatcher` in `Back.js`.
 * @typedef {object} BrowserHistory
 * @property {() => void} push Adds an entry for the current page. A later back removes it and calls the function of
 *   `onBack`.
 * @property {() => void} back Goes one entry back, as the Back button does. The function of `onBack` also runs.
 * @property {(handler: () => void) => void} onBack Sets the function that runs after each back of the browser.
 */

/**
 * A signed-in Google user.
 * @typedef {object} Session
 * @property {boolean} expired True if the access token expired. It lasts 1 hour, and there is no refresh token in the
 *   browser.
 * @property {() => Promise<string | null>} pickSpreadsheet Opens the Google Picker. Gives the ID of the picked
 *   spreadsheet, or null if the user cancels.
 * @property {(spreadsheetId: string) => Promise<void>} prepare Adds the `Metrics` and `Log` tabs to the spreadsheet if
 *   they are missing.
 * @property {(spreadsheetId: string) => Store} store The store of the spreadsheet.
 */

/**
 * The parts of the app that need the browser: the URL, the clock, local storage, the history, the Google sign-in and
 * the Google Picker.
 * @typedef {object} Platform
 * @property {Config} config
 * @property {boolean} isDemo True if the URL has `?demo`. Then the app uses sample data in memory. See `DemoStore`.
 * @property {boolean} hasMouse True if the main pointer of the device is a mouse or a touchpad, as on a desktop
 *   computer. False on a phone or a tablet. Example: the metrics screen moves a metric with a drag of the mouse, or
 *   else with arrow buttons.
 * @property {() => Day} today Today in the time zone of the device.
 * @property {(key: string) => string | null} readPref The setting in local storage. Null if it is not set, or if
 *   storage is blocked.
 * @property {(key: string, value: string | null) => void} writePref Sets the setting in local storage. A null value
 *   removes it.
 * @property {BrowserHistory} history
 * @property {(selectAccount: boolean) => Promise<Session>} signIn Opens the Google sign-in popup. Call it from a click
 *   handler, or the browser can block the popup. With `selectAccount`, the user picks the account. Throws an error if
 *   the sign-in fails.
 */

/**
 * The spreadsheet ID in local storage. Null if the user did not choose a sheet. Not secret: access needs a sign-in.
 * @param {Platform} platform
 * @returns {string | null}
 */
export function savedSpreadsheetId(platform) {
  return platform.readPref('spreadsheetId');
}

/**
 * Keeps the spreadsheet ID in local storage. Null removes it.
 * @param {Platform} platform
 * @param {string | null} id
 */
export function saveSpreadsheetId(platform, id) {
  platform.writePref('spreadsheetId', id);
}
