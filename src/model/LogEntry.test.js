import { describe, expect, test } from 'vitest';
import { Day } from './Day.js';
import {
  AppendRow,
  MissingColumnException,
  SetCell,
  applyCountSteps,
  cellValue,
  metricDayKey,
  parseMetricDay,
  planClear,
  planCount,
  planNumber,
  planValue,
  planYesNo,
} from './LogEntry.js';
import { NumberGoal, NumberMetric } from './Metric.js';
import { parseLog } from './Parse.js';
import { byId, meditate, rows, water, weight } from './testing/Fixtures.js';

describe('LogEntry', () => {
  const metrics = byId(weight, water, meditate);
  const d29 = Day.of(2026, 9, 29);
  const d30 = Day.of(2026, 9, 30);
  const log = parseLog(rows(['date', 'weight', 'meditate', 'water'], ['2026-09-30', 82.1, 1]), metrics).table;

  test('a yes/no check writes yes, an uncheck writes no, and no change returns null', () => {
    expect(planYesNo(meditate, d30, log, false)).toStrictEqual(new SetCell(2, 2, 'no'));
    // The log has the old value 1 on 2026-09-30. It is yes, so a check changes nothing.
    expect(planYesNo(meditate, d30, log, true)).toBeNull();
  });

  test('a day without a row gets a new row', () => {
    expect(planYesNo(meditate, d29, log, true)).toStrictEqual(new AppendRow(d29, 2, 'yes'));
    expect(new AppendRow(d29, 2, 'yes').toCells()).toEqual(['2026-09-29', '', 'yes']);
    const write = planYesNo(meditate, d29, log, false);
    expect(write).toBeInstanceOf(AppendRow);
    expect(/** @type {AppendRow} */ (write).toCells()).toEqual(['2026-09-29', '', 'no']);
  });

  test('cellValue gives yes and no for yes/no, and the number for number metrics', () => {
    expect([1, 0, null].map((v) => cellValue(meditate, v))).toEqual(['yes', 'no', null]);
    expect([cellValue(weight, 81.9), cellValue(water, null)]).toEqual([81.9, null]);
  });

  test('a number sets the cell of the day row', () => {
    expect(planNumber(weight, d30, 81.9, log)).toStrictEqual(new SetCell(2, 1, 81.9));
    expect(planNumber(water, d30, 5, log)).toStrictEqual(new SetCell(2, 3, 5));
    expect(planNumber(weight, d30, 82.1, log)).toBeNull();
  });

  test('clear empties the cell or does nothing', () => {
    expect(planClear(weight, d30, log)).toStrictEqual(new SetCell(2, 1, null));
    expect(planClear(water, d30, log)).toBeNull();
    expect(planClear(weight, d29, log)).toBeNull();
  });

  test('planValue sets the value of each kind, and null clears it', () => {
    expect(planValue(meditate, d30, 0, log)).toStrictEqual(new SetCell(2, 2, 'no'));
    expect(planValue(weight, d30, 81.9, log)).toStrictEqual(new SetCell(2, 1, 81.9));
    expect(planValue(weight, d30, null, log)).toStrictEqual(new SetCell(2, 1, null));
    expect(planValue(weight, d30, 82.1, log)).toBeNull();
  });

  test('count applies the taps to the latest value', () => {
    expect(planCount(water, d30, [{ delta: 1 }, { delta: 1 }], log)).toStrictEqual(new SetCell(2, 3, 2));
    const write = planCount(water, d29, [{ delta: 1 }], log);
    expect(write).toBeInstanceOf(AppendRow);
    expect(/** @type {AppendRow} */ (write).toCells()).toEqual(['2026-09-29', '', '', 1]);
    expect(planCount(water, d29, [{ delta: -1 }], log)).toBeNull();
  });

  test('throws if the metric has no column', () => {
    const steps = new NumberMetric({
      id: 'steps',
      name: 'Steps',
      icon: 'footprint',
      goal: new NumberGoal({ target: 8000 }),
    });
    expect(() => planNumber(steps, d30, 1, log)).toThrow(MissingColumnException);
  });

  test('applyCountSteps adds and subtracts', () => {
    expect(applyCountSteps(null, [{ delta: 1 }])).toBe(1);
    expect(applyCountSteps(3, [{ delta: -1 }])).toBe(2);
    expect(applyCountSteps(3, [{ delta: 1 }, { delta: 1 }, { delta: -1 }])).toBe(4);
  });

  test('applyCountSteps gives 0 or less as an empty cell, also between steps', () => {
    expect(applyCountSteps(1, [{ delta: -1 }])).toBeNull();
    expect(applyCountSteps(null, [{ delta: -1 }])).toBeNull();
    expect(applyCountSteps(null, [{ delta: -1 }, { delta: 1 }])).toBe(1);
  });

  test('applyCountSteps removes float noise from decimal steps', () => {
    expect(applyCountSteps(0.2, [{ delta: 0.1 }])).toBe(0.3);
  });

  test('a metric day is a text key that gives back its metric id and its day', () => {
    expect(metricDayKey('water', d30)).toBe('water|2026-09-30');
    expect(metricDayKey('water', d30)).toBe(metricDayKey('water', Day.of(2026, 9, 30)));
    expect(parseMetricDay(metricDayKey('Score:a|b', d30))).toEqual({ metricId: 'Score:a|b', day: d30 });
    expect(() => parseMetricDay('water')).toThrow();
  });

  test('the message of the exception is the text for the user', () => {
    const e = new MissingColumnException('water');
    expect(e.metricId).toBe('water');
    expect(e.message).toBe('The log tab has no column "water".');
  });
});
