/**
 * A filter that tells single taps from double-taps. One tap waits at a time, for any key, such as a cell.
 *
 * A single tap runs only when the wait ends without a second tap on the same key. A second tap in that time is a
 * double-tap: it runs at once and the single tap is dropped. A tap on another key runs the waiting single tap at once.
 * Fast repeated taps on one key alternate: 3 quick taps are a double-tap and a single tap.
 *
 * Two keys are the same key if `===` is true. For a pair of values, use a text key, for example
 * `` `${metricId}|${day}` ``.
 *
 * The wait uses `setTimeout`. Call {@link DoubleTap#dispose} when the input goes away. An error in a single tap does
 * not stop the next taps.
 * @template K
 */
export class DoubleTap {
  /** @type {K | null} */
  #key = null;

  /** @type {(() => void) | null} */
  #single = null;

  /** @type {ReturnType<typeof setTimeout> | null} */
  #timer = null;

  /** @type {number} */
  #wait;

  /** @param {number} [wait] The time that a single tap waits for a second tap, in milliseconds. */
  constructor(wait = 300) {
    this.#wait = wait;
  }

  /** @returns {boolean} True while a single tap waits. */
  get #waiting() {
    return this.#timer !== null;
  }

  /**
   * Adds a tap on `key`. `onSingle` runs after the wait if no second tap comes, and `onDouble` runs at the second tap.
   * @param {K} key
   * @param {() => void} onSingle
   * @param {() => void} onDouble
   */
  tap(key, onSingle, onDouble) {
    if (this.#waiting && this.#key === key) {
      this.#cancelTimer();
      this.#single = null;
      onDouble();
      return;
    }
    this.flush();
    this.#key = key;
    this.#single = onSingle;
    this.#timer = setTimeout(() => {
      // The wait has ended: a tap in onSingle is a new tap, not a double-tap.
      this.#timer = null;
      this.#runSingle();
    }, this.#wait);
  }

  /** Runs the waiting single tap at once, if there is one. */
  flush() {
    if (!this.#waiting) return;
    this.#cancelTimer();
    this.#runSingle();
  }

  /** Drops the waiting single tap. */
  dispose() {
    this.#cancelTimer();
  }

  /** Runs the waiting single tap, and removes it so that it runs only once. */
  #runSingle() {
    const single = this.#single;
    this.#single = null;
    single?.();
  }

  /** Stops the wait. */
  #cancelTimer() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}
