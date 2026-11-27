import { describe, expect, test } from 'vitest';
import { Day } from '../model/Day.js';
import { planClear, planNumber, planYesNo } from '../model/LogEntry.js';
import { NumberGoal, NumberMetric } from '../model/Metric.js';
import { planDeleteMetric, planMoveMetric, planSaveMetric } from '../model/MetricsWrite.js';
import { DemoStore } from './DemoStore.js';

/** @import { Metric, YesNoMetric } from '../model/Metric.js' */

describe('DemoStore', () => {
  const today = Day.of(2026, 10, 3);

  const store = () => new DemoStore(today, 0);

  /**
   * @param {Metric[]} metrics
   * @param {string} id
   * @returns {Metric}
   */
  const find = (metrics, id) => /** @type {Metric} */ (metrics.find((m) => m.id === id));

  test('loads the sample data without warnings and today has no values', async () => {
    const s = await store().load();
    expect(s.warnings).toEqual([]);
    expect(s.metrics.length).toBe(9);
    expect(s.deleted).toEqual([]);
    expect(s.log.rows.size).toBe(120);
    expect(s.log.rows.has(today)).toBe(false);
  });

  test('the sample waist is once a week in steps of a half centimeter', () => {
    // 187.5 half centimeters rounds away from zero.
    expect(DemoStore.sampleWaist(70)).toBe(94);
    expect(DemoStore.sampleWaist(7)).toBe(92);
    expect(DemoStore.sampleWaist(112)).toBe(95);
    expect(DemoStore.sampleWaist(8)).toBeNull();
  });

  test('changeAll adds one row for today also for two values', async () => {
    const st = store();
    const metrics = (await st.load()).metrics;
    const weight = /** @type {NumberMetric} */ (find(metrics, 'weight'));
    const meditate = /** @type {YesNoMetric} */ (find(metrics, 'meditate'));
    const s = await st.changeAll([
      (log) => planNumber(weight, today, 82.3, log),
      (log) => planYesNo(meditate, today, log, true),
    ]);
    expect(s.warnings).toEqual([]);
    expect(s.log.rows.size).toBe(121);
    expect(s.log.valueAt('weight', today)).toBe(82.3);
    expect(s.log.valueAt('meditate', today)).toBe(1);

    const cleared = await st.change((log) => planClear(weight, today, log));
    expect(cleared.log.valueAt('weight', today)).toBeNull();
  });

  test('a new metric gets a Log column so that it takes values', async () => {
    const st = store();
    const read = new NumberMetric({
      id: 'pages',
      name: 'Pages',
      icon: 'menu_book',
      goal: new NumberGoal({ target: 20 }),
      isCount: true,
    });
    const added = await st.changeMetrics((table) => planSaveMetric(table, read));
    expect(added.metrics.at(-1)).toEqual(read);

    const s = await st.change((log) => planNumber(read, today, 12, log));
    expect(s.log.valueAt('pages', today)).toBe(12);
    expect(s.warnings).toEqual([]);
  });

  test('delete and move change the order of the sample metrics', async () => {
    const st = store();
    const moved = await st.changeMetrics((table) => {
      const write = planMoveMetric(table, 'waist', true);
      return write === null ? [] : [write];
    });
    expect(moved.metrics.slice(0, 2).map((m) => m.id)).toEqual(['waist', 'weight']);

    const deleted = await st.changeMetrics((table) => [planDeleteMetric(table, 'waist')]);
    expect(deleted.metrics[0].id).toBe('weight');
    expect(deleted.deleted.map((d) => d.id)).toEqual(['waist']);
  });
});
