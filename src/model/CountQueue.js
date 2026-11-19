// The count taps that are not in the sheet yet.
import { metricDayKey, parseMetricDay, planCount } from './LogEntry.js';
import { NumberMetric } from './Metric.js';

/** @import { Day } from './Day.js' */
/** @import { CountStep, LogTable, LogWrite, MetricDay } from './LogEntry.js' */
/** @import { Metric } from './Metric.js' */

/**
 * The count taps that are not in the sheet yet, per cell.
 *
 * A tap goes to the queue first. {@link CountQueue#send} moves all queued taps to the write that runs now, and
 * {@link CountQueue#sent} removes them when that write ends. Taps that come during the write stay in the queue for the
 * next write. So only one write runs at a time, and two writes cannot overwrite each other.
 */
export class CountQueue {
  /**
   * Taps that wait for a write, per cell, in tap order.
   * @type {Map<MetricDay, CountStep[]>}
   */
  #queued = new Map();

  /**
   * Taps in the write that runs now. The app shows them until the new data arrives.
   * @type {Map<MetricDay, CountStep[]>}
   */
  #sending = new Map();

  /** @returns {boolean} True if taps wait for a write. */
  get hasQueued() {
    return this.#queued.size > 0;
  }

  /** @returns {boolean} True while a write of taps runs: after `send` and before `sent`. */
  get isSending() {
    return this.#sending.size > 0;
  }

  /**
   * @returns {Map<MetricDay, CountStep[]>} All taps that are not in the sheet yet, per cell. The taps of the write that
   *   runs now come first.
   */
  get pending() {
    /** @type {Map<MetricDay, CountStep[]>} */
    const result = new Map();
    for (const key of new Set([...this.#sending.keys(), ...this.#queued.keys()])) {
      result.set(key, [...(this.#sending.get(key) ?? []), ...(this.#queued.get(key) ?? [])]);
    }
    return result;
  }

  /**
   * Adds a tap of `step` on the cell of `metricId` on `day`.
   * @param {string} metricId
   * @param {Day} day
   * @param {CountStep} step
   */
  add(metricId, day, step) {
    const key = metricDayKey(metricId, day);
    const steps = this.#queued.get(key);
    if (steps) steps.push(step);
    else this.#queued.set(key, [step]);
  }

  /**
   * Moves the queued taps to the write that runs now. Returns one plan for each cell with all taps of that cell.
   *
   * Each plan adds the taps to the latest value in the sheet. A cell of a metric that is not a number metric of
   * `metrics`, for example a metric that is gone from the sheet, gets no plan: `sent` drops its taps. Throws an error
   * if a write runs: call `sent` first.
   * @param {Map<string, Metric>} metrics The metrics by id.
   * @returns {((log: LogTable) => LogWrite | null)[]}
   */
  send(metrics) {
    if (this.isSending) throw new Error('A write of count taps runs. Call sent() first.');
    for (const [key, steps] of this.#queued) this.#sending.set(key, steps);
    this.#queued.clear();
    /** @type {((log: LogTable) => LogWrite | null)[]} */
    const plans = [];
    for (const [key, steps] of this.#sending) {
      const { metricId, day } = parseMetricDay(key);
      const metric = metrics.get(metricId);
      if (!(metric instanceof NumberMetric)) continue;
      const taps = [...steps];
      plans.push((log) => planCount(metric, day, taps, log));
    }
    return plans;
  }

  /**
   * Removes the taps of the write that ran. Call it when the write ends, also after an error: so the taps of a failed
   * write are not written again.
   */
  sent() {
    this.#sending.clear();
  }
}
