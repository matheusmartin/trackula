// The history of the browser tab: the address of each screen after `#`, the Back button of the browser and the back
// gesture of a phone.

/**
 * The address of the current entry of the history: the part of the URL from `#`, for example `#/days`. Empty if the
 * URL has no `#`.
 * @returns {string}
 */
export function currentHash() {
  return window.location.hash;
}

/**
 * The position of the current entry among the entries that the app added: 0 for the first page that the app shows.
 * The app keeps it in the state of each entry, so it stays after a reload.
 * @returns {number}
 */
export function currentIndex() {
  const state = window.history.state;
  return typeof state?.index === 'number' ? state.index : 0;
}

/**
 * Adds an entry with the address `hash` after the current entry. The path and the parameters of the URL stay, for
 * example `?demo`.
 * @param {string} hash Example: `#/metric/weight`.
 * @param {number} index The position of the new entry. See {@link currentIndex}.
 */
export function pushHash(hash, index) {
  window.history.pushState({ index }, '', hash);
}

/**
 * Changes the address of the current entry to `hash`, without a new entry.
 * @param {string} hash
 * @param {number} index The position of the entry. See {@link currentIndex}.
 */
export function replaceHash(hash, index) {
  window.history.replaceState({ index }, '', hash);
}

/** Goes one entry back in the history of the browser tab, as the Back button does. */
export function historyBack() {
  window.history.back();
}

/**
 * Calls `handler` each time the browser goes to another entry of the history: the Back or Forward button, the back
 * gesture of a phone, or a change of the address after `#`.
 * @param {() => void} handler
 */
export function onHistoryChange(handler) {
  window.addEventListener('popstate', () => handler());
}
