import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/log_entry.dart';
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

  group('plan writes', () {
    final log = parseLog([
      ['date', 'weight', 'meditate', 'water'],
      ['2026-09-30', 82.1, 1],
    ], metrics).table;

    test('yesno: check writes yes, uncheck writes no, no change returns null', () {
      expect(
        planYesNo(meditate, d30, log, done: false),
        isA<SetCell>().having((w) => (w.row, w.column, w.value), 'cell', (2, 2, 'no')),
      );
      // The log has the old value 1 on 2026-09-30. It is yes, so a check changes nothing.
      expect(planYesNo(meditate, d30, log, done: true), isNull);
    });

    test('a day without a row gets a new row', () {
      expect(
        planYesNo(meditate, d29, log, done: true),
        isA<AppendRow>().having((w) => w.toCells(), 'cells', ['2026-09-29', '', 'yes']),
      );
      expect(
        planYesNo(meditate, d29, log, done: false),
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
}
