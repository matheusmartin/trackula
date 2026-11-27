/**
 * The text of `e` for the user: its message. A value that is not an `Error` gives its text.
 * @param {unknown} e
 * @returns {string}
 */
export function errorText(e) {
  if (e instanceof Error) return e.message || String(e);
  return String(e);
}
