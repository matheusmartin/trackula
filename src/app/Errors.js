/**
 * The text of `e` for the user: its message, as the Dart app showed `'$e'`. A value that is not an `Error` gives its
 * text.
 * @param {unknown} e
 * @returns {string}
 */
export function errorText(e) {
  if (e instanceof Error) return e.message || String(e);
  return String(e);
}
