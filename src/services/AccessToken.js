/** The token counts as expired this time before Google ends it, in milliseconds. */
const MARGIN = 20_000;

/**
 * A Google access token. It stays in memory only. It lasts about 1 hour, and there is no refresh token in the browser.
 *
 * The token counts as expired 20 seconds before Google ends it, as in the Dart googleapis_auth package, so that a
 * request does not start just before the end.
 */
export class AccessToken {
  /** The time at which the token counts as expired, in the milliseconds of `timeSource`. */
  #deadline;

  /** @type {() => number} */
  #timeSource;

  /**
   * @param {string} value The access token.
   * @param {number} expiresIn The time until Google ends the token, in milliseconds.
   * @param {() => number} [timeSource] Gives the current time in milliseconds. The default is the monotonic clock of
   *   the browser, `performance.now()`. Tests give a fake clock.
   */
  constructor(value, expiresIn, timeSource = () => performance.now()) {
    this.value = value;
    this.#timeSource = timeSource;
    this.#deadline = timeSource() + expiresIn - MARGIN;
  }

  /** @returns {boolean} True if the access token expired. */
  get expired() {
    return this.#timeSource() >= this.#deadline;
  }
}
