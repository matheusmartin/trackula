import 'package:test/test.dart';
import 'package:trackula/model/chart.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/log_entry.dart';
import 'package:trackula/model/metric.dart';
import 'package:trackula/model/number_input.dart';
import 'package:trackula/model/parse.dart';
import 'package:trackula/model/summary.dart';
import 'package:trackula/services/double_tap.dart';

void main() {
  const weight = NumberMetric(id: 'weight', name: 'Weight', icon: 'monitor_weight', unit: 'kg', step: 0.1);
  const water = NumberMetric(id: 'water', name: 'Water', icon: 'water_drop', unit: 'glasses');
  const meditate = YesNoMetric(id: 'meditate', name: 'Meditate', icon: 'self_improvement');
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

    test('converts Google Sheets date serial numbers', () {
      expect(const Day(2026, 10, 2).serial, 46297);
      expect(const Day(1900, 3, 1).serial, 61);
      expect(Day.fromSerial(46297), const Day(2026, 10, 2));
      // The fraction is the time of day.
      expect(Day.fromSerial(46297.75), const Day(2026, 10, 2));
      expect(Day.fromSerial(0), isNull);
      for (final d in [const Day(2024, 2, 29), const Day(2026, 3, 29), const Day(2026, 12, 31)]) {
        expect(Day.fromSerial(d.serial), d);
      }
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
        ['c', 'C', 'yesno', '', '', '', 'check', true],
        ['', '', '', '', '', '', '', false],
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
      // A no day shows like a day without a value.
      expect(dayValues(meditate, p.table.entries).keys, [const Day(2026, 9, 27), d28, d30]);
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

  group('plan writes', () {
    final log = parseLog([
      ['date', 'weight', 'meditate', 'water'],
      ['2026-09-30', 82.1, 1],
    ], metrics).table;

    test('yesno: check writes yes, uncheck writes no, no change returns null', () {
      expect(
        planYesNo(meditate, d30, false, log),
        isA<SetCell>().having((w) => (w.row, w.column, w.value), 'cell', (2, 2, 'no')),
      );
      // The log has the old value 1 on 2026-09-30. It is yes, so a check changes nothing.
      expect(planYesNo(meditate, d30, true, log), isNull);
    });

    test('a day without a row gets a new row', () {
      expect(
        planYesNo(meditate, d29, true, log),
        isA<AppendRow>().having((w) => w.toCells(), 'cells', ['2026-09-29', '', 'yes']),
      );
      expect(
        planYesNo(meditate, d29, false, log),
        isA<AppendRow>().having((w) => w.toCells(), 'cells', ['2026-09-29', '', 'no']),
      );
    });

    test('cellValue: yes and no for yesno, the number for number metrics', () {
      expect([cellValue(meditate, 1), cellValue(meditate, 0), cellValue(meditate, null)], ['yes', 'no', null]);
      expect([cellValue(weight, 81.9), cellValue(water, null)], [81.9, null]);
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

    test('count: applies the taps to the latest value', () {
      expect(
        planCount(water, d30, const [CountStep.add(1), CountStep.add(1)], log),
        isA<SetCell>().having((w) => (w.row, w.column, w.value), 'cell', (2, 3, 2)),
      );
      expect(
        planCount(water, d29, const [CountStep.add(1)], log),
        isA<AppendRow>().having((w) => w.toCells(), 'cells', ['2026-09-29', '', '', 1]),
      );
      expect(planCount(water, d29, const [CountStep.add(-1)], log), isNull);
    });

    test('throws if the metric has no column', () {
      const steps = NumberMetric(id: 'steps', name: 'Steps', icon: 'footprint');
      expect(() => planNumber(steps, d30, 1, log), throwsStateError);
    });
  });

  group('applyCountSteps', () {
    test('adds and subtracts', () {
      expect(applyCountSteps(null, const [CountStep.add(1)]), 1);
      expect(applyCountSteps(3, const [CountStep.add(-1)]), 2);
      expect(applyCountSteps(3, const [CountStep.add(1), CountStep.add(1), CountStep.add(-1)]), 4);
    });

    test('0 or less is an empty cell, also between steps', () {
      expect(applyCountSteps(1, const [CountStep.add(-1)]), isNull);
      expect(applyCountSteps(null, const [CountStep.add(-1)]), isNull);
      expect(applyCountSteps(null, const [CountStep.add(-1), CountStep.add(1)]), 1);
    });

    test('removes float noise from decimal steps', () {
      expect(applyCountSteps(0.2, const [CountStep.add(0.1)]), 0.3);
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
      ['steps', 'Steps', 'count', '', 100, '', 'footprint'],
    ]);
    expect(p.items.single, isA<NumberMetric>().having((m) => m.isCount, 'isCount', isTrue));
  });

  test('nearestDay: the nearest day before, else the nearest day after', () {
    final days = [d29, const Day(2026, 9, 25), const Day(2026, 10, 3), const Day(2026, 10, 1)];
    expect(nearestDay(days, d30), d29);
    expect(nearestDay(days, const Day(2026, 9, 20)), const Day(2026, 9, 25));
    expect(nearestDay([d30], d30), isNull);
    expect(nearestDay(const <Day>[], d30), isNull);
  });

  group('number input', () {
    test('parseDecimal reads a period or a comma, and rejects other text', () {
      expect(['81.9', '81,9', ' 82 ', '81.', ',5', '0'].map(parseDecimal), [81.9, 81.9, 82, 81, 0.5, 0]);
      expect(['', 'abc', '-1', '1.2.3', '8 1'].map(parseDecimal), everyElement(isNull));
    });

    test('stepDecimals', () {
      expect([0.1, 0.25, 5, 1.0, 250].map(stepDecimals), [1, 2, 0, 0, 0]);
    });

    test('roundToStep removes float noise, snaps to the step, and is never below 0', () {
      expect(roundToStep(81.9 + 0.1, 0.1), 82.0);
      expect(roundToStep(81.93, 0.1, snap: true), 81.9);
      expect(roundToStep(1237, 250, snap: true), 1250);
      expect(roundToStep(-0.3, 0.1), 0);
    });

    test('formatStep and formatShort', () {
      expect([formatStep(82, 0.1), formatStep(1250, 250), formatStep(90.5, 0.5)], ['82.0', '1250', '90.5']);
      expect([formatShort(82.0), formatShort(2.5), formatShort(2500)], ['82', '2.5', '2500']);
    });
  });

  group('DoubleTap', () {
    const wait = Duration(milliseconds: 50);
    Future<void> pause([int ms = 80]) => Future.delayed(Duration(milliseconds: ms));

    late List<String> events;
    late DoubleTap<String> taps;
    void tap(String key) => taps.tap(key, onSingle: () => events.add('$key+'), onDouble: () => events.add('$key-'));

    setUp(() {
      events = [];
      taps = DoubleTap(wait: wait);
    });
    tearDown(() => taps.dispose());

    test('a single tap runs after the wait', () async {
      tap('a');
      expect(events, isEmpty);
      await pause();
      expect(events, ['a+']);
    });

    test('two quick taps are a double-tap, without the single tap', () async {
      tap('a');
      tap('a');
      await pause();
      expect(events, ['a-']);
    });

    test('a tap on another key runs the waiting single tap at once', () async {
      tap('a');
      tap('b');
      expect(events, ['a+']);
      await pause();
      expect(events, ['a+', 'b+']);
    });

    test('3 quick taps are a double-tap and a single tap', () async {
      tap('a');
      tap('a');
      tap('a');
      await pause();
      expect(events, ['a-', 'a+']);
    });

    test('slow taps are single taps', () async {
      tap('a');
      await pause();
      tap('a');
      await pause();
      expect(events, ['a+', 'a+']);
    });

    test('flush runs the waiting single tap at once, and only once', () async {
      tap('a');
      taps.flush();
      expect(events, ['a+']);
      await pause();
      taps.flush();
      expect(events, ['a+']);
    });
  });
}
