import 'package:test/test.dart';
import 'package:trackula/model/chart.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/log_entry.dart';
import 'package:trackula/model/metric.dart';
import 'package:trackula/model/parse.dart';
import 'package:trackula/model/summary.dart';

void main() {
  const weight = NumberMetric(id: 'weight', name: 'Weight', perDay: PerDay.one, unit: 'kg', step: 0.1);
  const water = NumberMetric(id: 'water', name: 'Water', perDay: PerDay.many, unit: 'glasses');
  const meditate = YesNoMetric(id: 'meditate', name: 'Meditate');
  final metrics = {
    for (final m in <Metric>[weight, water, meditate]) m.id: m,
  };
  const d29 = Day(2026, 9, 29);
  const d30 = Day(2026, 9, 30);

  group('Day', () {
    test('parses and formats ISO dates', () {
      expect(Day.tryParse('2026-09-30'), d30);
      expect(d30.toString(), '2026-09-30');
    });

    test('adds days across month ends and knows the weekday', () {
      expect(d30.addDays(1), const Day(2026, 10, 1));
      expect(d30.addDays(-30), const Day(2026, 8, 31));
      expect(d30.weekday, DateTime.wednesday);
    });

    test('rejects invalid dates', () {
      expect(Day.tryParse('2026-02-30'), isNull);
      expect(Day.tryParse('30/09/2026'), isNull);
      expect(Day.tryParse(''), isNull);
    });
  });

  group('parseMetrics', () {
    test('parses the example rows', () {
      final p = parseMetrics([
        metricsHeader,
        ['weight', 'Weight', 'number', 'kg', 'one', 0.1, 'body', true],
        ['meditate', 'Meditate', 'yesno', '', 'one', '', 'habits', 'TRUE'],
        ['morning-shower', 'Morning shower', 'yesno', '', 'one', '', 'habits', true],
        ['water', 'Water', 'number', 'glasses', 'many', 1, 'habits', 'FALSE'],
      ]);
      expect(p.warnings, isEmpty);
      expect(p.items.map((m) => m.id), ['weight', 'meditate', 'morning-shower', 'water']);
      expect(p.items[0], isA<NumberMetric>().having((m) => m.step, 'step', 0.1));
      expect(p.items[1], isA<YesNoMetric>());
      expect(p.items[3].active, isFalse);
    });

    test('finds columns by header name', () {
      final p = parseMetrics([
        ['kind', 'id', 'per_day', 'name', 'unit', 'step', 'group', 'active'],
        ['yesno', 'read', 'one', 'Read'],
      ]);
      expect(p.items.single.id, 'read');
    });

    test('skips invalid rows with a warning', () {
      final p = parseMetrics([
        metricsHeader,
        ['Bad Id', 'x', 'number', '', 'one'],
        ['a', 'A', 'text', '', 'one'],
        ['b', 'B', 'number', '', 'sometimes'],
        ['c', 'C', 'yesno', '', 'one'],
        ['c', 'C', 'yesno', '', 'one'],
        [],
      ]);
      expect(p.items.map((m) => m.id), ['c']);
      expect(p.warnings, hasLength(4));
    });

    test('ignores rows that contain only unchecked checkboxes', () {
      final p = parseMetrics([
        metricsHeader,
        ['c', 'C', 'yesno', '', 'one', '', '', true],
        ['', '', '', '', '', '', '', false],
      ]);
      expect(p.items.map((m) => m.id), ['c']);
      expect(p.warnings, isEmpty);
    });

    test('reads the optional icon column', () {
      final p = parseMetrics([
        [...metricsHeader, ...metricsOptionalHeader],
        ['water', 'Water', 'number', 'glasses', 'many', 1, 'habits', true, 'water_drop'],
        ['read', 'Read', 'yesno', '', 'one', '', 'habits', true, '📚'],
        ['walk', 'Walk', 'yesno', '', 'one', '', 'habits', true],
      ]);
      expect(p.items.map((m) => m.icon), ['water_drop', '📚', null]);
    });

    test('works without the icon column', () {
      final p = parseMetrics([
        metricsHeader,
        ['walk', 'Walk', 'yesno', '', 'one', '', 'habits', true],
      ]);
      expect(p.items.single.icon, isNull);
      expect(p.warnings, isEmpty);
    });

    test('throws if a column is missing', () {
      expect(
        () => parseMetrics([
          ['id', 'name'],
        ]),
        throwsA(isA<HeaderException>()),
      );
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
      expect(dayValues(water, p.table.entries), {d29: 8, d30: 5});
    });

    test('warns about invalid cells, unknown columns and duplicate days', () {
      final p = parseLog([
        ['date', 'weight', 'steps', 'meditate'],
        ['30/09/2026', 82.1],
        ['2026-09-29', 'heavy', 100, 2],
        ['2026-09-29', 82.0],
      ], metrics);
      expect(p.table.entries.map((e) => (e.row, e.value)), [(4, 82.0)]);
      expect(p.table.rows[d29], 4);
      expect(p.warnings, hasLength(5));
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

  group('old log format', () {
    final old = [
      oldLogHeader,
      ['2026-09-29', 'weight', 82.4],
      ['2026-09-30', 'weight', 82.3],
      ['2026-09-30', 'weight', 82.1],
      ['2026-09-30', 'water', 2],
      ['2026-09-30', 'water', 3],
      ['2026-09-30', 'meditate', 1],
    ];

    test('is detected', () {
      expect(isOldLog(old), isTrue);
      expect(
        isOldLog([
          ['date', 'weight'],
        ]),
        isFalse,
      );
    });

    test('converts to one row per day, with day totals for many-per-day metrics', () {
      final entries = parseOldLog(old, metrics).items;
      expect(toWideRows(entries, [weight, water, meditate]), [
        ['date', 'weight', 'water', 'meditate'],
        ['2026-09-29', 82.4, '', ''],
        ['2026-09-30', 82.1, 5, 1],
      ]);
    });
  });

  test('columnLetter', () {
    expect([0, 1, 25, 26, 27, 51, 52].map(columnLetter), ['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });

  group('plan writes', () {
    final log = parseLog([
      ['date', 'weight', 'meditate', 'water'],
      ['2026-09-30', 82.1, 1],
    ], metrics).table;

    test('yesno: check sets 1, uncheck clears, no change returns null', () {
      expect(
        planYesNo(meditate, d30, false, log),
        isA<SetCell>().having((w) => (w.row, w.column, w.value), 'cell', (2, 2, null)),
      );
      expect(planYesNo(meditate, d30, true, log), isNull);
      expect(planYesNo(meditate, d29, false, log), isNull);
    });

    test('a day without a row gets a new row', () {
      final w = planYesNo(meditate, d29, true, log);
      expect(w, isA<AppendRow>().having((w) => w.toCells(), 'cells', ['2026-09-29', '', 1]));
    });

    test('number: sets the cell of the day row', () {
      expect(
        planNumber(weight, d30, 81.9, log),
        isA<SetCell>().having((w) => (w.row, w.column, w.value), 'cell', (2, 1, 81.9)),
      );
      expect(
        planNumber(water, d30, 5, log),
        isA<SetCell>().having((w) => (w.row, w.column, w.value), 'cell', (2, 3, 5)),
      );
      expect(planNumber(weight, d30, 82.1, log), isNull);
    });

    test('clear empties the cell, or does nothing', () {
      expect(planClear(weight, d30, log), isA<SetCell>().having((w) => w.value, 'value', isNull));
      expect(planClear(water, d30, log), isNull);
      expect(planClear(weight, d29, log), isNull);
    });

    test('throws if the metric has no column', () {
      const steps = NumberMetric(id: 'steps', name: 'Steps', perDay: PerDay.many);
      expect(() => planNumber(steps, d30, 1, log), throwsStateError);
    });
  });

  group('chartPoints', () {
    final days = [for (var i = 0; i < 5; i++) const Day(2026, 9, 26).addDays(i)];

    test('places values between padding and height, skipping empty days', () {
      final p = chartPoints(days, {days[0]: 80, days[2]: 90, days[4]: 85}, width: 100, height: 40, padding: 4);
      expect(p.map((p) => (p.x, p.y)), [(0.0, 36.0), (50.0, 4.0), (100.0, 20.0)]);
    });

    test('puts equal values in the middle', () {
      final p = chartPoints(days, {days[1]: 5, days[3]: 5}, height: 40);
      expect(p.map((p) => p.y), [20.0, 20.0]);
    });

    test('returns no points without values', () {
      expect(chartPoints(days, {}), isEmpty);
    });
  });

  group('chartBars', () {
    final days = [for (var i = 0; i < 4; i++) const Day(2026, 9, 27).addDays(i)];

    test('gives each day an equal slot and starts bars at 0', () {
      final b = chartBars(days, {days[0]: 8, days[3]: 4}, width: 100, height: 40, padding: 4, fill: 0.5);
      expect(b.map((b) => (b.x, b.w, b.y)), [(6.25, 12.5, 4.0), (81.25, 12.5, 22.0)]);
    });

    test('draws zero values with no height', () {
      expect(chartBars(days, {days[1]: 0}, height: 40).single.y, 40.0);
    });
  });

  test('parseMetrics reads kind count as a number metric with bars', () {
    final p = parseMetrics([
      metricsHeader,
      ['steps', 'Steps', 'count', '', 'many', 100],
    ]);
    expect(p.items.single, isA<NumberMetric>().having((m) => m.isCount, 'isCount', isTrue));
  });
}
