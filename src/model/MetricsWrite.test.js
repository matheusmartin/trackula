import { describe, expect, test } from 'vitest';
import { YesNoMetric } from './Metric.js';
import { InvalidMetricRow } from './MetricsTable.js';
import {
  AddMetricsColumns,
  ChangedRowException,
  DeleteMetricRow,
  MissingMetricException,
  MoveMetricRow,
  SetMetricCells,
  planDeleteMetric,
  planDeleteRow,
  planEditMetric,
  planFixRow,
  planMoveMetric,
  planMoveMetricTo,
  planSaveMetric,
} from './MetricsWrite.js';
import { metricsHeader, parseMetrics } from './Parse.js';
import { rows, water, weight } from './testing/Fixtures.js';

/** @import { MetricsWrite } from './MetricsWrite.js' */

/**
 * The write as a {@link SetMetricCells}. Fails the test if it is another write.
 * @param {MetricsWrite} write
 * @returns {SetMetricCells}
 */
function setCells(write) {
  expect(write).toBeInstanceOf(SetMetricCells);
  return /** @type {SetMetricCells} */ (write);
}

describe('MetricsWrite', () => {
  /** Rows 2 and 3 are metrics, row 4 is empty, row 5 has no icon, row 6 is a metric. A `notes` column is last. */
  const table = parseMetrics(
    rows(
      [...metricsHeader, 'notes'],
      ['weight', 'Weight', 'number', 'kg', 0.1, '', 'monitor_weight', 'at most 80', 'mine'],
      ['meditate', 'Meditate', 'yesno', '', '', '', 'self_improvement', 'yes'],
      [],
      ['walk', 'Walk', 'yesno'],
      ['water', 'Water', 'count', 'glasses', 1, '', 'water_drop', 'at least 8'],
    ),
  );
  const read = new YesNoMetric({ id: 'read', name: 'Read', icon: 'menu_book' });

  test('save writes the known columns in the row of the metric', () => {
    const writes = planSaveMetric(table, water.copy({ name: 'Drinks', isCount: true }));
    expect(writes.length).toBe(1);
    const write = setCells(writes[0]);
    expect(write.row).toBe(6);
    expect(write.cells.get(1)).toBe('Drinks');
    expect(write.cells.get(2)).toBe('count');
    expect(write.cells.get(7)).toBe('at least 8');
    // The other columns do not change.
    expect(new Set(write.cells.keys())).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
  });

  test('save of a new metric writes the row after the last row', () => {
    const writes = planSaveMetric(table, read);
    expect(writes.length).toBe(1);
    const write = setCells(writes[0]);
    expect(write.row).toBe(7);
    expect(write.cells.get(0)).toBe('read');
  });

  test('a fix of a row of an older sheet adds the goal column first', () => {
    // Without the goal column, the row has no goal: it is invalid.
    const old = parseMetrics(
      rows(
        metricsHeader.filter((name) => name !== 'goal'),
        ['read', 'Read', 'yesno', '', '', '', 'menu_book'],
      ),
    );
    expect(old.invalid.length).toBe(1);
    const writes = planFixRow(old, old.invalid[0], read.copy({ goalIsYes: false }));
    expect(writes[0]).toStrictEqual(new AddMetricsColumns(7, ['goal']));
    expect(setCells(writes[1]).row).toBe(2);
    expect(setCells(writes[1]).cells.get(7)).toBe('no');
  });

  test('an edit does not add a metric that is gone', () => {
    expect(planEditMetric(table, weight)).toStrictEqual(planSaveMetric(table, weight));
    expect(() => planEditMetric(table, read)).toThrow(MissingMetricException);
  });

  test('a fix writes the invalid row that has the same cells', () => {
    expect(table.invalid.length).toBe(1);
    const walk = table.invalid[0];
    const writes = planFixRow(table, walk, new YesNoMetric({ id: 'walk', name: 'Walk', icon: 'directions_walk' }));
    expect(writes.length).toBe(1);
    expect(setCells(writes[0]).row).toBe(5);
    expect(planDeleteRow(table, walk)).toStrictEqual(new DeleteMetricRow(5));

    const changed = new InvalidMetricRow(walk.row, new Map([...walk.cells, ['name', 'Run']]), walk.problem);
    expect(() => planFixRow(table, changed, new YesNoMetric({ id: 'walk', name: 'Walk', icon: 'x' }))).toThrow(
      ChangedRowException,
    );
  });

  test('delete gives the row of the metric, and a missing metric throws', () => {
    expect(planDeleteMetric(table, 'meditate')).toStrictEqual(new DeleteMetricRow(3));
    expect(() => planDeleteMetric(table, 'steps')).toThrow(MissingMetricException);
  });

  test('a move goes past the empty and invalid rows to the next metric', () => {
    expect(planMoveMetric(table, 'water', true)).toStrictEqual(new MoveMetricRow(6, 3));
    expect(planMoveMetric(table, 'meditate', false)).toStrictEqual(new MoveMetricRow(3, 7));
    expect(planMoveMetric(table, 'weight', false)).toStrictEqual(new MoveMetricRow(2, 4));
  });

  test('the first metric does not move up, and the last does not move down', () => {
    expect(planMoveMetric(table, 'weight', true)).toBeNull();
    expect(planMoveMetric(table, 'water', false)).toBeNull();
    expect(() => planMoveMetric(table, 'steps', true)).toThrow(MissingMetricException);
  });

  test('a drag moves a metric before or after the metric at the drop place', () => {
    // Down: after the row of the other metric. Up: before it. The empty and invalid rows do not move.
    expect(planMoveMetricTo(table, 'weight', 'water')).toStrictEqual(new MoveMetricRow(2, 7));
    expect(planMoveMetricTo(table, 'meditate', 'water')).toStrictEqual(new MoveMetricRow(3, 7));
    expect(planMoveMetricTo(table, 'water', 'weight')).toStrictEqual(new MoveMetricRow(6, 2));
  });

  test('a drag to its own place or to a row that is not a metric writes nothing', () => {
    expect(planMoveMetricTo(table, 'weight', 'weight')).toBeNull();
    expect(planMoveMetricTo(table, 'weight', 'walk')).toBeNull();
    expect(() => planMoveMetricTo(table, 'steps', 'water')).toThrow(MissingMetricException);
  });

  test('the message of an exception is the text for the user', () => {
    expect(new MissingMetricException('water').toString()).toBe(
      'The Metrics tab has no row "water" now. Reload to see the latest data.',
    );
    expect(new ChangedRowException(5).toString()).toBe(
      'Row 5 of the Metrics tab changed in the sheet. Reload to see the latest data.',
    );
  });
});
