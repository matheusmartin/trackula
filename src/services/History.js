/**
 * Adds an entry with the same URL to the history of the browser tab. Then the Back button of the browser, or the back
 * gesture of a phone, stays in the app: the browser removes this entry and calls the function of
 * {@link onHistoryBack}.
 */
export function pushHistoryEntry() {
  window.history.pushState(null, '');
}

/** Goes one entry back in the history of the browser tab, as the Back button does. */
export function historyBack() {
  window.history.back();
}

/**
 * Calls `handler` each time the browser goes back or forward in the history of the tab.
 * @param {() => void} handler
 */
export function onHistoryBack(handler) {
  window.addEventListener('popstate', () => handler());
}
