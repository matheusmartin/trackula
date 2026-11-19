// A random number generator with a seed, for the sample data of demo mode.

/**
 * Random numbers with a fixed seed: the same seed gives the same numbers each time. It uses the mulberry32 algorithm
 * by Tommy Ettinger. JavaScript has no generator with a seed. Kotlin `Random(7)` gives other numbers.
 *
 * It is not for secrets.
 */
export class Random {
  /** @type {number} */
  #state;

  /** @param {number} seed A whole number. */
  constructor(seed) {
    this.#state = seed | 0;
  }

  /** @returns {number} The next number from 0 (included) to 1 (not included). */
  nextDouble() {
    this.#state = (this.#state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.#state ^ (this.#state >>> 15), 1 | this.#state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * The next whole number from 0 (included) to `until` (not included), as Kotlin `nextInt(until)`.
   * @param {number} until A whole number above 0.
   * @returns {number}
   */
  nextInt(until) {
    if (!(until > 0)) throw new Error(`until must be above 0: ${until}`);
    return Math.floor(this.nextDouble() * until);
  }
}
