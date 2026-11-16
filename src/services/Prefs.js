/** The prefix of the keys of this app in the local storage of the browser. */
const PREFIX = 'trackula.';

/**
 * The setting `key`. Null if it is not set, or if storage is blocked.
 * @param {string} key
 * @returns {string | null}
 */
export function readPref(key) {
  try {
    return window.localStorage.getItem(`${PREFIX}${key}`);
  } catch {
    // The browser throws a DOMException when storage is blocked.
    return null;
  }
}

/**
 * Sets the setting `key` to `value`. A null `value` removes the setting. If storage is blocked, the setting is lost
 * after a reload.
 * @param {string} key
 * @param {string | null} value
 */
export function writePref(key, value) {
  try {
    if (value == null) {
      window.localStorage.removeItem(`${PREFIX}${key}`);
    } else {
      window.localStorage.setItem(`${PREFIX}${key}`, value);
    }
  } catch {
    // Storage is blocked. See readPref.
  }
}
