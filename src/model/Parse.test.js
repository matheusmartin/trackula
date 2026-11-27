import { describe, expect, test } from 'vitest';
import { Day } from './Day.js';
import { MissingColumnException } from './LogEntry.js';
import { NumberGoal, NumberMetric, YesNoMetric } from './Metric.js';
import {
  HeaderException,
  InvalidMetricException,
  LOG_TITLE,
  columnLetter,
  isValidMetricId,
  legacyYesNoCells,
  metricsHeader,
  parseLog,
  parseMetricRow,
  parseMetrics,
  textDateRows,
} from './Parse.js';
import { byId, meditate, rows, water, weight } from './testing/Fixtures.js';

/**
 * The error that `run` throws.
 * @param {() => unknown} run
 * @returns {unknown}
 */
function thrown(run) {
  try {
    run();
  } catch (e) {
    return e;
  }
  throw new Error('No error.');
}

describe('Parse', () => {
  const metrics = byId(weight, water, meditate);
  const d29 = Day.of(2026, 9, 29);
  const d30 = Day.of(2026, 9, 30);

  test('parseMetrics parses the example rows', () => {
    const p = parseMetrics(
      rows(
        metricsHeader,
        ['weight', 'Weight', 'number', 'kg', 0.1, 'body', 'monitor_weight', 'at most 80 from 83'],
        ['meditate', 'Meditate', 'yesno', '', '', 'habits', 'self_improvement', 'yes'],
        ['morning-shower', 'Morning shower', 'yesno', '', '', 'habits', '🚿', 'yes'],
        ['water', 'Water', 'number', 'glasses', 1, 'habits', 'water_drop', 'at least 8'],
      ),
    );
    expect(p.warnings).toEqual([]);
    expect(p.items.map((m) => m.id)).toEqual(['weight', 'meditate', 'morning-shower', 'water']);
    expect(p.items[0]).toBeInstanceOf(NumberMetric);
    expect(/** @type {NumberMetric} */ (p.items[0]).step).toBe(0.1);
    expect(p.items[1]).toBeInstanceOf(YesNoMetric);
  });

  test('parseMetrics finds the columns by header name and ignores other columns such as per_day and active', () => {
    const p = parseMetrics(
      rows(
        ['kind', 'id', 'per_day', 'name', 'unit', 'step', 'group', 'active', 'icon', 'goal'],
        ['yesno', 'read', 'one', 'Read', '', '', '', false, '📖', 'yes'],
      ),
    );
    expect(p.items.map((m) => m.id)).toEqual(['read']);
  });

  test('parseMetrics skips invalid rows with a warning', () => {
    const p = parseMetrics(
      rows(
        metricsHeader,
        ['Bad Id', 'x', 'number'],
        ['a', 'A', 'text'],
        ['', 'B', 'number'],
        ['c', 'C', 'yesno', '', '', '', 'check', 'yes'],
        ['c', 'C', 'yesno', '', '', '', 'check', 'yes'],
        [],
      ),
    );
    expect(p.items.map((m) => m.id)).toEqual(['c']);
    expect(p.warnings.length).toBe(4);
  });

  test('parseMetrics ignores rows that contain only unchecked checkboxes', () => {
    const p = parseMetrics(
      rows(
        [...metricsHeader, 'active'],
        ['c', 'C', 'yesno', '', '', '', 'check', 'yes', true],
        ['', '', '', '', '', '', '', '', false],
      ),
    );
    expect(p.items.map((m) => m.id)).toEqual(['c']);
    expect(p.warnings).toEqual([]);
  });

  test('parseMetrics reads the icon and skips a row without icon with a warning', () => {
    const p = parseMetrics(
      rows(
        metricsHeader,
        ['water', 'Water', 'number', 'glasses', 1, 'habits', 'water_drop', 'at least 8'],
        ['read', 'Read', 'yesno', '', '', 'habits', '📚', 'yes'],
        ['walk', 'Walk', 'yesno', '', '', 'habits', '', 'yes'],
      ),
    );
    expect(p.items.map((m) => m.icon)).toEqual(['water_drop', '📚']);
    expect(p.warnings.length).toBe(1);
    expect(p.warnings[0]).toContain('no icon');
  });

  test('parseMetrics throws without the icon column', () => {
    const e = thrown(() => parseMetrics(rows(['id', 'name', 'kind', 'unit', 'step', 'group'])));
    expect(e).toBeInstanceOf(HeaderException);
    expect(/** @type {HeaderException} */ (e).missing).toEqual(['icon']);
  });

  test('parseMetrics throws if a column is missing', () => {
    expect(() => parseMetrics(rows(['id', 'name']))).toThrow(HeaderException);
  });

  test('parseMetrics reads the goal', () => {
    const p = parseMetrics(
      rows(
        metricsHeader,
        ['meditate', 'Meditate', 'yesno', '', '', '', 'check', 'Yes'],
        ['smoke', 'Smoke', 'yesno', '', '', '', 'check', 'no'],
        ['water', 'Water', 'count', '', '', '', 'water_drop', 8],
        ['steps', 'Steps', 'count', '', '', '', 'footprint', 'at least 8000'],
        ['coffee', 'Coffee', 'count', '', '', '', 'coffee', 'At  most 2 from 4'],
        ['sleep', 'Sleep', 'number', 'h', '', '', 'bedtime', '>= 7 from 5'],
        ['weight', 'Weight', 'number', 'kg', 0.1, '', 'monitor_weight', 'at most 80 from 83.5 trend'],
        ['fat', 'Body fat', 'number', '%', '', '', 'percent', '<=20'],
      ),
    );
    expect(p.warnings).toEqual([]);
    const yesNo = p.items.filter((m) => m instanceof YesNoMetric);
    expect(yesNo.map((m) => m.goalIsYes)).toEqual([true, false]);
    const numbers = p.items.filter((m) => m instanceof NumberMetric);
    expect(numbers.map((m) => m.goal)).toStrictEqual([
      new NumberGoal({ target: 8 }),
      new NumberGoal({ target: 8000 }),
      new NumberGoal({ target: 2, isMaximum: true, from: 4 }),
      new NumberGoal({ target: 7, from: 5 }),
      new NumberGoal({ target: 80, isMaximum: true, from: 83.5, usesTrend: true }),
      new NumberGoal({ target: 20, isMaximum: true }),
    ]);
  });

  test('parseMetrics skips a row with an invalid goal with a warning', () => {
    const p = parseMetrics(
      rows(
        metricsHeader,
        ['meditate', 'Meditate', 'yesno', '', '', '', 'check', 'maybe'],
        ['weight', 'Weight', 'number', 'kg', 0.1, '', 'monitor_weight', '< 75'],
        ['waist', 'Waist', 'number', 'cm', 0.5, '', 'straighten', 'at most 90 from 88'],
        ['sleep', 'Sleep', 'number', 'h', '', '', 'bedtime', 'at least 7 from 7'],
        ['water', 'Water', 'count', '', '', '', 'water_drop', 'at least 8 trend'],
        ['steps', 'Steps', 'count', '', '', '', 'footprint', 'trend'],
      ),
    );
    expect(p.items).toEqual([]);
    expect(p.warnings.length).toBe(6);
    expect(p.warnings[0]).toContain('use yes or no');
    expect(p.warnings[1]).toContain('at most 80 from 83 trend');
    expect(p.warnings[2]).toContain('must be above the target');
    expect(p.warnings[3]).toContain('must be below the target');
    expect(p.warnings[4]).toContain('Only a number metric can have a trend');
    expect(p.warnings[5]).toContain('invalid goal "trend"');
  });

  test('parseMetrics skips a row without goal with a warning', () => {
    const p = parseMetrics(
      rows(
        metricsHeader,
        ['read', 'Read', 'yesno', '', '', '', 'check', ''],
        ['waist', 'Waist', 'number', 'cm', 0.5, '', 'straighten'],
        ['water', 'Water', 'count', '', '', '', 'water_drop', ' '],
      ),
    );
    expect(p.items).toEqual([]);
    expect(p.invalid.map((r) => r.row)).toEqual([2, 3, 4]);
    expect(p.invalid[0].problem).toBe('no goal. For a yesno metric, use yes or no.');
    const numberProblem = 'no goal. Use for example at least 8, at most 80, or at most 80 from 83 trend.';
    expect(p.invalid.slice(1).map((r) => r.problem)).toEqual([numberProblem, numberProblem]);
  });

  test('parseMetrics reads a sheet without the goal column as rows without goal', () => {
    const p = parseMetrics(
      rows(
        ['id', 'name', 'kind', 'unit', 'step', 'group', 'icon'],
        ['meditate', 'Meditate', 'yesno', '', '', '', 'check'],
        ['water', 'Water', 'count', '', '', '', 'water_drop'],
      ),
    );
    expect(p.items).toEqual([]);
    expect(p.invalid.map((r) => r.id)).toEqual(['meditate', 'water']);
    expect(p.invalid.every((r) => r.problem.startsWith('no goal'))).toBe(true);
  });

  test('parseMetrics reads kind count as a number metric with bars', () => {
    const p = parseMetrics(rows(metricsHeader, ['steps', 'Steps', 'count', '', 100, '', 'footprint', 8000]));
    expect(p.items.length).toBe(1);
    expect(p.items[0]).toBeInstanceOf(NumberMetric);
    expect(/** @type {NumberMetric} */ (p.items[0]).isCount).toBe(true);
  });

  test('parseMetrics reads numbers in text cells without zeros at the end', () => {
    const p = parseMetrics(rows(metricsHeader, ['year', 2026, 'number', '', '0.5', '', 7, 1]));
    expect(p.items.length).toBe(1);
    const metric = /** @type {NumberMetric} */ (p.items[0]);
    expect(metric).toBeInstanceOf(NumberMetric);
    expect([metric.name, metric.step, metric.icon]).toEqual(['2026', 0.5, '7']);
    const small = parseMetrics(rows(metricsHeader, ['x', 0.1234567, 'yesno', '', '', '', 'check', 1e-7]));
    expect(small.warnings.length).toBe(1);
    expect(small.warnings[0]).toContain('invalid goal "1e-7"');
  });

  test('parseLog reads numbers as text with a sign or without digits before or after the point', () => {
    const p = parseLog(rows(['date', 'weight', 'water'], ['2026-09-30', '+82', '.5'], ['2026-10-01', '8.']), metrics);
    expect(p.warnings).toEqual([]);
    expect(p.table.entries.map((e) => e.value)).toEqual([82, 0.5, 8]);
  });

  test('the text of an exception is the message only', () => {
    expect(new HeaderException(LOG_TITLE, ['date']).toString()).toBe('Tab "Log" has no column(s): date');
    expect(new MissingColumnException('water').toString()).toBe('The log tab has no column "water".');
  });

  test('parseLog reads one row per day and one column per metric', () => {
    const p = parseLog(
      rows(['date', 'weight', 'meditate', 'water'], ['2026-09-29', 82.4, '', 8], ['2026-09-30', '82.1', true, 5]),
      metrics,
    );
    expect(p.warnings).toEqual([]);
    expect(p.table.columns).toEqual(
      new Map([
        ['weight', 1],
        ['meditate', 2],
        ['water', 3],
      ]),
    );
    expect(p.table.rows).toEqual(
      new Map([
        [d29, 2],
        [d30, 3],
      ]),
    );
    expect(p.table.valueAt('weight', d30)).toBe(82.1);
    expect(p.table.valueAt('meditate', d30)).toBe(1);
    expect(p.table.valueAt('meditate', d29)).toBeNull();
  });

  test('parseLog warns about invalid cells and duplicate days, and ignores columns with no metric', () => {
    const p = parseLog(
      rows(
        ['date', 'weight', 'steps', 'meditate'],
        ['30/09/2026', 82.1],
        ['2026-09-29', 'heavy', 100, 2],
        ['2026-09-29', 82.0],
      ),
      metrics,
    );
    expect(p.table.entries.map((e) => [e.row, e.value])).toEqual([[4, 82]]);
    expect(p.table.rows.get(d29)).toBe(4);
    expect(p.table.columns.has('steps')).toBe(false);
    expect(p.warnings.length).toBe(4);
  });

  test('parseLog reads real dates and old text dates', () => {
    const p = parseLog(rows(['date', 'weight'], [46296, 81.9], ['2026-10-02', 82], [0, 83]), metrics);
    expect(p.table.rows).toEqual(
      new Map([
        [Day.of(2026, 10, 1), 2],
        [Day.of(2026, 10, 2), 3],
      ]),
    );
    expect(p.warnings.length).toBe(1);
    expect(p.warnings[0]).toContain('invalid date "0"');
  });

  test('textDateRows finds the dates stored as text only', () => {
    expect(
      textDateRows(rows(['date', 'weight'], ['2026-10-01', 1], [46297, 2], ['01/10/2026', 3], [], ['2026-10-03'])),
    ).toEqual([
      { row: 2, date: Day.of(2026, 10, 1) },
      { row: 6, date: Day.of(2026, 10, 3) },
    ]);
  });

  test('parseLog reads yes and no in any case, and old yes/no values', () => {
    const p = parseLog(
      rows(
        ['date', 'meditate'],
        ['2026-09-27', 'YES'],
        ['2026-09-28', 'yes'],
        ['2026-09-29', ' No '],
        ['2026-09-30', 1],
      ),
      metrics,
    );
    expect(p.warnings).toEqual([]);
    expect([Day.of(2026, 9, 28), d29, d30].map((d) => p.table.valueAt('meditate', d))).toEqual([1, 0, 1]);
  });

  test('parseLog warns about invalid yes/no values', () => {
    const p = parseLog(rows(['date', 'meditate'], ['2026-09-30', 'maybe']), metrics);
    expect(p.table.entries).toEqual([]);
    expect(p.warnings.length).toBe(1);
    expect(p.warnings[0]).toContain('yes or no');
  });

  test('legacyYesNoCells finds the old yes/no values only', () => {
    const cells = legacyYesNoCells(
      rows(
        ['date', 'weight', 'meditate'],
        ['2026-09-27', 1, 1],
        ['2026-09-28', 82, 'yes'],
        ['2026-09-29', 82, 'TRUE'],
        ['2026-09-30', 82, 0],
        ['2026-10-01', 82, ''],
        ['2026-10-02', 82, 'maybe'],
        ['2026-10-03', 82],
      ),
      metrics,
    );
    expect(cells).toEqual([
      { row: 2, column: 2, value: 'yes' },
      { row: 4, column: 2, value: 'yes' },
      { row: 5, column: 2, value: 'no' },
    ]);
  });

  test('parseLog throws if column A is not date', () => {
    expect(() => parseLog(rows(['day', 'weight']), metrics)).toThrow(HeaderException);
  });

  test('columnLetter', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(columnLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });

  test('parseMetrics gives the row of each metric and the column of each header', () => {
    const t = parseMetrics(
      rows(
        ['kind', 'id', 'per_day', 'name', 'unit', 'step', 'group', 'icon', 'goal'],
        ['yesno', 'read', 'one', 'Read', '', '', '', 'menu_book', 'yes'],
        [],
        ['number', 'weight', '', 'Weight', 'kg', 0.1, '', 'monitor_weight', 'at most 80'],
      ),
    );
    expect(t.rows).toEqual(
      new Map([
        ['read', 2],
        ['weight', 4],
      ]),
    );
    expect(t.columns.get('id')).toBe(1);
    expect(t.columns.get('per_day')).toBe(2);
    expect(t.width).toBe(9);
    expect(t.lastRow).toBe(4);
  });

  test('parseMetrics keeps each invalid row with its cells and its problem', () => {
    const t = parseMetrics(
      rows(
        metricsHeader,
        ['walk', 'Walk', 'yesno', '', '', 'habits', '', 'yes'],
        ['read', 'Read', 'yesno', '', '', '', 'menu_book', 'yes'],
        ['read', 'Read again', 'yesno', '', '', '', 'menu_book', 'yes'],
      ),
    );
    expect(t.items.map((m) => m.id)).toEqual(['read']);
    expect(t.invalid.map((r) => r.row)).toEqual([2, 4]);
    const walk = t.invalid[0];
    expect(walk.id).toBe('walk');
    expect(walk.cells.get('group')).toBe('habits');
    expect(walk.problem.startsWith('no icon')).toBe(true);
    expect(t.invalid[1].problem).toBe('duplicate id "read"');
    expect(t.warnings).toEqual([`Metrics row 2: ${walk.problem}`, 'Metrics row 4: duplicate id "read"']);
  });

  test('parseMetrics of an empty tab gives the header as the last row', () => {
    const t = parseMetrics(rows(metricsHeader));
    expect(t.lastRow).toBe(1);
    expect(t.width).toBe(metricsHeader.length);
  });

  test('parseMetricRow checks the cells of one row', () => {
    /**
     * @param {string} goal
     * @returns {Map<string, string>}
     */
    const cells = (goal) =>
      new Map([
        ['name', 'Water'],
        ['kind', 'count'],
        ['unit', 'glasses'],
        ['icon', 'water_drop'],
        ['goal', goal],
      ]);
    expect(parseMetricRow('water', cells('at least 8'))).toStrictEqual(
      new NumberMetric({
        id: 'water',
        name: 'Water',
        icon: 'water_drop',
        goal: new NumberGoal({ target: 8 }),
        unit: 'glasses',
        isCount: true,
      }),
    );
    const e = thrown(() => parseMetricRow('water', cells('lots')));
    expect(e).toBeInstanceOf(InvalidMetricException);
    expect(/** @type {Error} */ (e).message.startsWith('invalid goal "lots"')).toBe(true);
    const empty = thrown(() => parseMetricRow('water', cells('')));
    expect(empty).toBeInstanceOf(InvalidMetricException);
    expect(/** @type {Error} */ (empty).message.startsWith('no goal')).toBe(true);
  });

  test('isValidMetricId accepts lowercase letters, digits and two signs', () => {
    expect(isValidMetricId('morning_teeth-2')).toBe(true);
    expect(isValidMetricId('Morning')).toBe(false);
    expect(isValidMetricId('')).toBe(false);
  });
});
