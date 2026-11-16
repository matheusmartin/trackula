// A store for the UI tests. See FakePlatform.js.
import { Store } from '../../sheets/Store.js';

/** @import { Snapshot } from '../../sheets/Store.js' */

/**
 * A {@link Store} that counts the calls of `inner`, for the UI tests. With `failWrites`, each write fails at once, as
 * without a network. With a `gate`, each write waits until the test opens the gate, and then fails if `failWrites`.
 */
export class CountingStore extends Store {
  /** @param {Store} inner */
  constructor(inner) {
    super();
    this.inner = inner;
    this.loads = 0;
    /** @type {any[]} */
    this.writes = [];
    /** @type {any[]} */
    this.metricsWrites = [];
    /**
     * The data of the last load. The page loads after each write, so this has the result of the last write.
     * @type {Snapshot | null}
     */
    this.last = null;
    this.failWrites = false;
    /** True if the next write fails. That write sets it back to false. */
    this.failOnce = false;
    /** @type {Gate | null} */
    this.gate = null;
  }

  /** @returns {Promise<void>} */
  async refreshRules() {
    return this.inner.refreshRules();
  }

  /**
   * @param {boolean} [writesScores]
   * @returns {Promise<Snapshot>}
   */
  async load(writesScores = true) {
    this.loads++;
    this.last = await this.inner.load(writesScores);
    return this.last;
  }

  /**
   * @param {any} write
   * @returns {Promise<void>}
   */
  async apply(write) {
    if (this.gate != null) await this.gate.promise;
    if (this.failOnce) {
      this.failOnce = false;
      throw new Error('No network.');
    }
    if (this.failWrites) throw new Error('No network.');
    this.writes.push(write);
    await this.inner.apply(write);
  }

  /**
   * @param {any} write
   * @returns {Promise<void>}
   */
  async applyMetrics(write) {
    if (this.failWrites) throw new Error('No network.');
    this.metricsWrites.push(write);
    await this.inner.applyMetrics(write);
  }
}

/** A promise that the test resolves with `open()`: the `CompletableDeferred` of the Kotlin test. */
export class Gate {
  constructor() {
    /** @type {() => void} */
    let open = () => {};
    /** @type {Promise<void>} */
    this.promise = new Promise((resolve) => {
      open = resolve;
    });
    this.open = open;
  }
}
