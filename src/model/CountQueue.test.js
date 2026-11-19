import { describe, expect, test } from 'vitest';
import { CountQueue } from './CountQueue.js';
import { Day } from './Day.js';
import { AppendRow, SetCell, metricDayKey } from './LogEntry.js';
import { NumberGoal, NumberMetric } from './Metric.js';
import { parseLog } from './Parse.js';
import { byId, meditate } from './testing/Fixtures.js';

/** @import { CountStep, LogTable, MetricDay } from './LogEntry.js' */
/** @import { Cell } from './Parse.js' */

describe('CountQueue', () => {
  const water = new NumberMetric({
    id: 'water',
    name: 'Water',
    icon: 'water_drop',
    goal: new NumberGoal({ target: 8 }),
    isCount: true,
  });
  const walk = new NumberMetric({
    id: 'walk',
    name: 'Walk',
    icon: 'directions_walk',
    goal: new NumberGoal({ target: 30 }),
    step: 10,
    isCount: true,
  });
  const metrics = byId(water, walk, meditate);
  const d30 = Day.of(2026, 9, 30);
  const d01 = Day.of(2026, 10, 1);
  const plus = { delta: 1 };
  const minus = { delta: -1 };

  /**
   * The deltas of each cell of `pending`, to compare them with `toEqual`.
   * @param {Map<MetricDay, CountStep[]>} pending
   * @returns {Map<MetricDay, number[]>}
   */
  function deltas(pending) {
    return new Map([...pending].map(([key, steps]) => [key, steps.map((s) => s.delta)]));
  }

  /**
   * @param {...Cell[]} rows
   * @returns {LogTable}
   */
  function log(...rows) {
    return parseLog([['date', 'water', 'walk', 'meditate'], ...rows], metrics).table;
  }

  /**
   * A queue with the taps of `taps`, in order.
   * @param {[string, Day, CountStep][]} taps
   * @returns {CountQueue}
   */
  function queueOf(taps) {
    const queue = new CountQueue();
    for (const [metricId, day, step] of taps) queue.add(metricId, day, step);
    return queue;
  }

  test('a new queue has no taps', () => {
    const queue = new CountQueue();
    expect(queue.hasQueued).toBe(false);
    expect(queue.isSending).toBe(false);
    expect(queue.pending).toEqual(new Map());
    expect(queue.send(metrics)).toEqual([]);
  });

  test('add keeps the taps in tap order per cell', () => {
    const queue = queueOf([
      ['water', d30, plus],
      ['water', d30, minus],
      ['water', d01, plus],
    ]);
    expect(queue.hasQueued).toBe(true);
    expect(deltas(queue.pending)).toEqual(
      new Map([
        [metricDayKey('water', d30), [1, -1]],
        [metricDayKey('water', d01), [1]],
      ]),
    );
  });

  test('send gives one plan for each cell with all taps of that cell', () => {
    const queue = queueOf([
      ['water', d30, plus],
      ['water', d30, plus],
      ['walk', d30, { delta: 10 }],
    ]);
    const plans = queue.send(metrics);
    expect(queue.hasQueued).toBe(false);
    expect(queue.isSending).toBe(true);

    const current = log(['2026-09-30', 3, 20]);
    expect(plans.map((plan) => plan(current))).toStrictEqual([new SetCell(2, 1, 5), new SetCell(2, 2, 30)]);
  });

  test('a plan adds the taps to the latest value, not to the value at the tap', () => {
    const queue = queueOf([['water', d30, plus]]);
    const [plan] = queue.send(metrics);
    // Another device wrote 6 after the tap.
    expect(plan(log(['2026-09-30', 6]))).toStrictEqual(new SetCell(2, 1, 7));
  });

  test('taps during a write wait for the next write, and pending shows both', () => {
    const queue = queueOf([['water', d30, plus]]);
    queue.send(metrics);
    queue.add('water', d30, plus);
    queue.add('water', d01, plus);
    expect(queue.hasQueued).toBe(true);
    expect(deltas(queue.pending)).toEqual(
      new Map([
        [metricDayKey('water', d30), [1, 1]],
        [metricDayKey('water', d01), [1]],
      ]),
    );

    queue.sent();
    expect(queue.isSending).toBe(false);
    expect(deltas(queue.pending)).toEqual(
      new Map([
        [metricDayKey('water', d30), [1]],
        [metricDayKey('water', d01), [1]],
      ]),
    );
    expect(queue.send(metrics).length).toBe(2);
  });

  test('a tap after send does not change the plan of the write that runs', () => {
    const queue = queueOf([['water', d30, plus]]);
    const [plan] = queue.send(metrics);
    queue.add('water', d30, plus);
    expect(plan(log(['2026-09-30', 3]))).toStrictEqual(new SetCell(2, 1, 4));
  });

  test('send during a write throws, so two writes cannot overwrite each other', () => {
    const queue = queueOf([['water', d30, plus]]);
    queue.send(metrics);
    queue.add('water', d30, plus);
    expect(() => queue.send(metrics)).toThrow();
  });

  test('sent drops the taps of the write, also after a failed write', () => {
    const queue = queueOf([['water', d30, plus]]);
    queue.send(metrics);
    queue.sent();
    expect(queue.pending).toEqual(new Map());
    expect(queue.hasQueued).toBe(false);
  });

  test('a metric that is gone or not a number metric gets no plan, and sent drops its taps', () => {
    const queue = queueOf([
      ['gone', d30, plus],
      ['meditate', d30, plus],
      ['water', d30, plus],
    ]);
    expect(queue.send(metrics).length).toBe(1);
    queue.sent();
    expect(queue.pending).toEqual(new Map());
  });

  test('a day without a row gets a new row', () => {
    const queue = queueOf([['walk', d01, { delta: 10 }]]);
    const [plan] = queue.send(metrics);
    const write = plan(log());
    expect(write).toBeInstanceOf(AppendRow);
    expect(/** @type {AppendRow} */ (write).toCells()).toEqual(['2026-10-01', '', 10]);
  });
});
