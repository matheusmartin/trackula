import { describe, expect, test } from 'vitest';
import { Day } from './Day.js';
import { deletedMetrics } from './DeletedMetric.js';
import { rows } from './testing/Fixtures.js';

describe('DeletedMetric', () => {
  test('a log column without a metric is a deleted metric', () => {
    const log = rows(
      ['date', 'weight', 'steps', 'read', 'Score', '', 'Notes'],
      [Day.of(2026, 9, 29).serial, 82.4, 9000, 'yes', 50],
      [Day.of(2026, 9, 30).serial, 82.1, '', 'No', 60],
      [Day.of(2026, 9, 28).serial, '', 7000, false],
    );
    expect(deletedMetrics(log, new Set(['weight']))).toEqual([
      { id: 'steps', values: 2, lastDay: Day.of(2026, 9, 29), isYesNo: false },
      { id: 'read', values: 2, lastDay: Day.of(2026, 9, 30), isYesNo: true },
    ]);
  });

  test('a deleted metric without values is not yes/no, and a duplicate column counts once', () => {
    const log = rows(['date', 'walk', 'walk'], [Day.of(2026, 9, 29).serial, '', 'yes']);
    expect(deletedMetrics(log, new Set())).toEqual([{ id: 'walk', values: 0, lastDay: null, isYesNo: false }]);
  });

  test('an empty log has no deleted metrics', () => {
    expect(deletedMetrics([], new Set())).toEqual([]);
  });
});
