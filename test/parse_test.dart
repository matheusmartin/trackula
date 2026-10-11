import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/metric.dart';
import 'package:trackula/model/parse.dart';

void main() {
  const weight = NumberMetric(id: 'weight', name: 'Weight', icon: 'monitor_weight', unit: 'kg', step: 0.1);
  const water = NumberMetric(id: 'water', name: 'Water', icon: 'water_drop', unit: 'glasses');
  const meditate = YesNoMetric(id: 'meditate', name: 'Meditate', icon: 'self_improvement');
  final metrics = {
    for (final m in <Metric>[weight, water, meditate]) m.id: m,
  };
  const d29 = Day(2026, 9, 29);
  const d30 = Day(2026, 9, 30);

  group('parseMetrics', () {
    test('parses the example rows', () {
      final p = parseMetrics([
        metricsHeader,
        ['weight', 'Weight', 'number', 'kg', 0.1, 'body', 'monitor_weight'],
        ['meditate', 'Meditate', 'yesno', '', '', 'habits', 'self_improvement'],
        ['morning-shower', 'Morning shower', 'yesno', '', '', 'habits', '🚿'],
        ['water', 'Water', 'number', 'glasses', 1, 'habits', 'water_drop'],
      ]);
      expect(p.warnings, isEmpty);
      expect(p.items.map((m) => m.id), ['weight', 'meditate', 'morning-shower', 'water']);
      expect(p.items[0], isA<NumberMetric>().having((m) => m.step, 'step', 0.1));
      expect(p.items[1], isA<YesNoMetric>());
    });

    test('finds columns by header name, and ignores other columns such as per_day and active', () {
      final p = parseMetrics([
        ['kind', 'id', 'per_day', 'name', 'unit', 'step', 'group', 'active', 'icon'],
        ['yesno', 'read', 'one', 'Read', '', '', '', false, '📖'],
      ]);
      expect(p.items.single.id, 'read');
    });

    test('skips invalid rows with a warning', () {
      final p = parseMetrics([
        metricsHeader,
        ['Bad Id', 'x', 'number'],
        ['a', 'A', 'text'],
        ['', 'B', 'number'],
        ['c', 'C', 'yesno', '', '', '', 'check'],
        ['c', 'C', 'yesno', '', '', '', 'check'],
        [],
      ]);
      expect(p.items.map((m) => m.id), ['c']);
      expect(p.warnings, hasLength(4));
    });

    test('ignores rows that contain only unchecked checkboxes, for example of an old active column', () {
      final p = parseMetrics([
        [...metricsHeader, 'active'],
        ['c', 'C', 'yesno', '', '', '', 'check', '', true],
        ['', '', '', '', '', '', '', '', false],
      ]);
      expect(p.items.map((m) => m.id), ['c']);
      expect(p.warnings, isEmpty);
    });

    test('reads the icon, and skips a row without icon with a warning', () {
      final p = parseMetrics([
        metricsHeader,
        ['water', 'Water', 'number', 'glasses', 1, 'habits', 'water_drop'],
        ['read', 'Read', 'yesno', '', '', 'habits', '📚'],
        ['walk', 'Walk', 'yesno', '', '', 'habits'],
      ]);
      expect(p.items.map((m) => m.icon), ['water_drop', '📚']);
      expect(p.warnings.single, contains('no icon'));
    });

    test('throws without the icon column', () {
      expect(
        () => parseMetrics([
          ['id', 'name', 'kind', 'unit', 'step', 'group'],
        ]),
        throwsA(isA<HeaderException>().having((e) => e.missing, 'missing', ['icon'])),
      );
    });

    test('throws if a column is missing', () {
      expect(
        () => parseMetrics([
          ['id', 'name'],
        ]),
        throwsA(isA<HeaderException>()),
      );
    });

    test('reads the goal: yes or no for yesno, a minimum or a maximum for number and count', () {
      final p = parseMetrics([
        metricsHeader,
        ['meditate', 'Meditate', 'yesno', '', '', '', 'check', 'Yes'],
        ['smoke', 'Smoke', 'yesno', '', '', '', 'check', 'no'],
        ['read', 'Read', 'yesno', '', '', '', 'check'],
        ['water', 'Water', 'count', '', '', '', 'water_drop', 8],
        ['steps', 'Steps', 'number', '', '', '', 'footprint', '>= 8000'],
        ['weight', 'Weight', 'number', 'kg', 0.1, '', 'monitor_weight', '<=75.5'],
        ['waist', 'Waist', 'number', 'cm', 0.5, '', 'straighten', ''],
      ]);
      expect(p.warnings, isEmpty);
      expect([for (final m in p.items.whereType<YesNoMetric>()) m.goalIsYes], [true, false, true]);
      expect(
        [for (final m in p.items.whereType<NumberMetric>()) (m.goal?.value, m.goal?.isMaximum)],
        [(8, false), (8000, false), (75.5, true), (null, null)],
      );
    });

    test('skips a row with an invalid goal with a warning', () {
      final p = parseMetrics([
        metricsHeader,
        ['meditate', 'Meditate', 'yesno', '', '', '', 'check', 'maybe'],
        ['weight', 'Weight', 'number', 'kg', 0.1, '', 'monitor_weight', '< 75'],
      ]);
      expect(p.items, isEmpty);
      expect(p.warnings, [contains('use yes or no'), contains('<= 75 (at most 75)')]);
    });

    test('reads a sheet without the goal column: no goal', () {
      final p = parseMetrics([
        ['id', 'name', 'kind', 'unit', 'step', 'group', 'icon'],
        ['meditate', 'Meditate', 'yesno', '', '', '', 'check'],
        ['water', 'Water', 'count', '', '', '', 'water_drop'],
      ]);
      expect(p.warnings, isEmpty);
      expect(p.items[0], isA<YesNoMetric>().having((m) => m.goalIsYes, 'goalIsYes', isTrue));
      expect(p.items[1], isA<NumberMetric>().having((m) => m.goal, 'goal', isNull));
    });

    test('reads kind count as a number metric with bars', () {
      final p = parseMetrics([
        metricsHeader,
        ['steps', 'Steps', 'count', '', 100, '', 'footprint'],
      ]);
      expect(p.items.single, isA<NumberMetric>().having((m) => m.isCount, 'isCount', isTrue));
    });
  });

  group('parseLog', () {
    test('reads one row per day and one column per metric', () {
      final p = parseLog([
        ['date', 'weight', 'meditate', 'water'],
        ['2026-09-29', 82.4, '', 8],
        ['2026-09-30', '82.1', true, 5],
      ], metrics);
      expect(p.warnings, isEmpty);
      expect(p.table.columns, {'weight': 1, 'meditate': 2, 'water': 3});
      expect(p.table.rows, {d29: 2, d30: 3});
      expect(p.table.valueAt('weight', d30), 82.1);
      expect(p.table.valueAt('meditate', d30), 1);
      expect(p.table.valueAt('meditate', d29), isNull);
    });

    test('warns about invalid cells and duplicate days, and ignores columns with no metric', () {
      final p = parseLog([
        ['date', 'weight', 'steps', 'meditate'],
        ['30/09/2026', 82.1],
        ['2026-09-29', 'heavy', 100, 2],
        ['2026-09-29', 82.0],
      ], metrics);
      expect(p.table.entries.map((e) => (e.row, e.value)), [(4, 82.0)]);
      expect(p.table.rows[d29], 4);
      expect(p.table.columns.keys, isNot(contains('steps')));
      expect(p.warnings, hasLength(4));
    });

    test('reads real dates (serial numbers) and old text dates', () {
      final p = parseLog([
        ['date', 'weight'],
        [46296, 81.9],
        ['2026-10-02', 82],
        [0, 83],
      ], metrics);
      expect(p.table.rows, {const Day(2026, 10, 1): 2, const Day(2026, 10, 2): 3});
      expect(p.warnings.single, contains('invalid date "0"'));
    });

    test('textDateRows finds dates stored as text only', () {
      expect(
        textDateRows([
          ['date', 'weight'],
          ['2026-10-01', 1],
          [46297, 2],
          ['01/10/2026', 3],
          [],
          ['2026-10-03'],
        ]),
        [(row: 2, date: const Day(2026, 10, 1)), (row: 6, date: const Day(2026, 10, 3))],
      );
    });

    test('reads yes and no in any case, and old yesno values', () {
      const d28 = Day(2026, 9, 28);
      final p = parseLog([
        ['date', 'meditate'],
        ['2026-09-27', 'YES'],
        ['2026-09-28', 'yes'],
        ['2026-09-29', ' No '],
        ['2026-09-30', 1],
      ], metrics);
      expect(p.warnings, isEmpty);
      expect(
        [
          for (final d in [d28, d29, d30]) p.table.valueAt('meditate', d),
        ],
        [1, 0, 1],
      );
    });

    test('warns about invalid yesno values', () {
      final p = parseLog([
        ['date', 'meditate'],
        ['2026-09-30', 'maybe'],
      ], metrics);
      expect(p.table.entries, isEmpty);
      expect(p.warnings.single, contains('yes or no'));
    });

    test('legacyYesNoCells finds old yesno values only', () {
      final cells = legacyYesNoCells([
        ['date', 'weight', 'meditate'],
        ['2026-09-27', 1, 1],
        ['2026-09-28', 82, 'yes'],
        ['2026-09-29', 82, 'TRUE'],
        ['2026-09-30', 82, 0],
        ['2026-10-01', 82, ''],
        ['2026-10-02', 82, 'maybe'],
        ['2026-10-03', 82],
      ], metrics);
      expect(cells, [
        (row: 2, column: 2, value: 'yes'),
        (row: 4, column: 2, value: 'yes'),
        (row: 5, column: 2, value: 'no'),
      ]);
    });

    test('throws if column A is not date', () {
      expect(
        () => parseLog([
          ['day', 'weight'],
        ], metrics),
        throwsA(isA<HeaderException>()),
      );
    });
  });

  test('columnLetter', () {
    expect([0, 1, 25, 26, 27, 51, 52].map(columnLetter), ['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });
}
